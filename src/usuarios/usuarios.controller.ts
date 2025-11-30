import {
    Controller, Get, Post, Put, Delete, Res, HttpStatus, Body, Param
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Controller('usuarios')
export class UsuariosController {
    constructor(private readonly usuariosService: UsuariosService) { }

    // Crear usuario (registro público)
    @Post('/create')
    async createUsuario(@Res() response, @Body() createUsuarioDto: CreateUsuarioDto) {
        try {
            const usuario = await this.usuariosService.createUsuario(createUsuarioDto);
            return response.status(HttpStatus.OK).json({
                message: 'Usuario creado exitosamente',
                usuario,
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error al crear el usuario',
                error: error.message,
            });
        }
    }

    // Obtener todos los usuarios
    // Nota: Docentes y alumnos pueden ver usuarios para agregarlos en reservas
    // Solo admin puede crear/editar/eliminar usuarios
    @Get('/')
    async getAllUsuarios(@Res() response) {
        try {
            const usuarios = await this.usuariosService.getAllUsuarios();
            return response.status(HttpStatus.OK).json(usuarios);
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error al obtener los usuarios',
                error: error.message,
            });
        }
    }

    // Obtener usuario por ID
    @Get('/:id')
    async getUsuarioById(@Res() response, @Param('id') id: string) {
        try {
            const usuario = await this.usuariosService.getUsuarioById(id);
            return response.status(HttpStatus.OK).json(usuario);
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error al obtener el usuario',
                error: error.message,
            });
        }
    }

    // Actualizar usuario
    @Put('update/:id')
    async update(@Res() response, @Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
        try {
            const usuario = await this.usuariosService.updateUsuario(id, updateUsuarioDto);
            return response.status(HttpStatus.OK).json(usuario);
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error al actualizar el usuario',
                error: error.message,
            });
        }
    }

    // Eliminar usuario
    @Delete('/delete/:id')
    async remove(@Res() response, @Param('id') id: string) {
        try {
            const usuario = await this.usuariosService.remove(id);
            return response.status(HttpStatus.OK).json({
                message: 'Usuario eliminado exitosamente',
                usuario,
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error al eliminar el usuario',
                error: error.message,
            });
        }
    }
}
