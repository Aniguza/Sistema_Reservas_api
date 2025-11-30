import { Document } from 'mongoose';

export interface Reserva extends Document {
    nombre: string;
    correo: string;
    companeros?: string[]; // Array de códigos universitarios
    tipo: 'aula' | 'equipo';
    aulas?: string[]; // Array de IDs de aulas
    equipos?: string[]; // Array de IDs de equipos
    fecha: Date;
    horaInicio: string;
    horaFin: string;
    motivo: string;
    estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
    createdAt?: Date;
    updatedAt?: Date;
}
