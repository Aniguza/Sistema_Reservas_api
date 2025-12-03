import { Schema } from 'mongoose';

export const aulasSchema = new Schema({
  name: { type: String, required: true },
  codigo: { type: String, required: false },
  description: { type: String, required: false },
  imageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  disponibilidad: { type: Boolean, required: false, default: true  },
  equipos: [{ type: Schema.Types.ObjectId, ref: 'Equipo', required: false }],
});