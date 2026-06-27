import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DayOfWeek, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAvailabilityDto } from './dto/upsert-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseDayOfWeek(day: string): DayOfWeek {
    const upper = day.toUpperCase();
    if (!Object.values(DayOfWeek).includes(upper as DayOfWeek)) {
      throw new BadRequestException(
        `Invalid day "${day}". Must be one of: ${Object.values(DayOfWeek).join(', ')}`,
      );
    }
    return upper as DayOfWeek;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  // Maps Prisma DayOfWeek enum to JavaScript Date.getDay() index (0 = Sunday)
  private dayOfWeekToJsIndex(day: DayOfWeek): number {
    const map: Record<DayOfWeek, number> = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    };
    return map[day];
  }

  // ─── Owner actions ────────────────────────────────────────────────────────

  async upsert(ownerId: string, day: string, dto: UpsertAvailabilityDto) {
    const dayOfWeek = this.parseDayOfWeek(day);

    if (this.timeToMinutes(dto.startTime) >= this.timeToMinutes(dto.endTime)) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    return this.prisma.availability.upsert({
      where: { ownerId_dayOfWeek: { ownerId, dayOfWeek } },
      update: { startTime: dto.startTime, endTime: dto.endTime },
      create: {
        ownerId,
        dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
  }

  async getOwnerAvailability(ownerId: string) {
    return this.prisma.availability.findMany({
      where: { ownerId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async remove(ownerId: string, day: string) {
    const dayOfWeek = this.parseDayOfWeek(day);

    const record = await this.prisma.availability.findUnique({
      where: { ownerId_dayOfWeek: { ownerId, dayOfWeek } },
    });
    if (!record)
      throw new NotFoundException(`No availability set for ${dayOfWeek}`);

    // Block removal if upcoming bookings exist on this day of week for owner's services
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const ownerServices = await this.prisma.service.findMany({
      where: { ownerId, isActive: true },
      select: { id: true },
    });
    const serviceIds = ownerServices.map((s) => s.id);

    const upcomingBookings = await this.prisma.booking.findMany({
      where: {
        serviceId: { in: serviceIds },
        status: BookingStatus.CONFIRMED,
        date: { gte: now },
      },
      select: { date: true },
    });

    const jsIndex = this.dayOfWeekToJsIndex(dayOfWeek);
    const conflicts = upcomingBookings.filter(
      (b) => new Date(b.date).getDay() === jsIndex,
    );

    if (conflicts.length > 0) {
      throw new BadRequestException(
        `Cannot remove ${dayOfWeek} availability: ${conflicts.length} upcoming confirmed booking(s) on this day.`,
      );
    }

    return this.prisma.availability.delete({
      where: { ownerId_dayOfWeek: { ownerId, dayOfWeek } },
    });
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  async getPublicAvailability(ownerId: string) {
    return this.prisma.availability.findMany({
      where: { ownerId },
      select: { dayOfWeek: true, startTime: true, endTime: true },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
