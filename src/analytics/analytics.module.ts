import { Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MetricaTiempo, MetricaTiempoSchema } from './metrica-tiempo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MetricaTiempo.name, schema: MetricaTiempoSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {
  private readonly logger = new Logger(AnalyticsModule.name);

  constructor() {
    this.logger.log('AnalyticsModule loaded successfully');
  }
}