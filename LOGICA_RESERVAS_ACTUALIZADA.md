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

## 🚀 Próximos Pasos

1. ✅ Probar los endpoints con Postman
2. ✅ Implementar frontend con calendario
3. ✅ Agregar notificaciones (email/SMS) para cancelaciones/reprogramaciones
4. ✅ Dashboard de admin para gestionar reservas

¡Todo listo! 🎉
