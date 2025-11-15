import { Controller, Get, Post, Put, Delete, Res, HttpStatus, Body,  } from '@nestjs/common';

import { CreateEquipoDTO } from './dto/equipos.dto';

@Controller('equipos')
export class EquiposController {
    @Post('/create')
    createEquipo(@Res() response, @Body() createEquipoDTO: CreateEquipoDTO) {
        console.log(createEquipoDTO);
        return response.status(HttpStatus.OK).json({ 
            message: 'Equipo created successfully' 
        });
    }
}
