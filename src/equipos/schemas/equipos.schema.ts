import { Schema } from 'mongoose';

export const equiposSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: false },
  especifications: { type: String, required: false },
  quantity: { type: Number, required: false},
  imageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  category: { type: String, required: false },
  disponibilidad: { 
    type: String, 
    enum: ['disponible', 'no disponible', 'ocupado', 'en mantenimiento'],
    required: false, 
    default: 'disponible' 
  },
});