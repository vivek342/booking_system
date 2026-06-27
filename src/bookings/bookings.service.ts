import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, BookingStatus, DayOfWeek } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

// ─── Pure helper functions ────────────────────────────────────────────────────
// These are plain functions, not class methods — easy to unit-test in isolation.

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function generateSlots(
  startTime: string,
  endTime: string,
  durationMin: number,
): Array<{ startTime: string; endTime: string }> {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots: Array<{ startTime: string; endTime: string }> = [];
  let current = start;
  while (current + durationMin <= end) {
    slots.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + durationMin),
    });
    current += durationMin;
  }
  return slots;
}

export function jsIndexToDayOfWeek(index: number): string {
  const days = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  return days[index] ?? 'SUNDAY';
}

export function parseDateUtcMidnight(dateStr: string): Date {
  // Parse "YYYY-MM-DD" as UTC midnight to avoid timezone shift issues
  return new Date(dateStr + 'T00:00:00.000Z');
}

// ─── BookingsService ──────────────────────────────────────────────────────────

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Get Available Slots (public, no auth required) ──────────────────────

  async getAvailableSlots(serviceId: string, dateStr: string) {
    if (!serviceId)
      throw new BadRequestException('serviceId query parameter is required');
    if (!dateStr)
      throw new BadRequestException('date query parameter is required');

    const dateObj = parseDateUtcMidnight(dateStr);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date. Use YYYY-MM-DD format');
    }

    // Reject past dates
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (dateObj < today) {
      throw new BadRequestException('Cannot query slots for past dates');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
    });
    if (!service)
      throw new NotFoundException('Service not found or is no longer active');

    const dayOfWeek = jsIndexToDayOfWeek(dateObj.getUTCDay());

    const availability = await this.prisma.availability.findUnique({
      where: {
        ownerId_dayOfWeek: {
          ownerId: service.ownerId,
          dayOfWeek: dayOfWeek as DayOfWeek,
        },
      },
    });

    if (!availability) {
      return {
        date: dateStr,
        dayOfWeek,
        slots: [],
        message: 'Business is not available on this day',
      };
    }

    const allSlots = generateSlots(
      availability.startTime,
      availability.endTime,
      service.durationMin,
    );

    // Find all non-cancelled bookings to exclude
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        serviceId,
        date: dateObj,
        status: { notIn: [BookingStatus.CANCELLED] },
      },
      select: { startTime: true },
    });

    const bookedTimes = new Set(existingBookings.map((b) => b.startTime));
    const availableSlots = allSlots.filter(
      (s) => !bookedTimes.has(s.startTime),
    );

    return { date: dateStr, dayOfWeek, slots: availableSlots };
  }

  // ── 2. Create Booking ───────────────────────────────────────────────────────

  async createBooking(customerId: string, dto: CreateBookingDto) {
    const { serviceId, date: dateStr, startTime, notes } = dto;

    // Reject past dates
    const dateObj = parseDateUtcMidnight(dateStr);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (dateObj < today) {
      throw new BadRequestException('Cannot book a slot in the past');
    }

    // Validate service exists and is active
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
    });
    if (!service)
      throw new NotFoundException('Service not found or is no longer active');

    // Validate that the business is open on this day
    const dayOfWeek = jsIndexToDayOfWeek(dateObj.getUTCDay());
    const availability = await this.prisma.availability.findUnique({
      where: {
        ownerId_dayOfWeek: {
          ownerId: service.ownerId,
          dayOfWeek: dayOfWeek as DayOfWeek,
        },
      },
    });
    if (!availability) {
      throw new BadRequestException(
        `This business is not available on ${dayOfWeek}`,
      );
    }

    // Validate startTime falls within business hours
    const startMins = timeToMinutes(startTime);
    const endMins = startMins + service.durationMin;
    const availStartMins = timeToMinutes(availability.startTime);
    const availEndMins = timeToMinutes(availability.endTime);

    if (startMins < availStartMins || endMins > availEndMins) {
      throw new BadRequestException(
        `Slot ${startTime} is outside business hours (${availability.startTime}–${availability.endTime})`,
      );
    }

    // Validate startTime aligns with a slot boundary
    // e.g. if slots are every 60 min from 09:00, valid starts: 09:00, 10:00, 11:00...
    if ((startMins - availStartMins) % service.durationMin !== 0) {
      throw new BadRequestException(
        `${startTime} is not a valid slot boundary. Slots start every ${service.durationMin} minute(s) from ${availability.startTime}`,
      );
    }

    const endTime = minutesToTime(endMins);

    // Serializable transaction prevents double-booking under concurrent load
    const booking = await this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            serviceId,
            date: dateObj,
            startTime,
            status: { notIn: [BookingStatus.CANCELLED] },
          },
        });
        if (conflict) {
          throw new ConflictException(
            'This slot was just booked by another customer. Please choose another slot.',
          );
        }

        return tx.booking.create({
          data: {
            serviceId,
            customerId,
            date: dateObj,
            startTime,
            endTime,
            notes,
          },
          include: {
            service: { select: { name: true, durationMin: true, price: true } },
            customer: { select: { name: true, email: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return booking;
  }

  // ── 3. Customer: Get Own Bookings ───────────────────────────────────────────

  async getCustomerBookings(customerId: string) {
    return this.prisma.booking.findMany({
      where: { customerId },
      include: {
        service: {
          select: {
            name: true,
            durationMin: true,
            price: true,
            owner: { select: { businessName: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });
  }

  // ── 4. Customer: Cancel Booking ─────────────────────────────────────────────

  async cancelBooking(customerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Only the customer who owns the booking can cancel it
    if (booking.customerId !== customerId) {
      throw new ForbiddenException(
        'You are not authorised to cancel this booking',
      );
    }

    // Only CONFIRMED bookings can be cancelled
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}". Only CONFIRMED bookings can be cancelled.`,
      );
    }

    // Cannot cancel a past booking
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (new Date(booking.date) < today) {
      throw new BadRequestException(
        'Cannot cancel a booking that has already passed',
      );
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  // ── 5. Owner: View All Bookings for Their Services ──────────────────────────

  async getOwnerBookings(ownerId: string, status?: BookingStatus) {
    return this.prisma.booking.findMany({
      where: {
        service: { ownerId },
        ...(status ? { status } : {}),
      },
      include: {
        service: { select: { name: true, durationMin: true, price: true } },
        customer: { select: { name: true, email: true, phone: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ── 6. Owner: Mark Booking COMPLETED or NO_SHOW ─────────────────────────────

  async updateBookingStatus(
    ownerId: string,
    bookingId: string,
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: { select: { ownerId: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Enforce ownership: booking must belong to one of this owner's services
    if (booking.service.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You can only update bookings for your own services',
      );
    }

    // Only CONFIRMED bookings can be updated to COMPLETED or NO_SHOW
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot update a booking that is already "${booking.status}"`,
      );
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: dto.status },
    });
  }
}
