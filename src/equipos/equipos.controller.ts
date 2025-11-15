import { Controller, Get, Post, Put, Delete, Res, HttpStatus, Body, Param } from '@nestjs/common';

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

    @Get('/:id')
    async getEquipoById(@Res() response, @Param('id') id: string) {
        try {
            const equipo = await this.equiposService.getEquipoById(id);
            return response.status(HttpStatus.OK).json(equipo);
        } catch (error) {
            return response.status(HttpStatus.NOT_FOUND).json({
                message: 'Equipo not found',
                error: error.message,
            });
        }
    }

    @Delete('/delete/:id')
    async deleteEquipo(@Res() response, @Param('id') id: string) {
        try {
            const deletedEquipo = await this.equiposService.deleteEquipo(id);
            return response.status(HttpStatus.OK).json({
                message: 'Equipo deleted successfully',
                equipo: deletedEquipo,
            });
        } catch (error) {
            return response.status(HttpStatus.NOT_FOUND).json({
                message: 'Equipo not found',
                error: error.message,
            });
        }
    }
}