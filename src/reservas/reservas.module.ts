import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { reservasSchema } from './schemas/reservas.schema';
import { aulasSchema } from '../aulas/schemas/aulas.schema';
import { equiposSchema } from '../equipos/schemas/equipos.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'Reserva', schema: reservasSchema },
            { name: 'Aula', schema: aulasSchema },
            { name: 'Equipo', schema: equiposSchema },
        ]),
    ],
    controllers: [ReservasController],
    providers: [ReservasService],
    exports: [ReservasService],
})
export class ReservasModule { }
