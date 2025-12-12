import { Controller, Get, Post, Put, Delete, Res, HttpStatus, Body, Param, Query, UseGuards } from '@nestjs/common';

import { CreateEquipoDTO } from './dto/equipos.dto';
import { EquiposService } from './equipos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('equipos')
export class EquiposController {
    constructor(private readonly equiposService: EquiposService) { }


    // Crear equipo (SOLO ADMIN)
    @Post('/create')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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

    // Obtener todos los equipos (PÚBLICO)
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

    // Obtener equipo por ID (USUARIOS AUTENTICADOS)
    @Get('/:id')
    @UseGuards(JwtAuthGuard)
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

    // Actualizar equipo (SOLO ADMIN)
    @Put('/update/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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

    // Eliminar equipo (SOLO ADMIN)
    @Delete('/delete/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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
    @UseGuards(JwtAuthGuard)
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
    @UseGuards(JwtAuthGuard)
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