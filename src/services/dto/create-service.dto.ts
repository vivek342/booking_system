import { IsString, IsOptional, IsInt, Min, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt({ message: 'durationMin must be a whole number (minutes)' })
  @Min(5, { message: 'Minimum service duration is 5 minutes' })
  @Type(() => Number)
  durationMin!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Price cannot be negative' })
  @Type(() => Number)
  price!: number;
}
