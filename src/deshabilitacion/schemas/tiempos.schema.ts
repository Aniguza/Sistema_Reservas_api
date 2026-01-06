import { Schema } from 'mongoose';

export const TiempoDeshabilitacionSchema = new Schema(
  {
    motivo: { type: String, required: true, trim: true },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    activo: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  },
);
