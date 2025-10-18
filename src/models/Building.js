import mongoose from 'mongoose';

const buildingSchema = new mongoose.Schema(
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
    locationCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    levels: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

buildingSchema.index({ name: 1, locationCode: 1 });

const Building = mongoose.model('Building', buildingSchema);

export default Building;
