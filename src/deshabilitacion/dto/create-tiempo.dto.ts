import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class CreateTiempoDto {
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @IsDateString({}, { message: 'fechaInicio debe ser una fecha ISO válida' })
  fechaInicio: string;

  @IsDateString({}, { message: 'fechaFin debe ser una fecha ISO válida' })
  fechaFin: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
