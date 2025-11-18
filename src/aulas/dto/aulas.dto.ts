export class CreateAulasDTO {
    readonly name: string;
    readonly codigo: string;
    readonly description: string;
    readonly imageUrl: string;
    readonly createdAt: Date;
    readonly equipos: string[];
}