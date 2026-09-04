import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import TransactionModel from '@/lib/models/Transaction.model';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

// PUT /api/transactions/[id] — update transaction
export async function PUT(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await req.json();
    await connectDB();
    const updated = await TransactionModel.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const serialized = { ...updated, id: (updated._id as object).toString(), _id: undefined };
    return NextResponse.json(serialized);
  } catch (err) {
    console.error('[PUT /api/transactions/id]', err);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE /api/transactions/[id] — delete transaction
export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await connectDB();
    const deleted = await TransactionModel.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/transactions/id]', err);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
