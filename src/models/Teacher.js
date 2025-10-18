import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
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
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    specialty: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    careerCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subjectCodes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

teacherSchema.index({ lastName: 1, firstName: 1 });

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;
