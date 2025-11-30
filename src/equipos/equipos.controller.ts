import { Controller, Get, Post, Put, Delete, Res, HttpStatus, Body, Param, Query } from '@nestjs/common';

import { CreateEquipoDTO } from './dto/equipos.dto';
import { EquiposService } from './equipos.service';

@Controller('equipos')
export class EquiposController {
    constructor(private readonly equiposService: EquiposService) { }

    @Post('/create')
    async createEquipo(@Res() response, @Body() createEquipoDTO: CreateEquipoDTO) {
        try {
            const nuevoEquipo = await this.equiposService.createEquipo(createEquipoDTO);
            return response.status(HttpStatus.OK).json({
                message: 'Equipo created successfully',
                equipo: nuevoEquipo,
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error creating equipo',
                error: error.message,
            });
        }
    }

    @Get('/')
    async getAllEquipos(@Res() response) {
        try {
            const equipos = await this.equiposService.getAllEquipos();
            return response.status(HttpStatus.OK).json(equipos);
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error getting equipos',
                error: error.message,
            });
        }
    }

    // Nuevo endpoint: Obtener todos los equipos con disponibilidad (para catálogo)
    // DEBE IR ANTES de /:id para evitar conflictos de rutas
    @Get('/catalogo/disponibilidad')
    async getAllEquiposConDisponibilidad(@Res() response) {
        try {
            const equipos = await this.equiposService.getAllEquiposConDisponibilidad();
            return response.status(HttpStatus.OK).json(equipos);
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error obteniendo equipos con disponibilidad',
                error: error.message,
            });
        }
    }

    @Get('/:id')
    async getEquipoById(@Res() response, @Param('id') id: string) {
        try {
            const equipo = await this.equiposService.getEquipoById(id);
            return response.status(HttpStatus.OK).json(equipo);
        } catch (error) {
            return response.status(HttpStatus.NOT_FOUND).json({
                message: 'Equipo no encontrado',
                error: error.message,
            });
        }
    }

    @Put('/update/:id')
    async updateEquipo(@Res() response, @Param('id') id: string, @Body() createEquipoDTO: CreateEquipoDTO) {
        try {
            const updatedEquipo = await this.equiposService.updateEquipo(id, createEquipoDTO);
            return response.status(HttpStatus.OK).json({
                message: 'Equipo actualizado exitosamente',
                equipo: updatedEquipo,
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error actualizando equipo',
                error: error.message,
            });
        }
    }

    @Delete('/delete/:id')
    async deleteEquipo(@Res() response, @Param('id') id: string) {
        try {
            const deletedEquipo = await this.equiposService.deleteEquipo(id);
            return response.status(HttpStatus.OK).json({
                message: 'Equipo eliminado exitosamente',
                equipo: deletedEquipo,
            });
        } catch (error) {
            return response.status(HttpStatus.NOT_FOUND).json({
                message: 'Equipo no encontrado',
                error: error.message,
            });
        }
    }

    // Nuevo endpoint: Obtener fechas reservadas de un equipo específico
    @Get('/:id/fechas-reservadas')
    async getFechasReservadas(@Res() response, @Param('id') id: string) {
        try {
            const fechasReservadas = await this.equiposService.getFechasReservadas(id);
            return response.status(HttpStatus.OK).json({
                equipoId: id,
                fechasReservadas,
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error obteniendo fechas reservadas',
                error: error.message,
            });
        }
    }

    // Nuevo endpoint: Verificar disponibilidad de un equipo en fecha/hora específica
    @Get('/:id/verificar-disponibilidad')
    async verificarDisponibilidad(
        @Res() response, 
        @Param('id') id: string,
        @Query('fecha') fecha: string,
        @Query('horaInicio') horaInicio: string,
        @Query('horaFin') horaFin: string
    ) {
        try {
            const disponible = await this.equiposService.verificarDisponibilidad(
                id,
                new Date(fecha),
                horaInicio,
                horaFin
            );
            return response.status(HttpStatus.OK).json({
                equipoId: id,
                fecha,
                horaInicio,
                horaFin,
                disponible,
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error verificando disponibilidad',
                error: error.message,
            });
        }
    }
}