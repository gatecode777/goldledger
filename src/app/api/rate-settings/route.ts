import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import RateSettingsModel from '@/lib/models/RateSettings.model';

// GET /api/rate-settings
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const settings = await RateSettingsModel.findOne({}).lean();
    if (!settings) {
      return NextResponse.json({ error: 'Rate settings not found' }, { status: 404 });
    }
    return NextResponse.json(settings);
  } catch (err) {
    console.error('[GET /api/rate-settings]', err);
    return NextResponse.json({ error: 'Failed to fetch rate settings' }, { status: 500 });
  }
}

// POST /api/rate-settings — upsert the single rate document
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    await connectDB();
    const settings = await RateSettingsModel.findOneAndUpdate(
      {},
      { referenceRateUSD: body.referenceRateUSD, lastUpdated: body.lastUpdated },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json(settings);
  } catch (err) {
    console.error('[POST /api/rate-settings]', err);
    return NextResponse.json({ error: 'Failed to update rate settings' }, { status: 500 });
  }
}
