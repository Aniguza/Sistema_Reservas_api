# 🎯 Sistema de Disponibilidad - Resumen

## ✅ Problema Resuelto

**Pregunta original:** ¿Cómo manejar las fechas de reserva en equipos/aulas para mostrar disponibilidad en el calendario del frontend?

**Respuesta:** NO guardar fechas en equipos/aulas, sino **consultar dinámicamente** desde las reservas.

---

## 📋 Cambios Implementados

### 1. **Equipos Module** 
✅ Agregado `ReservaModel` al módulo  
✅ Nuevos métodos en `EquiposService`:
- `getFechasReservadas(equipoID)` - Obtener fechas reservadas de un equipo
- `getAllEquiposConDisponibilidad()` - Catálogo con disponibilidad
- `verificarDisponibilidad(equipoID, fecha, horaInicio, horaFin)` - Validar antes de reservar

✅ Nuevos endpoints en `EquiposController`:
```
GET /equipos/catalogo/disponibilidad
GET /equipos/:id/fechas-reservadas
GET /equipos/:id/verificar-disponibilidad?fecha=...&horaInicio=...&horaFin=...
```

### 2. **Aulas Module**
✅ Mismos cambios que en Equipos  
✅ Endpoints idénticos pero con `/aulas` en lugar de `/equipos`

### 3. **Reservas Schema**
✅ Agregados **6 índices** para optimizar consultas:
- `{ equipos: 1, fecha: 1, estado: 1 }`
- `{ aulas: 1, fecha: 1, estado: 1 }`
- `{ equipos: 1, fecha: 1, horaInicio: 1, horaFin: 1 }`
- `{ aulas: 1, fecha: 1, horaInicio: 1, horaFin: 1 }`
- `{ estado: 1 }`
- `{ fecha: 1 }`

---

## 🚀 Cómo Usar en el Frontend

### 1️⃣ Mostrar Catálogo con Disponibilidad

```javascript
// Obtener todos los equipos con fechas reservadas
const response = await fetch('http://localhost:3000/equipos/catalogo/disponibilidad');
const equipos = await response.json();

// Cada equipo tiene:
// - disponibilidadGeneral: true/false (si está fuera de servicio)
// - fechasReservadas: [{fecha, horaInicio, horaFin}, ...]
```

### 2️⃣ Mostrar Calendario con Fechas Rojas

```javascript
// Obtener fechas reservadas de un equipo específico
const response = await fetch(`http://localhost:3000/equipos/${equipoId}/fechas-reservadas`);
const { fechasReservadas } = await response.json();

// Marcar esas fechas en rojo en tu calendario
fechasReservadas.forEach(reserva => {
  calendario.marcarFechaEnRojo(reserva.fecha);
});
```

### 3️⃣ Validar Antes de Crear Reserva

```javascript
// Verificar si está disponible
const params = new URLSearchParams({
  fecha: '2025-12-01',
  horaInicio: '10:00',
  horaFin: '12:00'
});

const response = await fetch(
  `http://localhost:3000/equipos/${equipoId}/verificar-disponibilidad?${params}`
);
const { disponible } = await response.json();

if (disponible) {
  // Crear la reserva
  await fetch('http://localhost:3000/reservas/create', {
    method: 'POST',
    body: JSON.stringify({ ... })
  });
}
```

---

## 📂 Archivos Modificados

```
src/equipos/
  ├── equipos.module.ts       ✅ Importado ReservaSchema
  ├── equipos.service.ts      ✅ Nuevos métodos de disponibilidad
  └── equipos.controller.ts   ✅ Nuevos endpoints

src/aulas/
  ├── aulas.module.ts         ✅ Importado ReservaSchema
  ├── aulas.service.ts        ✅ Nuevos métodos de disponibilidad
  └── aulas.controller.ts     ✅ Nuevos endpoints

src/reservas/
  └── schemas/
      └── reservas.schema.ts  ✅ Agregados índices
```

---

## 📚 Documentación Creada

| Archivo | Contenido |
|---------|-----------|
| `DISPONIBILIDAD_API.md` | Explicación completa de la API y endpoints |
| `EJEMPLO_FRONTEND.md` | Componentes React listos para usar |
| `OPTIMIZACION_BD.md` | Índices y optimizaciones de MongoDB |

---

## 🎨 Flujo de Trabajo

### Cuando el Administrador CREA un Equipo
```javascript
POST /equipos/create
{
  "name": "Proyector Sony",
  "disponibilidad": true  // Solo indica si está "fuera de servicio"
}
```
**NO se agregan fechas aquí** ✅

### Cuando un Usuario CREA una Reserva
```javascript
POST /reservas/create
{
  "equipos": ["67890abc123"],
  "fecha": "2025-12-01",
  "horaInicio": "10:00",
  "horaFin": "12:00"
}
```
**Las fechas se guardan en la reserva** ✅

### Cuando el Frontend CONSULTA Disponibilidad
```javascript
GET /equipos/catalogo/disponibilidad
// Consulta automáticamente las reservas y retorna las fechas ocupadas
```
**Todo es automático** ✅

---

## ⚡ Ventajas de esta Arquitectura

| Ventaja | Descripción |
|---------|-------------|
| ✅ **Datos centralizados** | Las fechas están en un solo lugar (reservas) |
| ✅ **Actualización automática** | Al crear/cancelar reserva, la disponibilidad se actualiza |
| ✅ **Sin duplicación** | No hay datos redundantes |
| ✅ **Escalable** | Funciona para equipos, aulas, o cualquier recurso |
| ✅ **Historial completo** | Todas las reservas quedan registradas |
| ✅ **Optimizado** | Con índices, las consultas son ~10-100x más rápidas |

---

## 🧪 Probar los Endpoints

### Usando curl:

```bash
# 1. Obtener catálogo con disponibilidad
curl http://localhost:3000/equipos/catalogo/disponibilidad

# 2. Obtener fechas reservadas de un equipo
curl http://localhost:3000/equipos/67890abc123/fechas-reservadas

# 3. Verificar disponibilidad
curl "http://localhost:3000/equipos/67890abc123/verificar-disponibilidad?fecha=2025-12-01&horaInicio=10:00&horaFin=12:00"
```

### Usando Postman:

Importa esta colección:

```json
{
  "info": { "name": "Disponibilidad API" },
  "item": [
    {
      "name": "Catálogo Equipos",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/equipos/catalogo/disponibilidad"
      }
    },
    {
      "name": "Fechas Reservadas",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/equipos/{{equipoId}}/fechas-reservadas"
      }
    },
    {
      "name": "Verificar Disponibilidad",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/equipos/{{equipoId}}/verificar-disponibilidad",
        "query": [
          { "key": "fecha", "value": "2025-12-01" },
          { "key": "horaInicio", "value": "10:00" },
          { "key": "horaFin", "value": "12:00" }
        ]
      }
    }
  ]
}
```

---

## 🔥 Próximos Pasos

1. **Probar los endpoints** usando Postman o curl
2. **Implementar el frontend** usando los ejemplos en `EJEMPLO_FRONTEND.md`
3. **Verificar que los índices funcionen** (ver `OPTIMIZACION_BD.md`)
4. **(Opcional)** Agregar cache con Redis para mejor rendimiento
5. **(Opcional)** Agregar paginación si hay muchas reservas

---

## ❓ Preguntas Frecuentes

### ¿Debo guardar fechas en el schema de equipos?
**NO.** Las fechas se guardan solo en `reservas`. El endpoint `/catalogo/disponibilidad` consulta automáticamente las reservas.

### ¿Qué significa el campo `disponibilidad` en equipos?
Es un flag manual para marcar si el equipo está "fuera de servicio" permanentemente (por ejemplo, si está roto). **NO** guarda fechas específicas.

### ¿Cómo se actualiza la disponibilidad?
Automáticamente. Cada vez que se crea o cancela una reserva, los endpoints de disponibilidad reflejan el cambio inmediatamente.

### ¿Qué pasa si hay muchas reservas?
Los índices optimizan las consultas. Si aún es lento, implementa paginación (ver `OPTIMIZACION_BD.md`).

### ¿Puedo usar esto para otros recursos (salas, vehículos, etc.)?
Sí, la misma lógica aplica para cualquier recurso reservable.

---

## 📞 Soporte

Si tienes dudas, revisa los archivos de documentación:
- `DISPONIBILIDAD_API.md` - Endpoints y API
- `EJEMPLO_FRONTEND.md` - Componentes React
- `OPTIMIZACION_BD.md` - Índices y rendimiento

¡Listo para usar! 🚀
