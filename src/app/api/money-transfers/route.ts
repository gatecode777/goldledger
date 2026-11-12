import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import MoneyTransferModel from '@/lib/models/MoneyTransfer.model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/money-transfers — fetch all
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const transfers = await MoneyTransferModel.find({}).sort({ dateTime: -1 }).lean();

    const serialized = transfers.map((t) => ({
      ...t,
      id: (t._id as object).toString(),
      _id: undefined,
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error('[GET /api/money-transfers]', err);
    return NextResponse.json({ error: 'Failed to fetch gold transfers' }, { status: 500 });
  }
}

// POST /api/money-transfers — create
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    await connectDB();
    const transfer = await MoneyTransferModel.create(body);
    const serialized = { ...transfer.toObject(), id: transfer._id.toString(), _id: undefined };
    return NextResponse.json(serialized, { status: 201 });
  } catch (err) {
    console.error('[POST /api/money-transfers]', err);
    return NextResponse.json({ error: 'Failed to create gold transfer' }, { status: 500 });
  }
}

// DELETE /api/money-transfers — bulk delete
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
    await MoneyTransferModel.deleteMany({ _id: { $in: ids } });
    return NextResponse.json({ success: true, count: ids.length });
  } catch (err) {
    console.error('[DELETE /api/money-transfers]', err);
    return NextResponse.json({ error: 'Failed to delete gold transfers' }, { status: 500 });
  }
}

