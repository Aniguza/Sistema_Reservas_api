import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Equipo } from './interfaces/equipos.interface';
import { CreateEquipoDTO } from './dto/equipos.dto';

@Injectable()
export class EquiposService {
    constructor(@InjectModel('Equipo') private readonly equipoModel: Model<Equipo>) { }

    async createEquipo(createEquipoDTO: CreateEquipoDTO): Promise<Equipo> {
        const nuevoEquipo = new this.equipoModel(createEquipoDTO);
        return await nuevoEquipo.save();
    }
    
    async getAllEquipos(): Promise<Equipo[]> {
        const equipos = await this.equipoModel.find().exec();
        return equipos;
    }

    async getEquipoById(ProductID: string): Promise<Equipo> {
        const equipo = await this.equipoModel.findById(ProductID).exec();
        if (!equipo) {
            throw new Error(`Equipo con ID ${ProductID} no encontrado`);
        }
        return equipo;
    }

    async deleteEquipo(ProductID: string): Promise<Equipo> {
        const deletedEquipo = await this.equipoModel.findByIdAndDelete(ProductID).exec();
        if (!deletedEquipo) {
            throw new Error(`Equipo con ID ${ProductID} no encontrado`);
        }
        return deletedEquipo;
    }

    async updateEquipo(ProductID: string, createEquipoDTO: CreateEquipoDTO): Promise<Equipo> {
        const updatedEquipo = await this.equipoModel.findByIdAndUpdate(ProductID, createEquipoDTO, { new: true }).exec();
        if (!updatedEquipo) {
            throw new Error(`Equipo con ID ${ProductID} no encontrado`);
        }
        return updatedEquipo;
    }
}