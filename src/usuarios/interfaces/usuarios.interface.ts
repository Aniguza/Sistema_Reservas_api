import { Document } from 'mongoose';

export interface Usuario extends Document {
    correo: string;
    nombre: string;
    carrera: string;
    rol: 'docente' | 'alumno' | 'administrador' | 'asistente';
    contraseña: string;
    createdAt?: Date;
    updatedAt?: Date;
}
