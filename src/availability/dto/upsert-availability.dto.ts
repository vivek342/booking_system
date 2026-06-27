import { IsString, Matches } from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UpsertAvailabilityDto {
  @IsString()
  @Matches(HH_MM, { message: 'startTime must be in HH:mm format (e.g. 09:00)' })
  startTime!: string;

  @IsString()
  @Matches(HH_MM, { message: 'endTime must be in HH:mm format (e.g. 17:00)' })
  endTime!: string;
}
