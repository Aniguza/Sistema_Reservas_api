import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from '../usuarios/dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly usuariosService: UsuariosService,
        private readonly jwtService: JwtService,
    ) { }

    // Validar usuario
    async validateUser(correo: string, contraseña: string): Promise<any> {
        const usuario = await this.usuariosService.validateUser(correo, contraseña);

        if (!usuario) {
            return null;
        }

        // Retornar usuario sin contraseña
        const { contraseña: _, ...result } = usuario.toObject();
        return result;
    }

    // Login general (docentes y alumnos)
    async login(loginDto: LoginDto) {
        const usuario = await this.validateUser(loginDto.correo, loginDto.contraseña);

        if (!usuario) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const payload = {
            correo: usuario.correo,
            sub: usuario._id,
            rol: usuario.rol,
        };

        return {
            access_token: this.jwtService.sign(payload),
            usuario: {
                id: usuario._id,
                correo: usuario.correo,
                nombre: usuario.nombre,
                carrera: usuario.carrera,
                rol: usuario.rol,
            },
        };
    }

    // Login específico para administradores y asistentes
    async adminLogin(loginDto: LoginDto) {
        const usuario = await this.validateUser(loginDto.correo, loginDto.contraseña);

        if (!usuario) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        // Verificar que sea administrador o asistente
        if (usuario.rol !== 'administrador' && usuario.rol !== 'asistente') {
            throw new UnauthorizedException('Acceso denegado. Solo administradores y asistentes.');
        }

        const payload = {
            correo: usuario.correo,
            sub: usuario._id,
            rol: usuario.rol,
        };

        return {
            access_token: this.jwtService.sign(payload),
            usuario: {
                id: usuario._id,
                correo: usuario.correo,
                nombre: usuario.nombre,
                carrera: usuario.carrera,
                rol: usuario.rol,
            },
        };
    }

    // Verificar token
    async verifyToken(token: string) {
        try {
            return this.jwtService.verify(token);
        } catch (error) {
            throw new UnauthorizedException('Token inválido');
        }
    }
}
