import mongoose, { Schema, model, models } from 'mongoose';

const CounterpartySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['buyer', 'seller', 'both'],
      required: true,
      default: 'buyer',
    },
    defaultPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    weightUnit: {
      type: String,
      enum: ['gram', 'troy_oz', 'tola'],
      default: 'gram',
    },
    phone: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    lastUsedAt: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

if (process.env.NODE_ENV !== 'production' && models.Counterparty) {
  delete (models as any).Counterparty;
}

const CounterpartyModel =
  (models.Counterparty as mongoose.Model<any>) ||
  model('Counterparty', CounterpartySchema);

export default CounterpartyModel;
