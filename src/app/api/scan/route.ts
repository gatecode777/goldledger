import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Supported image MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// The structured extraction prompt sent to the vision model
const SYSTEM_PROMPT = `You are an expert gold-trade document parser.
The user uploads a photo of a gold transaction bill, receipt, invoice, or voucher.
Extract every relevant field and return ONLY a single valid JSON object — no markdown, no prose.

Return this exact structure:
{
  "type": "buy" | "sell",
  "weight": <number or null>,
  "weightUnit": "gram" | "tola" | "troy_oz" | null,
  "purity": "24K" | "22K" | "21K" | "18K" | "14K" | "custom" | null,
  "customPurity": "<string if purity is custom, else null>",
  "goldPricePerUnit": <number or null>,
  "currency": "<3-letter ISO code e.g. USD, INR, AED, SAR — uppercase>",
  "counterparty": "<shop/dealer name or null>",
  "dateTime": "<ISO 8601 datetime string or null>",
  "notes": "<any extra relevant info or empty string>",
  "totalValue": <number or null>,
  "lowConfidenceFields": ["<field names you are NOT confident about>"]
}

Rules:
- For purity: 999/999.9 → 24K, 916 → 22K, 875 → 21K, 750 → 18K, 583 → 14K
- For weightUnit: tola is common in South Asian/Middle East receipts; gram is most common globally
- If the bill is clearly a purchase receipt → type: "buy"; if it's a sale → type: "sell"; if unclear → "buy" with "type" in lowConfidenceFields
- If you cannot read a field clearly, set it to null AND add the field name to lowConfidenceFields
- Never invent values — only extract what is visible in the image
- Return ONLY the JSON object, nothing else`;

export async function POST(req: Request) {
  // Auth gate — API key must never be used from the browser
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[scan] OPENROUTER_API_KEY is not set');
    return NextResponse.json({ error: 'AI scan is not configured on this server' }, { status: 503 });
  }

  // Parse uploaded file
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

  // Convert to base64 data URL for the OpenRouter vision API
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUrl = `data:${file.type};base64,${base64}`;

  // Call OpenRouter vision API
  let rawText: string;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://goldledger.vercel.app',
        'X-Title': 'GoldLedger AI Scan',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
              {
                type: 'text',
                text: 'Extract the gold transaction details from this receipt/bill. Return only the JSON object.',
              },
            ],
          },
        ],
        temperature: 0,          // deterministic for data extraction
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[scan] OpenRouter error:', response.status, errText);
      return NextResponse.json(
        { error: `AI service error (${response.status}). Please try again.` },
        { status: 502 }
      );
    }

    const data = await response.json();
    rawText = data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    console.error('[scan] Fetch to OpenRouter failed:', err);
    return NextResponse.json({ error: 'Failed to reach AI service. Check network.' }, { status: 502 });
  }

  // Parse the JSON from the model response
  // The model is instructed to return only JSON, but defensively strip markdown fences
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(cleaned);
  } catch {
    console.error('[scan] Failed to parse model response:', rawText);
    return NextResponse.json(
      { error: 'AI returned an unreadable response. Try a clearer image.' },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true, data: extracted });
}
