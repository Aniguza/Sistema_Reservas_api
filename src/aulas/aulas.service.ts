import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Aula } from './interfaces/aulas.interface';
import { CreateAulasDTO } from './dto/aulas.dto';

@Injectable()
export class AulasService {
    constructor(@InjectModel('Aula') private readonly aulasModel: Model<Aula>) { }

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
}