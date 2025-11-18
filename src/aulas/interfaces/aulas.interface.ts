import { Document } from 'mongoose';

export interface Aula extends Document {
    name: string;
    codigo?: string;
    description?: string;
    imageUrl?: string;
    createdAt?: Date;
    equipos?: string[];
}