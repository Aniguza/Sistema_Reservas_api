export class CreateReservaDto {
    readonly nombre: string;
    readonly correo: string;
    readonly companeros?: string[]; // Códigos universitarios de compañeros
    readonly tipo: 'aula' | 'equipo';
    readonly aula?: string; // ID del aula (solo si tipo es 'aula')
    readonly equipos?: string[]; // Array de IDs de equipos (solo si tipo es 'equipo')
    readonly fecha: Date;
    readonly horaInicio: string; // Formato: "HH:mm"
    readonly horaFin: string; // Formato: "HH:mm"
    readonly motivo: string;
}
