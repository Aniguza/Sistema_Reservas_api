import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

type ManualDoc = {
  activa?: boolean;
  activadoEn?: Date | string | null;
};

@Injectable()
export class DeshabilitacionService {
  constructor(
    @InjectModel('TiempoDeshabilitacion') private tiempoModel: Model<any>,
    @InjectModel('DeshabilitacionManual') private manualModel: Model<any>,
  ) {}

  private timeToMinutes(h: string) {
    // Deprecated when using fecha-based schedules
    throw new BadRequestException('Operación no soportada: horarios por hora fueron reemplazados por fechas');
  }

  async createTiempo(data: any) {
    if (!data.motivo || data.motivo.trim() === '') {
      throw new BadRequestException('El motivo no puede estar vacío');
    }
    if (!data.fechaInicio || !data.fechaFin) {
      throw new BadRequestException('fechaInicio y fechaFin son requeridos');
    }
    const inicioDate = new Date(data.fechaInicio);
    const finDate = new Date(data.fechaFin);
    if (isNaN(inicioDate.getTime()) || isNaN(finDate.getTime())) {
      throw new BadRequestException('fechaInicio/fechaFin deben ser fechas ISO válidas');
    }
    if (inicioDate >= finDate) {
      throw new BadRequestException('fechaInicio debe ser anterior a fechaFin');
    }

    const created = new this.tiempoModel(data);
    return created.save();
  }

  async getAllTiempos() {
    return this.tiempoModel.find().sort({ createdAt: -1 }).lean();
  }

  async updateTiempo(id: string, data: any) {
    const tiempo = await this.tiempoModel.findById(id);
    if (!tiempo) {
      throw new NotFoundException('Tiempo no encontrado');
    }

    if (data.motivo !== undefined && (data.motivo === null || data.motivo.trim() === '')) {
      throw new BadRequestException('El motivo no puede estar vacío');
    }

    if (data.fechaInicio !== undefined || data.fechaFin !== undefined) {
      const fechaInicio = data.fechaInicio ? new Date(data.fechaInicio) : new Date(tiempo.fechaInicio);
      const fechaFin = data.fechaFin ? new Date(data.fechaFin) : new Date(tiempo.fechaFin);
      if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
        throw new BadRequestException('fechaInicio/fechaFin deben ser fechas ISO válidas');
      }
      if (fechaInicio >= fechaFin) {
        throw new BadRequestException('fechaInicio debe ser anterior a fechaFin');
      }
    }

    Object.assign(tiempo, data);
    return tiempo.save();
  }

  async deleteTiempo(id: string) {
    const res = await this.tiempoModel.findByIdAndDelete(id);
    if (!res) {
      throw new NotFoundException('Tiempo no encontrado');
    }
    return res;
  }

  async getManualStatus() {
    const doc = (await this.manualModel.findOne().lean()) as ManualDoc | null;
    if (!doc) {
      return { activa: false, activadoEn: null };
    }
    return { activa: !!doc.activa, activadoEn: doc.activadoEn ? new Date(doc.activadoEn).toISOString() : null };
  }

  async setManualStatus(activa: boolean) {
    let doc = (await this.manualModel.findOne()) as any;
    const now = new Date();
    if (!doc) {
      doc = new this.manualModel({ activa, activadoEn: activa ? now : null });
      await doc.save();
    } else {
      doc.activa = activa;
      doc.activadoEn = activa ? now : null;
      await doc.save();
    }
    return { activa: doc.activa, activadoEn: doc.activadoEn ? new Date(doc.activadoEn).toISOString() : null };
  }

  async isDisabled(nowDate?: Date) {
    const now = nowDate ?? new Date();

    // Check manual
    const manual = (await this.manualModel.findOne().lean()) as ManualDoc | null;
    if (manual && manual.activa) {
      return {
        deshabilitado: true,
        motivo: 'manual',
        activadoEn: manual.activadoEn ? new Date(manual.activadoEn).toISOString() : null,
      };
    }

    // Check scheduled
    const tiempos = (await this.tiempoModel.find({ activo: true }).lean()) as any[];
    for (const t of tiempos) {
      try {
        const start = new Date(t.fechaInicio);
        const end = new Date(t.fechaFin);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
        if (start <= now && now < end) {
          return {
            deshabilitado: true,
            motivo: 'programado',
            tiempo: {
              id: t._id,
              nombre: t.nombre,
              fechaInicio: start.toISOString(),
              fechaFin: end.toISOString(),
            },
          };
        }
      } catch (e) {
        continue;
      }
    }

    return { deshabilitado: false, motivo: null };
  }
}
