import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({ 
    origin: ['http://localhost:5173', 'http://localhost:5174'] 
  });
  await app.listen(process.env.PORT ?? 3000);

  console.log('🚀 Servidor iniciado en http://localhost:3000');
  console.log('📋 Endpoints disponibles:');
  console.log('  - POST /usuarios - Crear usuario');
  console.log('  - GET /usuarios - Listar usuarios');
  console.log('  - POST /auth/login - Login usuarios');
  console.log('  - POST /auth/admin/login - Login administrador');
  console.log('  - GET /auth/profile - Perfil (requiere token)');
}
bootstrap();
