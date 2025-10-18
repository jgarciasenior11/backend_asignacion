import mongoose from 'mongoose';

const jornadaSchema = new mongoose.Schema(
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
    locationCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
    managerId: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

jornadaSchema.index({ name: 1 });

const Jornada = mongoose.model('Jornada', jornadaSchema);

export default Jornada;
