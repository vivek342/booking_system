import { IsEnum } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingStatusDto {
  // Owner can only set COMPLETED or NO_SHOW — not CONFIRMED or CANCELLED
  @IsEnum(['COMPLETED', 'NO_SHOW'], {
    message: 'Status must be either COMPLETED or NO_SHOW',
  })
  status!: BookingStatus;
}
