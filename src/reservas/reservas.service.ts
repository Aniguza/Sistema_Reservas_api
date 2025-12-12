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

            // Extraer IDs de equipos del array con cantidades
            const equiposIds = equipos.map((e: any) => e.equipo);

            // Verificar que todos los equipos existen
            const equiposEncontrados = await this.equipoModel.find({
                _id: { $in: equiposIds },
            });

            if (equiposEncontrados.length !== equipos.length) {
                throw new HttpException(
                    'Uno o más equipos no existen',
                    HttpStatus.NOT_FOUND,
                );
            }

            // Buscar las aulas que contienen estos equipos
            let aulas = await this.aulaModel.find({
                equipos: { $in: equiposIds },
            }).populate('equipos');

            console.log('Equipos buscados:', equiposIds);
            console.log('Aulas encontradas con $in:', aulas.length);

            // Si no se encuentran aulas, intentar búsqueda alternativa
            if (aulas.length === 0) {
                const todasLasAulas = await this.aulaModel.find().populate('equipos');
                aulas = todasLasAulas.filter((aula: any) => {
                    if (!aula.equipos || aula.equipos.length === 0) return false;
                    return aula.equipos.some((equipo: any) =>
                        equiposIds.includes(equipo._id.toString())
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
                        equiposIds.includes(equipo._id.toString())
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
            
            const todosLosEquiposEnAula = equiposIds.every((equipoId: string) =>
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

        // Validar disponibilidad en el horario específico (incluye cantidades por equipo)
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

        // Enriquecer equipos con nombres si no los tienen
        let equiposConNombres = equipos || [];
        if (tipo === 'equipo' && equipos && equipos.length > 0) {
            equiposConNombres = await Promise.all(
                equipos.map(async (eq: any) => {
                    if (!eq.nombre) {
                        const equipoDoc: any = await this.equipoModel.findById(eq.equipo).exec();
                        return {
                            equipo: eq.equipo,
                            nombre: equipoDoc ? equipoDoc.name : 'Desconocido',
                            cantidad: eq.cantidad || 1
                        };
                    }
                    return eq;
                })
            );
        }

        // Crear la reserva
        const nuevaReserva = new this.reservaModel({
            ...createReservaDto,
            fecha: fechaNormalizada, // Usar fecha normalizada
            aulas: aulasIds,
            equipos: tipo === 'equipo' ? equiposConNombres : [],
            estado: estadoInicial,
        });

        const saved = await nuevaReserva.save();

        // Actualizar disponibilidad de los equipos si al reservar se agotó el stock
        if (tipo === 'equipo' && equipos && equipos.length > 0) {
            for (const req of equipos) {
                try {
                    const equipoDoc: any = await this.equipoModel.findById(req.equipo).exec();
                    if (!equipoDoc) continue;

                    // Calcular cantidad reservada en ese intervalo (incluyendo la reserva recién creada)
                    const reservasMismaFecha = await this.reservaModel.find({
                        fecha: fecha,
                        estado: { $in: ['pendiente', 'confirmada'] },
                        'equipos.equipo': req.equipo,
                    }).exec();

                    let totalReservado = 0;
                    for (const r of reservasMismaFecha) {
                        const reserva: any = r;
                        // Revisar solapamiento horario
                        if (this.hayConflictoHorario(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin)) {
                            if (reserva.equipos && reserva.equipos.length > 0) {
                                const match = reserva.equipos.find((ec: any) => ec.equipo.toString() === req.equipo.toString());
                                if (match) totalReservado += (match.cantidad || 1);
                            }
                        }
                    }

                    const restante = (equipoDoc.quantity || 0) - totalReservado;
                    if (restante <= 0) {
                        await this.equipoModel.findByIdAndUpdate(req.equipo, { disponibilidad: 'ocupado' }).exec();
                    }
                } catch (err) {
                    // No bloquear por errores de actualización de equipo
                    console.warn('Error actualizando disponibilidad de equipo:', err.message || err);
                }
            }
        }

        // Retornar la reserva guardada con las aulas pobladas
        const reservaFinal = await this.reservaModel
            .findById(saved._id)
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .exec();
        
        if (!reservaFinal) {
            throw new HttpException('Error al recuperar la reserva creada', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // Transformar la respuesta para aplanar la estructura de equipos
        const reservaObj: any = reservaFinal.toObject();
        if (reservaObj.equipos && reservaObj.equipos.length > 0) {
            reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                equipo: eq.equipo?._id || eq.equipo,
                nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                cantidad: eq.cantidad || 1,
                _id: eq._id
            }));
        }

        return reservaObj;
    }

    // Obtener todas las reservas
    async getAllReservas(): Promise<Reserva[]> {
        const reservas = await this.reservaModel
            .find()
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .exec();

        // Transformar la respuesta para aplanar la estructura de equipos
        return reservas.map((reserva: any) => {
            const reservaObj = reserva.toObject();
            if (reservaObj.equipos && reservaObj.equipos.length > 0) {
                reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                    equipo: eq.equipo?._id || eq.equipo,
                    nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                    cantidad: eq.cantidad || 1,
                    _id: eq._id
                }));
            }
            return reservaObj;
        });
    }

    // Obtener reserva por ID
    async getReservaById(id: string): Promise<Reserva> {
        const reserva = await this.reservaModel
            .findById(id)
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        // Transformar la respuesta para aplanar la estructura de equipos
        const reservaObj: any = reserva.toObject();
        if (reservaObj.equipos && reservaObj.equipos.length > 0) {
            reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                equipo: eq.equipo?._id || eq.equipo,
                nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                cantidad: eq.cantidad || 1,
                _id: eq._id
            }));
        }

        return reservaObj;
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
        const reserva = await this.reservaModel.findById(id);

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

        // Guardar datos anteriores en historial de reprogramaciones
        if (!reserva.reprogramaciones) {
            reserva.reprogramaciones = [];
        }

        reserva.reprogramaciones.push({
            fechaReprogramacion: new Date(),
            fechaAnterior: reserva.fecha,
            fechaNueva: fecha,
            horaInicioAnterior: reserva.horaInicio,
            horaInicioNueva: horaInicio,
            horaFinAnterior: reserva.horaFin,
            horaFinNueva: horaFin,
            motivo: motivo || 'Sin motivo especificado'
        });

        // Actualizar con nuevos datos
        reserva.fecha = fecha;
        reserva.horaInicio = horaInicio;
        reserva.horaFin = horaFin;
        reserva.estado = 'reprogramada';
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
        const reservas = await this.reservaModel
            .find({ aulas: aulaId })
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .exec();

        // Transformar la respuesta para aplanar la estructura de equipos
        return reservas.map((reserva: any) => {
            const reservaObj = reserva.toObject();
            if (reservaObj.equipos && reservaObj.equipos.length > 0) {
                reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                    equipo: eq.equipo?._id || eq.equipo,
                    nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                    cantidad: eq.cantidad || 1,
                    _id: eq._id
                }));
            }
            return reservaObj;
        });
    }

    // Obtener reservas por equipo
    async getReservasByEquipo(equipoId: string): Promise<Reserva[]> {
        const reservas = await this.reservaModel
            .find({ 'equipos.equipo': equipoId })
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .exec();

        // Transformar la respuesta para aplanar la estructura de equipos
        return reservas.map((reserva: any) => {
            const reservaObj = reserva.toObject();
            if (reservaObj.equipos && reservaObj.equipos.length > 0) {
                reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                    equipo: eq.equipo?._id || eq.equipo,
                    nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                    cantidad: eq.cantidad || 1,
                    _id: eq._id
                }));
            }
            return reservaObj;
        });
    }

    // Obtener reservas por usuario (correo)
    async getReservasByUsuario(correo: string): Promise<any[]> {
        const reservas = await this.reservaModel
            .find({ correo: correo })
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .sort({ fecha: -1 }) // Ordenar por fecha descendente (más recientes primero)
            .exec();

        // Transformar la respuesta y enriquecer con nombres de compañeros
        const reservasEnriquecidas = await Promise.all(
            reservas.map(async (reserva: any) => {
                const reservaObj = reserva.toObject();
                
                // Aplanar estructura de equipos
                if (reservaObj.equipos && reservaObj.equipos.length > 0) {
                    reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                        equipo: eq.equipo?._id || eq.equipo,
                        nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                        cantidad: eq.cantidad || 1,
                        _id: eq._id
                    }));
                }

                // Enriquecer compañeros con sus nombres
                if (reservaObj.companeros && reservaObj.companeros.length > 0) {
                    try {
                        const Usuario = this.reservaModel.db.model('Usuario');
                        const usuarios = await Usuario.find(
                            { _id: { $in: reservaObj.companeros } },
                            '_id correo nombre'
                        ).exec();

                        reservaObj.companeros = reservaObj.companeros.map((id: string) => {
                            const usuario = usuarios.find((u: any) => u._id.toString() === id);
                            const codigo = usuario?.correo ? usuario.correo.split('@')[0] : 'Sin código';
                            return {
                                id: id,
                                codigo: codigo,
                                nombre: usuario?.nombre || 'No encontrado'
                            };
                        });
                    } catch (error) {
                        // Si hay error, mantener solo IDs
                        console.warn('Error buscando compañeros:', error);
                        reservaObj.companeros = reservaObj.companeros.map((id: string) => ({
                            id: id,
                            codigo: 'Sin código',
                            nombre: 'No encontrado'
                        }));
                    }
                }

                return reservaObj;
            })
        );

        return reservasEnriquecidas;
    }

    // Verificar disponibilidad
    async checkDisponibilidad(
        aulasIds: string[],
        equipos: { equipo: string; nombre: string; cantidad: number }[],
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

        const equiposIds = equipos.map((e: any) => e.equipo);

        // Buscar reservas que incluyan alguna de las aulas o equipos
        query.$or = [];

        if (aulasIds.length > 0) {
            query.$or.push({ aulas: { $in: aulasIds } });
        }

        if (equiposIds.length > 0) {
            query.$or.push({ 'equipos.equipo': { $in: equiposIds } });
        }

        const reservasExistentes = await this.reservaModel.find(query).exec();

        // Verificar conflictos de horario por aula (si hay alguna reserva que se solape)
        for (const reserva of reservasExistentes) {
            if (this.hayConflictoHorario(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin)) {
                // Si la reserva existente afecta a aulas solicitadas -> no disponible
                if (aulasIds.length > 0 && reserva.aulas && reserva.aulas.some((a: any) => aulasIds.includes(a.toString()))) {
                    return false;
                }
            }
        }

        // Verificar cantidades por equipo
        if (equipos && equipos.length > 0) {
            for (const req of equipos) {
                // obtener el documento del equipo para conocer la cantidad total
                const equipoDoc: any = await this.equipoModel.findById(req.equipo).exec();
                if (!equipoDoc) {
                    throw new HttpException(`Equipo ${req.equipo} no existe`, HttpStatus.NOT_FOUND);
                }

                // Buscar reservas en la misma fecha que referencien este equipo
                const reservasConEquipo = await this.reservaModel.find({
                    fecha: fecha,
                    estado: { $in: ['pendiente', 'confirmada'] },
                    'equipos.equipo': req.equipo,
                }).exec();

                let totalReservado = 0;

                for (const r of reservasConEquipo) {
                    const reserva: any = r;
                    if (excludeReservaId && reserva._id.toString() === excludeReservaId) continue;
                    if (this.hayConflictoHorario(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin)) {
                        if (reserva.equipos && reserva.equipos.length > 0) {
                            const match = reserva.equipos.find((ec: any) => ec.equipo.toString() === req.equipo.toString());
                            if (match) totalReservado += (match.cantidad || 1);
                        }
                    }
                }

                // cantidad disponible actual
                const disponibleEquipo = (equipoDoc.quantity || 0) - totalReservado;
                if (disponibleEquipo < req.cantidad) {
                    return false;
                }
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
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
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
        const reservas = await this.reservaModel
            .find({ estado })
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .exec();

        // Transformar la respuesta para aplanar la estructura de equipos
        return reservas.map((reserva: any) => {
            const reservaObj = reserva.toObject();
            if (reservaObj.equipos && reservaObj.equipos.length > 0) {
                reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                    equipo: eq.equipo?._id || eq.equipo,
                    nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                    cantidad: eq.cantidad || 1,
                    _id: eq._id
                }));
            }
            return reservaObj;
        });
    }

    // ===== DASHBOARD STATS - ENDPOINT OPTIMIZADO =====
    
    // Obtener estadísticas agregadas para el dashboard en una sola llamada
    async getDashboardStats(): Promise<any> {
        try {
            const ahora = new Date();
            const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

            // Obtener todas las reservas en paralelo
            const [
                todasReservas,
                reservasMes,
                incidenciasAbiertas,
                aulasData,
                equiposData
            ] = await Promise.all([
                this.reservaModel.find().populate('aulas', 'name').populate('equipos.equipo', 'name').exec(),
                this.reservaModel.find({
                    fecha: { $gte: inicioMes, $lte: finMes }
                }).exec(),
                this.reservaModel.find({
                    'incidencias.0': { $exists: true },
                    'incidencias.estado': { $in: ['reportada', 'en_revision', 'en_proceso'] }
                }).exec(),
                this.aulaModel.find().exec(),
                this.equipoModel.find().exec()
            ]);

        // ===== ESTADÍSTICAS GENERALES =====
        const totalReservas = todasReservas.length;
        const reservasActivas = todasReservas.filter((r: any) => 
            r.estado === 'confirmada' || r.estado === 'en_curso'
        ).length;
        const reservasCanceladas = todasReservas.filter((r: any) => r.estado === 'cancelada').length;
        const reservasCerradas = todasReservas.filter((r: any) => 
            r.estado === 'cerrada' || r.estado === 'cerrada_con_incidencia'
        ).length;

        // Contar incidencias abiertas
        let totalIncidenciasAbiertas = 0;
        incidenciasAbiertas.forEach((r: any) => {
            if (r.incidencias && r.incidencias.length > 0) {
                totalIncidenciasAbiertas += r.incidencias.filter((inc: any) => 
                    ['reportada', 'en_revision', 'en_proceso'].includes(inc.estado)
                ).length;
            }
        });

        const stats = {
            totalReservas,
            reservasActivas,
            reservasCanceladas,
            reservasCerradas,
            incidenciasAbiertas: totalIncidenciasAbiertas,
            totalAulas: aulasData.length,
            totalEquipos: equiposData.length
        };

        // ===== DATOS PARA GRÁFICAS (ÚLTIMOS 7 DÍAS) =====
        const ultimosSieteDias: string[] = [];
        const reservasPorDia: number[] = [];
        
        for (let i = 6; i >= 0; i--) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            fecha.setHours(0, 0, 0, 0);
            
            const fechaFin = new Date(fecha);
            fechaFin.setHours(23, 59, 59, 999);
            
            const reservasDia = todasReservas.filter((r: any) => {
                const fechaReserva = new Date(r.fecha);
                return fechaReserva >= fecha && fechaReserva <= fechaFin;
            }).length;
            
            const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
            const label = `${dias[fecha.getDay()]} ${fecha.getDate()}`;
            ultimosSieteDias.push(label);
            reservasPorDia.push(reservasDia);
        }

        const chartData = {
            labels: ultimosSieteDias,
            data: reservasPorDia
        };

        // ===== RESERVAS POR MES (ÚLTIMOS 6 MESES) =====
        const reservasPorMes: number[] = [];
        const labelsMeses: string[] = [];
        
        for (let i = 5; i >= 0; i--) {
            const fecha = new Date();
            fecha.setMonth(fecha.getMonth() - i);
            const mesInicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
            const mesFin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
            
            const reservasMes = todasReservas.filter((r: any) => {
                const fechaReserva = new Date(r.fecha);
                return fechaReserva >= mesInicio && fechaReserva <= mesFin;
            }).length;
            
            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            labelsMeses.push(meses[mesInicio.getMonth()]);
            reservasPorMes.push(reservasMes);
        }

        const monthlyChartData = {
            labels: labelsMeses,
            data: reservasPorMes
        };

        // ===== RANKING DE AULAS MÁS RESERVADAS =====
        const aulasContador: any = {};
        
        todasReservas.forEach((r: any) => {
            if (r.aulas && Array.isArray(r.aulas) && r.aulas.length > 0) {
                r.aulas.forEach((aula: any) => {
                    if (!aula) return;
                    
                    let aulaId: string;
                    let aulaNombre: string;
                    
                    if (typeof aula === 'object' && aula._id) {
                        aulaId = aula._id.toString();
                        aulaNombre = aula.name || 'Sin nombre';
                    } else if (typeof aula === 'string') {
                        aulaId = aula;
                        aulaNombre = 'Sin nombre';
                    } else {
                        return;
                    }
                    
                    if (!aulasContador[aulaId]) {
                        aulasContador[aulaId] = { nombre: aulaNombre, count: 0 };
                    }
                    aulasContador[aulaId].count++;
                });
            }
        });

        const aulasRanking = Object.entries(aulasContador)
            .map(([id, data]: any) => ({ id, nombre: data.nombre, reservas: data.count }))
            .sort((a, b) => b.reservas - a.reservas)
            .slice(0, 5);

        // ===== RANKING DE EQUIPOS MÁS RESERVADOS =====
        const equiposContador: any = {};
        
        todasReservas.forEach((r: any) => {
            if (r.equipos && Array.isArray(r.equipos) && r.equipos.length > 0) {
                r.equipos.forEach((eq: any) => {
                    if (!eq || !eq.equipo) return;
                    
                    let equipoId: string;
                    let equipoNombre: string;
                    
                    if (typeof eq.equipo === 'object' && eq.equipo._id) {
                        equipoId = eq.equipo._id.toString();
                        equipoNombre = eq.equipo.name || eq.nombre || 'Sin nombre';
                    } else if (typeof eq.equipo === 'string') {
                        equipoId = eq.equipo;
                        equipoNombre = eq.nombre || 'Sin nombre';
                    } else {
                        return;
                    }
                    
                    const cantidad = eq.cantidad || 1;
                    
                    if (!equiposContador[equipoId]) {
                        equiposContador[equipoId] = { nombre: equipoNombre, count: 0 };
                    }
                    equiposContador[equipoId].count += cantidad;
                });
            }
        });

        const equiposRanking = Object.entries(equiposContador)
            .map(([id, data]: any) => ({ id, nombre: data.nombre, reservas: data.count }))
            .sort((a, b) => b.reservas - a.reservas)
            .slice(0, 5);

        // ===== DISTRIBUCIÓN POR TIPO =====
        const reservasPorTipo = {
            aula: todasReservas.filter((r: any) => r.tipo === 'aula').length,
            equipo: todasReservas.filter((r: any) => r.tipo === 'equipo').length
        };

        // ===== DISTRIBUCIÓN POR ESTADO =====
        const reservasPorEstado = {
            confirmada: todasReservas.filter((r: any) => r.estado === 'confirmada').length,
            cancelada: reservasCanceladas,
            cerrada: reservasCerradas,
            en_curso: todasReservas.filter((r: any) => r.estado === 'en_curso').length,
            cerrada_con_incidencia: todasReservas.filter((r: any) => r.estado === 'cerrada_con_incidencia').length
        };

        // ===== PRÓXIMAS RESERVAS (SIGUIENTE SEMANA) =====
        const proximaSemana = new Date();
        proximaSemana.setDate(proximaSemana.getDate() + 7);
        
        const proximasReservas = todasReservas
            .filter((r: any) => {
                const fechaReserva = new Date(r.fecha);
                return fechaReserva >= ahora && fechaReserva <= proximaSemana && 
                       (r.estado === 'confirmada' || r.estado === 'en_curso');
            })
            .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
            .slice(0, 5)
            .map((r: any) => ({
                id: r._id,
                nombre: r.nombre,
                fecha: r.fecha,
                horaInicio: r.horaInicio,
                horaFin: r.horaFin,
                tipo: r.tipo,
                estado: r.estado,
                aulas: r.aulas?.map((a: any) => a.name || 'Sin nombre') || []
            }));

        return {
            stats,
            chartData,
            monthlyChartData,
            aulasRanking,
            equiposRanking,
            reservasPorTipo,
            reservasPorEstado,
            proximasReservas
        };
        } catch (error) {
            console.error('Error en getDashboardStats:', error);
            throw new HttpException(
                `Error al obtener estadísticas del dashboard: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
} 
