import { Document } from 'mongoose';

export interface Equipo extends Document {
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt?: Date;
  category?: string;
  disponibilidad?: boolean;
}