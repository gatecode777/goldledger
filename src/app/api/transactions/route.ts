import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import TransactionModel from '@/lib/models/Transaction.model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/transactions — fetch all transactions
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const transactions = await TransactionModel.find({})
      .sort({ dateTime: -1 })
      .lean();

    // Serialize _id to id string
    const serialized = transactions.map((tx) => ({
      ...tx,
      id: (tx._id as object).toString(),
      _id: undefined,
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error('[GET /api/transactions]', err);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST /api/transactions — create a new transaction
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    await connectDB();
    const tx = await TransactionModel.create(body);
    const serialized = { ...tx.toObject(), id: tx._id.toString(), _id: undefined };
    return NextResponse.json(serialized, { status: 201 });
  } catch (err) {
    console.error('[POST /api/transactions]', err);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
