import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Res,
  HttpStatus,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DeshabilitacionService } from './deshabilitacion.service';
import { CreateTiempoDto } from './dto/create-tiempo.dto';
import { UpdateTiempoDto } from './dto/update-tiempo.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-objectid.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tiempos-deshabilitacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class TiemposController {
  constructor(private readonly desService: DeshabilitacionService) {}

  @Get()
  async getAll(@Res() res) {
    try {
      const tiempos = await this.desService.getAllTiempos();
      return res.status(HttpStatus.OK).json(tiempos.map(t => ({
        id: t._id,
        motivo: t.motivo,
        fechaInicio: t.fechaInicio,
        fechaFin: t.fechaFin,
        activo: t.activo,
        createdAt: t.createdAt,
      })));
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error al obtener tiempos', error: error.message });
    }
  }

  @Post()
  async create(@Res() res, @Body() createDto: CreateTiempoDto) {
    try {
      const created = await this.desService.createTiempo(createDto);
      const obj = created.toObject();
      return res.status(HttpStatus.CREATED).json({ id: obj._id, nombre: obj.nombre, fechaInicio: obj.fechaInicio, fechaFin: obj.fechaFin, activo: obj.activo, createdAt: obj.createdAt });
    } catch (error) {
      const status = error.status || HttpStatus.BAD_REQUEST;
      return res.status(status).json({ message: error.message });
    }
  }

  @Put('/:id')
  async update(@Res() res, @Param('id', ParseObjectIdPipe) id: string, @Body() updateDto: UpdateTiempoDto) {
    try {
      const updated = await this.desService.updateTiempo(id, updateDto);
      const obj = updated.toObject();
      return res.status(HttpStatus.OK).json({ id: obj._id, nombre: obj.nombre, fechaInicio: obj.fechaInicio, fechaFin: obj.fechaFin, activo: obj.activo, updatedAt: obj.updatedAt });
    } catch (error) {
      const status = error.status || (error.message && error.message.includes('no encontrado') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST);
      return res.status(status).json({ message: error.message });
    }
  }

  @Delete('/:id')
  async remove(@Res() res, @Param('id', ParseObjectIdPipe) id: string) {
    try {
      await this.desService.deleteTiempo(id);
      return res.status(HttpStatus.OK).json({ message: 'Tiempo eliminado exitosamente' });
    } catch (error) {
      const status = error.status || HttpStatus.BAD_REQUEST;
      return res.status(status).json({ message: error.message });
    }
  }
}
