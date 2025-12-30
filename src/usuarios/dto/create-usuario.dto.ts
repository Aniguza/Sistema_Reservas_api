import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, ValidateIf } from 'class-validator';

export class CreateUsuarioDto {
    @IsEmail({}, { message: 'Debe proporcionar un correo válido' })
    @IsNotEmpty({ message: 'El correo es obligatorio' })
    correo: string;

    @IsString({ message: 'El nombre debe ser un texto' })
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    nombre: string;

    @ValidateIf(({ rol }) => rol === 'alumno')
    @IsString({ message: 'La carrera debe ser un texto' })
    @IsNotEmpty({ message: 'La carrera es obligatoria para alumnos' })
    carrera?: string;

    @IsEnum(['docente', 'alumno', 'administrador'], {
        message: 'El rol debe ser: docente, alumno o administrador',
    })
    @IsNotEmpty({ message: 'El rol es obligatorio' })
    rol: 'docente' | 'alumno' | 'administrador';

    @IsString({ message: 'La contraseña debe ser un texto' })
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    contraseña: string;
}
