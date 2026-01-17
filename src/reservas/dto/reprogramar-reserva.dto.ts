import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class ReprogramarReservaDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'La fecha debe estar en formato YYYY-MM-DD (ej: 2026-01-22)',
    })
    readonly fecha: string; // Formato: "YYYY-MM-DD" (string, no Date)

    @IsString()
    @IsNotEmpty()
    @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'La hora de inicio debe estar en formato HH:mm (ej: 12:00)',
    })
    readonly horaInicio: string; // Formato: "HH:mm"

    @IsString()
    @IsNotEmpty()
    @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'La hora de fin debe estar en formato HH:mm (ej: 14:00)',
    })
    readonly horaFin: string; // Formato: "HH:mm"

    @IsOptional()
    @IsString()
    readonly motivo?: string;
}
