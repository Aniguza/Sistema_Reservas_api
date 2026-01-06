import { Schema } from 'mongoose';

export const DeshabilitacionManualSchema = new Schema(
  {
    activa: { type: Boolean, default: false },
    activadoEn: { type: Date, default: null },
  },
  {
    timestamps: { updatedAt: 'updatedAt' },
    versionKey: false,
  },
);
