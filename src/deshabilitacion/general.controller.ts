import { Controller, Get, Res, HttpStatus, Query } from '@nestjs/common';
import { DeshabilitacionService } from './deshabilitacion.service';

@Controller('api/deshabilitacion')
export class GeneralController {
  constructor(private readonly desService: DeshabilitacionService) {}

  // Opcional: recibir fecha ISO en query ?at=2026-01-04T10:00:00Z para evaluar en otro momento
  @Get()
  async check(@Res() res, @Query('at') at?: string) {
    try {
      const date = at ? new Date(at) : undefined;
      const result = await this.desService.isDisabled(date);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
    }
  }
}
