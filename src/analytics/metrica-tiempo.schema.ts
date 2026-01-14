import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MetricaTiempoDocument = MetricaTiempo & Document & {
  createdAt?: Date;
  updatedAt?: Date;
};

@Schema({ timestamps: true })
export class MetricaTiempo {
  @Prop({ required: true })
  tipo: string;

  @Prop({ required: true })
  duracion_segundos: number;

  @Prop()
  fecha_registro?: string;

  @Prop({ default: 'anonimo' })
  usuario?: string;

  @Prop()
  timestamp?: string;
}

export const MetricaTiempoSchema = SchemaFactory.createForClass(MetricaTiempo);