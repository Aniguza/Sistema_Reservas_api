import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario } from './interfaces/usuarios.interface';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
    constructor(
        @InjectModel('Usuario') private readonly usuarioModel: Model<Usuario>,
    ) { }

    // Crear nuevo usuario
    async createUsuario(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
        try {
            const usuarioExistente = await this.usuarioModel.findOne({
                correo: createUsuarioDto.correo,
            });

            if (usuarioExistente) {
                throw new HttpException(
                    'El correo ya está registrado',
                    HttpStatus.CONFLICT,
                );
            }

            const nuevoUsuario = new this.usuarioModel(createUsuarioDto);
            return await nuevoUsuario.save();
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Error al crear el usuario',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // Obtener todos los usuarios (sin contraseñas)
    async getAllUsuarios(): Promise<Usuario[]> {
        return await this.usuarioModel
            .find()
            .select('-contraseña')
            .exec();
    }

    // Buscar usuario por ID
    async getUsuarioById(id: string): Promise<Usuario> {
        const usuario = await this.usuarioModel
            .findById(id)
            .select('-contraseña')
            .exec();

        if (!usuario) {
            throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
        }

        return usuario;
    }

    // Buscar usuario por correo (para autenticación)
    async getUsuarioByEmail(correo: string): Promise<Usuario | null> {
        const usuario = await this.usuarioModel.findOne({ correo: correo }).exec();
        if (!usuario) {
            return null; // Retornar null si no existe para que validateUser lo maneje
        }
        return usuario;
    }

    // Actualizar usuario   
    async updateUsuario(id: string, updateUsuarioDto: UpdateUsuarioDto): Promise<Usuario> {
        // Si se está actualizando el correo, verificar que no exista
        if (updateUsuarioDto.correo) {
            const usuarioExistente = await this.usuarioModel.findOne({
                correo: updateUsuarioDto.correo,
                _id: { $ne: id },
            });

            if (usuarioExistente) {
                throw new HttpException(
                    'El correo ya está registrado',
                    HttpStatus.CONFLICT,
                );
            }
        }

        const usuario = await this.usuarioModel.findByIdAndUpdate(
            id,
            updateUsuarioDto,
            { new: true },
        ).select('-contraseña');

        if (!usuario) {
            throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
        }

        return usuario;
    }

    // Eliminar usuario
    async remove(id: string): Promise<Usuario> {
        const usuario = await this.usuarioModel
            .findByIdAndDelete(id)
            .select('-contraseña');

        if (!usuario) {
            throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
        }

        return usuario;
    }

    // Validar credenciales de usuario
    async validateUser(correo: string, contraseña: string): Promise<Usuario | null> {
        const usuario = await this.getUsuarioByEmail(correo);

        if (!usuario) {
            return null;
        }

        const isPasswordValid = await (usuario as any).comparePassword(contraseña);

        if (!isPasswordValid) {
            return null;
        }

        return usuario;
    }
}
