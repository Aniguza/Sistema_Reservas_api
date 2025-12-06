export class CreateEquipoDTO {
    readonly name: string;
    readonly description: string;
    readonly especifications: string;
    readonly quantity: number;
    readonly imageUrl: string;
    readonly createdAt: Date;
    readonly category: string;
    readonly disponibilidad: 'disponible' | 'no disponible' | 'ocupado' | 'en mantenimiento';
}