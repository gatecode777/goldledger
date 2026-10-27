import mongoose, { Schema, model, models } from 'mongoose';

const MoneyTransferSchema = new Schema(
  {
    senderName:         { type: String, required: true, trim: true },
    receiverName:       { type: String, required: true, trim: true },
    amount:             { type: Number, required: true },
    currency:           { type: String, required: true, default: 'INR' },
    senderFeePercent:   { type: Number, required: true, default: 0.1 },
    receiverFeePercent: { type: Number, required: true, default: 0.05 },
    senderFee:          { type: Number, required: true },
    receiverFee:        { type: Number, required: true },
    netProfit:          { type: Number, required: true },
    amountDelivered:    { type: Number, required: true },
    paymentType:        { type: String, enum: ['Cash', 'RTGS'], default: 'Cash' },
    transactionId:      { type: String, default: '' },
    dateTime:           { type: String, required: true },
    notes:              { type: String, default: '' },
    status:             { type: String, enum: ['completed', 'pending', 'cancelled'], default: 'completed' },
  },
  { timestamps: true, versionKey: false }
);

// Prevent model re-compilation issues in dev
if (process.env.NODE_ENV !== 'production' && models.MoneyTransfer) {
  delete (models as any).MoneyTransfer;
}

const MoneyTransferModel =
  (models.MoneyTransfer as mongoose.Model<any>) ||
  model('MoneyTransfer', MoneyTransferSchema);

export default MoneyTransferModel;

