import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva } from './interfaces/reservas.interface';
import { Aula } from '../aulas/interfaces/aulas.interface';
import { Equipo } from '../equipos/interfaces/equipos.interface';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';

@Injectable()
export class ReservasService {
    constructor(
        @InjectModel('Reserva') private readonly reservaModel: Model<Reserva>,
        @InjectModel('Aula') private readonly aulaModel: Model<Aula>,
        @InjectModel('Equipo') private readonly equipoModel: Model<Equipo>,
    ) { }

    // Crear nueva reserva
    async createReserva(createReservaDto: CreateReservaDto): Promise<Reserva> {
        const { tipo, aula, equipos, fecha, horaInicio, horaFin } = createReservaDto;

        // ===== VALIDACIÓN: 2 DÍAS DE ANTICIPACIÓN =====
        // COMENTADO TEMPORALMENTE PARA PRUEBAS
        const fechaReserva = new Date(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaReserva.setHours(0, 0, 0, 0);

        /* const diferenciaDias = Math.ceil((fechaReserva.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        if (diferenciaDias < 2) {
            throw new HttpException(
                'Las reservas deben realizarse con al menos 2 días de anticipación',
                HttpStatus.BAD_REQUEST,
            );
        } */

        let aulasIds: string[] = [];

        // Si el tipo es 'equipo', buscar las aulas que contienen esos equipos
        if (tipo === 'equipo') {
            if (!equipos || equipos.length === 0) {
                throw new HttpException(
                    'Debe seleccionar al menos un equipo',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Verificar que todos los equipos existen
            const equiposEncontrados = await this.equipoModel.find({
                _id: { $in: equipos },
            });

            if (equiposEncontrados.length !== equipos.length) {
                throw new HttpException(
                    'Uno o más equipos no existen',
                    HttpStatus.NOT_FOUND,
                );
            }

            // Buscar las aulas que contienen estos equipos
            let aulas = await this.aulaModel.find({
                equipos: { $in: equipos },
            }).populate('equipos');

            console.log('Equipos buscados:', equipos);
            console.log('Aulas encontradas con $in:', aulas.length);

            // Si no se encuentran aulas, intentar búsqueda alternativa
            if (aulas.length === 0) {
                const todasLasAulas = await this.aulaModel.find().populate('equipos');
                aulas = todasLasAulas.filter((aula: any) => {
                    if (!aula.equipos || aula.equipos.length === 0) return false;
                    return aula.equipos.some((equipo: any) =>
                        equipos.includes(equipo._id.toString())
                    );
                });

                console.log('Aulas encontradas con búsqueda manual:', aulas.length);
            }

            if (aulas.length === 0) {
                throw new HttpException(
                    'Los equipos seleccionados no están asociados a ningún aula. Todos los equipos deben pertenecer a un aula.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // ===== VALIDACIÓN CRÍTICA: Todos los equipos deben pertenecer a LA MISMA AULA =====
            // Verificar que todos los equipos pertenezcan a una única aula
            const aulasUnicas = new Set<string>();
            
            for (const aulaDoc of aulas) {
                const aula: any = aulaDoc;
                // Verificar si esta aula contiene alguno de los equipos seleccionados
                if (aula.equipos && aula.equipos.length > 0) {
                    const tieneEquipos = aula.equipos.some((equipo: any) =>
                        equipos.includes(equipo._id.toString())
                    );
                    if (tieneEquipos) {
                        aulasUnicas.add(aula._id.toString());
                    }
                }
            }

            // Si los equipos pertenecen a más de un aula, rechazar
            if (aulasUnicas.size > 1) {
                throw new HttpException(
                    'Los equipos seleccionados pertenecen a diferentes aulas. Solo puede reservar equipos que estén en la misma aula.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Verificar que TODOS los equipos seleccionados estén en el aula encontrada
            const aulaFinal: any = aulas[0];
            const equiposEnAula = aulaFinal.equipos.map((e: any) => e._id.toString());
            
            const todosLosEquiposEnAula = equipos.every((equipoId: string) =>
                equiposEnAula.includes(equipoId)
            );

            if (!todosLosEquiposEnAula) {
                throw new HttpException(
                    'No todos los equipos seleccionados pertenecen a la misma aula. Debe seleccionar equipos de una única aula.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            aulasIds = [aulaFinal._id.toString()];
        } else if (tipo === 'aula') {
            // Si el tipo es 'aula', verificar que existe
            if (!aula) {
                throw new HttpException(
                    'Debe seleccionar un aula',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const aulaEncontrada = await this.aulaModel.findById(aula);
            if (!aulaEncontrada) {
                throw new HttpException('El aula no existe', HttpStatus.NOT_FOUND);
            }

            aulasIds = [aula];
        }

        // ===== VALIDACIÓN: Verificar que pase al menos 1 día completo desde cualquier reserva cercana =====
        // Si reservan el lunes (día 1), pueden reservar el miércoles (día 3), dejando el martes libre
        
        // Buscar reservas cercanas (1 día antes o 1 día después)
        const unDiaAntes = new Date(fechaReserva);
        unDiaAntes.setDate(fechaReserva.getDate() - 2);
        
        const unDiaDespues = new Date(fechaReserva);
        unDiaDespues.setDate(fechaReserva.getDate() + 2);

        const reservasCercanas = await this.reservaModel
            .find({
                aulas: { $in: aulasIds },
                estado: { $in: ['pendiente', 'confirmada'] },
                fecha: {
                    $gte: unDiaAntes,
                    $lt: unDiaDespues
                }
            })
            .exec();

        // Verificar que no haya reservas en el día anterior o siguiente (debe haber 1 día libre)
        for (const reservaCercana of reservasCercanas) {
            const fechaReservaCercana = new Date(reservaCercana.fecha);
            fechaReservaCercana.setHours(0, 0, 0, 0);
            
            const diferenciaDias = Math.abs(Math.floor((fechaReserva.getTime() - fechaReservaCercana.getTime()) / (1000 * 60 * 60 * 24)));

            // Si la diferencia es 0 (mismo día) o 1 (día consecutivo), rechazar
            if (diferenciaDias < 2) {
                throw new HttpException(
                    `El aula tiene una reserva el ${fechaReservaCercana.toLocaleDateString('es-PE')}. Debe dejar al menos 1 día libre entre reservas.`,
                    HttpStatus.BAD_REQUEST,
                );
            }
        }

        // Validar disponibilidad en el horario específico
        const disponible = await this.checkDisponibilidad(
            aulasIds,
            equipos || [],
            fecha,
            horaInicio,
            horaFin,
        );

        if (!disponible) {
            throw new HttpException(
                'El aula no está disponible en el horario seleccionado. Ya existe una reserva en ese momento.',
                HttpStatus.CONFLICT,
            );
        }

        // Normalizar la fecha para evitar problemas de zona horaria
        const fechaNormalizada = new Date(fecha);
        fechaNormalizada.setHours(12, 0, 0, 0); // Establecer al mediodía para evitar cambios de día

        // Determinar el estado inicial según si la reserva ya pasó
        const ahora = new Date();
        const [horaFinNum, minutosFinNum] = horaFin.split(':').map(Number);
        const fechaFinReserva = new Date(fecha);
        fechaFinReserva.setHours(horaFinNum, minutosFinNum, 0, 0);

        let estadoInicial = 'confirmada';
        if (fechaFinReserva < ahora) {
            estadoInicial = 'cerrada'; // Si ya pasó, marcarla como cerrada
        }

        // Crear la reserva
        const nuevaReserva = new this.reservaModel({
            ...createReservaDto,
            fecha: fechaNormalizada, // Usar fecha normalizada
            aulas: aulasIds,
            equipos: tipo === 'equipo' ? equipos : [],
            estado: estadoInicial,
        });

        return await nuevaReserva.save();
    }

    // Obtener todas las reservas
    async getAllReservas(): Promise<Reserva[]> {
        return await this.reservaModel
            .find()
            .populate('aulas')
            .populate('equipos')
            .exec();
    }

    // Obtener reserva por ID
    async getReservaById(id: string): Promise<Reserva> {
        const reserva = await this.reservaModel
            .findById(id)
            .populate('aulas')
            .populate('equipos')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        return reserva;
    }

    // Actualizar reserva
    async updateReserva(
        id: string,
        updateReservaDto: UpdateReservaDto,
    ): Promise<Reserva> {
        const reserva = await this.reservaModel.findByIdAndUpdate(
            id,
            { ...updateReservaDto, updatedAt: new Date() },
            { new: true },
        );

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        return reserva;
    }

    // Reprogramar reserva (cambiar fecha/hora)
    async reprogramarReserva(
        id: string,
        fecha: Date,
        horaInicio: string,
        horaFin: string,
        motivo?: string,
    ): Promise<Reserva> {
        const reserva = await this.reservaModel.findById(id).populate('aulas');

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        if (reserva.estado === 'cancelada') {
            throw new HttpException(
                'No se puede reprogramar una reserva cancelada',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Validar 2 días de anticipación para la nueva fecha
        const nuevaFecha = new Date(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        nuevaFecha.setHours(0, 0, 0, 0);

        const diferenciaDias = Math.ceil((nuevaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        if (diferenciaDias < 2) {
            throw new HttpException(
                'La reprogramación debe ser con al menos 2 días de anticipación',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Validar disponibilidad en la nueva fecha/hora (excluyendo esta reserva)
        const disponible = await this.checkDisponibilidad(
            reserva.aulas || [],
            reserva.equipos || [],
            fecha,
            horaInicio,
            horaFin,
            id,
        );

        if (!disponible) {
            throw new HttpException(
                'El aula no está disponible en el nuevo horario',
                HttpStatus.CONFLICT,
            );
        }

        // Guardar información de la reprogramación
        reserva.fecha = fecha;
        reserva.horaInicio = horaInicio;
        reserva.horaFin = horaFin;
        if (motivo) {
            reserva.motivo = `${reserva.motivo} [REPROGRAMADA: ${motivo}]`;
        }
        reserva.updatedAt = new Date();

        return await reserva.save();
    }

    // Cancelar reserva (solo admin o el mismo usuario)
    async cancelarReserva(
        id: string, 
        isAdmin: boolean = false,
        motivoCancelacion?: string,
        correoUsuario?: string
    ): Promise<Reserva> {
        const reserva = await this.reservaModel.findById(id);

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        // Permitir cancelación si es admin O si es el mismo usuario
        if (!isAdmin && (!correoUsuario || correoUsuario !== reserva.correo)) {
            throw new HttpException(
                'Solo puedes cancelar tus propias reservas o necesitas ser administrador',
                HttpStatus.FORBIDDEN,
            );
        }

        if (reserva.estado === 'cancelada') {
            throw new HttpException(
                'La reserva ya está cancelada',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Verificar que la reserva sea futura
        const ahora = new Date();
        const fechaReserva = new Date(reserva.fecha);
        
        if (fechaReserva < ahora) {
            throw new HttpException(
                'No se puede cancelar una reserva pasada',
                HttpStatus.BAD_REQUEST,
            );
        }

        reserva.estado = 'cancelada';
        if (motivoCancelacion) {
            reserva.motivo = `${reserva.motivo} [CANCELADA: ${motivoCancelacion}]`;
        }
        reserva.updatedAt = new Date();

        return await reserva.save();
    }

    // Eliminar reserva
    async deleteReserva(id: string): Promise<Reserva> {
        const reserva = await this.reservaModel.findByIdAndDelete(id);

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        return reserva;
    }

    // Obtener reservas por aula
    async getReservasByAula(aulaId: string): Promise<Reserva[]> {
        return await this.reservaModel
            .find({ aulas: aulaId })
            .populate('aulas')
            .populate('equipos')
            .exec();
    }

    // Obtener reservas por equipo
    async getReservasByEquipo(equipoId: string): Promise<Reserva[]> {
        return await this.reservaModel
            .find({ equipos: equipoId })
            .populate('aulas')
            .populate('equipos')
            .exec();
    }

    // Verificar disponibilidad
    async checkDisponibilidad(
        aulasIds: string[],
        equiposIds: string[],
        fecha: Date,
        horaInicio: string,
        horaFin: string,
        excludeReservaId?: string,
    ): Promise<boolean> {
        // Buscar reservas que coincidan con las aulas o equipos en la misma fecha
        const query: any = {
            fecha: fecha,
            estado: { $in: ['pendiente', 'confirmada'] },
        };

        if (excludeReservaId) {
            query._id = { $ne: excludeReservaId };
        }

        // Buscar reservas que incluyan alguna de las aulas o equipos
        query.$or = [];

        if (aulasIds.length > 0) {
            query.$or.push({ aulas: { $in: aulasIds } });
        }

        if (equiposIds.length > 0) {
            query.$or.push({ equipos: { $in: equiposIds } });
        }

        const reservasExistentes = await this.reservaModel.find(query).exec();

        // Verificar si hay conflictos de horario
        for (const reserva of reservasExistentes) {
            if (this.hayConflictoHorario(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin)) {
                return false;
            }
        }

        return true;
    }

    // Verificar si hay conflicto de horario
    private hayConflictoHorario(
        inicio1: string,
        fin1: string,
        inicio2: string,
        fin2: string,
    ): boolean {
        // Convertir a minutos desde medianoche para comparar
        const toMinutes = (hora: string): number => {
            const [h, m] = hora.split(':').map(Number);
            return h * 60 + m;
        };

        const inicio1Min = toMinutes(inicio1);
        const fin1Min = toMinutes(fin1);
        const inicio2Min = toMinutes(inicio2);
        const fin2Min = toMinutes(fin2);

        // Hay conflicto si los rangos se solapan
        return !(fin1Min <= inicio2Min || inicio1Min >= fin2Min);
    }

    // ===== GESTIÓN DE INCIDENCIAS =====

    // Reportar incidencia en una reserva
    async reportarIncidencia(
        reservaId: string,
        descripcion: string,
        tipo: 'tecnica' | 'administrativa' | 'limpieza' | 'otra',
        prioridad: 'baja' | 'media' | 'alta' | 'critica',
        reportadoPor: string,
    ): Promise<Reserva> {
        const reserva = await this.reservaModel.findById(reservaId);

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        const nuevaIncidencia = {
            descripcion,
            tipo,
            prioridad,
            estado: 'reportada' as const,
            reportadoPor,
            reportadoEn: new Date(),
            actualizadoEn: new Date(),
        };

        if (!reserva.incidencias) {
            reserva.incidencias = [];
        }

        reserva.incidencias.push(nuevaIncidencia);
        reserva.updatedAt = new Date();

        return await reserva.save();
    }

    // Actualizar estado de incidencia
    async actualizarIncidencia(
        reservaId: string,
        incidenciaId: string,
        estado: 'reportada' | 'en_revision' | 'en_proceso' | 'resuelta' | 'cerrada',
        resolucion?: string,
    ): Promise<Reserva> {
        const reserva = await this.reservaModel.findById(reservaId);

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        if (!reserva.incidencias || reserva.incidencias.length === 0) {
            throw new HttpException(
                'No hay incidencias en esta reserva',
                HttpStatus.NOT_FOUND,
            );
        }

        const incidencia = reserva.incidencias.find(
            (inc: any) => inc._id.toString() === incidenciaId,
        );

        if (!incidencia) {
            throw new HttpException('Incidencia no encontrada', HttpStatus.NOT_FOUND);
        }

        incidencia.estado = estado;
        if (resolucion) {
            incidencia.resolucion = resolucion;
        }
        incidencia.actualizadoEn = new Date();
        reserva.updatedAt = new Date();

        return await reserva.save();
    }

    // Obtener incidencias de una reserva
    async getIncidenciasByReserva(reservaId: string): Promise<any[]> {
        const reserva = await this.reservaModel.findById(reservaId);

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        return reserva.incidencias || [];
    }

    // Obtener todas las incidencias con filtros
    async getAllIncidencias(filtros?: {
        tipo?: string;
        estado?: string;
        prioridad?: string;
    }): Promise<any[]> {
        const query: any = { 'incidencias.0': { $exists: true } };

        const reservas = await this.reservaModel
            .find(query)
            .populate('aulas')
            .populate('equipos')
            .exec();

        let todasLasIncidencias: any[] = [];

        reservas.forEach((reserva) => {
            if (reserva.incidencias && reserva.incidencias.length > 0) {
                reserva.incidencias.forEach((incidencia: any) => {
                    todasLasIncidencias.push({
                        ...incidencia.toObject(),
                        reservaId: reserva._id,
                        reservaNombre: reserva.nombre,
                        reservaFecha: reserva.fecha,
                        aulas: reserva.aulas,
                        equipos: reserva.equipos,
                    });
                });
            }
        });

        // Aplicar filtros si existen
        if (filtros) {
            if (filtros.tipo) {
                todasLasIncidencias = todasLasIncidencias.filter(
                    (inc) => inc.tipo === filtros.tipo,
                );
            }
            if (filtros.estado) {
                todasLasIncidencias = todasLasIncidencias.filter(
                    (inc) => inc.estado === filtros.estado,
                );
            }
            if (filtros.prioridad) {
                todasLasIncidencias = todasLasIncidencias.filter(
                    (inc) => inc.prioridad === filtros.prioridad,
                );
            }
        }

        return todasLasIncidencias;
    }

    // Eliminar incidencia
    async eliminarIncidencia(
        reservaId: string,
        incidenciaId: string,
    ): Promise<Reserva> {
        const reserva = await this.reservaModel.findById(reservaId);

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        if (!reserva.incidencias || reserva.incidencias.length === 0) {
            throw new HttpException(
                'No hay incidencias en esta reserva',
                HttpStatus.NOT_FOUND,
            );
        }

        const index = reserva.incidencias.findIndex(
            (inc: any) => inc._id.toString() === incidenciaId,
        );

        if (index === -1) {
            throw new HttpException('Incidencia no encontrada', HttpStatus.NOT_FOUND);
        }

        reserva.incidencias.splice(index, 1);
        reserva.updatedAt = new Date();

        return await reserva.save();
    }

    // ===== CIERRE AUTOMÁTICO DE RESERVAS PASADAS =====

    // Verificar y cerrar reservas que ya pasaron
    async cerrarReservasPasadas(): Promise<{ actualizadas: number; detalles: any[] }> {
        const ahora = new Date();
        const detalles: any[] = [];

        // Buscar reservas que ya pasaron y no están cerradas o canceladas
        const reservasPasadas = await this.reservaModel.find({
            estado: { $nin: ['cancelada', 'cerrada', 'cerrada_con_incidencia'] },
        }).exec();

        let actualizadas = 0;

        for (const reserva of reservasPasadas) {
            // Construir fecha y hora completa de fin de la reserva
            const fechaReserva = new Date(reserva.fecha);
            const [horaFin, minutosFin] = reserva.horaFin.split(':').map(Number);
            fechaReserva.setHours(horaFin, minutosFin, 0, 0);

            // Si la reserva ya pasó
            if (fechaReserva < ahora) {
                const tieneIncidencias = reserva.incidencias && reserva.incidencias.length > 0;
                const estadoAnterior = reserva.estado;

                if (tieneIncidencias && reserva.incidencias) {
                    reserva.estado = 'cerrada_con_incidencia';
                    // Cerrar todas las incidencias que no estén cerradas
                    reserva.incidencias.forEach((inc: any) => {
                        if (inc.estado !== 'cerrada') {
                            inc.estado = 'cerrada';
                            inc.actualizadoEn = new Date();
                        }
                    });
                } else {
                    reserva.estado = 'cerrada';
                }

                reserva.updatedAt = new Date();
                await reserva.save();
                actualizadas++;

                detalles.push({
                    reservaId: reserva._id,
                    nombre: reserva.nombre,
                    fecha: reserva.fecha,
                    horaFin: reserva.horaFin,
                    estadoAnterior,
                    estadoNuevo: reserva.estado,
                    incidenciasCerradas: tieneIncidencias && reserva.incidencias ? reserva.incidencias.length : 0,
                });
            }
        }

        return { actualizadas, detalles };
    }

    // Obtener reservas por estado
    async getReservasByEstado(
        estado: 'confirmada' | 'cancelada' | 'completada' | 'cerrada' | 'cerrada_con_incidencia',
    ): Promise<Reserva[]> {
        return await this.reservaModel
            .find({ estado })
            .populate('aulas')
            .populate('equipos')
            .exec();
    }
}
