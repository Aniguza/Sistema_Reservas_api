import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'correo',
            passwordField: 'contraseña',
        });
    }

    async validate(correo: string, contraseña: string): Promise<any> {
        const usuario = await this.authService.validateUser(correo, contraseña);

        if (!usuario) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        return usuario;
    }
}
