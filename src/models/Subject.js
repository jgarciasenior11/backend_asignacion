import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
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
    careerCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    definitionType: {
      type: String,
      enum: ['credits', 'dependency'],
      default: 'credits',
    },
    credits: {
      type: Number,
      min: 0,
    },
    dependsOn: {
      type: String,
      trim: true,
      default: null,
    },
    semester: {
      type: Number,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

subjectSchema.index({ careerCode: 1, name: 1 });

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject;
