import { Schema } from 'mongoose';

export const equiposSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: false },
  imageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});