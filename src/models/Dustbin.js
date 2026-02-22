import mongoose from 'mongoose';

const dustbinSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    area: { type: String, required: true },
    
    // ✅ NEW: Flask model ko prediction ke liye ye chahiye
    location_type: { 
      type: String, 
      enum: ['Residential', 'Commercial', 'Industrial'], 
      default: 'Residential' 
    },
    
    size: { type: String, enum: ['Small', 'Medium', 'Large'], default: 'Medium' },
    
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },

    currentLevel: { type: Number, default: 0 }, // 0 to 100 percentage
    
    // ✅ NEW: Model se aane wali priority yahan store ho sakti hai
    priority_score: { type: Number, default: 0 }, 

    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    
    // Past collection ka data
    history: [
      {
        fillLevel: Number,
        collectedAt: { type: Date, default: Date.now },
        collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ]
  },
  { timestamps: true }
);

const Dustbin = mongoose.model('Dustbin', dustbinSchema);
export default Dustbin;