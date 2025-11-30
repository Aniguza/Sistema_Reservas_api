import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'Debe proporcionar un correo válido' })
    @IsNotEmpty({ message: 'El correo es obligatorio' })
    correo: string;

    @IsString({ message: 'La contraseña debe ser un texto' })
    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    contraseña: string;
}
