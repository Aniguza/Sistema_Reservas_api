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
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { CreateIncidenciaDto, UpdateIncidenciaDto } from './dto/incidencia.dto';
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

    // Obtener estadísticas agregadas para el dashboard (SOLO ADMIN)
    @Get('/dashboard/stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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

    // Exportar reservas a Excel (SOLO ADMIN)
    @Get('/reportes/excel')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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

    // Obtener todas las reservas (SOLO ADMIN)
    @Get('/')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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

    // Actualizar reserva (SOLO ADMIN)
    @Put('/update/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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

    // Reprogramar reserva (ALUMNOS, DOCENTES Y ADMIN)
    @Patch('/reprogramar/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async reprogramarReserva(
        @Res() res,
        @Param('id') id: string,
        @Body() body: { fecha: Date; horaInicio: string; horaFin: string; motivo?: string },
    ) {
        try {
            const reserva = await this.reservasService.reprogramarReserva(
                id,
                body.fecha,
                body.horaInicio,
                body.horaFin,
                body.motivo,
            );
            return res.status(HttpStatus.OK).json({
                message: 'Reserva reprogramada exitosamente',
                reserva,
            });
        } catch (error) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: error.message,
            });
        }
    }

    // Cancelar reserva (ALUMNOS, DOCENTES Y ADMIN)
    @Patch('/cancelar/:id')
    @UseGuards(JwtAuthGuard)
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
    @Roles('administrador')
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
        },
    ) {
        try {
            const disponible = await this.reservasService.checkDisponibilidad(
                body.aulas || [],
                body.equipos || [],
                body.fecha,
                body.horaInicio,
                body.horaFin,
            );
            return res.status(HttpStatus.OK).json({
                disponible,
                message: disponible
                    ? 'Los recursos están disponibles'
                    : 'Los recursos no están disponibles en el horario seleccionado',
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
}
