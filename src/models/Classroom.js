import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema(
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
    buildingCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    roomNumber: {
      type: String,
      default: '',
      trim: true,
    },
    capacity: {
      type: Number,
      default: 0,
      min: 0,
    },
    type: {
      type: String,
      default: '',
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

classroomSchema.index({ name: 1, buildingCode: 1 });

const Classroom = mongoose.model('Classroom', classroomSchema);

export default Classroom;
