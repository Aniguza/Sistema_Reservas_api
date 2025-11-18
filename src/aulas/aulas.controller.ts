import { Controller, Get, Post, Put, Delete, Res, HttpStatus, Body, Param } from '@nestjs/common';

import { CreateAulasDTO } from './dto/aulas.dto';
import { AulasService } from './aulas.service';

@Controller('aulas')
export class AulasController {

    constructor(private readonly aulasService: AulasService) { }

    @Post('/create')
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

    @Get('/:id')
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


    @Delete('/delete/:id')
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
}