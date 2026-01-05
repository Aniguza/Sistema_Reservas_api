import { Controller, Get, Post, Res, HttpStatus, Body, UseGuards } from '@nestjs/common';
import { DeshabilitacionService } from './deshabilitacion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('deshabilitacion-manual')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class ManualController {
  constructor(private readonly desService: DeshabilitacionService) {}

  @Get()
  async getStatus(@Res() res) {
    try {
      const status = await this.desService.getManualStatus();
      return res.status(HttpStatus.OK).json(status);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error al obtener estado', error: error.message });
    }
  }

  @Post()
  async setStatus(@Res() res, @Body() body: { activa: boolean }) {
    try {
      if (typeof body.activa !== 'boolean') {
        return res.status(HttpStatus.BAD_REQUEST).json({ message: 'El campo activa es requerido y debe ser booleano' });
      }
      const result = await this.desService.setManualStatus(body.activa);
      const message = body.activa ? 'Deshabilitación manual activada' : 'Deshabilitación manual desactivada';
      return res.status(HttpStatus.OK).json({ activa: result.activa, message, activadoEn: result.activadoEn });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }
}
