import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    HttpStatus,
    Res,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { CreateIncidenciaDto, UpdateIncidenciaDto } from './dto/incidencia.dto';
import { ReprogramarReservaDto } from './dto/reprogramar-reserva.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reservas')
export class ReservasController {
    constructor(private readonly reservasService: ReservasService) { }

    // Crear nueva reserva (SOLO ALUMNOS Y DOCENTES)
    @Post('/create')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('alumno', 'docente')
    async createReserva(@Res() res, @Body() createReservaDto: CreateReservaDto) {
        try {
            const reserva = await this.reservasService.createReserva(createReservaDto);
            return res.status(HttpStatus.CREATED).json({
                message: 'Reserva creada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener estadísticas agregadas para el dashboard (ADMIN Y ASISTENTES)
    @Get('/dashboard/stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador', 'asistente')
    async getDashboardStats(@Res() res) {
        try {
            const stats = await this.reservasService.getDashboardStats();
            return res.status(HttpStatus.OK).json(stats);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Exportar reservas a Excel (ADMIN Y ASISTENTES)
    @Get('/reportes/excel')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador', 'asistente')
    async exportReservasExcel(
        @Res() res,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string,
        @Query('periodo') periodo?: 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'anio',
        @Query('fechaReferencia') fechaReferencia?: string,
        @Query('tipo') tipo?: 'aula' | 'equipo',
    ) {
        try {
            const { buffer, fileName, total } = await this.reservasService.exportReservasToExcel({
                fechaInicio,
                fechaFin,
                periodo,
                fechaReferencia,
                tipo,
            });

            const encodedName = encodeURIComponent(fileName);

            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodedName}`,
                'X-Total-Items': total.toString(),
            });

            return res.status(HttpStatus.OK).send(buffer);
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Exportar dashboard con gráficos a Excel (ADMIN Y ASISTENTES)
    @Get('/dashboard/exportar')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador', 'asistente')
    async exportDashboardExcel(
        @Res() res,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string,
    ) {
        try {
            const { buffer, fileName } = await this.reservasService.exportDashboardToExcel({
                fechaInicio,
                fechaFin,
            });

            const encodedName = encodeURIComponent(fileName);

            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodedName}`,
            });

            return res.status(HttpStatus.OK).send(buffer);
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener todas las reservas (ADMIN Y ASISTENTES)
    @Get('/')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador', 'asistente')
    async getAllReservas(@Res() res) {
        try {
            const reservas = await this.reservasService.getAllReservas();
            return res.status(HttpStatus.OK).json(reservas);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener reserva por ID (TODOS AUTENTICADOS)
    @Get('/:id')
    @UseGuards(JwtAuthGuard)
    async getReservaById(@Res() res, @Param('id') id: string) {
        try {
            const reserva = await this.reservasService.getReservaById(id);
            return res.status(HttpStatus.OK).json(reserva);
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Actualizar reserva (ADMIN Y ASISTENTES)
    @Put('/update/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador', 'asistente')
    async updateReserva(
        @Res() res,
        @Param('id') id: string,
        @Body() updateReservaDto: UpdateReservaDto,
    ) {
        try {
            const reserva = await this.reservasService.updateReserva(id, updateReservaDto);
            return res.status(HttpStatus.OK).json({
                message: 'Reserva actualizada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Reprogramar reserva (SOLO EL PROPIETARIO O ADMIN - NO ASISTENTES)
    @Patch('/reprogramar/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('alumno', 'docente', 'administrador')
    async reprogramarReserva(
        @Res() res,
        @Param('id') id: string,
        @Body() body: ReprogramarReservaDto,
        @Request() req,
    ) {
        try {
            // Log detallado del body recibido
            console.log('🔍 ===== BODY RECIBIDO EN REPROGRAMACIÓN =====');
            console.log(`🔍 Body completo:`, JSON.stringify(body, null, 2));
            console.log(`🔍 body.fecha: ${body.fecha}`);
            console.log(`🔍 Tipo de body.fecha: ${typeof body.fecha}`);
            console.log('🔍 ============================================');

            // La fecha viene como string "YYYY-MM-DD" desde el DTO
            // Asegurar que sea string (por si acaso)
            const fechaParaValidar: string = typeof body.fecha === 'string' 
                ? body.fecha 
                : String(body.fecha).split('T')[0]; // Si por alguna razón viene como Date, extraer solo la fecha

            // Primero obtener la reserva para determinar aulas/equipos
            const reserva = await this.reservasService.getReservaBasicaById(id);

            if (!reserva) {
                return res.status(HttpStatus.NOT_FOUND).json({
                    message: 'Reserva no encontrada',
                });
            }

            // Obtener el usuario del token JWT
            const user = req.user;

            // Validar que solo el propietario de la reserva pueda reprogramarla (o un administrador)
            if (user.rol !== 'administrador' && reserva.correo !== user.correo) {
                return res.status(HttpStatus.FORBIDDEN).json({
                    message: 'Solo puedes reprogramar tus propias reservas',
                });
            }

            // Validar que el usuario no tenga otra reserva activa en la nueva fecha (excluyendo esta reserva)
            const puedeReprogramar = await this.reservasService.validarUsuarioPuedeReprogramar(
                reserva.correo,
                fechaParaValidar as any,
                id
            );

            if (!puedeReprogramar) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    message: 'Ya tienes una reserva activa para este día. Solo puedes tener una reserva por día.',
                });
            }

            // Validar disponibilidad usando el endpoint de checkDisponibilidad
            let aulasParaValidar: string[] = [];
            let equiposParaValidar: any[] = [];

            if (reserva.equipos && reserva.equipos.length > 0) {
                equiposParaValidar = reserva.equipos;
            } else if (reserva.aulas && reserva.aulas.length > 0) {
                aulasParaValidar = reserva.aulas.map((a: any) => a._id.toString());
            }

            console.log('🔍 CONTROLLER REPROGRAMACIÓN - Validando disponibilidad de aula/equipos...');
            console.log(`🔍 Fecha para validar: ${fechaParaValidar} (tipo: ${typeof fechaParaValidar})`);
            const resultadoCheck = await this.reservasService.checkDisponibilidad(
                aulasParaValidar,
                equiposParaValidar,
                fechaParaValidar as any,
                body.horaInicio,
                body.horaFin,
                id, // Excluir la reserva actual
                reserva.correo,
            );

            if (!resultadoCheck.disponible) {
                return res.status(HttpStatus.CONFLICT).json({
                    message: 'No se puede reprogramar: ' + resultadoCheck.motivo,
                    motivo: resultadoCheck.motivo,
                });
            }

            // Si está disponible, proceder con la reprogramación
            const reservaActualizada = await this.reservasService.reprogramarReserva(
                id,
                fechaParaValidar as any,
                body.horaInicio,
                body.horaFin,
                body.motivo,
            );
            return res.status(HttpStatus.OK).json({
                message: 'Reserva reprogramada exitosamente',
                reserva: reservaActualizada,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Cancelar reserva (ALUMNOS, DOCENTES Y ADMIN - NO ASISTENTES)
    @Patch('/cancelar/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('alumno', 'docente', 'administrador')
    async cancelarReserva(
        @Res() res,
        @Param('id') id: string,
        @Body() body: { isAdmin?: boolean; motivo?: string; correoUsuario?: string },
    ) {
        try {
            const reserva = await this.reservasService.cancelarReserva(
                id, 
                body.isAdmin || false,
                body.motivo,
                body.correoUsuario
            );
            return res.status(HttpStatus.OK).json({
                message: 'Reserva cancelada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Eliminar reserva (SOLO ADMIN)
    @Delete('/delete/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador', 'asistente')
    async deleteReserva(@Res() res, @Param('id') id: string) {
        try {
            const reserva = await this.reservasService.deleteReserva(id);
            return res.status(HttpStatus.OK).json({
                message: 'Reserva eliminada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener reservas por aula
    @Get('aula/:aulaId')
    async getReservasByAula(@Res() res, @Param('aulaId') aulaId: string) {
        try {
            const reservas = await this.reservasService.getReservasByAula(aulaId);
            return res.status(HttpStatus.OK).json(reservas);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener reservas por equipo
    @Get('equipo/:equipoId')
    async getReservasByEquipo(@Res() res, @Param('equipoId') equipoId: string) {
        try {
            const reservas = await this.reservasService.getReservasByEquipo(equipoId);
            return res.status(HttpStatus.OK).json(reservas);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener reservas por usuario (correo)
    @Get('usuario/:correo')
    async getReservasByUsuario(@Res() res, @Param('correo') correo: string) {
        try {
            const reservas = await this.reservasService.getReservasByUsuario(correo);
            return res.status(HttpStatus.OK).json(reservas);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Verificar disponibilidad (ALUMNOS Y DOCENTES)
    @Post('disponibilidad')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('alumno', 'docente')
    async checkDisponibilidad(
        @Res() res,
        @Body()
        body: {
            aulas?: string[];
            equipos?: { equipo: string; nombre: string; cantidad: number }[];
            fecha: Date;
            horaInicio: string;
            horaFin: string;
            correoUsuario?: string;
        },
    ) {
        try {
            console.log('=== CONTROLLER: checkDisponibilidad ===');
            console.log('Body recibido:', JSON.stringify(body, null, 2));
            console.log('aulas:', body.aulas, 'equipos:', body.equipos);

            const resultado = await this.reservasService.checkDisponibilidad(
                body.aulas || [],
                body.equipos || [],
                body.fecha,
                body.horaInicio,
                body.horaFin,
                undefined,
                body.correoUsuario,
            );
            return res.status(HttpStatus.OK).json({
                disponible: resultado.disponible,
                message: resultado.disponible
                    ? 'Los recursos están disponibles'
                    : resultado.motivo || 'Los recursos no están disponibles en el horario seleccionado',
                motivo: resultado.motivo,
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // ===== ENDPOINTS DE INCIDENCIAS =====

    // Reportar incidencia en una reserva
    @Post(':id/incidencias')
    async reportarIncidencia(
        @Res() res,
        @Param('id') reservaId: string,
        @Body() body: CreateIncidenciaDto & { reportadoPor: string },
    ) {
        try {
            const reserva = await this.reservasService.reportarIncidencia(
                reservaId,
                body.descripcion,
                body.tipo,
                body.prioridad,
                body.reportadoPor,
            );
            return res.status(HttpStatus.CREATED).json({
                message: 'Incidencia reportada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener incidencias de una reserva específica
    @Get(':id/incidencias')
    async getIncidenciasByReserva(@Res() res, @Param('id') reservaId: string) {
        try {
            const incidencias = await this.reservasService.getIncidenciasByReserva(reservaId);
            return res.status(HttpStatus.OK).json(incidencias);
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener todas las incidencias con filtros opcionales
    @Get('incidencias/todas')
    async getAllIncidencias(
        @Res() res,
        @Query('tipo') tipo?: string,
        @Query('estado') estado?: string,
        @Query('prioridad') prioridad?: string,
    ) {
        try {
            const filtros: any = {};
            if (tipo) filtros.tipo = tipo;
            if (estado) filtros.estado = estado;
            if (prioridad) filtros.prioridad = prioridad;

            const incidencias = await this.reservasService.getAllIncidencias(filtros);
            return res.status(HttpStatus.OK).json(incidencias);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Actualizar estado de una incidencia
    @Patch(':reservaId/incidencias/:incidenciaId')
    async actualizarIncidencia(
        @Res() res,
        @Param('reservaId') reservaId: string,
        @Param('incidenciaId') incidenciaId: string,
        @Body() body: UpdateIncidenciaDto & { estado: 'reportada' | 'en_revision' | 'en_proceso' | 'resuelta' | 'cerrada' },
    ) {
        try {
            const reserva = await this.reservasService.actualizarIncidencia(
                reservaId,
                incidenciaId,
                body.estado,
                body.resolucion,
            );
            return res.status(HttpStatus.OK).json({
                message: 'Incidencia actualizada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Eliminar incidencia
    @Delete(':reservaId/incidencias/:incidenciaId')
    async eliminarIncidencia(
        @Res() res,
        @Param('reservaId') reservaId: string,
        @Param('incidenciaId') incidenciaId: string,
    ) {
        try {
            const reserva = await this.reservasService.eliminarIncidencia(
                reservaId,
                incidenciaId,
            );
            return res.status(HttpStatus.OK).json({
                message: 'Incidencia eliminada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // ===== CIERRE AUTOMÁTICO DE RESERVAS =====

    // Cerrar reservas que ya pasaron su fecha y hora
    @Patch('admin/cerrar-reservas-pasadas')
    async cerrarReservasPasadas(@Res() res) {
        try {
            const resultado = await this.reservasService.cerrarReservasPasadas();
            return res.status(HttpStatus.OK).json({
                message: `Se cerraron ${resultado.actualizadas} reservas exitosamente`,
                actualizadas: resultado.actualizadas,
                detalles: resultado.detalles,
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Actualizar estados de reservas según su horario actual
    @Patch('admin/actualizar-estados')
    async actualizarEstadosReservas(@Res() res) {
        try {
            const resultado = await this.reservasService.actualizarEstadosReservas();
            return res.status(HttpStatus.OK).json({
                message: `Se actualizaron ${resultado.actualizadas} reservas exitosamente`,
                actualizadas: resultado.actualizadas,
                detalles: resultado.detalles,
            });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener reservas por estado
    @Get('estado/:estado')
    async getReservasByEstado(
        @Res() res,
        @Param('estado') estado: 'confirmada' | 'cancelada' | 'completada' | 'cerrada' | 'cerrada_con_incidencia',
    ) {
        try {
            const reservas = await this.reservasService.getReservasByEstado(estado);
            return res.status(HttpStatus.OK).json(reservas);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // ===== GESTIÓN DE ASISTENTES =====

    // Asignar reserva a un asistente (SOLO ADMIN)
    @Patch('/asignar-asistente/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async asignarAsistente(
        @Res() res,
        @Param('id') id: string,
        @Body() body: { asistenteId: string },
        @Request() req,
    ) {
        try {
            const user = req.user; // Usuario del token JWT
            const reserva = await this.reservasService.asignarAsistente(id, body.asistenteId, user._id);
            return res.status(HttpStatus.OK).json({
                message: 'Reserva asignada al asistente exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Desasignar reserva de un asistente (SOLO ADMIN)
    @Patch('/desasignar-asistente/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async desasignarAsistente(
        @Res() res,
        @Param('id') id: string,
        @Body() body: { asistenteId: string }
    ) {
        try {
            const reserva = await this.reservasService.desasignarAsistente(id, body.asistenteId);
            return res.status(HttpStatus.OK).json({
                message: 'Reserva desasignada del asistente exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener reservas asignadas a un asistente específico (SOLO ADMIN)
    @Get('/asistente/:asistenteId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador', 'asistente')
    async getReservasByAsistente(@Res() res, @Param('asistenteId') asistenteId: string) {
        try {
            const reservas = await this.reservasService.getReservasByAsistente(asistenteId);
            return res.status(HttpStatus.OK).json(reservas);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Obtener reservas asignadas al asistente actual (SOLO ASISTENTES)
    @Get('/mis-asignaciones')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('asistente')
    async getMisAsignaciones(@Res() res, @Request() req) {
        try {
            // El usuario se obtiene del token JWT a través del guard
            const user = req.user;
            const reservas = await this.reservasService.getReservasByAsistente(user._id);
            return res.status(HttpStatus.OK).json(reservas);
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }
}
