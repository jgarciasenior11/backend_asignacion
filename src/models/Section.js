import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    jornadaCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
  },
  capacity: {
    type: Number,
    min: 0,
    default: 0,
  },
  semester: {
    type: Number,
    min: 1,
    max: 12,
    default: 1,
  },
  createdBy: {
    type: String,
    trim: true,
    default: '',
  },
  },
  {
    timestamps: true,
  },
);

sectionSchema.index({ name: 1, jornadaCode: 1 });

const Section = mongoose.model('Section', sectionSchema);

export default Section;
