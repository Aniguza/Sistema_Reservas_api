import { Module } from '@nestjs/common';
import { AulasController } from './aulas.controller';
import { AulasService } from './aulas.service';
import { Mongoose } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { aulasSchema } from './schemas/aulas.schema';
import { reservasSchema } from '../reservas/schemas/reservas.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Aula', schema: aulasSchema },
      { name: 'Reserva', schema: reservasSchema }
    ])
  ],
  controllers: [AulasController],
  providers: [AulasService]
})
export class AulasModule {}
