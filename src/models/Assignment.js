import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    teacherCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    classroomCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    timeSlotCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    jornadaCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sectionCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  period: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  matrixId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  semester: {
    type: Number,
    min: 1,
    max: 12,
    default: 1,
  },
    notes: {
      type: String,
      trim: true,
      default: '',
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

assignmentSchema.index({ period: 1, timeSlotCode: 1, teacherCode: 1 }, { unique: true });
assignmentSchema.index({ period: 1, timeSlotCode: 1, classroomCode: 1 }, { unique: true });
assignmentSchema.index({ period: 1, timeSlotCode: 1, sectionCode: 1 }, { unique: true });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
