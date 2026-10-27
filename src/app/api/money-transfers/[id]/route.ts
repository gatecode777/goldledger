import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import MoneyTransferModel from '@/lib/models/MoneyTransfer.model';

export const dynamic = 'force-dynamic';

// PUT /api/money-transfers/:id — update
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    await connectDB();
    const updated = await MoneyTransferModel.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const serialized = { ...updated, id: (updated._id as object).toString(), _id: undefined };
    return NextResponse.json(serialized);
  } catch (err) {
    console.error('[PUT /api/money-transfers/:id]', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/money-transfers/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();
    await MoneyTransferModel.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/money-transfers/:id]', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

