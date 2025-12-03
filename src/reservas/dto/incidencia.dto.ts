export class CreateIncidenciaDto {
    readonly descripcion: string;
    readonly tipo: 'tecnica' | 'administrativa' | 'limpieza' | 'otra';
    readonly prioridad: 'baja' | 'media' | 'alta' | 'critica';
}

export class UpdateIncidenciaDto {
    readonly descripcion?: string;
    readonly tipo?: 'tecnica' | 'administrativa' | 'limpieza' | 'otra';
    readonly prioridad?: 'baja' | 'media' | 'alta' | 'critica';
    readonly estado?: 'reportada' | 'en_revision' | 'en_proceso' | 'resuelta' | 'cerrada';
    readonly resolucion?: string;
}
