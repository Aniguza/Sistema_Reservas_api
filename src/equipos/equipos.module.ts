import { Module } from '@nestjs/common';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { MongooseModule } from '@nestjs/mongoose';
import { equiposSchema } from './schemas/equipos.schema';
import { reservasSchema } from '../reservas/schemas/reservas.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Equipo', schema: equiposSchema },
      { name: 'Reserva', schema: reservasSchema }
    ])
  ],
  controllers: [EquiposController],
  providers: [EquiposService]
})
export class EquiposModule { }
