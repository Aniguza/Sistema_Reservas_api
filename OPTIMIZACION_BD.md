# Optimización de Base de Datos

## 🎯 Índices Recomendados para MongoDB

Para mejorar el rendimiento de las consultas de disponibilidad, se recomienda agregar los siguientes índices:

### Índices para Reservas

```javascript
// En reservas.schema.ts
import { Schema } from 'mongoose';

export const reservasSchema = new Schema({
  nombre: { type: String, required: true },
  correo: { type: String, required: true },
  companeros: [{ type: String, required: false }],
  tipo: { type: String, enum: ['aula', 'equipo'], required: true },
  aulas: [{ type: Schema.Types.ObjectId, ref: 'Aula', required: false }],
  equipos: [{ type: Schema.Types.ObjectId, ref: 'Equipo', required: false }],
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true },
  horaFin: { type: String, required: true },
  motivo: { type: String, required: true },
  estado: {
    type: String,
    enum: ['pendiente', 'confirmada', 'cancelada', 'completada'],
    default: 'confirmada'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ===== ÍNDICES PARA OPTIMIZAR CONSULTAS =====

// Índice compuesto para consultas de equipos
reservasSchema.index({ 
  equipos: 1, 
  fecha: 1, 
  estado: 1 
});

// Índice compuesto para consultas de aulas
reservasSchema.index({ 
  aulas: 1, 
  fecha: 1, 
  estado: 1 
});

// Índice para consultas de horarios (detección de conflictos)
reservasSchema.index({ 
  equipos: 1, 
  fecha: 1, 
  horaInicio: 1, 
  horaFin: 1 
});

reservasSchema.index({ 
  aulas: 1, 
  fecha: 1, 
  horaInicio: 1, 
  horaFin: 1 
});

// Índice para consultas por estado
reservasSchema.index({ estado: 1 });

// Índice para consultas por fecha
reservasSchema.index({ fecha: 1 });

// Middleware para actualizar updatedAt
reservasSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
```

---

## 📊 Beneficios de los Índices

| Índice | Consulta Optimizada | Mejora de Rendimiento |
|--------|---------------------|----------------------|
| `{ equipos: 1, fecha: 1, estado: 1 }` | Obtener fechas reservadas de un equipo | **~10-100x más rápido** |
| `{ aulas: 1, fecha: 1, estado: 1 }` | Obtener fechas reservadas de un aula | **~10-100x más rápido** |
| `{ equipos: 1, fecha: 1, horaInicio: 1, horaFin: 1 }` | Verificar disponibilidad (conflictos) | **~50-200x más rápido** |
| `{ estado: 1 }` | Filtrar por estado | **~5-20x más rápido** |
| `{ fecha: 1 }` | Consultas por rango de fechas | **~5-20x más rápido** |

---

## 🚀 Cómo Aplicar los Índices

### Opción 1: Actualizar el Schema (Recomendado)

Modifica tu archivo `src/reservas/schemas/reservas.schema.ts` con el código de arriba.

Los índices se crearán automáticamente cuando inicies la aplicación.

### Opción 2: Crear Índices Manualmente en MongoDB

```javascript
// Conectarte a MongoDB Shell o usar MongoDB Compass

use nombre_de_tu_base_de_datos;

// Crear índices manualmente
db.reservas.createIndex({ equipos: 1, fecha: 1, estado: 1 });
db.reservas.createIndex({ aulas: 1, fecha: 1, estado: 1 });
db.reservas.createIndex({ equipos: 1, fecha: 1, horaInicio: 1, horaFin: 1 });
db.reservas.createIndex({ aulas: 1, fecha: 1, horaInicio: 1, horaFin: 1 });
db.reservas.createIndex({ estado: 1 });
db.reservas.createIndex({ fecha: 1 });
```

---

## 🔍 Verificar que los Índices Funcionan

### Usando MongoDB Shell:

```javascript
// Ver todos los índices de la colección reservas
db.reservas.getIndexes();

// Analizar el plan de ejecución de una consulta
db.reservas.explain("executionStats").find({
  equipos: ObjectId("67890abc123"),
  fecha: ISODate("2025-12-01"),
  estado: { $in: ["pendiente", "confirmada"] }
});
```

**Buscar en el resultado:**
- `"executionStats.totalDocsExamined"` - Debe ser bajo (idealmente igual a `nReturned`)
- `"winningPlan.inputStage.stage"` - Debe ser `"IXSCAN"` (Index Scan)

### Usando MongoDB Compass:

1. Ve a la pestaña "Explain Plan"
2. Ejecuta la consulta
3. Verifica que use índices (debe aparecer "Index Scan")

---

## 📈 Monitoreo de Rendimiento

### Habilitar el Profiler de MongoDB (Opcional)

```javascript
// Habilitar profiling para queries lentas (>100ms)
db.setProfilingLevel(1, { slowms: 100 });

// Ver queries lentas
db.system.profile.find().limit(10).sort({ ts: -1 }).pretty();
```

---

## 🧹 Limpieza de Datos

### Limpiar Reservas Antiguas (Opcional)

Si tu base de datos crece mucho, puedes agregar un job que limpie reservas completadas antiguas:

```javascript
// Crear un script que se ejecute periódicamente
// Por ejemplo, eliminar reservas completadas de hace más de 6 meses

const seiseMesesAtras = new Date();
seiseMesesAtras.setMonth(seiseMesesAtras.getMonth() - 6);

db.reservas.deleteMany({
  estado: "completada",
  fecha: { $lt: seiseMesesAtras }
});
```

---

## ⚡ Optimizaciones Adicionales

### 1. Cache de Consultas Frecuentes (Opcional)

Si tienes muchas consultas repetidas, considera usar Redis:

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service'; // Implementar servicio de Redis

@Injectable()
export class EquiposService {
  constructor(
    @InjectModel('Equipo') private readonly equipoModel: Model<Equipo>,
    @InjectModel('Reserva') private readonly reservaModel: Model<any>,
    private readonly redisService: RedisService
  ) {}

  async getAllEquiposConDisponibilidad(): Promise<any[]> {
    const cacheKey = 'equipos:catalogo:disponibilidad';
    
    // Intentar obtener de cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Si no está en cache, consultar BD
    const equipos = await this.equipoModel.find().exec();
    const equiposConDisponibilidad = await Promise.all(
      equipos.map(async (equipo) => {
        const fechasReservadas = await this.getFechasReservadas(equipo._id.toString());
        return {
          ...equipo.toObject(),
          fechasReservadas,
          disponibilidadGeneral: equipo.disponibilidad ?? true,
        };
      })
    );

    // Guardar en cache por 5 minutos
    await this.redisService.set(cacheKey, JSON.stringify(equiposConDisponibilidad), 300);

    return equiposConDisponibilidad;
  }
}
```

### 2. Paginación para Fechas Reservadas

Si un equipo tiene muchas reservas, paginar los resultados:

```typescript
async getFechasReservadas(
  equipoID: string,
  limit: number = 50,
  skip: number = 0
): Promise<any[]> {
  const reservas = await this.reservaModel
    .find({
      equipos: equipoID,
      estado: { $in: ['pendiente', 'confirmada'] },
      fecha: { $gte: new Date() } // Solo fechas futuras
    })
    .select('fecha horaInicio horaFin')
    .sort({ fecha: 1 }) // Ordenar por fecha ascendente
    .limit(limit)
    .skip(skip)
    .exec();

  return reservas.map(reserva => ({
    fecha: reserva.fecha,
    horaInicio: reserva.horaInicio,
    horaFin: reserva.horaFin,
  }));
}
```

### 3. Agregar TTL Index para Limpieza Automática

```javascript
// Eliminar automáticamente reservas completadas después de 1 año
reservasSchema.index(
  { updatedAt: 1 }, 
  { 
    expireAfterSeconds: 31536000, // 1 año en segundos
    partialFilterExpression: { estado: 'completada' }
  }
);
```

---

## 📝 Resumen de Optimizaciones

| Optimización | Prioridad | Complejidad | Mejora |
|--------------|-----------|-------------|---------|
| Índices en MongoDB | ⭐⭐⭐⭐⭐ **CRÍTICO** | Baja | ~10-100x |
| Paginación | ⭐⭐⭐⭐ Alta | Media | Evita timeouts |
| Cache con Redis | ⭐⭐⭐ Media | Alta | ~5-10x |
| TTL Index | ⭐⭐ Baja | Baja | Ahorra espacio |
| Profiling | ⭐ Baja | Baja | Monitoreo |

**Recomendación:** Implementar los índices PRIMERO (es lo más importante).

