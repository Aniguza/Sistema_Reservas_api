import { Document } from 'mongoose';

export interface Equipo extends Document {
  name: string;
  description?: string;
  especifications?: string;
  quantity?: number;
  imageUrl?: string;
  createdAt?: Date;
  category?: string;
  disponibilidad?: boolean;
}