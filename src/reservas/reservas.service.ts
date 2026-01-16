import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva } from './interfaces/reservas.interface';
import { Aula } from '../aulas/interfaces/aulas.interface';
import { Equipo } from '../equipos/interfaces/equipos.interface';
import { Usuario } from '../usuarios/interfaces/usuarios.interface';
import { MailService } from '../mail/mail.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { Workbook } from 'exceljs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Chart as ChartJS, registerables } from 'chart.js';

@Injectable()
export class ReservasService {
    private readonly logger = new Logger(ReservasService.name);


    private normalizarCodigoAula(codigo?: string): string | undefined {
        if (!codigo) {
            return undefined;
        }

        const limpio = codigo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return limpio || undefined;
    }

    private async generarCodigoReserva(
        fecha: Date,
        opciones: { codigoAula?: string; excludeId?: string } = {},
    ): Promise<string> {
        const fechaReferencia = new Date(fecha);

        if (Number.isNaN(fechaReferencia.getTime())) {
            throw new Error('Fecha invalida para generar codigo de reserva');
        }

        const year = fechaReferencia.getFullYear();
        const month = String(fechaReferencia.getMonth() + 1).padStart(2, '0');
        const day = String(fechaReferencia.getDate()).padStart(2, '0');

        const inicioDia = new Date(fechaReferencia);
        inicioDia.setHours(0, 0, 0, 0);

        const finDia = new Date(inicioDia);
        finDia.setDate(finDia.getDate() + 1);

        const filtro: any = {
            fecha: {
                $gte: inicioDia,
                $lt: finDia,
            },
        };

        if (opciones.excludeId) {
            filtro._id = { $ne: opciones.excludeId };
        }

        const correlativo = await this.reservaModel.countDocuments(filtro);
        const correlativoStr = String(correlativo + 1).padStart(2, '0');

        const codigoAula = this.normalizarCodigoAula(opciones.codigoAula) ?? 'SINLAB';

        return `RES-PIU-${codigoAula}-${year}${month}${day}-${correlativoStr}`;
    }

    private quitarAcentos(texto: string): string {
        return texto ? texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC') : '';
    }

    private obtenerCodigoDesdeCorreo(correo: string): string {
        if (!correo) {
            return 'SIN-CODIGO';
        }

        return correo.split('@')[0]?.toUpperCase() || 'SIN-CODIGO';
    }

    constructor(
        @InjectModel('Reserva') private readonly reservaModel: Model<Reserva>,
        @InjectModel('Aula') private readonly aulaModel: Model<Aula>,
        @InjectModel('Equipo') private readonly equipoModel: Model<Equipo>,
        @InjectModel('Usuario') private readonly usuarioModel: Model<Usuario>,
        private readonly mailService: MailService,
    ) {
        // Registrar todos los componentes de Chart.js
        ChartJS.register(...registerables);
        this.logger.log('Chart.js registrado con todos los componentes');

        // Configurar fuente que use fuentes embebidas del proyecto (Lato)
        ChartJS.defaults.font.family = 'Lato, lato, sans-serif';
        ChartJS.defaults.font.size = 12;

        this.logger.log(`Configuración de fuente Chart.js: family="${ChartJS.defaults.font.family}", size=${ChartJS.defaults.font.size}`);
        this.logger.log('Configuración de fuente Lato embebida completada en constructor');
    }

    private async construirContextoReserva(reservaId: string) {
        const reserva = await this.reservaModel
            .findById(reservaId)
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        const reservaObj: any = reserva.toObject();

        if (reservaObj.equipos && reservaObj.equipos.length > 0) {
            reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                equipo: eq.equipo?._id || eq.equipo,
                nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                cantidad: eq.cantidad || 1,
                _id: eq._id,
            }));
        }

        const fechaLegible = new Date(reservaObj.fecha).toLocaleDateString('es-PE', { dateStyle: 'full' });
        const aulaReservada = Array.isArray(reservaObj.aulas) ? reservaObj.aulas[0] : undefined;
        const aulaNombre = aulaReservada?.name || aulaReservada?.codigo;
        const ambienteDescripcion =
            reservaObj.tipo === 'equipo'
                ? aulaNombre ? `Equipos en ${aulaNombre}` : 'Reserva de equipos'
                : aulaNombre || 'Ambiente reservado';

        let codigoReserva = reservaObj.codigo;
        if (!codigoReserva) {
            codigoReserva = await this.generarCodigoReserva(new Date(reservaObj.fecha), {
                codigoAula: aulaReservada?.codigo,
                excludeId: reservaObj._id ? String(reservaObj._id) : undefined,
            });
            try {
                await this.reservaModel.findByIdAndUpdate(reservaObj._id, { codigo: codigoReserva }).exec();
                reservaObj.codigo = codigoReserva;
            } catch (legacyError) {
                this.logger.warn(`No se pudo actualizar código de reserva legacy ${reservaObj._id}`, legacyError as Error);
            }
        }

        const codigoAlumno = this.obtenerCodigoDesdeCorreo(reservaObj.correo);

        return {
            reservaObj,
            fechaLegible,
            ambienteDescripcion,
            codigoReserva,
            codigoAlumno,
        };
    }

    private async asegurarCodigoReserva(reserva: any): Promise<string> {
        if (!reserva.codigo) {
            let codigoAula: string | undefined;

            if (Array.isArray(reserva.aulas) && reserva.aulas.length > 0) {
                const primerAulaId = reserva.aulas[0];

                if (primerAulaId) {
                    const aulaDoc: any = await this.aulaModel
                        .findById(primerAulaId)
                        .select('codigo')
                        .lean()
                        .exec();

                    codigoAula = aulaDoc?.codigo;
                }
            }

            reserva.codigo = await this.generarCodigoReserva(new Date(reserva.fecha), {
                codigoAula,
                excludeId: reserva._id ? String(reserva._id) : undefined,
            });
        }

        return reserva.codigo;
    }

    private mapEquiposAplanados(reservaObj: any): void {
        if (Array.isArray(reservaObj.equipos) && reservaObj.equipos.length > 0) {
            reservaObj.equipos = reservaObj.equipos.map((eq: any) => ({
                equipo: eq.equipo?._id || eq.equipo,
                nombre: eq.equipo?.name || eq.nombre || 'Desconocido',
                cantidad: eq.cantidad || 1,
                _id: eq._id,
            }));
        }
    }

    private async mapCompanerosDetallados(reservaObj: any): Promise<void> {
        if (!Array.isArray(reservaObj.companeros) || reservaObj.companeros.length === 0) {
            return;
        }

        const primerElemento = reservaObj.companeros[0];
        if (primerElemento && typeof primerElemento === 'object' && 'id' in primerElemento) {
            return;
        }

        try {
            const ids = reservaObj.companeros.map((comp: any) => comp.toString());
            const usuarios = await this.usuarioModel.find(
                { _id: { $in: ids } },
                '_id correo nombre',
            )
                .lean()
                .exec();

            reservaObj.companeros = ids.map((id: string) => {
                const usuarioEncontrado = usuarios.find((usuario: any) => usuario._id.toString() === id);
                const correo = usuarioEncontrado?.correo || '';
                const codigo = correo ? correo.split('@')[0] : 'Sin código';

                return {
                    id,
                    codigo,
                    nombre: usuarioEncontrado?.nombre || 'No encontrado',
                };
            });
        } catch (error) {
            this.logger.warn(`No se pudo enriquecer la lista de compañeros: ${(error as Error).message}`);
            reservaObj.companeros = reservaObj.companeros.map((comp: any) => ({
                id: comp.toString(),
                codigo: 'Sin código',
                nombre: 'No encontrado',
            }));
        }
    }

    private async construirRespuestaReserva(reserva: any): Promise<any> {
        const reservaObj = typeof reserva?.toObject === 'function' ? reserva.toObject() : { ...reserva };
        this.mapEquiposAplanados(reservaObj);
        await this.mapCompanerosDetallados(reservaObj);
        return reservaObj;
    }

    // Crear nueva reserva
    async createReserva(createReservaDto: CreateReservaDto): Promise<Reserva> {
        const { tipo, aula, equipos, fecha, horaInicio, horaFin } = createReservaDto;

        // ===== VALIDACIÓN: 2 DÍAS DE ANTICIPACIÓN =====
        // COMENTADO TEMPORALMENTE PARA PRUEBAS
        const fechaReserva = new Date(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaReserva.setHours(0, 0, 0, 0);

        const diferenciaDias = Math.ceil((fechaReserva.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        if (diferenciaDias < 2) {
            throw new HttpException(
                'Las reservas deben realizarse con al menos 2 días de anticipación',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Validar que la fecha sea de lunes a viernes
        this.validarDiaPermitido(fechaReserva);

        // ===== VALIDACIÓN: UN USUARIO NO PUEDE HACER MÚLTIPLES RESERVAS EL MISMO DÍA =====
        // Normalizar la fecha para evitar problemas de zona horaria
        const fechaNormalizada = new Date(fecha);
        fechaNormalizada.setHours(12, 0, 0, 0); // Establecer al mediodía para evitar cambios de día

        const reservasUsuarioDia = await this.reservaModel.find({
            correo: createReservaDto.correo,
            fecha: fechaNormalizada,
            estado: { $in: ['confirmada', 'pendiente'] }
        }).exec();

        if (reservasUsuarioDia.length > 0) {
            throw new HttpException(
                'Ya tienes una reserva confirmada para este día. Solo puedes hacer una reserva por día.',
                HttpStatus.BAD_REQUEST,
            );
        }

        let aulasIds: string[] = [];

        // Si el tipo es 'equipo', buscar las aulas que contienen esos equipos
        let codigoAulaSeleccionada: string | undefined;

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
            codigoAulaSeleccionada = aulaFinal?.codigo;
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
            codigoAulaSeleccionada = aulaEncontrada.codigo;
        }

        // Nota: se permite reservar el mismo día siempre que no haya solapamiento.
        // La restricción de "dejar 1 día libre" fue eliminada para permitir reservas el mismo día.

        // Validar disponibilidad en el horario específico (incluye cantidades por equipo)
        // Validar que el horario esté dentro del rango permitido (09:00-21:00)
        this.validarHorarioPermitido(horaInicio, horaFin);
        const resultadoDisponibilidad = await this.checkDisponibilidad(
            aulasIds,
            equipos || [],
            fechaNormalizada,
            horaInicio,
            horaFin,
            undefined,
            createReservaDto.correo,
        );

        if (!resultadoDisponibilidad.disponible) {
            throw new HttpException(
                resultadoDisponibilidad.motivo || 'El aula no está disponible en el horario seleccionado.',
                HttpStatus.CONFLICT,
            );
        }

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

        const codigoReserva = await this.generarCodigoReserva(fechaNormalizada, {
            codigoAula: codigoAulaSeleccionada,
        });

        // Crear la reserva
        const nuevaReserva = new this.reservaModel({
            ...createReservaDto,
            fecha: fechaNormalizada, // Usar fecha normalizada
            aulas: aulasIds,
            equipos: tipo === 'equipo' ? equiposConNombres : [],
            estado: estadoInicial,
            codigo: codigoReserva,
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
        const {
            reservaObj,
            fechaLegible,
            ambienteDescripcion,
            codigoReserva: codigoReservaFinal,
            codigoAlumno,
        } = await this.construirContextoReserva(saved.id);

        try {
            await this.mailService.sendReservaEmail({
                email: reservaObj.correo,
                nombre: reservaObj.nombre,
                fecha: fechaLegible,
                ambiente: ambienteDescripcion,
                horario: { inicio: reservaObj.horaInicio, fin: reservaObj.horaFin },
                equipos: reservaObj.equipos,
                codigoReserva: codigoReservaFinal,
                codigoAlumno,
            });
        } catch (mailError) {
            this.logger.error(`No se pudo enviar correo de reserva ${reservaObj._id}`, mailError as Error);
        }

        await this.mailService.notifyReservaAdmin({
            reservaId: String(reservaObj._id),
            usuario: reservaObj.nombre,
            correoUsuario: reservaObj.correo,
            fecha: fechaLegible,
            ambiente: ambienteDescripcion,
            horario: { inicio: reservaObj.horaInicio, fin: reservaObj.horaFin },
            tipo: reservaObj.tipo,
            motivo: reservaObj.motivo,
            equipos: reservaObj.equipos,
            codigoReserva: codigoReservaFinal,
            codigoAlumno,
        });

        return reservaObj;
    }

    // Obtener todas las reservas
    async getAllReservas(): Promise<Reserva[]> {
        // Actualizar estados antes de obtener todas las reservas
        await this.actualizarEstadosReservas();

        const reservas = await this.reservaModel
            .find()
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        return Promise.all(
            reservas.map((reserva: any) => this.construirRespuestaReserva(reserva)),
        );
    }

    // Obtener reserva por ID
    async getReservaById(id: string): Promise<Reserva> {
        const reserva = await this.reservaModel
            .findById(id)
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        return this.construirRespuestaReserva(reserva);
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
        const reserva = await this.reservaModel.findById(id)
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        await this.asegurarCodigoReserva(reserva);

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

        // Validar que la nueva fecha sea de lunes a viernes
        this.validarDiaPermitido(nuevaFecha);

        // Normalizar la fecha para comparación consistente
        const fechaNormalizada = new Date(fecha);
        fechaNormalizada.setHours(12, 0, 0, 0);

        // Validar disponibilidad en la nueva fecha/hora (excluyendo esta reserva)
        // Validar que el horario esté dentro del rango permitido (09:00-21:00)
        this.validarHorarioPermitido(horaInicio, horaFin);
        const resultadoDisponibilidad = await this.checkDisponibilidad(
            reserva.aulas || [],
            reserva.equipos || [],
            fechaNormalizada,
            horaInicio,
            horaFin,
            id,
            reserva.correo,
        );

        if (!resultadoDisponibilidad.disponible) {
            throw new HttpException(
                resultadoDisponibilidad.motivo || 'El aula no está disponible en el nuevo horario',
                HttpStatus.CONFLICT,
            );
        }

        // Guardar datos anteriores en historial de reprogramaciones
        if (!reserva.reprogramaciones) {
            reserva.reprogramaciones = [];
        }

        const fechaAnterior = new Date(reserva.fecha);
        const horarioAnterior = {
            inicio: reserva.horaInicio,
            fin: reserva.horaFin,
        };

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

        const reservaActualizada = await reserva.save();

        const contexto = await this.construirContextoReserva(reservaActualizada.id);

        try {
            await this.mailService.sendReprogramacionEmail({
                email: contexto.reservaObj.correo,
                nombre: contexto.reservaObj.nombre,
                codigoReserva: contexto.codigoReserva,
                codigoAlumno: contexto.codigoAlumno,
                fechaAnterior: fechaAnterior.toLocaleDateString('es-PE', { dateStyle: 'full' }),
                fechaNueva: contexto.fechaLegible,
                horarioAnterior,
                horarioNuevo: { inicio: contexto.reservaObj.horaInicio, fin: contexto.reservaObj.horaFin },
                ambiente: contexto.ambienteDescripcion,
                motivo: motivo || 'Sin motivo especificado',
                equipos: contexto.reservaObj.equipos,
            });
        } catch (mailError) {
            this.logger.error(`No se pudo notificar reprogramación ${reservaActualizada._id}`, mailError as Error);
        }

        return reservaActualizada;
    }

    // Cancelar reserva (solo admin o el mismo usuario)
    async cancelarReserva(
        id: string,
        isAdmin: boolean = false,
        motivoCancelacion?: string,
        correoUsuario?: string
    ): Promise<Reserva> {
        const reserva = await this.reservaModel.findById(id)
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        await this.asegurarCodigoReserva(reserva);

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

        // Verificar que no hayan pasado 24 horas desde la confirmación (createdAt)
        if (reserva.createdAt) {
            const tiempoTranscurrido = ahora.getTime() - reserva.createdAt.getTime();
            const horasTranscurridas = tiempoTranscurrido / (1000 * 60 * 60); // Convertir a horas

            if (horasTranscurridas > 24) {
                throw new HttpException(
                    'No se puede cancelar una reserva después de 24 horas de su confirmación',
                    HttpStatus.BAD_REQUEST,
                );
            }
        }

        reserva.estado = 'cancelada';
        if (motivoCancelacion) {
            reserva.motivo = `${reserva.motivo} [CANCELADA: ${motivoCancelacion}]`;
        }
        reserva.updatedAt = new Date();

        const reservaCancelada = await reserva.save();

        const contexto = await this.construirContextoReserva(reservaCancelada.id);
        const motivoCorreo = motivoCancelacion || 'Sin motivo proporcionado';

        try {
            await this.mailService.sendCancelacionEmail({
                email: contexto.reservaObj.correo,
                nombre: contexto.reservaObj.nombre,
                codigoReserva: contexto.codigoReserva,
                codigoAlumno: contexto.codigoAlumno,
                fecha: contexto.fechaLegible,
                horario: { inicio: contexto.reservaObj.horaInicio, fin: contexto.reservaObj.horaFin },
                ambiente: contexto.ambienteDescripcion,
                motivoCancelacion: motivoCorreo,
            });
        } catch (mailError) {
            this.logger.error(`No se pudo notificar cancelación ${reservaCancelada._id}`, mailError as Error);
        }

        // Notificar a asistentes asignados o administradores
        try {
            await this.mailService.notifyCancelacionAsistenteAdmin({
                asistentesAsignados: contexto.reservaObj.asistentesAsignados,
                codigoReserva: contexto.codigoReserva,
                solicitante: contexto.reservaObj.nombre,
                fecha: contexto.fechaLegible,
                ambiente: contexto.ambienteDescripcion,
                horario: { inicio: contexto.reservaObj.horaInicio, fin: contexto.reservaObj.horaFin },
                motivoCancelacion: motivoCorreo,
                equipos: contexto.reservaObj.equipos,
                isAdminCancelando: isAdmin,
            });
        } catch (mailError) {
            this.logger.error(`No se pudo notificar cancelación a asistentes/admin ${reservaCancelada._id}`, mailError as Error);
        }

        return reservaCancelada;
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
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        return Promise.all(
            reservas.map((reserva: any) => this.construirRespuestaReserva(reserva)),
        );
    }

    // Obtener reservas por equipo
    async getReservasByEquipo(equipoId: string): Promise<Reserva[]> {
        const reservas = await this.reservaModel
            .find({ 'equipos.equipo': equipoId })
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        return Promise.all(
            reservas.map((reserva: any) => this.construirRespuestaReserva(reserva)),
        );
    }

    // Obtener reservas por usuario (correo)
    async getReservasByUsuario(correo: string): Promise<any[]> {
        const reservas = await this.reservaModel
            .find({ correo: correo })
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .sort({ fecha: -1 }) // Ordenar por fecha descendente (más recientes primero)
            .exec();

        return Promise.all(
            reservas.map((reserva: any) => this.construirRespuestaReserva(reserva)),
        );
    }

    // Verificar disponibilidad
    async checkDisponibilidad(
        aulasIds: string[],
        equipos: { equipo: string; nombre: string; cantidad: number }[],
        fecha: Date,
        horaInicio: string,
        horaFin: string,
        excludeReservaId?: string,
        userCorreo?: string,
    ): Promise<{ disponible: boolean; motivo?: string }> {
        // Normalizar la fecha para comparación consistente (al mediodía)
        const fechaNormalizada = new Date(fecha);
        fechaNormalizada.setHours(12, 0, 0, 0);

        console.log(`Buscando reservas para fecha normalizada: ${fechaNormalizada.toISOString()}`);

        // ===== VALIDACIÓN DE DÍAS Y HORARIOS PERMITIDOS =====
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Resetear hora para comparación de fechas

        // Verificar que la fecha no sea en el pasado
        if (fechaNormalizada < hoy) {
            console.log('Validación fallida: Fecha en el pasado');
            return { disponible: false, motivo: 'No se pueden hacer reservas para fechas pasadas' };
        }

        // Verificar anticipación mínima de 2 días
        const diasAnticipacion = Math.floor((fechaNormalizada.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diasAnticipacion < 2) {
            console.log(`Validación fallida: Solo ${diasAnticipacion} días de anticipación (mínimo 2)`);
            return { disponible: false, motivo: 'Las reservas requieren al menos 2 días de anticipación' };
        }

        // Verificar que sea lunes a viernes (1-5, donde 0=domingo, 6=sábado)
        const diaSemana = fechaNormalizada.getDay();
        if (diaSemana === 0 || diaSemana === 6) {
            console.log(`Validación fallida: Día no permitido (día ${diaSemana}: ${diaSemana === 0 ? 'domingo' : 'sábado'})`);
            return { disponible: false, motivo: 'Las reservas solo están disponibles de lunes a viernes' };
        }

        // Verificar horarios: 9:00 AM (09:00) a 9:00 PM (21:00)
        const horaInicioNum = parseInt(horaInicio.split(':')[0]);
        const horaFinNum = parseInt(horaFin.split(':')[0]);

        if (horaInicioNum < 9 || horaInicioNum > 21 || horaFinNum < 9 || horaFinNum > 21) {
            console.log(`Validación fallida: Horario fuera de rango - Inicio: ${horaInicioNum}, Fin: ${horaFinNum}`);
            return { disponible: false, motivo: 'Las reservas solo están disponibles entre las 9:00 AM y las 9:00 PM' };
        }

        // Verificar que la hora de fin no sea anterior a la hora de inicio
        if (horaFinNum < horaInicioNum) {
            console.log(`Validación fallida: Hora fin (${horaFinNum}) anterior a hora inicio (${horaInicioNum})`);
            return { disponible: false, motivo: 'La hora de fin no puede ser anterior a la hora de inicio' };
        }

        console.log('✅ Todas las validaciones de fecha y horario pasaron');

        // Si no se pasaron aulas pero sí equipos, determinar las aulas automáticamente
        console.log(`Parámetros recibidos - aulasIds: ${JSON.stringify(aulasIds)}, equipos: ${JSON.stringify(equipos)}`);
        let aulasIdsFinales = [...aulasIds];
        console.log(`Condición: aulasIds.length === 0 (${aulasIds.length === 0}) && equipos.length > 0 (${equipos.length > 0})`);
        if (aulasIds.length === 0 && equipos.length > 0) {
            console.log(`No se pasaron aulas, determinando aulas automáticamente para equipos: ${equipos.map(e => e.equipo).join(', ')}`);

            // Extraer IDs de equipos
            const equiposIds = equipos.map((e: any) => e.equipo);

            // Buscar las aulas que contienen estos equipos
            let aulas = await this.aulaModel.find({
                equipos: { $in: equiposIds },
            }).populate('equipos');

            console.log('Equipos buscados:', equiposIds);
            console.log('Aulas encontradas con $in:', aulas.length);
            console.log('Aulas encontradas:', aulas.map(a => {
                if (typeof a === 'object' && a && (a as any)._id) {
                    return { id: (a as any)._id, equipos: (a as any).equipos?.map((e: any) => e._id?.toString()) };
                } else if (typeof a === 'string') {
                    return { id: a, equipos: [] };
                }
                return { id: 'unknown', equipos: [] };
            }));

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
                console.log('No se encontraron aulas para los equipos especificados');
                // Si no hay aulas, significa que los equipos no existen o no están asignados
                return { disponible: false, motivo: 'Los equipos seleccionados no están asignados a ninguna aula' };
            }

            // ===== VALIDACIÓN CRÍTICA: Todos los equipos deben pertenecer a LA MISMA AULA =====
            const aulasUnicas = new Set<string>();
            for (const aula of aulas) {
                aulasUnicas.add((aula as any)._id.toString());
            }

            if (aulasUnicas.size > 1) {
                console.log(`Los equipos pertenecen a ${aulasUnicas.size} aulas diferentes: ${Array.from(aulasUnicas).join(', ')}`);
                console.log('Equipos deben pertenecer a la misma aula');
                return { disponible: false, motivo: 'Los equipos seleccionados pertenecen a diferentes aulas' };
            }

            // Usar la única aula encontrada para la validación
            aulasIdsFinales = [(aulas[0] as any)._id.toString()];
            console.log(`Aula determinada automáticamente: ${aulasIdsFinales[0]}`);
        }

        // Buscar reservas que coincidan con las aulas o equipos en la misma fecha
        const query: any = {
            fecha: fechaNormalizada,
            estado: { $in: ['pendiente', 'confirmada'] },
        };

        if (excludeReservaId) {
            query._id = { $ne: excludeReservaId };
        }

        const equiposIds = equipos.map((e: any) => e.equipo);

        // Buscar reservas que incluyan alguna de las aulas o equipos
        query.$or = [];

        if (aulasIdsFinales.length > 0) {
            query.$or.push({ aulas: { $in: aulasIdsFinales } });
        }

        if (equiposIds.length > 0) {
            query.$or.push({ 'equipos.equipo': { $in: equiposIds } });
        }

        const reservasExistentes = await this.reservaModel.find(query).exec();
        console.log(`Query ejecutado:`, JSON.stringify(query, null, 2));
        console.log(`Reservas encontradas: ${reservasExistentes.length}`);
        reservasExistentes.forEach((reserva, index) => {
            console.log(`Reserva ${index + 1}: ID=${reserva._id}, Estado=${reserva.estado}, Aulas=${reserva.aulas?.join(',') || 'ninguna'}, Equipos=${reserva.equipos?.map(e => e.equipo).join(',') || 'ninguno'}`);
        });

        // Verificar franjas ocupadas definidas en el documento de Aula
        if (aulasIdsFinales.length > 0) {
            const aulasDocs: any[] = await this.aulaModel
                .find({ _id: { $in: aulasIdsFinales } })
                .select('occupiedRanges')
                .lean()
                .exec();

            const startReserva = new Date(fecha);
            const [hi, mi] = (horaInicio || '00:00').split(':').map(Number);
            startReserva.setHours(isNaN(hi) ? 0 : hi, isNaN(mi) ? 0 : mi, 0, 0);
            const endReserva = new Date(fecha);
            const [hf, mf] = (horaFin || '00:00').split(':').map(Number);
            endReserva.setHours(isNaN(hf) ? 0 : hf, isNaN(mf) ? 0 : mf, 0, 0);

            const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
                return aStart < bEnd && bStart < aEnd;
            };

            for (const aulaDoc of aulasDocs) {
                if (aulaDoc && Array.isArray(aulaDoc.occupiedRanges) && aulaDoc.occupiedRanges.length > 0) {
                    for (const r of aulaDoc.occupiedRanges) {
                        try {
                            const rStart = new Date(r.start);
                            const rEnd = new Date(r.end);
                            if (overlaps(startReserva, endReserva, rStart, rEnd)) {
                                return { disponible: false, motivo: 'Conflicto con franjas ocupadas del aula' };
                            }
                        } catch (err) {
                            // Ignorar franjas inválidas
                        }
                    }
                }
            }
        }

        // ===== VALIDACIÓN PRINCIPAL: CONFLICTOS POR AULA =====
        // Si es la MISMA aula, NO permitir solapamiento (buffer = 0)
        // Si es DIFERENTE aula, permitir con separación de 1 hora entre usuarios diferentes

        console.log(`Verificando disponibilidad para aulas: ${aulasIdsFinales.join(', ')}`);
        console.log(`Horario solicitado: ${horaInicio} - ${horaFin}`);
        console.log(`Reservas existentes encontradas: ${reservasExistentes.length}`);

        // Primero verificar conflictos en la MISMA aula (sin buffer)
        for (const reserva of reservasExistentes) {
            console.log(`Verificando reserva existente: ${reserva._id} - Aulas: ${reserva.aulas?.map((a: any) => a.toString()).join(', ') || 'ninguna'} - Horario: ${reserva.horaInicio}-${reserva.horaFin}`);

            // Verificar si la reserva existente usa alguna de las aulas solicitadas
            let hayAulaComun = false;
            if (aulasIdsFinales.length > 0 && reserva.aulas && reserva.aulas.length > 0) {
                for (const aulaSolicitada of aulasIdsFinales) {
                    for (const aulaExistente of reserva.aulas) {
                        const aulaExistenteStr = aulaExistente.toString();
                        console.log(`Comparando aula solicitada: "${aulaSolicitada}" con aula existente: "${aulaExistenteStr}"`);
                        if (aulaSolicitada === aulaExistenteStr) {
                            hayAulaComun = true;
                            console.log(`✅ Aula común encontrada: ${aulaSolicitada}`);
                            break;
                        }
                    }
                    if (hayAulaComun) break;
                }
            }

            if (hayAulaComun) {
                console.log(`Verificando conflicto horario para misma aula...`);
                // Si hay aulas en común, verificar conflicto SIN buffer (misma aula = conflicto inmediato)
                if (this.hayConflictoHorario(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin, 0)) {
                    console.log(`❌ Conflicto detectado - Misma aula - Horario conflicto`);
                    return { disponible: false, motivo: 'El aula no está disponible en el horario seleccionado' };
                } else {
                    console.log(`✅ No hay conflicto horario en misma aula`);
                }
            } else {
                console.log(`No hay aulas en común con esta reserva`);
            }
        }

        // ===== VALIDACIÓN: AL MENOS 1 HORA DE SEPARACIÓN ENTRE RESERVAS DE DIFERENTES USUARIOS =====
        // Solo aplicar para aulas DIFERENTES (ya validamos conflictos de misma aula arriba)
        const todasLasReservasDia = await this.reservaModel.find({
            fecha: fechaNormalizada,
            estado: { $in: ['confirmada', 'pendiente'] },
        }).exec();

        // Verificar que no haya conflicto con reservas de otros usuarios (mínimo 1 hora de separación)
        for (const reserva of todasLasReservasDia) {
            // Solo verificar si es de otro usuario (diferente correo) Y no usa las mismas aulas
            if (userCorreo && reserva.correo !== userCorreo) {
                // Verificar si esta reserva usa aulas DIFERENTES a las solicitadas
                const aulasDiferentes = !reserva.aulas ||
                    (reserva.aulas?.length === 0) ||
                    !aulasIdsFinales.some(aulaId => reserva.aulas?.some((a: any) => a.toString() === aulaId));

                if (aulasDiferentes) {
                    // Si son aulas diferentes, aplicar buffer de 1 hora
                    if (this.hayConflictoHorario(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin, 60)) {
                        console.log(`Conflicto detectado - Usuario diferente, aula diferente: separación de 1 hora requerida`);
                        return { disponible: false, motivo: 'Conflicto de horario con otra reserva' };
                    }
                }
                // Si son las mismas aulas, ya se validó arriba con buffer = 0
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
                    fecha: fechaNormalizada,
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
                    return { disponible: false, motivo: `No hay suficiente cantidad del equipo disponible (${disponibleEquipo} disponible, ${req.cantidad} solicitado)` };
                }
            }
        }

        return { disponible: true };
    }

    // Verificar si hay conflicto de horario
    private hayConflictoHorario(
        inicio1: string,
        fin1: string,
        inicio2: string,
        fin2: string,
        bufferMinutes: number = 0,
    ): boolean {
        // Convertir a minutos desde medianoche para comparar
        const toMinutes = (hora: string): number => {
            const [h, m] = hora.split(':').map(Number);
            return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
        };

        const inicio1Min = toMinutes(inicio1);
        const fin1Min = toMinutes(fin1);
        const inicio2Min = toMinutes(inicio2);
        const fin2Min = toMinutes(fin2);

        const buffer = Math.max(0, Math.floor(bufferMinutes));

        // Considerar buffer (en minutos) alrededor de la reserva existente:
        // No hay conflicto si fin1 <= inicio2 - buffer OR inicio1 >= fin2 + buffer
        return !(fin1Min <= (inicio2Min - buffer) || inicio1Min >= (fin2Min + buffer));
    }

    // Validar que el horario esté dentro del rango permitido (09:00 - 21:00)
    private validarHorarioPermitido(horaInicio: string, horaFin: string): void {
        const toMinutes = (hora: string): number => {
            const [h, m] = hora.split(':').map(Number);
            return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
        };

        const inicioMin = toMinutes(horaInicio);
        const finMin = toMinutes(horaFin);

        const limiteInicio = 9 * 60; // 09:00
        const limiteFin = 21 * 60; // 21:00

        if (inicioMin < limiteInicio || finMin > limiteFin || inicioMin >= finMin) {
            throw new HttpException(
                'Las reservas solo se permiten entre 9:00am a 9:00pm.',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    // Validar que la fecha sea de lunes a viernes
    private validarDiaPermitido(fecha: Date): void {
        const dia = new Date(fecha);
        dia.setHours(0, 0, 0, 0);
        const diaSemana = dia.getDay(); // 0 = domingo, 6 = sábado

        if (diaSemana === 0 || diaSemana === 6) {
            throw new HttpException(
                'Solo puedes reservar de lunes a viernes',
                HttpStatus.BAD_REQUEST,
            );
        }
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

        await this.asegurarCodigoReserva(reserva);

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

        const reservaConIncidencia = await reserva.save();

        const contexto = await this.construirContextoReserva(reservaConIncidencia.id);
        const incidenciaRegistrada: any = reservaConIncidencia.incidencias
            ? reservaConIncidencia.incidencias[reservaConIncidencia.incidencias.length - 1]
            : null;

        if (incidenciaRegistrada) {
            try {
                await this.mailService.sendIncidenciaEmail({
                    email: contexto.reservaObj.correo,
                    nombre: contexto.reservaObj.nombre,
                    codigoReserva: contexto.codigoReserva,
                    codigoAlumno: contexto.codigoAlumno,
                    fechaReserva: contexto.fechaLegible,
                    ambiente: contexto.ambienteDescripcion,
                    incidencia: {
                        id: incidenciaRegistrada._id?.toString() || 'SIN-ID',
                        descripcion: incidenciaRegistrada.descripcion,
                        tipo: incidenciaRegistrada.tipo,
                        prioridad: incidenciaRegistrada.prioridad,
                        estado: incidenciaRegistrada.estado,
                        fechaReporte: new Date(incidenciaRegistrada.reportadoEn || Date.now()).toLocaleString('es-PE', {
                            dateStyle: 'full',
                            timeStyle: 'short',
                        }),
                        reportadoPor: incidenciaRegistrada.reportadoPor,
                    },
                });
            } catch (mailError) {
                this.logger.error(`No se pudo notificar incidencia ${reservaConIncidencia._id}`, mailError as Error);
            }
        }

        return reservaConIncidencia;
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

        await this.asegurarCodigoReserva(reserva);

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

        await this.asegurarCodigoReserva(reserva);

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
            fechaReserva.setHours(horaFin, minutosFin, 59, 999); // Incluir segundos para evitar problemas de redondeo

            // Si la reserva ya pasó (comparar con la hora actual en UTC para evitar problemas de zona horaria)
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
                await this.asegurarCodigoReserva(reserva);
                const reservaGuardada = await reserva.save();
                console.log(`Reserva ${reserva._id} actualizada de ${estadoAnterior} a ${reservaGuardada.estado}`);
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
    async getDashboardStats(filtros?: {
        fechaInicio?: Date;
        fechaFin?: Date;
    }): Promise<any> {
        try {
            // Actualizar estados antes de calcular estadísticas
            await this.actualizarEstadosReservas();

            const ahora = new Date();
            
            // Determinar rango de fechas
            let fechaInicio: Date;
            let fechaFin: Date;
            
            if (filtros?.fechaInicio && filtros?.fechaFin) {
                // Usar fechas proporcionadas
                fechaInicio = new Date(filtros.fechaInicio);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(filtros.fechaFin);
                fechaFin.setHours(23, 59, 59, 999);
            } else {
                // Por defecto: último mes
                fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
                fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
                fechaFin.setHours(23, 59, 59, 999);
            }

            // Construir query para filtrar reservas por fecha
            const queryReservas: any = {};
            if (filtros?.fechaInicio || filtros?.fechaFin) {
                queryReservas.fecha = {};
                if (fechaInicio) {
                    queryReservas.fecha.$gte = fechaInicio;
                }
                if (fechaFin) {
                    queryReservas.fecha.$lte = fechaFin;
                }
            }

            // Obtener todas las reservas en paralelo (filtradas por fecha si se proporciona)
            const [
                todasReservas,
                reservasMes,
                incidenciasAbiertas,
                aulasData,
                equiposData
            ] = await Promise.all([
                this.reservaModel.find(queryReservas).populate('aulas', 'name codigo').populate('equipos.equipo', 'name').exec(),
                this.reservaModel.find({
                    ...queryReservas,
                    fecha: { $gte: fechaInicio, $lte: fechaFin }
                }).exec(),
                this.reservaModel.find({
                    ...queryReservas,
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

            // ===== DATOS PARA GRÁFICAS POR DÍA/SEMANA =====
            const ultimosSieteDias: string[] = [];
            const reservasPorDia: number[] = [];

            // Calcular días a mostrar según el rango
            const diasDiferencia = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            // Si el rango es menor o igual a 30 días, mostrar por día
            if (diasDiferencia <= 30) {
                const fechaActual = new Date(fechaInicio);
                while (fechaActual <= fechaFin) {
                    const fechaDiaInicio = new Date(fechaActual);
                    fechaDiaInicio.setHours(0, 0, 0, 0);
                    const fechaDiaFin = new Date(fechaActual);
                    fechaDiaFin.setHours(23, 59, 59, 999);

                    const reservasDia = todasReservas.filter((r: any) => {
                        const fechaReserva = new Date(r.fecha);
                        return fechaReserva >= fechaDiaInicio && fechaReserva <= fechaDiaFin;
                    }).length;

                    const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
                    const label = `${dias[fechaActual.getDay()]} ${fechaActual.getDate()}/${fechaActual.getMonth() + 1}`;
                    ultimosSieteDias.push(label);
                    reservasPorDia.push(reservasDia);

                    fechaActual.setDate(fechaActual.getDate() + 1);
                }
            } else {
                // Si el rango es mayor a 30 días, mostrar por semana con formato "Semana del X al Y"
                const fechaActual = new Date(fechaInicio);
                while (fechaActual <= fechaFin) {
                    const fechaSemanaInicio = new Date(fechaActual);
                    fechaSemanaInicio.setHours(0, 0, 0, 0);
                    const fechaSemanaFin = new Date(fechaActual);
                    fechaSemanaFin.setDate(fechaSemanaFin.getDate() + 6);
                    fechaSemanaFin.setHours(23, 59, 59, 999);

                    // Ajustar si la semana se sale del rango
                    if (fechaSemanaFin > fechaFin) {
                        fechaSemanaFin.setTime(fechaFin.getTime());
                    }

                    const reservasSemana = todasReservas.filter((r: any) => {
                        const fechaReserva = new Date(r.fecha);
                        return fechaReserva >= fechaSemanaInicio && fechaReserva <= fechaSemanaFin;
                    }).length;

                    // Formato: "Semana del DD/MM al DD/MM"
                    const inicioStr = fechaSemanaInicio.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
                    const finStr = fechaSemanaFin.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
                    const label = `Semana del ${inicioStr} al ${finStr}`;
                    ultimosSieteDias.push(label);
                    reservasPorDia.push(reservasSemana);

                    fechaActual.setDate(fechaActual.getDate() + 7);
                }
            }

            const chartData = {
                labels: ultimosSieteDias,
                data: reservasPorDia
            };

            // ===== RESERVAS POR MES =====
            const reservasPorMes: number[] = [];
            const labelsMeses: string[] = [];

            // Calcular meses en el rango
            const fechaActual = new Date(fechaInicio);
            fechaActual.setDate(1); // Primer día del mes
            
            while (fechaActual <= fechaFin) {
                const mesInicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
                const mesFin = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
                mesFin.setHours(23, 59, 59, 999);

                // Ajustar límites al rango proporcionado
                const mesInicioAjustado = mesInicio < fechaInicio ? fechaInicio : mesInicio;
                const mesFinAjustado = mesFin > fechaFin ? fechaFin : mesFin;

                const reservasMes = todasReservas.filter((r: any) => {
                    const fechaReserva = new Date(r.fecha);
                    return fechaReserva >= mesInicioAjustado && fechaReserva <= mesFinAjustado;
                }).length;

                const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                labelsMeses.push(`${meses[mesInicio.getMonth()]} ${mesInicio.getFullYear()}`);
                reservasPorMes.push(reservasMes);

                // Avanzar al siguiente mes
                fechaActual.setMonth(fechaActual.getMonth() + 1);
            }

            const monthlyChartData = {
                labels: labelsMeses,
                data: reservasPorMes
            };

            // ===== RANKING DE AULAS MÁS RESERVADAS =====
            const aulasContador: any = {};
            const aulasIdsParaBuscar = new Set<string>();

            // Primero, recopilar todos los IDs de aulas y contar
            todasReservas.forEach((r: any) => {
                if (r.aulas && Array.isArray(r.aulas) && r.aulas.length > 0) {
                    r.aulas.forEach((aula: any) => {
                        if (!aula) return;

                        let aulaId: string;
                        let aulaNombre: string | null = null;

                        if (typeof aula === 'object' && aula._id) {
                            aulaId = aula._id.toString();
                            aulaNombre = aula.name || aula.codigo || null;
                        } else if (typeof aula === 'string') {
                            aulaId = aula;
                            aulasIdsParaBuscar.add(aulaId);
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

            // Si hay aulas sin nombre (solo IDs), buscarlas en la base de datos
            if (aulasIdsParaBuscar.size > 0) {
                const aulasEncontradas = await this.aulaModel.find({
                    _id: { $in: Array.from(aulasIdsParaBuscar) }
                }).select('name codigo').lean().exec();

                aulasEncontradas.forEach((aula: any) => {
                    const aulaId = aula._id.toString();
                    if (aulasContador[aulaId] && !aulasContador[aulaId].nombre) {
                        aulasContador[aulaId].nombre = aula.name || aula.codigo || 'Sin nombre';
                    }
                });
            }

            // Asegurar que todas las aulas tengan nombre
            Object.keys(aulasContador).forEach(aulaId => {
                if (!aulasContador[aulaId].nombre) {
                    aulasContador[aulaId].nombre = 'Sin nombre';
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

    // ===== ACTUALIZACIÓN AUTOMÁTICA DE ESTADOS =====
    async actualizarEstadosReservas(): Promise<{ actualizadas: number; detalles: any[] }> {
        const ahora = new Date();
        const detalles: any[] = [];

        // Buscar TODAS las reservas que no están canceladas definitivamente
        const todasReservas = await this.reservaModel.find({
            estado: { $nin: ['cancelada'] }, // Excluir solo las canceladas definitivamente
        }).exec();

        let actualizadas = 0;

        for (const reserva of todasReservas) {
            const fechaReserva = new Date(reserva.fecha);
            const [horaInicio, minutosInicio] = reserva.horaInicio.split(':').map(Number);
            const [horaFin, minutosFin] = reserva.horaFin.split(':').map(Number);

            // Crear fechas completas de inicio y fin
            const fechaInicioReserva = new Date(fechaReserva);
            fechaInicioReserva.setHours(horaInicio, minutosInicio, 0, 0);

            const fechaFinReserva = new Date(fechaReserva);
            fechaFinReserva.setHours(horaFin, minutosFin, 59, 999);

            const estadoAnterior = reserva.estado;
            let nuevoEstado = estadoAnterior;

            // Determinar si tiene incidencias (por cantidad total)
            const tieneIncidencias = reserva.incidencias && reserva.incidencias.length > 0;
            const cantidadIncidencias = reserva.incidencias ? reserva.incidencias.length : 0;

            // Determinar si tiene reprogramaciones
            const tieneReprogramaciones = reserva.reprogramaciones &&
                reserva.reprogramaciones.length > 0;


            // Lógica de prioridad de estados:
            // 1. Si está cancelada → mantener cancelada
            // 2. Si está en horario actual → en_curso
            // 3. Si ya terminó y tiene incidencias activas → cerrada_con_incidencia
            // 4. Si ya terminó y no tiene incidencias activas → cerrada
            // 5. Si tiene reprogramaciones y no ha terminado → reprogramada
            // 6. Mantener estado actual si no aplica ninguna regla

            if (estadoAnterior === 'cancelada') {
                // Mantener cancelada
                nuevoEstado = 'cancelada';
            } else if (ahora >= fechaInicioReserva && ahora <= fechaFinReserva) {
                // Está dentro del horario de la reserva
                nuevoEstado = 'en_curso';
            } else if (ahora > fechaFinReserva) {
                // La reserva ya terminó - verificar si tiene incidencias ANTES de cerrarlas automáticamente

                // PRIMERO verificar si tiene incidencias (activas o no) para determinar el estado
                if (tieneIncidencias) {
                    nuevoEstado = 'cerrada_con_incidencia';
                } else {
                    nuevoEstado = 'cerrada';
                }

                // DESPUÉS cerrar incidencias automáticamente cuando la reserva termina
                if (reserva.incidencias) {
                    reserva.incidencias.forEach((inc: any) => {
                        if (inc.estado !== 'cerrada') {
                            inc.estado = 'cerrada';
                            inc.actualizadoEn = new Date();
                        }
                    });
                }
            } else if (tieneReprogramaciones && ahora <= fechaFinReserva) {
                // Si tiene reprogramaciones y no ha terminado aún
                nuevoEstado = 'reprogramada';
            } else {
                // Reserva futura - mantener estado actual (confirmada o reprogramada)
                // PERO si ya terminó y tiene incidencias, corregir el estado
                if (ahora > fechaFinReserva && tieneIncidencias && estadoAnterior === 'cerrada') {
                    nuevoEstado = 'cerrada_con_incidencia';
                    console.log(`Corrigiendo estado: reserva ya terminó con ${cantidadIncidencias} incidencia(s), cambiando de cerrada a cerrada_con_incidencia`);
                } else {
                    nuevoEstado = estadoAnterior;
                }
            }

            // Actualizar si el estado cambió
            if (nuevoEstado !== estadoAnterior) {
                console.log(`Actualizando reserva ${reserva._id}: ${estadoAnterior} -> ${nuevoEstado}`);
                reserva.estado = nuevoEstado;
                reserva.updatedAt = new Date();
                await this.asegurarCodigoReserva(reserva);
                await reserva.save();
                actualizadas++;

                detalles.push({
                    reservaId: reserva._id,
                    nombre: reserva.nombre,
                    fecha: reserva.fecha,
                    horaInicio: reserva.horaInicio,
                    horaFin: reserva.horaFin,
                    estadoAnterior,
                    estadoNuevo: nuevoEstado,
                    cantidadIncidencias: cantidadIncidencias,
                    tieneReprogramaciones,
                });
            }
        }

        return { actualizadas, detalles };
    }

    // ===== REPORTES =====
    async exportReservasToExcel(filtros?: {
        fechaInicio?: string;
        fechaFin?: string;
        periodo?: 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'anio';
        fechaReferencia?: string;
        estado?: string;
        tipo?: 'aula' | 'equipo';
    }): Promise<{ buffer: Buffer; fileName: string; total: number }> {
        try {
            // Actualizar automáticamente los estados de las reservas antes de exportar
            await this.actualizarEstadosReservas();

            const query: Record<string, any> = {};

            let rangoInicio: Date | undefined;
            let rangoFin: Date | undefined;

            if (filtros?.fechaInicio || filtros?.fechaFin) {
                if (filtros.fechaInicio) {
                    rangoInicio = new Date(filtros.fechaInicio);
                    rangoInicio.setHours(0, 0, 0, 0);
                }
                if (filtros.fechaFin) {
                    rangoFin = new Date(filtros.fechaFin);
                    rangoFin.setHours(23, 59, 59, 999);
                }
                if (rangoInicio && !rangoFin) {
                    rangoFin = new Date();
                    rangoFin.setHours(23, 59, 59, 999);
                }
                if (rangoFin && !rangoInicio) {
                    rangoInicio = new Date(1970, 0, 1);
                    rangoInicio.setHours(0, 0, 0, 0);
                }
            } else if (filtros?.periodo) {
                const referencia = filtros.fechaReferencia
                    ? new Date(filtros.fechaReferencia)
                    : new Date();
                ({ inicio: rangoInicio, fin: rangoFin } = this.calcularRangoPorPeriodo(
                    filtros.periodo,
                    referencia,
                ));
            }

            if (rangoInicio || rangoFin) {
                query.fecha = {};
                if (rangoInicio) {
                    query.fecha.$gte = rangoInicio;
                }
                if (rangoFin) {
                    query.fecha.$lte = rangoFin;
                }
            }

            if (filtros?.estado) {
                query.estado = filtros.estado;
            }

            if (filtros?.tipo) {
                query.tipo = filtros.tipo;
            }

            const reservas = await this.reservaModel
                .find(query)
                .populate('aulas', 'name codigo')
                .populate('equipos.equipo', 'name')
                .sort({ fecha: 1, horaInicio: 1 })
                .exec();

            const workbook = new Workbook();
            const worksheet = workbook.addWorksheet('Reservas');

            worksheet.columns = [
                { header: 'Código', key: 'codigo', width: 18 },
                { header: 'Solicitante', key: 'nombre', width: 24 },
                { header: 'Correo', key: 'correo', width: 28 },
                { header: 'Tipo', key: 'tipo', width: 12 },
                { header: 'Fecha', key: 'fecha', width: 14 },
                { header: 'Hora inicio', key: 'horaInicio', width: 14 },
                { header: 'Hora fin', key: 'horaFin', width: 14 },
                { header: 'Estado', key: 'estado', width: 16 },
                { header: 'Ambiente/Aula', key: 'aula', width: 24 },
                { header: 'Equipos', key: 'equipos', width: 40 },
                { header: 'Creado en', key: 'creado', width: 20 },
            ];

            const opcionesFecha: Intl.DateTimeFormatOptions = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            };
            const opcionesFechaHora: Intl.DateTimeFormatOptions = {
                dateStyle: 'medium',
                timeStyle: 'short',
            };

            for (const reservaDoc of reservas) {
                const reserva = reservaDoc.toObject();
                await this.asegurarCodigoReserva(reserva);

                let aula = 'Sin aula';
                if (Array.isArray(reserva.aulas) && reserva.aulas.length > 0) {
                    const aulaReferenciada = reserva.aulas[0];
                    if (typeof aulaReferenciada === 'string') {
                        aula = aulaReferenciada;
                    } else if (aulaReferenciada && typeof aulaReferenciada === 'object') {
                        const aulaObj = aulaReferenciada as { name?: string; codigo?: string };
                        aula = aulaObj.name || aulaObj.codigo || 'Sin aula';
                    }
                }

                const equiposTexto = Array.isArray(reserva.equipos) && reserva.equipos.length > 0
                    ? reserva.equipos
                        .map((eq: any) => {
                            const equipoNombre = eq.nombre
                                || (typeof eq.equipo === 'object' ? eq.equipo?.name : undefined)
                                || 'Equipo';
                            const cantidad = eq.cantidad || 1;
                            return `${equipoNombre} (x${cantidad})`;
                        })
                        .join(', ')
                    : 'N/A';

                worksheet.addRow({
                    codigo: reserva.codigo,
                    nombre: reserva.nombre,
                    correo: reserva.correo,
                    tipo: reserva.tipo,
                    fecha: reserva.fecha
                        ? new Date(reserva.fecha).toLocaleDateString('es-PE', opcionesFecha)
                        : '',
                    horaInicio: reserva.horaInicio,
                    horaFin: reserva.horaFin,
                    estado: reserva.estado,
                    aula,
                    equipos: equiposTexto,
                    creado: reserva.createdAt
                        ? new Date(reserva.createdAt).toLocaleString('es-PE', opcionesFechaHora)
                        : '',
                });
            }

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

            const borderStyle = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            } as const;

            worksheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.border = borderStyle;
                    cell.alignment = cell.alignment || { horizontal: 'left', vertical: 'middle', wrapText: true };
                });
            });

            const writeResult = await workbook.xlsx.writeBuffer();
            const buffer = Buffer.isBuffer(writeResult)
                ? writeResult
                : Buffer.from(writeResult);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `reporte_reservas_${timestamp}.xlsx`;

            return { buffer, fileName, total: reservas.length };
        } catch (error) {
            this.logger.error('Error al generar reporte de reservas', error as Error);
            throw new HttpException(
                'No se pudo generar el reporte de reservas',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ===== EXPORTAR DASHBOARD CON GRÁFICOS =====
    async exportDashboardToExcel(filtros?: {
        fechaInicio?: string;
        fechaFin?: string;
    }): Promise<{ buffer: Buffer; fileName: string }> {
        try {
            // Convertir fechas de string a Date si se proporcionan
            let fechaInicioDate: Date | undefined;
            let fechaFinDate: Date | undefined;

            if (filtros?.fechaInicio) {
                fechaInicioDate = new Date(filtros.fechaInicio);
            }
            if (filtros?.fechaFin) {
                fechaFinDate = new Date(filtros.fechaFin);
            }

            // Obtener estadísticas del dashboard con filtros
            const dashboardData = await this.getDashboardStats({
                fechaInicio: fechaInicioDate,
                fechaFin: fechaFinDate,
            });

            // Configurar ChartJSNodeCanvas con configuración optimizada para evitar Fontconfig
            this.logger.log('Iniciando configuración con ChartJSNodeCanvas optimizado para dashboard Excel');

            // Configurar ChartJS para usar fuentes embebidas y evitar dependencias del sistema
            ChartJS.defaults.font.family = 'Lato, lato, sans-serif';
            ChartJS.defaults.font.size = 12;

            const chartJSNodeCanvas = new ChartJSNodeCanvas({
                width: 800,
                height: 400,
                backgroundColour: 'white',
                chartCallback: (ChartJS) => {
                    // Forzar configuración de fuentes que no dependan del sistema
                    ChartJS.defaults.font.family = 'Lato, lato, sans-serif';
                    ChartJS.defaults.font.size = 12;
                    ChartJS.defaults.responsive = false;
                    ChartJS.defaults.maintainAspectRatio = false;
                    // Desactivar animaciones que pueden causar problemas
                    ChartJS.defaults.animation = false;
                },
            });

            this.logger.log('ChartJSNodeCanvas configurado exitosamente con configuración optimizada');

            const workbook = new Workbook();
            workbook.creator = 'Sistema de Reservas';
            workbook.created = new Date();

            // ===== HOJA 1: RESUMEN Y ESTADÍSTICAS =====
            const summarySheet = workbook.addWorksheet('Resumen');
            
            // Título
            summarySheet.getCell('A1').value = 'DASHBOARD DE RESERVAS';
            summarySheet.getCell('A1').font = { size: 16, bold: true };
            summarySheet.mergeCells('A1:D1');
            summarySheet.getRow(1).height = 25;

            // Fecha de generación y rango
            const rangoTexto = fechaInicioDate && fechaFinDate
                ? `Período: ${fechaInicioDate.toLocaleDateString('es-PE')} - ${fechaFinDate.toLocaleDateString('es-PE')}`
                : 'Período: Todos los datos';
            
            summarySheet.getCell('A2').value = `Generado el: ${new Date().toLocaleString('es-PE')}`;
            summarySheet.getCell('A2').font = { size: 10, italic: true };
            summarySheet.mergeCells('A2:D2');
            
            summarySheet.getCell('A3').value = rangoTexto;
            summarySheet.getCell('A3').font = { size: 10, italic: true };
            summarySheet.mergeCells('A3:D3');
            
            summarySheet.getRow(4).height = 5; // Espacio

            // Estadísticas generales
            let row = 5;
            summarySheet.getCell(`A${row}`).value = 'ESTADÍSTICAS GENERALES';
            summarySheet.getCell(`A${row}`).font = { size: 12, bold: true };
            summarySheet.mergeCells(`A${row}:B${row}`);
            row++;

            const stats = [
                ['Total de Reservas', dashboardData.stats.totalReservas],
                ['Reservas Activas', dashboardData.stats.reservasActivas],
                ['Reservas Canceladas', dashboardData.stats.reservasCanceladas],
                ['Reservas Cerradas', dashboardData.stats.reservasCerradas],
                ['Incidencias Abiertas', dashboardData.stats.incidenciasAbiertas],
                ['Total de Aulas', dashboardData.stats.totalAulas],
                ['Total de Equipos', dashboardData.stats.totalEquipos],
            ];

            summarySheet.getRow(row).height = 20;
            summarySheet.getCell(`A${row}`).value = 'Métrica';
            summarySheet.getCell(`B${row}`).value = 'Valor';
            summarySheet.getRow(row).font = { bold: true };
            summarySheet.getRow(row).alignment = { horizontal: 'center', vertical: 'middle' };
            row++;

            stats.forEach(([label, value]) => {
                summarySheet.getCell(`A${row}`).value = label;
                summarySheet.getCell(`B${row}`).value = value as number;
                summarySheet.getRow(row).height = 18;
                row++;
            });

            // Aplicar bordes y formato
            for (let i = 5; i < row; i++) {
                summarySheet.getCell(`A${i}`).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
                summarySheet.getCell(`B${i}`).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
                summarySheet.getCell(`A${i}`).alignment = { horizontal: 'left', vertical: 'middle' };
                summarySheet.getCell(`B${i}`).alignment = { horizontal: 'center', vertical: 'middle' };
            }

            // Ajustar ancho de columnas
            summarySheet.getColumn(1).width = 25;
            summarySheet.getColumn(2).width = 15;

            // Calcular diferencia de días para determinar si mostrar por día o por semana
            let diferenciaDias = 0;
            if (fechaInicioDate && fechaFinDate) {
                diferenciaDias = Math.ceil((fechaFinDate.getTime() - fechaInicioDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            } else {
                // Si no hay fechas, usar el último mes (aproximadamente 30 días)
                diferenciaDias = 30;
            }

            // ===== HOJA 2: GRÁFICO DE RESERVAS POR DÍA/SEMANA =====
            // Solo crear esta hoja si el rango es <= 30 días (Hoy, Últimos 7 días, Últimos 30 días)
            this.logger.log(`Evaluando condición para gráficos: diferenciaDias = ${diferenciaDias}, condición = ${diferenciaDias <= 30}`);
            if (diferenciaDias <= 30) {
                const chartSheet1 = workbook.addWorksheet('Reservas por Día');
                
                // Datos para el gráfico
                chartSheet1.getCell('A1').value = 'Día';
                chartSheet1.getCell('B1').value = 'Cantidad de Reservas';
                chartSheet1.getRow(1).font = { bold: true };
                chartSheet1.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

                dashboardData.chartData.labels.forEach((label, index) => {
                    chartSheet1.getCell(`A${index + 2}`).value = label;
                    chartSheet1.getCell(`B${index + 2}`).value = dashboardData.chartData.data[index];
                });

                chartSheet1.getColumn(1).width = 20;
                chartSheet1.getColumn(2).width = 20;

                // Generar imagen del gráfico de barras
                const tituloGrafico1 = fechaInicioDate && fechaFinDate
                    ? `Reservas por Día (${fechaInicioDate.toLocaleDateString('es-PE')} - ${fechaFinDate.toLocaleDateString('es-PE')})`
                    : 'Reservas por Día (Últimos 7 Días)';

                this.logger.log(`Generando gráfico "${tituloGrafico1}" - Fuentes globales: family="${ChartJS.defaults.font.family}", size=${ChartJS.defaults.font.size}`);

                try {
                    const chartImage1 = await chartJSNodeCanvas.renderToBuffer({
                        type: 'bar',
                        data: {
                            labels: dashboardData.chartData.labels,
                            datasets: [{
                                label: 'Reservas por Día',
                                data: dashboardData.chartData.data,
                                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: false,
                            animation: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: tituloGrafico1,
                                    font: { size: 16, family: 'Lato, lato, sans-serif' }
                                },
                                legend: {
                                    display: true,
                                    labels: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                },
                                x: {
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            }
                        }
                    });

                    this.logger.log(`Gráfico "${tituloGrafico1}" generado exitosamente. Tamaño del buffer: ${chartImage1.length} bytes`);

                    // Insertar imagen en Excel
                    const imageId1 = workbook.addImage({
                        buffer: chartImage1 as any,
                        extension: 'png',
                    });
                    chartSheet1.addImage(imageId1, {
                        tl: { col: 0, row: dashboardData.chartData.labels.length + 2 },
                        ext: { width: 800, height: 400 }
                    });
                } catch (error) {
                    this.logger.error(`Error generando gráfico "${tituloGrafico1}":`, error);
                    // Continuar sin el gráfico
                }
            } else {
                // Si es > 30 días, crear hoja "Reservas por Semana"
                const chartSheet1 = workbook.addWorksheet('Reservas por Semana');
                
                // Datos para el gráfico
                chartSheet1.getCell('A1').value = 'Semana';
                chartSheet1.getCell('B1').value = 'Cantidad de Reservas';
                chartSheet1.getRow(1).font = { bold: true };
                chartSheet1.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

                dashboardData.chartData.labels.forEach((label, index) => {
                    chartSheet1.getCell(`A${index + 2}`).value = label;
                    chartSheet1.getCell(`B${index + 2}`).value = dashboardData.chartData.data[index];
                });

                chartSheet1.getColumn(1).width = 30;
                chartSheet1.getColumn(2).width = 20;

                // Generar imagen del gráfico de barras
                const tituloGrafico1 = fechaInicioDate && fechaFinDate
                    ? `Reservas por Semana (${fechaInicioDate.toLocaleDateString('es-PE')} - ${fechaFinDate.toLocaleDateString('es-PE')})`
                    : 'Reservas por Semana';

                try {
                    const chartImage1 = await chartJSNodeCanvas.renderToBuffer({
                        type: 'bar',
                        data: {
                            labels: dashboardData.chartData.labels,
                            datasets: [{
                                label: 'Reservas por Semana',
                                data: dashboardData.chartData.data,
                                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: false,
                            animation: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: tituloGrafico1,
                                    font: { size: 16, family: 'Lato, lato, sans-serif' }
                                },
                                legend: {
                                    display: true,
                                    labels: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                },
                                x: {
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            }
                        }
                    });

                    this.logger.log(`Gráfico "${tituloGrafico1}" generado exitosamente. Tamaño del buffer: ${chartImage1.length} bytes`);

                    // Insertar imagen en Excel
                    const imageId1 = workbook.addImage({
                        buffer: chartImage1 as any,
                        extension: 'png',
                    });
                    chartSheet1.addImage(imageId1, {
                        tl: { col: 0, row: dashboardData.chartData.labels.length + 2 },
                        ext: { width: 800, height: 400 }
                    });
                } catch (error) {
                    this.logger.error(`Error generando gráfico "${tituloGrafico1}":`, error);
                    // Continuar sin el gráfico
                }
            }

            // ===== HOJA 3: GRÁFICO DE RESERVAS POR MES =====
            this.logger.log('Generando gráfico de Reservas por Mes');
            const chartSheet2 = workbook.addWorksheet('Reservas por Mes');
            
            chartSheet2.getCell('A1').value = 'Mes';
            chartSheet2.getCell('B1').value = 'Cantidad de Reservas';
            chartSheet2.getRow(1).font = { bold: true };
            chartSheet2.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

            dashboardData.monthlyChartData.labels.forEach((label, index) => {
                chartSheet2.getCell(`A${index + 2}`).value = label;
                chartSheet2.getCell(`B${index + 2}`).value = dashboardData.monthlyChartData.data[index];
            });

            chartSheet2.getColumn(1).width = 15;
            chartSheet2.getColumn(2).width = 20;

            // Generar imagen del gráfico de líneas
            const tituloGrafico2 = fechaInicioDate && fechaFinDate
                ? `Reservas por Mes (${fechaInicioDate.toLocaleDateString('es-PE')} - ${fechaFinDate.toLocaleDateString('es-PE')})`
                : 'Reservas por Mes (Últimos 6 Meses)';

            try {
                const chartImage2 = await chartJSNodeCanvas.renderToBuffer({
                    type: 'line',
                    data: {
                        labels: dashboardData.monthlyChartData.labels,
                        datasets: [{
                            label: 'Reservas por Mes',
                            data: dashboardData.monthlyChartData.data,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: false,
                        animation: false,
                        plugins: {
                            title: {
                                display: true,
                                text: tituloGrafico2,
                                font: { size: 16, family: 'Lato, lato, sans-serif' }
                            },
                            legend: {
                                display: true,
                                labels: {
                                    font: { family: 'Lato, lato, sans-serif' }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    font: { family: 'Lato, lato, sans-serif' }
                                }
                            },
                            x: {
                                ticks: {
                                    font: { family: 'Lato, lato, sans-serif' }
                                }
                            }
                        }
                    }
                });

                this.logger.log(`Gráfico "${tituloGrafico2}" generado exitosamente. Tamaño del buffer: ${chartImage2.length} bytes`);

                const imageId2 = workbook.addImage({
                    buffer: chartImage2 as any,
                    extension: 'png',
                });
                chartSheet2.addImage(imageId2, {
                    tl: { col: 0, row: dashboardData.monthlyChartData.labels.length + 2 },
                    ext: { width: 800, height: 400 }
                });
            } catch (error) {
                this.logger.error(`Error generando gráfico "${tituloGrafico2}":`, error);
                // Continuar sin insertar la imagen
            }

            // ===== HOJA 3: RANKING DE AULAS =====
            this.logger.log('Generando gráfico de Ranking de Aulas');
            const aulasSheet = workbook.addWorksheet('Ranking Aulas');
            
            aulasSheet.getCell('A1').value = 'Aula';
            aulasSheet.getCell('B1').value = 'Reservas';
            aulasSheet.getRow(1).font = { bold: true };
            aulasSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

            if (dashboardData.aulasRanking && dashboardData.aulasRanking.length > 0) {
                dashboardData.aulasRanking.forEach((aula, index) => {
                    aulasSheet.getCell(`A${index + 2}`).value = aula.nombre || 'Sin nombre';
                    aulasSheet.getCell(`B${index + 2}`).value = aula.reservas || 0;
                });

                aulasSheet.getColumn(1).width = 30;
                aulasSheet.getColumn(2).width = 15;

                // Aplicar bordes a la tabla
                for (let i = 1; i <= dashboardData.aulasRanking.length + 1; i++) {
                    aulasSheet.getCell(`A${i}`).border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                    aulasSheet.getCell(`B${i}`).border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                    aulasSheet.getCell(`A${i}`).alignment = { horizontal: 'left', vertical: 'middle' };
                    aulasSheet.getCell(`B${i}`).alignment = { horizontal: 'center', vertical: 'middle' };
                }
            } else {
                // Si no hay datos, mostrar mensaje
                aulasSheet.getCell('A2').value = 'No hay datos disponibles para el período seleccionado';
                aulasSheet.mergeCells('A2:B2');
                aulasSheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
                aulasSheet.getCell('A2').font = { italic: true };
            }

            // Generar gráfico de barras horizontales si hay datos
            if (dashboardData.aulasRanking && dashboardData.aulasRanking.length > 0) {
                try {
                    const chartImageAulas = await chartJSNodeCanvas.renderToBuffer({
                        type: 'bar',
                        data: {
                            labels: dashboardData.aulasRanking.map(a => a.nombre),
                            datasets: [{
                                label: 'Reservas',
                                data: dashboardData.aulasRanking.map(a => a.reservas),
                                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: false,
                            animation: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Top 5 Aulas Más Reservadas',
                                    font: { size: 16, family: 'Lato, lato, sans-serif' }
                                },
                                legend: {
                                    display: true,
                                    labels: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    beginAtZero: true,
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                },
                                y: {
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            }
                        }
                    });

                    this.logger.log(`Gráfico "Top 5 Aulas Más Reservadas" generado exitosamente. Tamaño del buffer: ${chartImageAulas.length} bytes`);

                    const imageIdAulas = workbook.addImage({
                        buffer: chartImageAulas as any,
                        extension: 'png',
                    });
                    aulasSheet.addImage(imageIdAulas, {
                        tl: { col: 0, row: dashboardData.aulasRanking.length + 2 },
                        ext: { width: 800, height: 400 }
                    });
                } catch (error) {
                    this.logger.error('Error generando gráfico "Top 5 Aulas Más Reservadas":', error);
                    // Continuar sin insertar la imagen
                }
            }

            // ===== HOJA 5: RANKING DE EQUIPOS =====
            this.logger.log('Generando gráfico de Ranking de Equipos');
            const equiposSheet = workbook.addWorksheet('Ranking Equipos');
            
            equiposSheet.getCell('A1').value = 'Equipo';
            equiposSheet.getCell('B1').value = 'Reservas';
            equiposSheet.getRow(1).font = { bold: true };
            equiposSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

            dashboardData.equiposRanking.forEach((equipo, index) => {
                equiposSheet.getCell(`A${index + 2}`).value = equipo.nombre;
                equiposSheet.getCell(`B${index + 2}`).value = equipo.reservas;
            });

            equiposSheet.getColumn(1).width = 30;
            equiposSheet.getColumn(2).width = 15;

            // Aplicar bordes a la tabla
            for (let i = 1; i <= dashboardData.equiposRanking.length + 1; i++) {
                equiposSheet.getCell(`A${i}`).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
                equiposSheet.getCell(`B${i}`).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
                equiposSheet.getCell(`A${i}`).alignment = { horizontal: 'left', vertical: 'middle' };
                equiposSheet.getCell(`B${i}`).alignment = { horizontal: 'center', vertical: 'middle' };
            }

            // Generar gráfico de barras horizontales si hay datos
            if (dashboardData.equiposRanking.length > 0) {
                try {
                    const chartImageEquipos = await chartJSNodeCanvas.renderToBuffer({
                        type: 'bar',
                        data: {
                            labels: dashboardData.equiposRanking.map(e => e.nombre),
                            datasets: [{
                                label: 'Reservas',
                                data: dashboardData.equiposRanking.map(e => e.reservas),
                                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                                borderColor: 'rgba(153, 102, 255, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: false,
                            animation: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Top 5 Equipos Más Reservados',
                                    font: { size: 16, family: 'Lato, lato, sans-serif' }
                                },
                                legend: {
                                    display: true,
                                    labels: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    beginAtZero: true,
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                },
                                y: {
                                    ticks: {
                                        font: { family: 'Lato, lato, sans-serif' }
                                    }
                                }
                            }
                        }
                    });

                    this.logger.log(`Gráfico "Top 5 Equipos Más Reservados" generado exitosamente. Tamaño del buffer: ${chartImageEquipos.length} bytes`);

                    const imageIdEquipos = workbook.addImage({
                        buffer: chartImageEquipos as any,
                        extension: 'png',
                    });
                    equiposSheet.addImage(imageIdEquipos, {
                        tl: { col: 0, row: dashboardData.equiposRanking.length + 2 },
                        ext: { width: 800, height: 400 }
                    });
                } catch (error) {
                    this.logger.error('Error generando gráfico "Top 5 Equipos Más Reservados":', error);
                    // Continuar sin insertar la imagen
                }
            }

            // Generar buffer
            const writeResult = await workbook.xlsx.writeBuffer();
            const buffer = Buffer.isBuffer(writeResult)
                ? writeResult
                : Buffer.from(writeResult);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `dashboard_reservas_${timestamp}.xlsx`;

            this.logger.log(`Dashboard Excel generado exitosamente. Archivo: ${fileName}, Tamaño: ${buffer.length} bytes`);

            return { buffer, fileName };
        } catch (error) {
            this.logger.error('Error al generar dashboard con gráficos', error as Error);
            throw new HttpException(
                'No se pudo generar el dashboard con gráficos',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private calcularRangoPorPeriodo(
        periodo: 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'anio',
        referencia: Date,
    ): { inicio: Date; fin: Date } {
        const inicio = new Date(referencia);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(referencia);
        fin.setHours(23, 59, 59, 999);

        const month = inicio.getMonth();
        const year = inicio.getFullYear();

        switch (periodo) {
            case 'dia':
                return { inicio, fin };
            case 'semana': {
                const dayOfWeek = inicio.getDay();
                const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                inicio.setDate(inicio.getDate() - diffToMonday);
                fin.setTime(inicio.getTime());
                fin.setDate(inicio.getDate() + 6);
                fin.setHours(23, 59, 59, 999);
                return { inicio, fin };
            }
            case 'mes': {
                inicio.setDate(1);
                fin.setMonth(month + 1);
                fin.setDate(0);
                fin.setHours(23, 59, 59, 999);
                return { inicio, fin };
            }
            case 'trimestre': {
                const quarterStartMonth = Math.floor(month / 3) * 3;
                inicio.setMonth(quarterStartMonth, 1);
                fin.setMonth(quarterStartMonth + 3, 0);
                fin.setHours(23, 59, 59, 999);
                return { inicio, fin };
            }
            case 'semestre': {
                const semesterStartMonth = month < 6 ? 0 : 6;
                inicio.setMonth(semesterStartMonth, 1);
                fin.setMonth(semesterStartMonth + 6, 0);
                fin.setHours(23, 59, 59, 999);
                return { inicio, fin };
            }
            case 'anio': {
                inicio.setMonth(0, 1);
                fin.setFullYear(year, 11, 31);
                fin.setHours(23, 59, 59, 999);
                return { inicio, fin };
            }
            default:
                return { inicio, fin };
        }
    }

    // ===== MÉTODOS PARA GESTIÓN DE ASISTENTES =====

    async asignarAsistente(reservaId: string, asistenteId: string, adminId: string): Promise<Reserva> {
        // Validar que el administrador no se esté asignando a sí mismo
        if (adminId === asistenteId) {
            throw new HttpException('No puedes asignarte una reserva a ti mismo', HttpStatus.BAD_REQUEST);
        }

        // Verificar que el asistente existe y tiene el rol correcto
        const asistente = await this.usuarioModel.findById(asistenteId);

        if (!asistente || (asistente.rol as string) !== 'asistente') {
            throw new HttpException('Asistente no encontrado o no tiene permisos', HttpStatus.NOT_FOUND);
        }

        // Verificar si la reserva ya tiene este asistente asignado
        const reservaExistente = await this.reservaModel.findById(reservaId);
        if (!reservaExistente) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        // Verificar si el asistente ya está asignado (antes del populate, son IDs)
        const asistentesAsignados = (reservaExistente as any).asistentesAsignados || [];
        if (asistentesAsignados.some((asistente: any) => asistente.toString() === asistenteId || asistente === asistenteId)) {
            throw new HttpException('Este asistente ya está asignado a la reserva', HttpStatus.BAD_REQUEST);
        }

        // Actualizar la reserva agregando el asistente al array
        const reserva = await this.reservaModel
            .findByIdAndUpdate(
                reservaId,
                { $push: { asistentesAsignados: asistenteId } },
                { new: true }
            )
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        // Enviar correo al asistente asignado
        try {
            // Obtener datos del asistente
            const asistente = await this.usuarioModel.findById(asistenteId);
            if (!asistente) {
                throw new HttpException('Asistente no encontrado', HttpStatus.NOT_FOUND);
            }

            // Preparar datos para el correo
            const fechaFormateada = reserva.fecha.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Obtener nombre del ambiente (aula o equipos)
            let ambienteNombre = '';
            if (reserva.aulas && reserva.aulas.length > 0) {
                ambienteNombre = (reserva.aulas[0] as any).name || (reserva.aulas[0] as any).codigo;
            } else if (reserva.equipos && reserva.equipos.length > 0) {
                ambienteNombre = 'Equipos de laboratorio';
            }

            // Enviar correo al asistente
            await this.mailService.sendAsistenteAsignadoEmail({
                email: asistente.correo,
                nombre: asistente.nombre,
                codigoReserva: reserva.codigo,
                solicitante: reserva.nombre,
                fecha: fechaFormateada,
                ambiente: ambienteNombre,
                horario: {
                    inicio: reserva.horaInicio,
                    fin: reserva.horaFin
                },
                equipos: reserva.equipos?.map(eq => ({
                    nombre: (eq as any).nombre || eq.equipo,
                    cantidad: eq.cantidad
                }))
            });
        } catch (emailError) {
            // Log del error pero no fallar la asignación
            this.logger.error('Error enviando correo al asistente asignado', emailError as Error);
        }

        return reserva;
    }

    async desasignarAsistente(reservaId: string, asistenteId: string): Promise<Reserva> {
        // Verificar que la reserva existe
        const reservaExistente = await this.reservaModel.findById(reservaId);
        if (!reservaExistente) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        // Verificar si el asistente está asignado
        const asistentesAsignados = (reservaExistente as any).asistentesAsignados || [];
        if (!asistentesAsignados.some((asistente: any) => asistente.toString() === asistenteId || asistente === asistenteId)) {
            throw new HttpException('Este asistente no está asignado a la reserva', HttpStatus.BAD_REQUEST);
        }

        // Desasignar el asistente del array
        const reserva = await this.reservaModel
            .findByIdAndUpdate(
                reservaId,
                { $pull: { asistentesAsignados: asistenteId } },
                { new: true }
            )
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .exec();

        if (!reserva) {
            throw new HttpException('Reserva no encontrada', HttpStatus.NOT_FOUND);
        }

        return reserva;
    }

    async getReservasByAsistente(asistenteId: string): Promise<Reserva[]> {
        const reservas = await this.reservaModel
            .find({ asistentesAsignados: asistenteId })
            .populate('aulas', 'name codigo description imageUrl disponibilidad')
            .populate('equipos.equipo', 'name')
            .populate('asistentesAsignados', 'nombre correo')
            .sort({ fecha: 1, horaInicio: 1 })
            .exec();

        return reservas;
    }
} 
