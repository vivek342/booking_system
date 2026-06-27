import {
  IsUUID,
  IsDateString,
  IsString,
  Matches,
  IsOptional,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  serviceId!: string;

  // Must be "YYYY-MM-DD" format
  @IsDateString()
  date!: string;

  // Must be "HH:mm" format
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
