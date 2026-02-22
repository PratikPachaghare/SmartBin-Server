import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'worker', 'user'], default: 'worker' },
    area: { type: String },
    phone: { type: String },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    tasksCompleted: { type: Number, default: 0 }, // Worker ke liye task completion count track karne ke liye
    // ✅ NEW: Location fields for User/Worker tracking
    location: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 }
    },
    // ✅ NEW: Tracking kab update hui thi
    lastActive: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

// Password hashing logic
// 'next' ko parameter se hata diya gaya hai
userSchema.pre('save', async function () {
  try {
    // Agar password modify nahi hua, toh function yahi ruk jayega (Modern equivalent of next())
    if (!this.isModified('password')) return;

    // Password hashing logic
    const hash = await bcrypt.hash(this.password, SALT_ROUNDS);
    this.password = hash;
    
    // Yahan next() call karne ki zaroorat nahi hai, async function apne aap resolve ho jayega
  } catch (err) {
    // Error aane par throw karein, Mongoose ise automatically handle kar lega
    throw new Error(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)
export default User