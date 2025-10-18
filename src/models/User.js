import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['admin', 'coordinator', 'teacher', 'viewer'],
      default: 'viewer',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ fullName: 1 });

const User = mongoose.model('User', userSchema);

export default User;
