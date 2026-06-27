import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Owner actions ────────────────────────────────────────────────────────

  async create(ownerId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({ data: { ...dto, ownerId } });
  }

  async findAllByOwner(ownerId: string) {
    return this.prisma.service.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByOwner(ownerId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, ownerId },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async update(ownerId: string, serviceId: string, dto: UpdateServiceDto) {
    await this.findOneByOwner(ownerId, serviceId); // ensure ownership
    return this.prisma.service.update({ where: { id: serviceId }, data: dto });
  }

  async remove(ownerId: string, serviceId: string) {
    await this.findOneByOwner(ownerId, serviceId);

    // Block deletion if upcoming CONFIRMED bookings exist
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const activeCount = await this.prisma.booking.count({
      where: {
        serviceId,
        status: BookingStatus.CONFIRMED,
        date: { gte: now },
      },
    });
    if (activeCount > 0) {
      throw new BadRequestException(
        `Cannot delete service with ${activeCount} upcoming confirmed booking(s). Cancel them first.`,
      );
    }

    // Soft delete: mark inactive — keeps historical bookings intact
    return this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });
  }

  // ─── Public actions (no auth) ─────────────────────────────────────────────

  async findAllPublic(ownerId?: string) {
    return this.prisma.service.findMany({
      where: { isActive: true, ...(ownerId ? { ownerId } : {}) },
      include: {
        owner: { select: { id: true, businessName: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOnePublic(serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      include: {
        owner: { select: { id: true, businessName: true, name: true } },
      },
    });
    if (!service)
      throw new NotFoundException('Service not found or no longer available');
    return service;
  }
}
