import { Controller, Post, Get, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {
    console.log('🎯 AnalyticsController initialized');
  }

  @Post('tiempo-formulario')
  async guardarMetricaTiempo(
    @Body() body: { tipo: string; duracion_segundos: number; fecha_registro?: string; usuario?: string },
    @Res() res: Response,
  ) {
    try {
      const { tipo, duracion_segundos, fecha_registro, usuario } = body;

      // Validar datos requeridos
      if (!duracion_segundos || !tipo) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Faltan datos requeridos: duracion_segundos y tipo',
        });
      }

      const metrica = await this.analyticsService.guardarMetricaTiempo(
        tipo,
        duracion_segundos,
        fecha_registro,
        usuario,
      );

      res.status(HttpStatus.OK).json({
        mensaje: 'Métrica registrada correctamente',
        id: metrica._id,
      });
    } catch (error) {
      console.error('Error guardando métrica:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Error interno del servidor',
      });
    }
  }

  @Get('tiempo-formulario/stats')
  async obtenerEstadisticas(@Res() res: Response) {
    try {
      const estadisticas = await this.analyticsService.obtenerEstadisticas();
      res.status(HttpStatus.OK).json(estadisticas);
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Error obteniendo estadísticas',
      });
    }
  }
}