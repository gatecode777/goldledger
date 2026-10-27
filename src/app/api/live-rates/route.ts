import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface CountryGoldRate {
  country: string;
  code: string;
  symbol: string;
  flag: string;
  exchangeRateToUSD: number;
  pricePerTroyOz: number;
  pricePerGram999: number;
  pricePerGram995: number;
  pricePerGram991: number;
  pricePerTola999: number;
  pricePerTael999?: number;
}

export interface LiveRatesResponse {
  success: boolean;
  baseUSDPerOz: number;
  timestamp: string;
  source: string;
  cached: boolean;
  countries: CountryGoldRate[];
}

// In-memory cache to prevent hitting free rate limits too frequently
let cachedData: {
  timestamp: number;
  payload: LiveRatesResponse;
} | null = null;

const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

const DEFAULT_FX_RATES: Record<string, number> = {
  USD: 1,
  INR: 83.5,
  ZAR: 18.9,
  AED: 3.6725,
  HKD: 7.83,
  EUR: 0.92,
  CNY: 7.24,
};

export async function GET(req: Request) {
  // Session is optional for public market commodity rates
  const session = await auth().catch(() => null);

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  const now = Date.now();
  if (!forceRefresh && cachedData && now - cachedData.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cachedData.payload, cached: true });
  }

  let baseUSD = 0;
  let fxRates = { ...DEFAULT_FX_RATES };
  let apiSource = 'gold-api.com (Real-Time)';

  // 1. Try real-time primary endpoints: api.gold-api.com + open.er-api.com
  try {
    const [goldRes, fxRes] = await Promise.allSettled([
      fetch('https://api.gold-api.com/price/XAU', {
        headers: { 'User-Agent': 'GoldTransactionApp/1.0' },
        signal: AbortSignal.timeout(4500),
      }),
      fetch('https://open.er-api.com/v6/latest/USD', {
        headers: { 'User-Agent': 'GoldTransactionApp/1.0' },
        signal: AbortSignal.timeout(4500),
      }),
    ]);

    if (goldRes.status === 'fulfilled' && goldRes.value.ok) {
      const gData = await goldRes.value.json();
      if (typeof gData.price === 'number' && gData.price > 0) {
        baseUSD = gData.price;
      }
    }

    if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
      const fData = await fxRes.value.json();
      if (fData.rates && typeof fData.rates === 'object') {
        fxRates = {
          ...fxRates,
          ...fData.rates,
          AED: fData.rates.AED || 3.6725, // Pegged rate safeguard
        };
      }
    }
  } catch (err) {
    console.warn('[live-rates] Primary API fetch error:', err);
  }

  // 2. Fallback to free CDN currency API if primary spot rate was unreachable
  if (!baseUSD) {
    try {
      const cdnRes = await fetch(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json',
        { signal: AbortSignal.timeout(4500) }
      );
      if (cdnRes.ok) {
        const cdnData = await cdnRes.json();
        if (cdnData.xau?.usd && cdnData.xau.usd > 0) {
          baseUSD = cdnData.xau.usd;
          apiSource = 'jsdelivr currency-api (Daily Spot)';
          if (cdnData.xau.inr) fxRates.INR = cdnData.xau.inr / baseUSD;
          if (cdnData.xau.aed) fxRates.AED = cdnData.xau.aed / baseUSD;
          if (cdnData.xau.zar) fxRates.ZAR = cdnData.xau.zar / baseUSD;
          if (cdnData.xau.hkd) fxRates.HKD = cdnData.xau.hkd / baseUSD;
          if (cdnData.xau.eur) fxRates.EUR = cdnData.xau.eur / baseUSD;
          if (cdnData.xau.cny) fxRates.CNY = cdnData.xau.cny / baseUSD;
        }
      }
    } catch (cdnErr) {
      console.warn('[live-rates] Secondary CDN fetch error:', cdnErr);
    }
  }

  // 3. Absolute safety baseline if all external services are unreachable
  if (!baseUSD) {
    baseUSD = 2700;
    apiSource = 'offline baseline fallback';
  }

  // TROY OUNCE = 31.1035 grams
  // TOLA = 11.6638 grams
  // TAEL (Hong Kong) = 37.429 grams
  const COUNTRY_METADATA = [
    { country: 'India',        code: 'INR', symbol: '₹',   flag: '🇮🇳' },
    { country: 'South Africa', code: 'ZAR', symbol: 'R',   flag: '🇿🇦' },
    { country: 'UAE',          code: 'AED', symbol: 'AED', flag: '🇦🇪' },
    { country: 'USA',          code: 'USD', symbol: '$',   flag: '🇺🇸' },
    { country: 'Hong Kong',    code: 'HKD', symbol: 'HK$', flag: '🇭🇰' },
    { country: 'Europe',       code: 'EUR', symbol: '€',   flag: '🇪🇺' },
    { country: 'China',        code: 'CNY', symbol: '¥',   flag: '🇨🇳' },
  ];

  const countries: CountryGoldRate[] = COUNTRY_METADATA.map((meta) => {
    const fx = meta.code === 'USD' ? 1 : (fxRates[meta.code] || DEFAULT_FX_RATES[meta.code] || 1);
    const oz = baseUSD * fx;
    const g999 = oz / 31.1035;
    const g995 = g999 * (995 / 999);
    const g991 = g999 * (991 / 999);
    const tola = g999 * 11.6638;
    const tael = g999 * 37.429;

    return {
      country: meta.country,
      code: meta.code,
      symbol: meta.symbol,
      flag: meta.flag,
      exchangeRateToUSD: fx,
      pricePerTroyOz: oz,
      pricePerGram999: g999,
      pricePerGram995: g995,
      pricePerGram991: g991,
      pricePerTola999: tola,
      pricePerTael999: meta.code === 'HKD' ? tael : undefined,
    };
  });

  const payload: LiveRatesResponse = {
    success: true,
    baseUSDPerOz: baseUSD,
    timestamp: new Date().toISOString(),
    source: apiSource,
    cached: false,
    countries,
  };

  cachedData = {
    timestamp: now,
    payload,
  };

  return NextResponse.json(payload);
}
