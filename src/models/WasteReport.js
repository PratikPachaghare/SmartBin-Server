import mongoose from 'mongoose';
// Define the schema for a waste report
const wasteReportSchema = new mongoose.Schema({
  userId: {
    type: String, // Or mongoose.Schema.Types.ObjectId if referencing a User model
    required: true,
  },
  imageUrl: {
    type: String, // Store the server path or URL to the image
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'], // Denotes GeoJSON Point
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  // Status of the verification process
  status: {
    type: String,
    enum: ['pending', 'valid', 'invalid'],
    default: 'pending',
  },
  // Result from the AI/Model verification (if any)
  modelResult: {
    garbageStrash: {
      detected: Boolean,
      confidence: Number,
    },
  },
  // Feedback from the human worker
  workerFeedback: {
    workerId: String,
    decision: String, // 'valid', 'invalid', etc.
    verifiedAt: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for geospatial queries (e.g., find reports near a location)
wasteReportSchema.index({ location: '2dsphere' });

const WasteReport = mongoose.model('WasteReport', wasteReportSchema);

export default WasteReport;