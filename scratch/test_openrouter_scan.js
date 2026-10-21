/**
 * Quick end-to-end test for the OpenRouter scan endpoint.
 * Run: node scratch/test_openrouter_scan.js
 */
const fs = require('fs');
const path = require('path');

// Load OPENROUTER_API_KEY from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = env.match(/^OPENROUTER_API_KEY=(.+)$/m);
if (!apiKeyMatch) {
  console.error('OPENROUTER_API_KEY not found in .env.local');
  process.exit(1);
}
const apiKey = apiKeyMatch[1].trim();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

const imagePath =
  'C:\\Users\\Balram Suman\\.gemini\\antigravity-ide\\brain\\fc1485c2-ce4b-41bb-9a78-471354368a3d\\.user_uploaded\\media_1792567781624.jpg';

const PROMPT = `You are an expert gold-trade document and handwriting parser.
Analyze this image and extract ALL gold transactions present.
Return ONLY a valid JSON object with a "transactions" array.
Each transaction: { "type": "buy"|"sell", "weight": <number>, "weightUnit": "gram"|"tola"|"troy_oz", "notes": "<text>" }
Return ONLY raw JSON, no markdown fences, no prose.`;

async function run() {
  console.log('Reading image from:', imagePath);
  const imgBuffer = fs.readFileSync(imagePath);
  const base64Data = imgBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Data}`;

  console.log('Calling OpenRouter...');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://gold-ledger.app',
      'X-Title': 'GoldLedger AI Scan Test',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0,
    }),
  });

  console.log('HTTP Status:', res.status);
  const data = await res.json();

  if (data.error) {
    console.error('API Error:', JSON.stringify(data.error, null, 2));
    return;
  }

  const rawText = data.choices?.[0]?.message?.content ?? '';
  console.log('\nRaw response text:\n', rawText);

  // Strip <think> blocks
  const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const start = Math.max(cleaned.indexOf('{'), cleaned.indexOf('['));
  const jsonStr = start >= 0 ? cleaned.slice(start, cleaned.lastIndexOf('}') + 1 || cleaned.lastIndexOf(']') + 1) : cleaned;

  try {
    const parsed = JSON.parse(jsonStr);
    const list = Array.isArray(parsed) ? parsed : (parsed.transactions || [parsed]);
    console.log(`\nParsed ${list.length} transaction(s):`);
    list.forEach((t, i) => console.log(`  #${i + 1}:`, t.type, t.weight, t.weightUnit, t.notes || ''));
  } catch (e) {
    console.error('JSON parse failed:', e.message);
    console.log('Cleaned text:', jsonStr);
  }
}

run().catch(console.error);
