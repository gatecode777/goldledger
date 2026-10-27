import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import CounterpartyModel from '@/lib/models/Counterparty.model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  params: Promise<{ id: string }>;
}

// PUT /api/counterparties/[id] — update counterparty details (name, price, etc.)
export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();

    await connectDB();
    const updated = await CounterpartyModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Counterparty not found' }, { status: 404 });
    }

    const serialized = { ...updated.toObject(), id: updated._id.toString(), _id: undefined };
    return NextResponse.json(serialized);
  } catch (err: any) {
    console.error('[PUT /api/counterparties/[id]]', err);
    return NextResponse.json({ error: err.message || 'Failed to update counterparty' }, { status: 500 });
  }
}

// DELETE /api/counterparties/[id] — delete counterparty
export async function DELETE(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();
    const deleted = await CounterpartyModel.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Counterparty not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Counterparty deleted' });
  } catch (err) {
    console.error('[DELETE /api/counterparties/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete counterparty' }, { status: 500 });
  }
}
