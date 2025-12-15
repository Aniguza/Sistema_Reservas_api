import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
    imports: [
        ConfigModule,
        UsuariosModule,
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => {
                const secret = configService.getOrThrow<string>('JWT_SECRET');
                const expiresIn = configService.get<string>('JWT_EXPIRES_IN');

                return {
                    secret,
                    signOptions: {
                        expiresIn: (expiresIn ?? '24h') as JwtSignOptions['expiresIn'],
                    },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, LocalStrategy],
    exports: [AuthService],
})
export class AuthModule { }
