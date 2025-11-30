# Ejemplos de Implementación Frontend

## 🎯 Componente: Catálogo de Equipos

```javascript
import { useEffect, useState } from 'react';

function CatalogoEquipos() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar equipos con disponibilidad
    fetch('http://localhost:3000/equipos/catalogo/disponibilidad')
      .then(res => res.json())
      .then(data => {
        setEquipos(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {equipos.map(equipo => (
        <EquipoCard key={equipo._id} equipo={equipo} />
      ))}
    </div>
  );
}

function EquipoCard({ equipo }) {
  const tieneReservas = equipo.fechasReservadas.length > 0;
  const estaDisponible = equipo.disponibilidadGeneral;

  return (
    <div className="border rounded-lg p-4">
      <img src={equipo.imageUrl} alt={equipo.name} />
      <h3>{equipo.name}</h3>
      <p>{equipo.description}</p>

      {/* Indicador de disponibilidad */}
      {!estaDisponible ? (
        <span className="badge badge-danger">❌ Fuera de servicio</span>
      ) : tieneReservas ? (
        <span className="badge badge-warning">
          ⚠️ Ver disponibilidad
        </span>
      ) : (
        <span className="badge badge-success">✅ Disponible</span>
      )}

      <button onClick={() => verDetalles(equipo._id)}>
        Ver detalles
      </button>
    </div>
  );
}
```

---

## 📅 Componente: Calendario de Disponibilidad

```javascript
import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function CalendarioDisponibilidad({ equipoId }) {
  const [fechasReservadas, setFechasReservadas] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    // Obtener fechas reservadas del equipo
    fetch(`http://localhost:3000/equipos/${equipoId}/fechas-reservadas`)
      .then(res => res.json())
      .then(data => {
        setFechasReservadas(data.fechasReservadas);
      });
  }, [equipoId]);

  // Función para determinar si una fecha está reservada
  const estaReservada = (fecha) => {
    return fechasReservadas.some(reserva => {
      const fechaReserva = new Date(reserva.fecha);
      return (
        fechaReserva.getDate() === fecha.getDate() &&
        fechaReserva.getMonth() === fecha.getMonth() &&
        fechaReserva.getFullYear() === fecha.getFullYear()
      );
    });
  };

  // Función para aplicar estilos a las fechas
  const tileClassName = ({ date }) => {
    if (estaReservada(date)) {
      return 'fecha-reservada'; // CSS: background-color: #ff5555;
    }
    return null;
  };

  // Obtener horarios reservados para la fecha seleccionada
  const horariosReservados = fechasReservadas
    .filter(reserva => {
      const fechaReserva = new Date(reserva.fecha);
      return (
        fechaReserva.getDate() === selectedDate.getDate() &&
        fechaReserva.getMonth() === selectedDate.getMonth() &&
        fechaReserva.getFullYear() === selectedDate.getFullYear()
      );
    });

  return (
    <div>
      <h3>Selecciona una fecha</h3>
      <Calendar
        onChange={setSelectedDate}
        value={selectedDate}
        tileClassName={tileClassName}
        tileDisabled={({ date }) => date < new Date()} // Deshabilitar fechas pasadas
      />

      {/* Mostrar horarios reservados para la fecha seleccionada */}
      {horariosReservados.length > 0 && (
        <div className="mt-4">
          <h4>Horarios NO disponibles para {selectedDate.toLocaleDateString()}:</h4>
          <ul>
            {horariosReservados.map((horario, index) => (
              <li key={index} className="text-red-600">
                ❌ {horario.horaInicio} - {horario.horaFin}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Componente: Formulario de Reserva con Validación

```javascript
import { useState } from 'react';

function FormularioReserva({ equipoId }) {
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    motivo: ''
  });

  const [errors, setErrors] = useState({});
  const [verificando, setVerificando] = useState(false);

  // Verificar disponibilidad antes de enviar
  const verificarDisponibilidad = async () => {
    setVerificando(true);
    
    const params = new URLSearchParams({
      fecha: formData.fecha,
      horaInicio: formData.horaInicio,
      horaFin: formData.horaFin
    });

    try {
      const response = await fetch(
        `http://localhost:3000/equipos/${equipoId}/verificar-disponibilidad?${params}`
      );
      const data = await response.json();
      
      setVerificando(false);
      return data.disponible;
    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      setVerificando(false);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // 1. Validar campos
    if (!formData.fecha || !formData.horaInicio || !formData.horaFin) {
      setErrors({ general: 'Por favor completa todos los campos' });
      return;
    }

    // 2. Verificar disponibilidad
    const disponible = await verificarDisponibilidad();
    
    if (!disponible) {
      setErrors({ 
        disponibilidad: '❌ Este equipo NO está disponible en el horario seleccionado. Por favor elige otro horario.' 
      });
      return;
    }

    // 3. Si está disponible, crear la reserva
    try {
      const response = await fetch('http://localhost:3000/reservas/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          correo: formData.correo,
          tipo: 'equipo',
          equipos: [equipoId],
          fecha: formData.fecha,
          horaInicio: formData.horaInicio,
          horaFin: formData.horaFin,
          motivo: formData.motivo
        })
      });

      if (response.ok) {
        alert('✅ Reserva creada exitosamente!');
        // Resetear formulario o redirigir
      } else {
        setErrors({ general: 'Error al crear la reserva' });
      }
    } catch (error) {
      setErrors({ general: 'Error de conexión' });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Nombre:</label>
        <input
          type="text"
          value={formData.nombre}
          onChange={(e) => setFormData({...formData, nombre: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Correo:</label>
        <input
          type="email"
          value={formData.correo}
          onChange={(e) => setFormData({...formData, correo: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Fecha:</label>
        <input
          type="date"
          value={formData.fecha}
          onChange={(e) => setFormData({...formData, fecha: e.target.value})}
          min={new Date().toISOString().split('T')[0]} // No permitir fechas pasadas
          required
        />
      </div>

      <div>
        <label>Hora inicio:</label>
        <input
          type="time"
          value={formData.horaInicio}
          onChange={(e) => setFormData({...formData, horaInicio: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Hora fin:</label>
        <input
          type="time"
          value={formData.horaFin}
          onChange={(e) => setFormData({...formData, horaFin: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Motivo:</label>
        <textarea
          value={formData.motivo}
          onChange={(e) => setFormData({...formData, motivo: e.target.value})}
          required
        />
      </div>

      {/* Mostrar errores */}
      {errors.general && (
        <div className="alert alert-danger">{errors.general}</div>
      )}
      {errors.disponibilidad && (
        <div className="alert alert-warning">{errors.disponibilidad}</div>
      )}

      <button type="submit" disabled={verificando}>
        {verificando ? 'Verificando...' : 'Crear Reserva'}
      </button>
    </form>
  );
}
```

---

## 🔍 Componente: Vista Detalle de Equipo

```javascript
function DetalleEquipo({ equipoId }) {
  const [equipo, setEquipo] = useState(null);
  const [fechasReservadas, setFechasReservadas] = useState([]);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  useEffect(() => {
    // Obtener info del equipo
    fetch(`http://localhost:3000/equipos/${equipoId}`)
      .then(res => res.json())
      .then(data => setEquipo(data));

    // Obtener fechas reservadas
    fetch(`http://localhost:3000/equipos/${equipoId}/fechas-reservadas`)
      .then(res => res.json())
      .then(data => setFechasReservadas(data.fechasReservadas));
  }, [equipoId]);

  if (!equipo) return <div>Cargando...</div>;

  return (
    <div>
      <h1>{equipo.name}</h1>
      <img src={equipo.imageUrl} alt={equipo.name} />
      <p>{equipo.description}</p>
      <p>Categoría: {equipo.category}</p>

      {/* Estado */}
      {equipo.disponibilidad === false ? (
        <div className="alert alert-danger">
          ❌ Este equipo está fuera de servicio
        </div>
      ) : (
        <>
          <div className="alert alert-success">
            ✅ Equipo disponible para reserva
          </div>

          {/* Botones */}
          <button 
            onClick={() => setMostrarCalendario(!mostrarCalendario)}
            className="btn btn-info"
          >
            {mostrarCalendario ? 'Ocultar' : 'Ver'} disponibilidad
          </button>

          {mostrarCalendario && (
            <CalendarioDisponibilidad 
              equipoId={equipoId} 
            />
          )}

          <button className="btn btn-primary">
            Reservar este equipo
          </button>
        </>
      )}

      {/* Próximas reservas */}
      {fechasReservadas.length > 0 && (
        <div className="mt-4">
          <h3>Próximas reservas:</h3>
          <ul>
            {fechasReservadas.slice(0, 5).map((reserva, index) => (
              <li key={index}>
                📅 {new Date(reserva.fecha).toLocaleDateString()} 
                | 🕐 {reserva.horaInicio} - {reserva.horaFin}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 CSS para el Calendario

```css
/* Marcar fechas reservadas en rojo */
.fecha-reservada {
  background-color: #ff5555 !important;
  color: white !important;
  font-weight: bold;
}

.fecha-reservada:hover {
  background-color: #ff3333 !important;
}

/* Fechas disponibles en verde */
.react-calendar__tile:not(.fecha-reservada):enabled {
  background-color: #e8f5e9;
}

.react-calendar__tile:not(.fecha-reservada):enabled:hover {
  background-color: #4caf50;
  color: white;
}

/* Deshabilitar fechas pasadas */
.react-calendar__tile:disabled {
  background-color: #f5f5f5;
  color: #ccc;
  cursor: not-allowed;
}
```

---

## 📱 Ejemplo: Pantalla de Administrador

```javascript
function PanelAdmin() {
  const [equipos, setEquipos] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/equipos/catalogo/disponibilidad')
      .then(res => res.json())
      .then(data => setEquipos(data));
  }, []);

  return (
    <div>
      <h1>Panel de Administración</h1>
      <button className="btn btn-primary">Crear nuevo equipo</button>

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Estado General</th>
            <th>Reservas Activas</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map(equipo => (
            <tr key={equipo._id}>
              <td>{equipo.name}</td>
              <td>{equipo.category}</td>
              <td>
                {equipo.disponibilidadGeneral ? (
                  <span className="badge badge-success">✅ Activo</span>
                ) : (
                  <span className="badge badge-danger">❌ Inactivo</span>
                )}
              </td>
              <td>
                <span className="badge badge-info">
                  {equipo.fechasReservadas.length} reservas
                </span>
              </td>
              <td>
                <button className="btn btn-sm btn-primary">Editar</button>
                <button className="btn btn-sm btn-danger">Eliminar</button>
                <button className="btn btn-sm btn-info">Ver reservas</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 🚀 Resumen de Flujo Completo

### 1. Usuario visita el catálogo
```javascript
GET /equipos/catalogo/disponibilidad
// Muestra todos los equipos con sus fechas reservadas
```

### 2. Usuario hace clic en un equipo
```javascript
GET /equipos/:id/fechas-reservadas
// Muestra calendario con fechas en rojo
```

### 3. Usuario selecciona fecha y hora
```javascript
GET /equipos/:id/verificar-disponibilidad?fecha=...&horaInicio=...&horaFin=...
// Valida antes de permitir enviar el formulario
```

### 4. Usuario crea la reserva
```javascript
POST /reservas/create
// Crea la reserva en la base de datos
```

### 5. Automáticamente...
- La próxima vez que se llame a `/catalogo/disponibilidad`, la nueva fecha aparecerá como reservada
- El calendario se actualizará automáticamente
- No se necesita actualizar el equipo manualmente ✅

