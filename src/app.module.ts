import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EquiposModule } from './equipos/equipos.module';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [EquiposModule, MongooseModule.forRoot('mongodb://localhost/sistema-reservas')],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
