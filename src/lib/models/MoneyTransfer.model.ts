import mongoose, { Schema, model, models } from 'mongoose';

const MoneyTransferSchema = new Schema(
  {
    transferType:       { type: String, enum: ['receive', 'send', 'both'], default: 'both' },
    senderName:         { type: String, default: '', trim: true },
    receiverName:       { type: String, default: '', trim: true },
    amount:             { type: Number, required: true },
    currency:           { type: String, required: true, default: 'INR' },
    senderFeePercent:   { type: Number, required: true, default: 0.1 },
    receiverFeePercent: { type: Number, required: true, default: 0.05 },
    senderFee:          { type: Number, required: true, default: 0 },
    receiverFee:        { type: Number, required: true, default: 0 },
    netProfit:          { type: Number, required: true, default: 0 },
    amountDelivered:    { type: Number, required: true, default: 0 },
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

