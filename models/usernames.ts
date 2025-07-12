import mongoose from 'mongoose';

const UsernameSchema = new mongoose.Schema({
  username: {
    type: String,
    required: false,
    unique: true,
    trim: true,
  },
}, { timestamps: true });

export default mongoose.model('Username', UsernameSchema);
