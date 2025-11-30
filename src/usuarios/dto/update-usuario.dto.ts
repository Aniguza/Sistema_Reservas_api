import { PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuario.dto';
import { IsOptional } from 'class-validator';

export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {
    @IsOptional()
    correo?: string;

    @IsOptional()
    nombre?: string;

    @IsOptional()
    carrera?: string;

    @IsOptional()
    rol?: 'docente' | 'alumno' | 'administrador';

    @IsOptional()
    contraseña?: string;
}
