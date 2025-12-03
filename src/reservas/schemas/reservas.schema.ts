import { Schema } from 'mongoose';

export const reservasSchema = new Schema({
  nombre: { type: String, required: true },
  correo: { type: String, required: true },
  companeros: [{ type: String, required: false }], // Array de códigos universitarios
  tipo: { type: String, enum: ['aula', 'equipo'], required: true },
  aulas: [{ type: Schema.Types.ObjectId, ref: 'Aula', required: false }], // Array de aulas
  equipos: [{ type: Schema.Types.ObjectId, ref: 'Equipo', required: false }], // Array de equipos
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true }, // Formato: "HH:mm"
  horaFin: { type: String, required: true }, // Formato: "HH:mm"
  motivo: { type: String, required: true },
  estado: {
    type: String,
    enum: ['confirmada', 'reprogramada', 'cancelada', 'cerrada', 'cerrada_con_incidencia'],
    default: 'confirmada'
  },
  incidencias: [{
    descripcion: { type: String, required: true },
    tipo: { 
      type: String, 
      enum: ['tecnica', 'administrativa', 'limpieza', 'otra'],
      required: true 
    },
    prioridad: { 
      type: String, 
      enum: ['baja', 'media', 'alta', 'critica'],
      default: 'media'
    },
    estado: {
      type: String,
      enum: ['reportada', 'en_revision', 'en_proceso', 'resuelta', 'cerrada'],
      default: 'reportada'
    },
    resolucion: { type: String, required: false },
    reportadoPor: { type: String, required: true },
    reportadoEn: { type: Date, default: Date.now },
    actualizadoEn: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ===== ÍNDICES PARA OPTIMIZAR CONSULTAS DE DISPONIBILIDAD =====

// Índice compuesto para consultas de equipos por fecha y estado
reservasSchema.index({ equipos: 1, fecha: 1, estado: 1 });

// Índice compuesto para consultas de aulas por fecha y estado
reservasSchema.index({ aulas: 1, fecha: 1, estado: 1 });

// Índice para detección de conflictos de horarios en equipos
reservasSchema.index({ equipos: 1, fecha: 1, horaInicio: 1, horaFin: 1 });

// Índice para detección de conflictos de horarios en aulas
reservasSchema.index({ aulas: 1, fecha: 1, horaInicio: 1, horaFin: 1 });

// Índice para consultas por estado
reservasSchema.index({ estado: 1 });

// Índice para consultas por fecha
reservasSchema.index({ fecha: 1 });

// Middleware para actualizar updatedAt
reservasSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
