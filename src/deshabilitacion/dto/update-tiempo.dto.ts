import { PartialType } from '@nestjs/mapped-types';
import { CreateTiempoDto } from './create-tiempo.dto';

export class UpdateTiempoDto extends PartialType(CreateTiempoDto) {}
