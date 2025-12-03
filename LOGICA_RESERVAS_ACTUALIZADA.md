# 🎯 Lógica de Reservas Actualizada

## ✅ Reglas de Negocio Implementadas

### 1️⃣ **Anticipación de 2 Días**
- ✅ Las reservas deben hacerse con **mínimo 2 días de anticipación**
- ✅ Si hay una reserva previa en el aula, la nueva reserva debe ser **2 días después** de la última

### 2️⃣ **Enfoque en AULAS (no equipos individuales)**
- ✅ Las fechas ocupadas se marcan por **AULA**, no por equipo
- ✅ Si reservas equipos, se bloquea el **aula completa** donde están esos equipos
- ✅ El calendario muestra las fechas ocupadas del aula

### 3️⃣ **Reprogramación y Cancelación**
- ✅ **Reprogramar**: Cambiar fecha/hora de una reserva existente
- ✅ **Cancelar**: Los usuarios pueden cancelar sus propias reservas, los admins pueden cancelar cualquiera
- ✅ Ambas acciones pueden incluir un motivo

---

## 📋 Endpoints Actualizados

### **1. Crear Reserva**
```
POST /reservas/create
```

**Validaciones:**
- ✅ Fecha debe ser al menos 2 días en el futuro
- ✅ Si el aula tiene una reserva previa, la nueva debe ser 2 días después
- ✅ Verifica disponibilidad en el horario específico

**Body:**
```json
{
  "nombre": "Juan Pérez",
  "correo": "juan@example.com",
  "companeros": ["EST001", "EST002"],
  "tipo": "equipo",
  "equipos": ["674a1b2c3d4e5f6789012345"],
  "fecha": "2025-12-05",
  "horaInicio": "10:00",
  "horaFin": "12:00",
  "motivo": "Proyecto de robótica"
}
```

**Respuestas posibles:**
```json
// ✅ Éxito
{
  "message": "Reserva creada exitosamente",
  "reserva": { ... }
}

// ❌ Error: Menos de 2 días
{
  "message": "Las reservas deben realizarse con al menos 2 días de anticipación"
}

// ❌ Error: Aula ocupada recientemente
{
  "message": "El aula tiene una reserva reciente. Debe esperar al menos 2 días después de la última reserva (01/12/2025)"
}

// ❌ Error: Conflicto de horario
{
  "message": "El aula no está disponible en el horario seleccionado. Ya existe una reserva en ese momento."
}
```

---

### **2. Reprogramar Reserva**
```
PATCH /reservas/reprogramar/:id
```

**Body:**
```json
{
  "fecha": "2025-12-10",
  "horaInicio": "14:00",
  "horaFin": "16:00",
  "motivo": "Cambio de horario por conflicto con otra clase"
}
```

**Validaciones:**
- ✅ Nueva fecha debe ser al menos 2 días en el futuro
- ✅ Verifica disponibilidad en el nuevo horario
- ✅ No puede reprogramar reservas canceladas

**Respuestas:**
```json
// ✅ Éxito
{
  "message": "Reserva reprogramada exitosamente",
  "reserva": {
    "_id": "...",
    "fecha": "2025-12-10",
    "horaInicio": "14:00",
    "horaFin": "16:00",
    "motivo": "Proyecto de robótica [REPROGRAMADA: Cambio de horario por conflicto con otra clase]",
    ...
  }
}

// ❌ Error
{
  "message": "La reprogramación debe ser con al menos 2 días de anticipación"
}
```

---

### **3. Cancelar Reserva**
```
PATCH /reservas/cancelar/:id
```

**Body:**
```json
{
  "isAdmin": false,
  "correoUsuario": "juan@example.com",
  "motivo": "Evento suspendido por mal clima"
}
```

**Permisos:**
- ✅ **Usuario normal**: Solo puede cancelar sus propias reservas (debe enviar `correoUsuario`)
- ✅ **Administrador**: Puede cancelar cualquier reserva (`isAdmin: true`)

**Respuestas:**
```json
// ✅ Éxito
{
  "message": "Reserva cancelada exitosamente",
  "reserva": {
    "_id": "...",
    "estado": "cancelada",
    "motivo": "Proyecto de robótica [CANCELADA: Evento suspendido por mal clima]",
    ...
  }
}

// ❌ Error: No autorizado
{
  "message": "Solo puedes cancelar tus propias reservas o necesitas ser administrador"
}

// ❌ Error: Ya cancelada
{
  "message": "La reserva ya está cancelada"
}

// ❌ Error: Reserva pasada
{
  "message": "No se puede cancelar una reserva pasada"
}
```

---

### **4. Obtener Fechas Reservadas de un Aula**
```
GET /aulas/:id/fechas-reservadas
```

**Respuesta:**
```json
{
  "aulaId": "674a1b2c3d4e5f6789012345",
  "fechasReservadas": [
    {
      "fecha": "2025-12-05T00:00:00.000Z",
      "horaInicio": "10:00",
      "horaFin": "12:00"
    },
    {
      "fecha": "2025-12-08T00:00:00.000Z",
      "horaInicio": "14:00",
      "horaFin": "16:00"
    }
  ]
}
```

**Uso en Frontend:**
```javascript
// Marcar fechas en rojo en el calendario
const response = await fetch(`/aulas/${aulaId}/fechas-reservadas`);
const { fechasReservadas } = await response.json();

fechasReservadas.forEach(reserva => {
  calendario.marcarFechaEnRojo(reserva.fecha);
});
```

---

### **5. Catálogo de Aulas con Disponibilidad**
```
GET /aulas/catalogo/disponibilidad
```

**Respuesta:**
```json
[
  {
    "_id": "674a1b2c3d4e5f6789012345",
    "name": "Laboratorio de Robótica",
    "codigo": "LAB-101",
    "description": "Aula equipada con Arduino y sensores",
    "equipos": [
      {
        "_id": "...",
        "name": "Arduino Uno R3",
        ...
      }
    ],
    "fechasReservadas": [
      {
        "fecha": "2025-12-05T00:00:00.000Z",
        "horaInicio": "10:00",
        "horaFin": "12:00"
      }
    ]
  }
]
```

---

## 🎨 Flujo Completo en el Frontend

### **Escenario 1: Usuario Crea Reserva**

```javascript
// 1. Usuario selecciona equipos (Arduino, sensores, etc.)
const equiposSeleccionados = ["674a1b2c...", "674a1b2d..."];

// 2. Usuario selecciona fecha (debe ser +2 días desde hoy)
const fechaSeleccionada = "2025-12-05";

// 3. Sistema obtiene el aula de esos equipos
const aula = await obtenerAulaDeEquipos(equiposSeleccionados);

// 4. Mostrar calendario con fechas ocupadas del AULA
const { fechasReservadas } = await fetch(`/aulas/${aula._id}/fechas-reservadas`);
calendario.marcarFechasEnRojo(fechasReservadas);

// 5. Usuario selecciona horario disponible
const horaInicio = "10:00";
const horaFin = "12:00";

// 6. Crear la reserva
const response = await fetch('/reservas/create', {
  method: 'POST',
  body: JSON.stringify({
    nombre: "Juan Pérez",
    correo: "juan@example.com",
    tipo: "equipo",
    equipos: equiposSeleccionados,
    fecha: fechaSeleccionada,
    horaInicio,
    horaFin,
    motivo: "Proyecto de robótica"
  })
});

if (response.ok) {
  alert("✅ Reserva creada exitosamente!");
} else {
  const error = await response.json();
  alert(`❌ ${error.message}`);
}
```

---

### **Escenario 2: Usuario Reprograma Reserva**

```javascript
// 1. Usuario ve sus reservas
const misReservas = await fetch(`/reservas?correo=juan@example.com`);

// 2. Selecciona una reserva para reprogramar
const reservaId = "674a1b2c...";

// 3. Selecciona nueva fecha y hora
const response = await fetch(`/reservas/reprogramar/${reservaId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fecha: "2025-12-10",
    horaInicio: "14:00",
    horaFin: "16:00",
    motivo: "Cambio por conflicto de horario"
  })
});

if (response.ok) {
  alert("✅ Reserva reprogramada!");
} else {
  const error = await response.json();
  alert(`❌ ${error.message}`);
}
```

---

### **Escenario 3: Usuario Cancela Reserva**

```javascript
const reservaId = "674a1b2c...";

const response = await fetch(`/reservas/cancelar/${reservaId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isAdmin: false,
    correoUsuario: "juan@example.com",
    motivo: "Evento suspendido"
  })
});

if (response.ok) {
  alert("✅ Reserva cancelada!");
}
```

---

### **Escenario 4: Admin Cancela Cualquier Reserva**

```javascript
const reservaId = "674a1b2c...";

const response = await fetch(`/reservas/cancelar/${reservaId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isAdmin: true,
    motivo: "Mantenimiento del aula"
  })
});

if (response.ok) {
  alert("✅ Reserva cancelada por el administrador!");
}
```

---

## 📅 Calendario Frontend - Ejemplo Visual

```javascript
import Calendar from 'react-calendar';

function CalendarioAula({ aulaId }) {
  const [fechasOcupadas, setFechasOcupadas] = useState([]);

  useEffect(() => {
    // Obtener fechas reservadas del AULA
    fetch(`/aulas/${aulaId}/fechas-reservadas`)
      .then(res => res.json())
      .then(data => setFechasOcupadas(data.fechasReservadas));
  }, [aulaId]);

  const tileClassName = ({ date }) => {
    // Verificar si la fecha está ocupada
    const estaOcupada = fechasOcupadas.some(reserva => {
      const fechaReserva = new Date(reserva.fecha);
      return (
        fechaReserva.getDate() === date.getDate() &&
        fechaReserva.getMonth() === date.getMonth() &&
        fechaReserva.getFullYear() === date.getFullYear()
      );
    });

    if (estaOcupada) return 'fecha-ocupada'; // CSS: background: red

    // Verificar si es antes de 2 días
    const hoy = new Date();
    const dosDiasDespues = new Date(hoy);
    dosDiasDespues.setDate(hoy.getDate() + 2);

    if (date < dosDiasDespues) {
      return 'fecha-no-disponible'; // CSS: background: gray
    }

    return 'fecha-disponible'; // CSS: background: green
  };

  return (
    <div>
      <h3>Aula: {aulaId}</h3>
      <Calendar tileClassName={tileClassName} />
      
      <div className="leyenda">
        <span className="rojo">🔴 Fecha ocupada</span>
        <span className="gris">⚫ Menos de 2 días (no disponible)</span>
        <span className="verde">🟢 Disponible</span>
      </div>
    </div>
  );
}
```

---

## 🎯 Resumen de Cambios

| Característica | Estado | Detalles |
|----------------|--------|----------|
| **2 días de anticipación** | ✅ Implementado | Valida al crear y reprogramar |
| **2 días después de última reserva** | ✅ Implementado | Valida que el aula esté libre |
| **Enfoque en aulas** | ✅ Implementado | Las fechas se marcan por aula, no por equipo |
| **Reprogramar reserva** | ✅ Implementado | Con motivo opcional |
| **Cancelar reserva (usuario)** | ✅ Implementado | Solo sus propias reservas |
| **Cancelar reserva (admin)** | ✅ Implementado | Cualquier reserva |
| **Motivo de cancelación** | ✅ Implementado | Se agrega al campo `motivo` |
| **Validación de permisos** | ✅ Implementado | Usuario vs Admin |

---

---

## 🚨 Sistema de Gestión de Incidencias

### **¿Qué son las incidencias?**
Las incidencias permiten reportar problemas o situaciones que ocurren durante una reserva (equipos dañados, problemas de limpieza, etc.).

### **Características:**
- ✅ **Tipos**: técnica, administrativa, limpieza, otra
- ✅ **Prioridades**: baja, media, alta, crítica
- ✅ **Estados**: reportada, en_revision, en_proceso, resuelta, cerrada
- ✅ **Trazabilidad**: Registro de quién reportó, cuándo y resolución
- ✅ **Integrado**: Las incidencias están asociadas a reservas específicas

---

### **6. Reportar Incidencia en una Reserva**
```
POST /reservas/:id/incidencias
```

**Body:**
```json
{
  "descripcion": "El Arduino Uno no enciende, posible daño en el puerto USB",
  "tipo": "tecnica",
  "prioridad": "alta",
  "reportadoPor": "juan@example.com"
}
```

**Tipos válidos:**
- `tecnica`: Problemas con equipos o infraestructura
- `administrativa`: Problemas con documentación, permisos, etc.
- `limpieza`: Problemas de higiene o mantenimiento
- `otra`: Cualquier otro tipo de incidencia

**Prioridades válidas:**
- `baja`: Puede esperar
- `media`: Requiere atención pronto
- `alta`: Requiere atención urgente
- `critica`: Requiere atención inmediata

**Respuesta:**
```json
{
  "message": "Incidencia reportada exitosamente",
  "reserva": {
    "_id": "674a1b2c...",
    "nombre": "Juan Pérez",
    "incidencias": [
      {
        "_id": "674b2c3d...",
        "descripcion": "El Arduino Uno no enciende...",
        "tipo": "tecnica",
        "prioridad": "alta",
        "estado": "reportada",
        "reportadoPor": "juan@example.com",
        "reportadoEn": "2025-12-05T10:30:00.000Z",
        "actualizadoEn": "2025-12-05T10:30:00.000Z"
      }
    ]
  }
}
```

---

### **7. Obtener Incidencias de una Reserva**
```
GET /reservas/:id/incidencias
```

**Respuesta:**
```json
[
  {
    "_id": "674b2c3d...",
    "descripcion": "El Arduino Uno no enciende...",
    "tipo": "tecnica",
    "prioridad": "alta",
    "estado": "reportada",
    "reportadoPor": "juan@example.com",
    "reportadoEn": "2025-12-05T10:30:00.000Z",
    "actualizadoEn": "2025-12-05T10:30:00.000Z"
  }
]
```

---

### **8. Obtener Todas las Incidencias (con filtros)**
```
GET /reservas/incidencias/todas?tipo=tecnica&estado=reportada&prioridad=alta
```

**Parámetros opcionales:**
- `tipo`: Filtrar por tipo (tecnica, administrativa, limpieza, otra)
- `estado`: Filtrar por estado (reportada, en_revision, en_proceso, resuelta, cerrada)
- `prioridad`: Filtrar por prioridad (baja, media, alta, critica)

**Respuesta:**
```json
[
  {
    "_id": "674b2c3d...",
    "descripcion": "El Arduino Uno no enciende...",
    "tipo": "tecnica",
    "prioridad": "alta",
    "estado": "reportada",
    "reportadoPor": "juan@example.com",
    "reportadoEn": "2025-12-05T10:30:00.000Z",
    "actualizadoEn": "2025-12-05T10:30:00.000Z",
    "reservaId": "674a1b2c...",
    "reservaNombre": "Juan Pérez",
    "reservaFecha": "2025-12-05T00:00:00.000Z",
    "aulas": [...],
    "equipos": [...]
  }
]
```

---

### **9. Actualizar Estado de una Incidencia**
```
PATCH /reservas/:reservaId/incidencias/:incidenciaId
```

**Body:**
```json
{
  "estado": "resuelta",
  "resolucion": "Se reemplazó el Arduino dañado por uno nuevo"
}
```

**Estados válidos:**
- `reportada`: Inicial
- `en_revision`: Siendo revisada por el personal
- `en_proceso`: Se está trabajando en la resolución
- `resuelta`: Problema solucionado
- `cerrada`: Cerrada definitivamente

**Respuesta:**
```json
{
  "message": "Incidencia actualizada exitosamente",
  "reserva": {
    "_id": "674a1b2c...",
    "incidencias": [
      {
        "_id": "674b2c3d...",
        "descripcion": "El Arduino Uno no enciende...",
        "tipo": "tecnica",
        "prioridad": "alta",
        "estado": "resuelta",
        "resolucion": "Se reemplazó el Arduino dañado por uno nuevo",
        "reportadoPor": "juan@example.com",
        "reportadoEn": "2025-12-05T10:30:00.000Z",
        "actualizadoEn": "2025-12-05T14:20:00.000Z"
      }
    ]
  }
}
```

---

### **10. Eliminar Incidencia**
```
DELETE /reservas/:reservaId/incidencias/:incidenciaId
```

**Respuesta:**
```json
{
  "message": "Incidencia eliminada exitosamente",
  "reserva": {
    "_id": "674a1b2c...",
    "incidencias": []
  }
}
```

---

## 🎨 Flujo de Incidencias en el Frontend

### **Escenario 1: Usuario Reporta Incidencia Durante Reserva**

```javascript
// Durante o después de usar el aula/equipo
const reservaId = "674a1b2c...";

const response = await fetch(`/reservas/${reservaId}/incidencias`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    descripcion: "El Arduino Uno no enciende, posible daño en el puerto USB",
    tipo: "tecnica",
    prioridad: "alta",
    reportadoPor: "juan@example.com"
  })
});

if (response.ok) {
  alert("✅ Incidencia reportada. El personal será notificado.");
}
```

---

### **Escenario 2: Admin Revisa Incidencias Pendientes**

```javascript
// Obtener todas las incidencias pendientes de alta prioridad
const response = await fetch('/reservas/incidencias/todas?estado=reportada&prioridad=alta');
const incidencias = await response.json();

// Mostrar en dashboard
incidencias.forEach(inc => {
  console.log(`🚨 ${inc.tipo} - ${inc.descripcion}`);
  console.log(`📅 Reserva: ${inc.reservaNombre} - ${inc.reservaFecha}`);
  console.log(`📧 Reportado por: ${inc.reportadoPor}`);
});
```

---

### **Escenario 3: Personal Técnico Actualiza Incidencia**

```javascript
const reservaId = "674a1b2c...";
const incidenciaId = "674b2c3d...";

// Primero: Marcar como "en_proceso"
await fetch(`/reservas/${reservaId}/incidencias/${incidenciaId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    estado: "en_proceso"
  })
});

// Después de resolver: Marcar como "resuelta"
await fetch(`/reservas/${reservaId}/incidencias/${incidenciaId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    estado: "resuelta",
    resolucion: "Se reemplazó el Arduino dañado por uno nuevo del inventario"
  })
});

alert("✅ Incidencia resuelta!");
```

---

### **Escenario 4: Dashboard de Incidencias con Filtros**

```javascript
import { useState, useEffect } from 'react';

function DashboardIncidencias() {
  const [incidencias, setIncidencias] = useState([]);
  const [filtros, setFiltros] = useState({
    tipo: '',
    estado: '',
    prioridad: ''
  });

  useEffect(() => {
    // Construir query params
    const params = new URLSearchParams();
    if (filtros.tipo) params.append('tipo', filtros.tipo);
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.prioridad) params.append('prioridad', filtros.prioridad);

    // Obtener incidencias filtradas
    fetch(`/reservas/incidencias/todas?${params}`)
      .then(res => res.json())
      .then(data => setIncidencias(data));
  }, [filtros]);

  return (
    <div>
      <h2>🚨 Gestión de Incidencias</h2>
      
      {/* Filtros */}
      <select onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}>
        <option value="">Todos los tipos</option>
        <option value="tecnica">Técnica</option>
        <option value="administrativa">Administrativa</option>
        <option value="limpieza">Limpieza</option>
        <option value="otra">Otra</option>
      </select>

      <select onChange={(e) => setFiltros({...filtros, estado: e.target.value})}>
        <option value="">Todos los estados</option>
        <option value="reportada">Reportada</option>
        <option value="en_revision">En Revisión</option>
        <option value="en_proceso">En Proceso</option>
        <option value="resuelta">Resuelta</option>
        <option value="cerrada">Cerrada</option>
      </select>

      <select onChange={(e) => setFiltros({...filtros, prioridad: e.target.value})}>
        <option value="">Todas las prioridades</option>
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
        <option value="critica">Crítica</option>
      </select>

      {/* Lista de incidencias */}
      <div className="incidencias-lista">
        {incidencias.map(inc => (
          <div key={inc._id} className={`incidencia prioridad-${inc.prioridad}`}>
            <h3>🚨 {inc.tipo.toUpperCase()}</h3>
            <p>{inc.descripcion}</p>
            <div className="detalles">
              <span className="badge">{inc.estado}</span>
              <span className="prioridad">{inc.prioridad}</span>
              <span>📅 {new Date(inc.reportadoEn).toLocaleString()}</span>
              <span>📧 {inc.reportadoPor}</span>
            </div>
            {inc.resolucion && (
              <div className="resolucion">
                <strong>Resolución:</strong> {inc.resolucion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

---

## 🔒 Cierre Automático de Reservas Pasadas

### **¿Cómo funciona?**
El sistema puede cerrar automáticamente las reservas que ya pasaron su fecha y hora, diferenciando entre:
- **`cerrada`**: Reservas completadas sin problemas
- **`cerrada_con_incidencia`**: Reservas que tuvieron incidencias reportadas

### **Estados de Reservas:**
- `confirmada`: Reserva activa
- `reprogramada`: Reserva que fue modificada
- `cancelada`: Reserva cancelada antes de realizarse
- `completada`: Reserva finalizada manualmente
- `cerrada`: ✨ **NUEVO** - Reserva pasada sin incidencias
- `cerrada_con_incidencia`: ✨ **NUEVO** - Reserva pasada con incidencias

---

### **11. Cerrar Reservas Pasadas (Admin)**
```
PATCH /reservas/admin/cerrar-reservas-pasadas
```

Este endpoint verifica todas las reservas cuya fecha y hora ya pasaron y las actualiza automáticamente:

**Lógica:**
1. Busca reservas con `estado != 'cancelada', 'cerrada', 'cerrada_con_incidencia'`
2. Verifica si la fecha y hora de fin ya pasaron
3. Si tiene incidencias:
   - Cambia estado a `cerrada_con_incidencia`
   - Cierra todas las incidencias automáticamente
4. Si NO tiene incidencias:
   - Cambia estado a `cerrada`

**Respuesta:**
```json
{
  "message": "Se cerraron 5 reservas exitosamente",
  "actualizadas": 5,
  "detalles": [
    {
      "reservaId": "674a1b2c...",
      "nombre": "Juan Pérez",
      "fecha": "2025-11-28T00:00:00.000Z",
      "horaFin": "12:00",
      "estadoAnterior": "confirmada",
      "estadoNuevo": "cerrada_con_incidencia",
      "incidenciasCerradas": 2
    },
    {
      "reservaId": "674a1b2d...",
      "nombre": "María García",
      "fecha": "2025-11-27T00:00:00.000Z",
      "horaFin": "16:00",
      "estadoAnterior": "confirmada",
      "estadoNuevo": "cerrada",
      "incidenciasCerradas": 0
    }
  ]
}
```

---

### **12. Obtener Reservas por Estado**
```
GET /reservas/estado/:estado
```

**Estados válidos:**
- `confirmada`
- `cancelada`
- `completada`
- `cerrada`
- `cerrada_con_incidencia`

**Ejemplo:**
```
GET /reservas/estado/cerrada_con_incidencia
```

**Respuesta:**
```json
[
  {
    "_id": "674a1b2c...",
    "nombre": "Juan Pérez",
    "fecha": "2025-11-28T00:00:00.000Z",
    "estado": "cerrada_con_incidencia",
    "incidencias": [
      {
        "_id": "674b2c3d...",
        "descripcion": "El Arduino Uno no enciende",
        "tipo": "tecnica",
        "prioridad": "alta",
        "estado": "cerrada",
        "reportadoPor": "juan@example.com"
      }
    ],
    "aulas": [...],
    "equipos": [...]
  }
]
```

---

## 🎨 Flujo de Cierre Automático

### **Escenario 1: Tarea Programada (Cron Job)**

```javascript
// Ejecutar diariamente a las 00:00
import cron from 'node-cron';

// Ejecutar cada día a medianoche
cron.schedule('0 0 * * *', async () => {
  console.log('⏰ Ejecutando cierre automático de reservas...');
  
  const response = await fetch('/reservas/admin/cerrar-reservas-pasadas', {
    method: 'PATCH'
  });
  
  const resultado = await response.json();
  console.log(`✅ ${resultado.message}`);
  console.log(`📊 Reservas cerradas: ${resultado.actualizadas}`);
  
  // Enviar notificaciones si hay incidencias cerradas automáticamente
  resultado.detalles.forEach(reserva => {
    if (reserva.estadoNuevo === 'cerrada_con_incidencia') {
      enviarNotificacionAdmin(
        `Reserva de ${reserva.nombre} cerrada con ${reserva.incidenciasCerradas} incidencia(s)`
      );
    }
  });
});
```

---

### **Escenario 2: Dashboard Admin - Cierre Manual**

```javascript
function AdminDashboard() {
  const cerrarReservasPasadas = async () => {
    if (!confirm('¿Cerrar todas las reservas pasadas automáticamente?')) return;
    
    const response = await fetch('/reservas/admin/cerrar-reservas-pasadas', {
      method: 'PATCH'
    });
    
    const resultado = await response.json();
    
    alert(`✅ ${resultado.message}`);
    
    // Mostrar detalles
    console.table(resultado.detalles);
  };

  return (
    <div>
      <h2>🔧 Panel de Administración</h2>
      <button onClick={cerrarReservasPasadas}>
        🔒 Cerrar Reservas Pasadas
      </button>
    </div>
  );
}
```

---

### **Escenario 3: Ver Reservas Cerradas con Incidencias**

```javascript
function ReservasCerradasConIncidencias() {
  const [reservas, setReservas] = useState([]);

  useEffect(() => {
    fetch('/reservas/estado/cerrada_con_incidencia')
      .then(res => res.json())
      .then(data => setReservas(data));
  }, []);

  return (
    <div>
      <h2>🚨 Reservas Cerradas con Incidencias</h2>
      
      {reservas.map(reserva => (
        <div key={reserva._id} className="reserva-cerrada-incidencia">
          <h3>{reserva.nombre}</h3>
          <p>📅 {new Date(reserva.fecha).toLocaleDateString()}</p>
          <p>🏫 Aula: {reserva.aulas[0]?.name}</p>
          
          <div className="incidencias">
            <h4>Incidencias reportadas:</h4>
            {reserva.incidencias.map(inc => (
              <div key={inc._id} className="incidencia">
                <span className={`badge ${inc.prioridad}`}>{inc.tipo}</span>
                <p>{inc.descripcion}</p>
                <p className="estado-cerrado">Estado: {inc.estado}</p>
                {inc.resolucion && <p>Resolución: {inc.resolucion}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### **Escenario 4: Estadísticas de Incidencias**

```javascript
async function getEstadisticasIncidencias() {
  // Obtener todas las reservas cerradas con incidencias
  const response = await fetch('/reservas/estado/cerrada_con_incidencia');
  const reservas = await response.json();
  
  const stats = {
    totalReservasConIncidencias: reservas.length,
    incidenciasPorTipo: {
      tecnica: 0,
      administrativa: 0,
      limpieza: 0,
      otra: 0
    },
    incidenciasPorPrioridad: {
      baja: 0,
      media: 0,
      alta: 0,
      critica: 0
    }
  };
  
  reservas.forEach(reserva => {
    reserva.incidencias.forEach(inc => {
      stats.incidenciasPorTipo[inc.tipo]++;
      stats.incidenciasPorPrioridad[inc.prioridad]++;
    });
  });
  
  console.log('📊 Estadísticas de Incidencias:', stats);
  return stats;
}
```

---

## 📊 Resumen de Endpoints Completo

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/reservas/create` | POST | Crear reserva |
| `/reservas/reprogramar/:id` | PATCH | Reprogramar reserva |
| `/reservas/cancelar/:id` | PATCH | Cancelar reserva |
| `/reservas/:id/incidencias` | POST | Reportar incidencia |
| `/reservas/:id/incidencias` | GET | Ver incidencias de reserva |
| `/reservas/incidencias/todas` | GET | Ver todas las incidencias (con filtros) |
| `/reservas/:reservaId/incidencias/:incidenciaId` | PATCH | Actualizar incidencia |
| `/reservas/:reservaId/incidencias/:incidenciaId` | DELETE | Eliminar incidencia |
| `/reservas/admin/cerrar-reservas-pasadas` | PATCH | ✨ **Cerrar reservas pasadas automáticamente** |
| `/reservas/estado/:estado` | GET | ✨ **Obtener reservas por estado** |

---

## 🚀 Próximos Pasos

1. ✅ Probar los endpoints con Postman
2. ✅ Implementar frontend con calendario
3. ✅ Agregar notificaciones (email/SMS) para cancelaciones/reprogramaciones
4. ✅ Dashboard de admin para gestionar reservas e incidencias
5. ✅ Sistema de alertas para incidencias de alta prioridad

¡Todo listo! 🎉
