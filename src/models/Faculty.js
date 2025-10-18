import mongoose from 'mongoose';

const facultySchema = new mongoose.Schema(
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
    dean: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

facultySchema.index({ name: 1 });

const Faculty = mongoose.model('Faculty', facultySchema);

export default Faculty;
