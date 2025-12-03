import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EquiposModule } from './equipos/equipos.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AulasModule } from './aulas/aulas.module';
import { ReservasModule } from './reservas/reservas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [EquiposModule, AulasModule, ReservasModule, UsuariosModule, AuthModule, MongooseModule.forRoot('mongodb+srv://reservas_db:sistema_ana_paty@sistemareservas.ovhqk5w.mongodb.net/')],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
