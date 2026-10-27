import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import TransactionModel from '@/lib/models/Transaction.model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/transactions/import — bulk insert transactions from Excel
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const transactions = body.transactions;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided to import' }, { status: 400 });
    }

    // Sanitize and ensure proper defaults
    const cleaned = transactions.map((tx: any) => ({
      type: tx.type === 'sell' ? 'sell' : 'buy',
      goldPricePerUnit: Number(tx.goldPricePerUnit) || 0,
      marketRate: Number(tx.marketRate) || 2355,
      purity: (['24K 999', '24K 995', '24K 991'].includes(tx.purity) ? tx.purity : '24K 999'),
      customPurity: tx.customPurity || undefined,
      weight: Number(tx.weight) || 0,
      weightUnit: tx.weightUnit || 'gram',
      dateTime: tx.dateTime || new Date().toISOString(),
      currency: (tx.currency || 'USD').toUpperCase(),
      counterparty: (tx.counterparty || '').trim(),
      paymentType: tx.paymentType === 'RTGS' ? 'RTGS' : 'Cash',
      transactionId: (tx.transactionId || '').trim(),
      notes: (tx.notes || '').trim(),
      source: 'import',
      totalValue: Number(tx.totalValue) || (Number(tx.goldPricePerUnit) * Number(tx.weight)) || 0,
    }));

    await connectDB();
    const created = await TransactionModel.create(cleaned as any);
    const createdList = Array.isArray(created) ? created : [created];

    const serialized = createdList.map((tx: any) => ({
      ...tx.toObject(),
      id: tx._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json({
      success: true,
      count: serialized.length,
      transactions: serialized,
      message: `Successfully imported ${serialized.length} transactions.`,
    });
  } catch (err: any) {
    console.error('[POST /api/transactions/import]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to import transactions' },
      { status: 500 }
    );
  }
}

