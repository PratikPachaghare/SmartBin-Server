import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const publicUserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
}, { timestamps: true });

// Pre-save hook to hash the password before saving to the database
// Pre-save hook to hash the password before saving to the database
publicUserSchema.pre('save', async function() {
  // If the password isn't modified, stop here and let Mongoose continue
  if (!this.isModified('password')) return;
  
  // Since this is an async function, Mongoose will automatically catch any errors thrown here
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
// Method to compare incoming password with hashed password
publicUserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('PublicUser', publicUserSchema);