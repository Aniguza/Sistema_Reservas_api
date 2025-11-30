# API de Disponibilidad - Equipos y Aulas

## Estrategia de Implementación

### ❌ Lo que NO hacemos:
- NO guardar fechas de reserva dentro del esquema de equipos/aulas
- NO actualizar manualmente campos de disponibilidad

### ✅ Lo que SÍ hacemos:
- **Consultar disponibilidad dinámicamente** desde la colección de reservas
- **El campo `disponibilidad` en equipos** sirve solo para marcar si está "fuera de servicio" permanentemente
- **Calcular fechas ocupadas** en tiempo real consultando las reservas activas

---

## Nuevos Endpoints

### 🔧 EQUIPOS

#### 1. Obtener catálogo de equipos con disponibilidad
```
GET /equipos/catalogo/disponibilidad
```
**Respuesta:**
```json
[
  {
    "_id": "67890...",
    "name": "Proyector Sony",
    "description": "Proyector HD",
    "disponibilidadGeneral": true,
    "fechasReservadas": [
      {
        "fecha": "2025-12-01T00:00:00.000Z",
        "horaInicio": "10:00",
        "horaFin": "12:00"
      },
      {
        "fecha": "2025-12-05T00:00:00.000Z",
        "horaInicio": "14:00",
        "horaFin": "16:00"
      }
    ]
  }
]
```

**Uso en Frontend:**
- Mostrar el catálogo completo
- Marcar en rojo las fechas reservadas en el calendario
- Si `disponibilidadGeneral: false`, mostrar como "No disponible"

---

#### 2. Obtener fechas reservadas de un equipo específico
```
GET /equipos/:id/fechas-reservadas
```
**Ejemplo:** `GET /equipos/67890abc123/fechas-reservadas`

**Respuesta:**
```json
{
  "equipoId": "67890abc123",
  "fechasReservadas": [
    {
      "fecha": "2025-12-01T00:00:00.000Z",
      "horaInicio": "10:00",
      "horaFin": "12:00"
    }
  ]
}
```

**Uso en Frontend:**
- Al seleccionar un equipo, obtener sus fechas reservadas
- Pintar esas fechas en rojo en el calendario
- Deshabilitar esas fechas/horarios para nueva reserva

---

#### 3. Verificar disponibilidad antes de reservar
```
GET /equipos/:id/verificar-disponibilidad?fecha=2025-12-01&horaInicio=10:00&horaFin=12:00
```

**Ejemplo:**
```
GET /equipos/67890abc123/verificar-disponibilidad?fecha=2025-12-01&horaInicio=10:00&horaFin=12:00
```

**Respuesta:**
```json
{
  "equipoId": "67890abc123",
  "fecha": "2025-12-01",
  "horaInicio": "10:00",
  "horaFin": "12:00",
  "disponible": false
}
```

**Uso en Frontend:**
- Antes de enviar el formulario de reserva
- Verificar si el equipo está disponible en esa fecha/hora
- Mostrar mensaje de error si no está disponible

---

### 🏫 AULAS

Los endpoints son idénticos pero cambiando `/equipos` por `/aulas`:

#### 1. Catálogo con disponibilidad
```
GET /aulas/catalogo/disponibilidad
```

#### 2. Fechas reservadas de un aula
```
GET /aulas/:id/fechas-reservadas
```

#### 3. Verificar disponibilidad
```
GET /aulas/:id/verificar-disponibilidad?fecha=2025-12-01&horaInicio=10:00&horaFin=12:00
```

---

## Flujo de Trabajo en Frontend

### 📅 Para el Calendario

```javascript
// 1. Obtener todos los equipos con sus fechas reservadas
const response = await fetch('/equipos/catalogo/disponibilidad');
const equipos = await response.json();

// 2. Para cada equipo, marcar las fechas reservadas en rojo
equipos.forEach(equipo => {
  equipo.fechasReservadas.forEach(reserva => {
    calendario.marcarFechaEnRojo(reserva.fecha);
  });
});
```

### 🛒 Para el Catálogo

```javascript
// 1. Obtener equipos con disponibilidad
const response = await fetch('/equipos/catalogo/disponibilidad');
const equipos = await response.json();

// 2. Mostrar cada equipo
equipos.forEach(equipo => {
  if (equipo.disponibilidadGeneral === false) {
    // Mostrar badge "Fuera de servicio"
  } else if (equipo.fechasReservadas.length > 0) {
    // Mostrar "Ver disponibilidad" con calendario
  } else {
    // Mostrar "Disponible"
  }
});
```

### ✅ Para Validar Antes de Reservar

```javascript
// Cuando el usuario selecciona fecha y hora
const verificar = async (equipoId, fecha, horaInicio, horaFin) => {
  const response = await fetch(
    `/equipos/${equipoId}/verificar-disponibilidad?` +
    `fecha=${fecha}&horaInicio=${horaInicio}&horaFin=${horaFin}`
  );
  const resultado = await response.json();
  
  if (!resultado.disponible) {
    alert('Este equipo no está disponible en ese horario');
    return false;
  }
  return true;
};

// Antes de enviar el formulario
if (await verificar(equipoId, fecha, horaInicio, horaFin)) {
  // Proceder con la reserva
}
```

---

## Flujo Completo: Crear Equipo vs Crear Reserva

### 🔧 Cuando el Administrador CREA un Equipo

```javascript
POST /equipos/create
{
  "name": "Proyector Sony",
  "description": "Proyector HD",
  "imageUrl": "...",
  "category": "Proyectores",
  "disponibilidad": true  // Solo indica si está fuera de servicio
}
```

**NO se agregan fechas aquí** ✅

---

### 📝 Cuando un Usuario CREA una Reserva

```javascript
// 1. Primero verificar disponibilidad
GET /equipos/67890/verificar-disponibilidad?fecha=2025-12-01&horaInicio=10:00&horaFin=12:00

// 2. Si está disponible, crear la reserva
POST /reservas/create
{
  "nombre": "Juan Pérez",
  "correo": "juan@example.com",
  "tipo": "equipo",
  "equipos": ["67890abc123"],
  "fecha": "2025-12-01",
  "horaInicio": "10:00",
  "horaFin": "12:00",
  "motivo": "Presentación"
}
```

**Las fechas se guardan en la reserva, NO en el equipo** ✅

---

## Ventajas de esta Arquitectura

✅ **Datos centralizados**: Las fechas están en un solo lugar (reservas)  
✅ **Actualización automática**: Al crear/cancelar reserva, la disponibilidad se actualiza automáticamente  
✅ **Escalable**: Funciona para equipos, aulas, o cualquier otro recurso  
✅ **Sin duplicación**: No hay datos redundantes  
✅ **Historial completo**: Todas las reservas quedan registradas  

---

## Consideraciones de Rendimiento

Para mejorar el rendimiento en producción:

1. **Agregar índices en MongoDB:**
```javascript
// En reservas.schema.ts
reservasSchema.index({ equipos: 1, fecha: 1, estado: 1 });
reservasSchema.index({ aulas: 1, fecha: 1, estado: 1 });
```

2. **Cache (opcional):**
   - Cachear el catálogo de disponibilidad por 5-10 minutos
   - Invalidar cache al crear/cancelar reserva

3. **Paginación:**
   - Si hay muchas fechas reservadas, paginar los resultados

---

## Resumen

| Acción | Endpoint | Propósito |
|--------|----------|-----------|
| Ver catálogo | `GET /equipos/catalogo/disponibilidad` | Mostrar todos los equipos con fechas reservadas |
| Ver fechas de 1 equipo | `GET /equipos/:id/fechas-reservadas` | Calendario individual de un equipo |
| Verificar antes de reservar | `GET /equipos/:id/verificar-disponibilidad` | Validar disponibilidad |
| Crear equipo | `POST /equipos/create` | Solo info básica, SIN fechas |
| Crear reserva | `POST /reservas/create` | Aquí SÍ se agregan las fechas |

