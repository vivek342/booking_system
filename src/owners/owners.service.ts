import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOwnerDto } from './dto/update-owner.dto';

const OWNER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  businessName: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(ownerId: string) {
    const owner = await this.prisma.businessOwner.findUnique({
      where: { id: ownerId },
      select: OWNER_PUBLIC_SELECT,
    });
    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }

  async updateProfile(ownerId: string, dto: UpdateOwnerDto) {
    return this.prisma.businessOwner.update({
      where: { id: ownerId },
      data: dto,
      select: OWNER_PUBLIC_SELECT,
    });
  }
}
