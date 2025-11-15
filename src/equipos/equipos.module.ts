import { Module } from '@nestjs/common';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { MongooseModule } from '@nestjs/mongoose';
import { equiposSchema } from './schemas/equipos.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Equipo', schema: equiposSchema }]
    )],
  controllers: [EquiposController],
  providers: [EquiposService]
})
export class EquiposModule { }
