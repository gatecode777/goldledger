import mongoose, { Schema, model, models } from 'mongoose';

const RateSettingsSchema = new Schema(
  {
    referenceRateUSD: { type: Number, required: true },
    lastUpdated: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const RateSettingsModel =
  (models.RateSettings as mongoose.Model<mongoose.Document>) ||
  model('RateSettings', RateSettingsSchema);

export default RateSettingsModel;
