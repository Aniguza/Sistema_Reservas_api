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
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';

@Controller('reservas')
export class ReservasController {
    constructor(private readonly reservasService: ReservasService) { }

    // Crear nueva reserva
    @Post('/create')
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

    // Obtener todas las reservas
    @Get('/')
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

    // Obtener reserva por ID
    @Get('/:id')
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

    // Actualizar reserva
    @Put('/update/:id')
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

    // Reprogramar reserva
    @Patch('/reprogramar/:id')
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

    // Cancelar reserva (admin o mismo usuario)
    @Patch('/cancelar/:id')
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

    // Eliminar reserva
    @Delete('/delete/:id')
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

    // Verificar disponibilidad
    @Post('disponibilidad')
    async checkDisponibilidad(
        @Res() res,
        @Body()
        body: {
            aulas?: string[];
            equipos?: string[];
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
}
