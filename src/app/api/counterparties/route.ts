import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import CounterpartyModel from '@/lib/models/Counterparty.model';
import TransactionModel from '@/lib/models/Transaction.model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/counterparties — fetch all buyers and sellers (auto-seeds from existing txs if empty)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    let list = await CounterpartyModel.find({}).sort({ updatedAt: -1 }).lean();

    // If no counterparties exist yet, auto-populate from existing transactions
    if (list.length === 0) {
      const txs = await TransactionModel.find({
        counterparty: { $exists: true, $ne: '' },
      })
        .sort({ dateTime: -1 })
        .lean();

      const seen = new Set<string>();
      const toInsert: any[] = [];

      for (const t of txs as any[]) {
        const name = String(t.counterparty || '').trim();
        const key = name.toLowerCase();
        if (name && !seen.has(key)) {
          seen.add(key);
          toInsert.push({
            name,
            type: t.type === 'buy' ? 'seller' : 'buyer',
            defaultPrice: Number(t.goldPricePerUnit) || 0,
            currency: t.currency || 'USD',
            weightUnit: t.weightUnit || 'gram',
            notes: t.notes || '',
            lastUsedAt: t.dateTime || new Date().toISOString(),
          });
        }
      }

      if (toInsert.length > 0) {
        await CounterpartyModel.insertMany(toInsert);
        list = await CounterpartyModel.find({}).sort({ updatedAt: -1 }).lean();
      }
    }

    const serialized = list.map((item: any) => ({
      ...item,
      id: (item._id as object).toString(),
      _id: undefined,
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error('[GET /api/counterparties]', err);
    return NextResponse.json({ error: 'Failed to fetch counterparties' }, { status: 500 });
  }
}

// POST /api/counterparties — create or upsert counterparty
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type = 'buyer', defaultPrice = 0, currency = 'USD', weightUnit = 'gram', phone = '', notes = '' } = body;

    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Counterparty name is required' }, { status: 400 });
    }

    await connectDB();

    // Check if counterparty already exists (case-insensitive)
    const existing = await CounterpartyModel.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });

    const now = new Date().toISOString();

    if (existing) {
      let updatedType = existing.get('type') || type;
      if (updatedType !== type && updatedType !== 'both') {
        updatedType = 'both';
      }

      existing.set('defaultPrice', Number(defaultPrice) > 0 ? Number(defaultPrice) : existing.get('defaultPrice'));
      if (currency) existing.set('currency', currency);
      if (weightUnit) existing.set('weightUnit', weightUnit);
      if (phone !== undefined && phone !== '') existing.set('phone', phone);
      if (notes !== undefined && notes !== '') existing.set('notes', notes);
      existing.set('type', updatedType);
      existing.set('lastUsedAt', now);

      await existing.save();
      const serialized = { ...existing.toObject(), id: existing._id.toString(), _id: undefined };
      return NextResponse.json(serialized, { status: 200 });
    }

    // Create new
    const created = await CounterpartyModel.create({
      name: trimmedName,
      type,
      defaultPrice: Number(defaultPrice) || 0,
      currency,
      weightUnit,
      phone,
      notes,
      lastUsedAt: now,
    });

    const serialized = { ...created.toObject(), id: created._id.toString(), _id: undefined };
    return NextResponse.json(serialized, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/counterparties]', err);
    return NextResponse.json({ error: err.message || 'Failed to save counterparty' }, { status: 500 });
  }
}

// DELETE /api/counterparties — bulk delete counterparties
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }
    await connectDB();
    await CounterpartyModel.deleteMany({ _id: { $in: ids } });
    return NextResponse.json({ success: true, count: ids.length });
  } catch (err) {
    console.error('[DELETE /api/counterparties]', err);
    return NextResponse.json({ error: 'Failed to delete counterparties' }, { status: 500 });
  }
}
