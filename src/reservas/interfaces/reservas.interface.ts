import { Document } from 'mongoose';

export interface Incidencia {
    descripcion: string;
    tipo: 'tecnica' | 'administrativa' | 'limpieza' | 'otra';
    prioridad: 'baja' | 'media' | 'alta' | 'critica';
    estado: 'reportada' | 'en_revision' | 'en_proceso' | 'resuelta' | 'cerrada';
    resolucion?: string;
    reportadoPor: string;
    reportadoEn?: Date;
    actualizadoEn?: Date;
    _id?: string;
}

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
    estado: 'pendiente' | 'confirmada' | 'en_curso' | 'cancelada' |  'cerrada' | 'cerrada_con_incidencia';
    incidencias?: Incidencia[];
    createdAt?: Date;
    updatedAt?: Date;
}
