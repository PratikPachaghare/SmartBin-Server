import mongoose from 'mongoose';

const binHistorySchema = new mongoose.Schema({
  bin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Dustbin', required: true },
  timestamp: { type: Date, default: Date.now },
  location_type: { type: String, required: true },
  fill_percent: { type: Number, required: true },
  is_weekend: { type: Number, enum: [0, 1], required: true }, // 1 for Sat/Sun, 0 for others
  hours_to_full: { type: Number, default: 0 } // Machine Learning target variable
});

const BinHistory = mongoose.model('BinHistory', binHistorySchema);
export default BinHistory;