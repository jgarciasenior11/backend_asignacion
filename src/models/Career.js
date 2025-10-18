import mongoose from 'mongoose';

const careerSchema = new mongoose.Schema(
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
    description: {
      type: String,
      default: '',
      trim: true,
    },
    facultyCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    levels: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

careerSchema.index({ name: 1 });

const Career = mongoose.model('Career', careerSchema);

export default Career;
