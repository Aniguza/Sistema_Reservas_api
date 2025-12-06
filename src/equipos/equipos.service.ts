import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Equipo } from './interfaces/equipos.interface';
import { CreateEquipoDTO } from './dto/equipos.dto';

@Injectable()
export class EquiposService {
    constructor(
        @InjectModel('Equipo') private readonly equipoModel: Model<Equipo>,
        @InjectModel('Reserva') private readonly reservaModel: Model<any>
    ) { }

    async createEquipo(createEquipoDTO: CreateEquipoDTO): Promise<Equipo> {
        const nuevoEquipo = new this.equipoModel(createEquipoDTO);
        return await nuevoEquipo.save();
    }

    async getAllEquipos(): Promise<Equipo[]> {
        const equipos = await this.equipoModel.find().exec();
        return equipos;
    }

    async getEquipoById(EquipoID: string): Promise<Equipo> {
        const equipo = await this.equipoModel.findById(EquipoID).exec();
        if (!equipo) {
            throw new Error(`Equipo con ID ${EquipoID} no encontrado`);
        }
        return equipo;
    }

    async deleteEquipo(EquipoID: string): Promise<Equipo> {
        const deletedEquipo = await this.equipoModel.findByIdAndDelete(EquipoID).exec();
        if (!deletedEquipo) {
            throw new Error(`Equipo con ID ${EquipoID} no encontrado`);
        }
        return deletedEquipo;
    }

    async updateEquipo(EquipoID: string, createEquipoDTO: CreateEquipoDTO): Promise<Equipo> {
        const updatedEquipo = await this.equipoModel.findByIdAndUpdate(EquipoID, createEquipoDTO, { new: true }).exec();
        if (!updatedEquipo) {
            throw new Error(`Equipo con ID ${EquipoID} no encontrado`);
        }
        return updatedEquipo;
    }

    /**
     * Obtiene todas las fechas reservadas para un equipo específico
     * Retorna array de objetos con fecha, horaInicio, horaFin
     */
    async getFechasReservadas(equipoID: string): Promise<any[]> {
        const reservas = await this.reservaModel
            .find({
                equipos: equipoID,
                estado: { $in: ['pendiente', 'confirmada'] }, // Solo reservas activas
            })
            .select('fecha horaInicio horaFin')
            .exec();

        return reservas.map(reserva => ({
            fecha: reserva.fecha,
            horaInicio: reserva.horaInicio,
            horaFin: reserva.horaFin,
        }));
    }

    /**
     * Obtiene todos los equipos con sus fechas reservadas
     * Útil para mostrar el catálogo con disponibilidad
     */
    async getAllEquiposConDisponibilidad(): Promise<any[]> {
        const equipos = await this.equipoModel.find().exec();
        
        const equiposConDisponibilidad = await Promise.all(
            equipos.map(async (equipo) => {
                const fechasReservadas = await this.getFechasReservadas(String(equipo._id));
                
                return {
                    ...equipo.toObject(),
                    fechasReservadas,
                    // disponibilidad general del equipo (si está fuera de servicio)
                    disponibilidadGeneral: equipo.disponibilidad ?? true,
                };
            })
        );

        return equiposConDisponibilidad;
    }

    /**
     * Verifica si un equipo está disponible en una fecha y horario específico
     */
    async verificarDisponibilidad(
        equipoID: string, 
        fecha: Date, 
        horaInicio: string, 
        horaFin: string
    ): Promise<boolean> {
        const equipo = await this.getEquipoById(equipoID);
        
        
        if (equipo.disponibilidad === 'no disponible' || equipo.disponibilidad === 'en mantenimiento' || equipo.disponibilidad === 'ocupado') {
            return false;
        }

        // Buscar reservas que se solapen con el horario solicitado
        const reservasConflicto = await this.reservaModel
            .find({
                equipos: equipoID,
                fecha: fecha,
                estado: { $in: ['pendiente', 'confirmada'] },
                $or: [
                    // Nueva reserva comienza durante una reserva existente
                    { horaInicio: { $lte: horaInicio }, horaFin: { $gt: horaInicio } },
                    // Nueva reserva termina durante una reserva existente
                    { horaInicio: { $lt: horaFin }, horaFin: { $gte: horaFin } },
                    // Nueva reserva contiene completamente una reserva existente
                    { horaInicio: { $gte: horaInicio }, horaFin: { $lte: horaFin } },
                ],
            })
            .exec();

        return reservasConflicto.length === 0;
    }
}