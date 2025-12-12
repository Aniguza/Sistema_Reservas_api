import { Controller, Get, Post, Put, Delete, Res, HttpStatus, Body, Param, Query, UseGuards } from '@nestjs/common';

import { CreateAulasDTO } from './dto/aulas.dto';
import { AulasService } from './aulas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('aulas')
export class AulasController {

    constructor(private readonly aulasService: AulasService) { }

    // Crear aula (SOLO ADMIN)
    @Post('/create')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async createAulas(@Res() res, @Body() createAulasDTO: CreateAulasDTO) {
        try {
            const nuevaAula = await this.aulasService.createAula(createAulasDTO);
            return res.status(HttpStatus.OK).json({
                message: 'Aulas Successfully Created',
                nuevaAula,
            });
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error creating Aulas',
                error: error.message,
            });
        }
    }

    // Obtener todas las aulas (PÚBLICO)
    @Get('/')
    async getAllAulas(@Res() res) {
        try {
            const aulas = await this.aulasService.getAllAulas();
            return res.status(HttpStatus.OK).json(aulas);
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error getting Aulas',
                error: error.message,
            });
        }
    }

    // Nuevo endpoint: Obtener todas las aulas con disponibilidad (para catálogo)
    // DEBE IR ANTES de /:id para evitar conflictos de rutas
    @Get('/catalogo/disponibilidad')
    async getAllAulasConDisponibilidad(@Res() res) {
        try {
            const aulas = await this.aulasService.getAllAulasConDisponibilidad();
            return res.status(HttpStatus.OK).json(aulas);
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error obteniendo aulas con disponibilidad',
                error: error.message,
            });
        }
    }

    // Obtener aula por ID (USUARIOS AUTENTICADOS)
    @Get('/:id')
    @UseGuards(JwtAuthGuard)
    async getAulaById(@Res() res, @Param('id') id: string) {
        try {
            const aula = await this.aulasService.getAulaById(id);
            return res.status(HttpStatus.OK).json(aula);
        } catch (error) {
            return res.status(HttpStatus.NOT_FOUND).json({
                message: 'Aula not found',
                error: error.message,
            });
        }
    }


    // Actualizar aula (SOLO ADMIN)
    @Put('/update/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async updateAula(@Res() res, @Param('id') id: string, @Body() createAulasDTO: CreateAulasDTO) {
        try {
            const updatedAula = await this.aulasService.updateAula(id, createAulasDTO);
            return res.status(HttpStatus.OK).json({
                message: 'Aula updated successfully',
                updatedAula,
            });
        } catch (error) {
            return res.status(HttpStatus.NOT_FOUND).json({
                message: 'Aula not found',
                error: error.message,
            });
        }
    }

    // Eliminar aula (SOLO ADMIN)
    @Delete('/delete/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async deleteAula(@Res() res, @Param('id') id: string) {
        try {
            const deletedAula = await this.aulasService.deleteAula(id);
            return res.status(HttpStatus.OK).json({
                message: 'Aula deleted successfully',
                deletedAula,
            });
        } catch (error) {
            return res.status(HttpStatus.NOT_FOUND).json({
                message: 'Aula not found',
                error: error.message,
            });
        }
    }

    // Nuevo endpoint: Obtener fechas reservadas de un aula específica
    @Get('/:id/fechas-reservadas')
    @UseGuards(JwtAuthGuard)
    async getFechasReservadas(@Res() res, @Param('id') id: string) {
        try {
            const fechasReservadas = await this.aulasService.getFechasReservadas(id);
            return res.status(HttpStatus.OK).json({
                aulaId: id,
                fechasReservadas,
            });
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error obteniendo fechas reservadas',
                error: error.message,
            });
        }
    }

    // Nuevo endpoint: Verificar disponibilidad de un aula en fecha/hora específica
    @Get('/:id/verificar-disponibilidad')
    @UseGuards(JwtAuthGuard)
    async verificarDisponibilidad(
        @Res() res, 
        @Param('id') id: string,
        @Query('fecha') fecha: string,
        @Query('horaInicio') horaInicio: string,
        @Query('horaFin') horaFin: string
    ) {
        try {
            const disponible = await this.aulasService.verificarDisponibilidad(
                id,
                new Date(fecha),
                horaInicio,
                horaFin
            );
            return res.status(HttpStatus.OK).json({
                aulaId: id,
                fecha,
                horaInicio,
                horaFin,
                disponible,
            });
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error verificando disponibilidad',
                error: error.message,
            });
        }
    }
    
    
}