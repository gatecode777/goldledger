import mongoose, { Schema, model, models } from 'mongoose';

const TransactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['buy', 'sell'],
      required: true,
    },
    goldPricePerUnit: { type: Number, required: true },
    marketRate: { type: Number, required: true },
    purity: {
      type: String,
      enum: ['24K 999', '24K 995', '24K 991'],
      required: true,
    },
    customPurity: { type: String },
    weight: { type: Number, required: true },
    weightUnit: {
      type: String,
      enum: ['gram', 'troy_oz', 'tola'],
      required: true,
    },
    dateTime: { type: String, required: true },
    currency: { type: String, required: true },
    counterparty: { type: String, default: '' },
    notes: { type: String, default: '' },
    paymentType: {
      type: String,
      enum: ['Cash', 'RTGS'],
      default: 'Cash',
    },
    transactionId: { type: String, default: '' },
    source: {
      type: String,
      default: 'manual',
    },
    totalValue: { type: Number, required: true },
    lowConfidenceFields: { type: [String], default: undefined },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent model re-compilation issues while allowing schema updates in dev
if (process.env.NODE_ENV !== 'production' && models.Transaction) {
  delete (models as any).Transaction;
}
const TransactionModel =
  (models.Transaction as mongoose.Model<mongoose.Document>) ||
  model('Transaction', TransactionSchema);

export default TransactionModel;
