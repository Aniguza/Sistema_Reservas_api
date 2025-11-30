import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: 'SECRET_KEY_CHANGE_THIS', // TODO: Mover a variables de entorno
        });
    }

    async validate(payload: any) {
        return {
            userId: payload.sub,
            correo: payload.correo,
            rol: payload.rol,
        };
    }
}
