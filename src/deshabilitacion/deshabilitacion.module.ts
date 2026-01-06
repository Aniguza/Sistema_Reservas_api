import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeshabilitacionService } from './deshabilitacion.service';
import { TiemposController } from './tiempos.controller';
import { ManualController } from './manual.controller';
import { GeneralController } from './general.controller';
import { TiempoDeshabilitacionSchema } from './schemas/tiempos.schema';
import { DeshabilitacionManualSchema } from './schemas/deshabilitacion_manual.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'TiempoDeshabilitacion', schema: TiempoDeshabilitacionSchema },
      { name: 'DeshabilitacionManual', schema: DeshabilitacionManualSchema },
    ]),
  ],
  controllers: [TiemposController, ManualController, GeneralController],
  providers: [DeshabilitacionService],
  exports: [DeshabilitacionService],
})
export class DeshabilitacionModule {}
