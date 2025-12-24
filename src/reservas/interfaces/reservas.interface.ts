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

export interface Reprogramacion {
    fechaReprogramacion: Date;
    fechaAnterior: Date;
    fechaNueva: Date;
    horaInicioAnterior: string;
    horaInicioNueva: string;
    horaFinAnterior: string;
    horaFinNueva: string;
    motivo?: string;
    _id?: string;
}

export interface Reserva extends Document {
    nombre: string;
    correo: string;
    companeros?: string[]; // Array de códigos universitarios
    tipo: 'aula' | 'equipo';
    aulas?: string[]; // Array de IDs de aulas
    equipos?: { equipo: string; nombre: string; cantidad: number }[]; // Array de equipos con nombre y cantidad
    fecha: Date;
    horaInicio: string;
    horaFin: string;
    motivo: string;
    codigo: string;
    estado: 'pendiente' | 'confirmada' | 'reprogramada' | 'en_curso' | 'cancelada' |  'cerrada' | 'cerrada_con_incidencia';
    incidencias?: Incidencia[];
    reprogramaciones?: Reprogramacion[];
    createdAt?: Date;
    updatedAt?: Date;
}
