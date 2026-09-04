import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const EXTRACTION_PROMPT = `You are an expert gold-trade document parser.
Extract every relevant field from this gold transaction bill/receipt/invoice and return ONLY a single valid JSON object — no markdown fences, no prose, just raw JSON.

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
- Purity: 999/999.9 → 24K, 916 → 22K, 875 → 21K, 750 → 18K, 583 → 14K
- WeightUnit: tola is common in South Asian/Middle East receipts
- Purchase receipt → type "buy"; sale → type "sell"; if unclear → "buy" + add "type" to lowConfidenceFields
- If you cannot clearly read a field → set null AND add field name to lowConfidenceFields
- Never invent values — only extract what is visible
- Return ONLY the JSON object, nothing else`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    console.error('[scan] GOOGLE_AI_KEY is not set');
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

  // Convert image to base64 for Gemini inline data
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');

  // gemini-3.6-flash — as recommended by Google's own API error message for new users
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  let rawText: string;
  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,   // increased — 512 caused JSON truncation
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[scan] Gemini API error:', response.status, errBody);
      return NextResponse.json(
        { error: `AI service error (${response.status}). Check your GOOGLE_AI_KEY and try again.` },
        { status: 502 }
      );
    }

    const data = await response.json();
    rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) {
      console.error('[scan] Empty response from Gemini:', JSON.stringify(data));
      return NextResponse.json({ error: 'AI returned an empty response. Try a clearer image.' }, { status: 422 });
    }
  } catch (err) {
    console.error('[scan] Fetch to Gemini failed:', err);
    return NextResponse.json({ error: 'Failed to reach AI service. Check network.' }, { status: 502 });
  }

  // Robustly extract the JSON object from the response.
  // The model is instructed to return only JSON, but defensively handle
  // markdown fences or surrounding prose by finding the first { ... } block.
  function extractJson(text: string): string {
    // 1. Strip markdown fences
    let s = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    // 2. Find first { and last } — handles any surrounding text
    const start = s.indexOf('{');
    const end   = s.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      s = s.slice(start, end + 1);
    }
    return s;
  }

  const cleaned = extractJson(rawText);

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(cleaned);
  } catch {
    console.error('[scan] Failed to parse Gemini response:', rawText);
    return NextResponse.json(
      { error: 'AI returned an unreadable response. Try a clearer image.' },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true, data: extracted });
}
