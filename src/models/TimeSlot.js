import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    day: {
      type: String,
      required: true,
      trim: true,
    },
    start: {
      type: String,
      required: true,
      trim: true,
    },
    end: {
      type: String,
      required: true,
      trim: true,
    },
    jornadaCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
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

timeSlotSchema.index({ jornadaCode: 1, day: 1, start: 1 });

const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

export default TimeSlot;
