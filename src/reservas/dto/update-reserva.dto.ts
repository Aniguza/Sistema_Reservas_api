export class UpdateReservaDto {
    readonly nombre?: string;
    readonly correo?: string;
    readonly companeros?: string[];
    readonly tipo?: 'aula' | 'equipo';
    readonly aula?: string;
    readonly equipos?: string[];
    readonly fecha?: Date;
    readonly horaInicio?: string;
    readonly horaFin?: string;
    readonly motivo?: string;
    readonly estado?: 'pendiente' | 'confirmada' | 'en_curso' | 'cancelada' |  'cerrada' | 'cerrada_con_incidencia';
}
