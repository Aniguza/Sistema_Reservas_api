import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MetricaTiempo, MetricaTiempoDocument } from './metrica-tiempo.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(MetricaTiempo.name)
    private metricaTiempoModel: Model<MetricaTiempoDocument>,
  ) {}

  async guardarMetricaTiempo(
    tipo: string,
    duracion_segundos: number,
    fecha_registro?: string,
    usuario?: string,
  ) {
    // Crear objeto de métrica
    const metrica = new this.metricaTiempoModel({
      tipo,
      duracion_segundos: parseInt(duracion_segundos.toString()),
      fecha_registro,
      usuario: usuario || 'anonimo',
      timestamp: new Date().toISOString(),
    });

    // Guardar en MongoDB
    const savedMetrica = await metrica.save();

    // Guardar en archivo JSON para persistencia adicional (opcional)
    await this.guardarEnArchivo(savedMetrica);

    console.log(`📊 Métrica registrada: ${duracion_segundos}s para ${usuario}`);

    return savedMetrica;
  }

  async obtenerEstadisticas() {
    const data = await this.metricaTiempoModel.find().sort({ createdAt: -1 });

    if (data.length === 0) {
      return {
        total_registros: 0,
        promedio_segundos: 0,
        minimo_segundos: 0,
        maximo_segundos: 0,
        registros_recientes: [],
      };
    }

    const duraciones = data.map(m => m.duracion_segundos);
    const promedio = Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length);
    const minimo = Math.min(...duraciones);
    const maximo = Math.max(...duraciones);

    return {
      total_registros: data.length,
      promedio_segundos: promedio,
      minimo_segundos: minimo,
      maximo_segundos: maximo,
      registros_recientes: data.slice(0, 10), // Últimos 10 registros
    };
  }

  private async guardarEnArchivo(metrica: MetricaTiempoDocument) {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const metricasPath = path.join(dataDir, 'metricas_tiempo.json');

      // Crear directorio si no existe
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      let existingData: any[] = [];
      if (fs.existsSync(metricasPath)) {
        existingData = JSON.parse(fs.readFileSync(metricasPath, 'utf8'));
      }

      existingData.push({
        id: metrica._id,
        tipo: metrica.tipo,
        duracion_segundos: metrica.duracion_segundos,
        fecha_registro: metrica.fecha_registro,
        usuario: metrica.usuario,
        timestamp: metrica.timestamp,
        createdAt: (metrica as any).createdAt || new Date(),
      });

      fs.writeFileSync(metricasPath, JSON.stringify(existingData, null, 2));
    } catch (fileError) {
      console.warn('No se pudo guardar en archivo:', fileError.message);
    }
  }
}