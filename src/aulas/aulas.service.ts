import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Aula } from './interfaces/aulas.interface';
import { CreateAulasDTO } from './dto/aulas.dto';

@Injectable()
export class AulasService {
    constructor(
        @InjectModel('Aula') private readonly aulasModel: Model<Aula>,
        @InjectModel('Reserva') private readonly reservaModel: Model<any>
    ) { }

    async createAula(createAulasDTO: CreateAulasDTO): Promise<Aula> {
        const nuevaAula = new this.aulasModel(createAulasDTO);
        return await nuevaAula.save();
    }

    async getAllAulas(): Promise<Aula[]> {
        const aulas = await this.aulasModel.find().populate('equipos').exec();
        return aulas;
    }

    async getAulaById(AulaID: string): Promise<Aula> {
        const aula = await this.aulasModel.findById(AulaID).populate('equipos').exec();
        if (!aula) {
            throw new Error(`Aula con ID ${AulaID} no encontrada`);
        }
        return aula;
    }

    async deleteAula(AulaID: string): Promise<Aula> {
        const deletedAula = await this.aulasModel.findByIdAndDelete(AulaID).exec();
        if (!deletedAula) {
            throw new Error(`Aula con ID ${AulaID} no encontrada`);
        }
        return deletedAula;
    }

    async updateAula(AulaID: string, createAulasDTO: CreateAulasDTO): Promise<Aula> {
        const updatedAula = await this.aulasModel.findByIdAndUpdate(AulaID, createAulasDTO, { new: true }).exec();
        if (!updatedAula) {
            throw new Error(`Aula con ID ${AulaID} no encontrada`);
        }
        return updatedAula;
    }

    /**
     * Obtiene todas las fechas reservadas para un aula específica
     * Retorna array de objetos con fecha, horaInicio, horaFin
     */
    async getFechasReservadas(aulaID: string): Promise<any[]> {
        const reservas = await this.reservaModel
            .find({
                aulas: aulaID,
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
     * Obtiene todas las aulas con sus fechas reservadas
     * Útil para mostrar el catálogo con disponibilidad
     */
    async getAllAulasConDisponibilidad(): Promise<any[]> {
        const aulas = await this.aulasModel.find().populate('equipos').exec();
        
        const aulasConDisponibilidad = await Promise.all(
            aulas.map(async (aula) => {
                const fechasReservadas = await this.getFechasReservadas(String(aula._id));
                
                return {
                    ...aula.toObject(),
                    fechasReservadas,
                };
            })
        );

        return aulasConDisponibilidad;
    }

    /**
     * Verifica si un aula está disponible en una fecha y horario específico
     */
    async verificarDisponibilidad(
        aulaID: string, 
        fecha: Date, 
        horaInicio: string, 
        horaFin: string
    ): Promise<boolean> {
        const aula = await this.getAulaById(aulaID);
        
        if (!aula) {
            return false;
        }

        // Buscar reservas que se solapen con el horario solicitado
        const reservasConflicto = await this.reservaModel
            .find({
                aulas: aulaID,
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