import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// OpenRouter endpoint — uses OpenAI-compatible Chat Completions API
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

// ─── Extraction Prompt ────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are an expert gold-trade document and handwriting parser.
Analyze this image (which may be a formal receipt/bill/invoice, or handwritten notes, ledger entries, or daily trade list with ONE OR MULTIPLE gold transactions).
Extract ALL gold transactions present in the image.

Return ONLY a valid JSON object with a "transactions" array. Do not include markdown fences, comments, or prose.

Expected JSON Structure:
{
  "transactions": [
    {
      "type": "buy" or "sell",
      "weight": <number>,
      "weightUnit": "gram" or "tola" or "troy_oz",
      "purity": "24K" or "22K" or "21K" or "18K" or "14K" or "custom" or null,
      "customPurity": null,
      "goldPricePerUnit": <number or null>,
      "currency": "<3-letter ISO code e.g. USD, INR, AED, SAR or null>",
      "counterparty": "<shop/dealer/customer name or null>",
      "dateTime": "<ISO 8601 datetime or null>",
      "notes": "<line item text or description>",
      "totalValue": <number or null>,
      "lowConfidenceFields": ["purity", "goldPricePerUnit"]
    }
  ]
}

Extraction Rules:
1. MULTIPLE ROWS: If the image has multiple handwritten or printed rows/entries (e.g. "SELL 10g", "BUY 5g", "BUY 11g", "SELL 9g"), create a separate transaction object in the "transactions" array for EACH individual row in the order they appear.
2. SINGLE BILL: If the image represents a single bill or invoice, return a "transactions" array with that single transaction object.
3. TYPE: "SELL", "sale", "out", "-" -> "sell"; "BUY", "purchase", "in", "+" -> "buy".
4. WEIGHT & UNIT: Extract numeric weight and unit ("gram", "tola", "troy_oz"). E.g. "10g" -> weight: 10, weightUnit: "gram".
5. PURITY: 999/999.9 -> "24K", 916 -> "22K", 875 -> "21K", 750 -> "18K", 583/585 -> "14K". If not visible, set purity to null and add "purity" to lowConfidenceFields.
6. Return ONLY the raw JSON object, nothing else.`;

// ─── JSON Extraction Helper ───────────────────────────────────────────────────
function extractJson(text: string): string {
  // Strip markdown code fences
  let s = text.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '').trim();

  // Strip <think>...</think> reasoning blocks (used by reasoning models)
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');

  let start = -1;
  let end = -1;

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    start = firstBracket;
    end = s.lastIndexOf(']');
  } else if (firstBrace !== -1) {
    start = firstBrace;
    end = s.lastIndexOf('}');
  }

  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return s;
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // Auth check
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // API key check
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[scan] OPENROUTER_API_KEY is not set');
    return NextResponse.json({ error: 'AI scan is not configured on this server' }, { status: 503 });
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('image') as File | null;
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  // Convert image to base64 data URL for OpenRouter vision input
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  const dataUrl = `data:${file.type};base64,${base64Data}`;

  // ─── Call OpenRouter API ────────────────────────────────────────────────────
  let rawText = '';
  try {
    let response: Response | null = null;
    let lastError = '';

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://gold-ledger.app',
            'X-Title': 'GoldLedger AI Scan',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: EXTRACTION_PROMPT,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: dataUrl,
                    },
                  },
                ],
              },
            ],
            max_tokens: 4096,
            temperature: 0,
          }),
        });

        if (response.ok) {
          break;
        }

        lastError = await response.text();
        console.warn(`[scan] OpenRouter attempt ${attempt} failed (${response.status}):`, lastError);

        // Retry on rate-limit or server error
        if (response.status === 429 || response.status === 503 || response.status === 500) {
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          // Non-retryable error (e.g. 401 bad key, 400 bad request)
          break;
        }
      } catch (err: any) {
        lastError = err?.message || 'Network error';
        console.warn(`[scan] OpenRouter attempt ${attempt} network error:`, lastError);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!response || !response.ok) {
      console.error('[scan] OpenRouter API error:', response?.status, lastError);
      return NextResponse.json(
        { error: `AI service error (${response?.status ?? 502}). Please try again in a moment.` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Standard OpenAI-compatible response format
    rawText = data.choices?.[0]?.message?.content ?? '';

    if (!rawText) {
      console.error('[scan] Empty response from OpenRouter:', JSON.stringify(data));
      return NextResponse.json(
        { error: 'AI returned an empty response. Try a clearer image.' },
        { status: 422 }
      );
    }
  } catch (err) {
    console.error('[scan] Fetch to OpenRouter failed:', err);
    return NextResponse.json({ error: 'Failed to reach AI service. Check network.' }, { status: 502 });
  }

  // ─── Parse JSON Response ────────────────────────────────────────────────────
  const cleaned = extractJson(rawText);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[scan] Failed to parse OpenRouter response:', rawText);
    return NextResponse.json(
      { error: 'AI returned an unreadable response. Try a clearer image.' },
      { status: 422 }
    );
  }

  // Handle { transactions: [...] }, [...], or single object
  let rawList: any[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && Array.isArray(parsed.transactions)) {
    rawList = parsed.transactions;
  } else if (parsed && typeof parsed === 'object') {
    rawList = [parsed];
  }

  if (rawList.length === 0) {
    return NextResponse.json(
      { error: 'No gold transactions could be detected from the image. Please try a clearer picture.' },
      { status: 422 }
    );
  }

  // ─── Normalize Transactions ─────────────────────────────────────────────────
  const normalizedTransactions = rawList.map((item: any) => {
    const lowConf: string[] = Array.isArray(item.lowConfidenceFields) ? [...item.lowConfidenceFields] : [];

    // Type
    let type: 'buy' | 'sell' = 'buy';
    const typeStr = String(item.type || item.action || item.notes || '').toLowerCase();
    if (typeStr.includes('sell') || typeStr.includes('sale') || typeStr.includes('sold')) {
      type = 'sell';
    } else if (typeStr.includes('buy') || typeStr.includes('purchase')) {
      type = 'buy';
    } else if (!item.type) {
      if (!lowConf.includes('type')) lowConf.push('type');
    }

    // Weight
    const rawW = item.weight ?? item.amount ?? item.qty;
    let weight = typeof rawW === 'number' ? rawW : parseFloat(String(rawW || '').replace(/,/g, ''));
    if (isNaN(weight) || weight <= 0) {
      const match = String(item.notes || rawW || '').match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram|tola|oz)/i);
      if (match) {
        weight = parseFloat(match[1]);
      } else {
        weight = 0;
        if (!lowConf.includes('weight')) lowConf.push('weight');
      }
    }

    // Weight Unit
    let weightUnit = 'gram';
    const unitStr = String(item.weightUnit || item.unit || item.notes || '').toLowerCase();
    if (unitStr.includes('tola')) weightUnit = 'tola';
    else if (unitStr.includes('oz') || unitStr.includes('ounce')) weightUnit = 'troy_oz';

    // Purity
    const purity = item.purity || '22K';
    if (!item.purity) {
      if (!lowConf.includes('purity')) lowConf.push('purity');
    }

    // Price Per Unit (defaults to 2355 if not detected)
    const rawP = item.goldPricePerUnit ?? item.price ?? item.rate;
    let price = typeof rawP === 'number' ? rawP : parseFloat(String(rawP || ''));
    if (isNaN(price) || price <= 0) {
      price = 2355;
      if (!lowConf.includes('goldPricePerUnit')) lowConf.push('goldPricePerUnit');
    }

    // Currency
    const currency = item.currency ? String(item.currency).toUpperCase() : 'USD';
    if (!item.currency && !lowConf.includes('currency')) {
      lowConf.push('currency');
    }

    // Total Value
    const totalValue = weight > 0 && price > 0 ? weight * price : (item.totalValue || 0);

    return {
      type,
      weight: weight > 0 ? weight : 0,
      weightUnit,
      purity,
      customPurity: item.customPurity || undefined,
      goldPricePerUnit: price,
      currency,
      counterparty: item.counterparty || '',
      dateTime: item.dateTime || new Date().toISOString(),
      notes: item.notes || `${type.toUpperCase()} ${weight}${weightUnit === 'gram' ? 'g' : ' ' + weightUnit}`,
      totalValue,
      lowConfidenceFields: lowConf,
    };
  });

  return NextResponse.json({
    success: true,
    count: normalizedTransactions.length,
    transactions: normalizedTransactions,
    data: normalizedTransactions[0], // Backwards-compatibility for single-result consumers
  });
}
