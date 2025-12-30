import {
    Controller, Get, Post, Put, Delete, Res, HttpStatus, Body, Param, UseGuards
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-objectid.pipe';

@Controller('usuarios')
export class UsuariosController {
    constructor(private readonly usuariosService: UsuariosService) { }

    // Crear usuario (SOLO ADMIN)
    @Post('/create')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
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

    // Obtener todos los usuarios (TODOS los roles autenticados)
    // Docentes y alumnos lo necesitan para agregar compañeros en reservas
    @Get('/')
    @UseGuards(JwtAuthGuard)
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

    // Obtener perfil de usuario por correo (TODOS los roles autenticados)
    @Get('/perfil/:correo')
    @UseGuards(JwtAuthGuard)
    async getPerfilByCorreo(@Res() response, @Param('correo') correo: string) {
        try {
            const perfil = await this.usuariosService.getPerfilByCorreo(correo);
            return response.status(HttpStatus.OK).json(perfil);
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                message: 'Error al obtener el perfil',
                error: error.message,
            });
        }
    }

    // Obtener usuario por ID (TODOS los roles autenticados)
    @Get('/id/:id')
    @UseGuards(JwtAuthGuard)
    async getUsuarioById(
        @Res() response,
        @Param('id', ParseObjectIdPipe) id: string,
    ) {
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

    // Actualizar usuario (SOLO ADMIN)
    @Put('update/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async update(
        @Res() response,
        @Param('id', ParseObjectIdPipe) id: string,
        @Body() updateUsuarioDto: UpdateUsuarioDto,
    ) {
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

    // Eliminar usuario (SOLO ADMIN)
    @Delete('/delete/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('administrador')
    async remove(@Res() response, @Param('id', ParseObjectIdPipe) id: string) {
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
