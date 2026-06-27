import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: PrismaService;

  const mockPrisma = {
    service: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      count: jest.fn(),
    },
  };

  const OWNER_ID = 'owner-123';
  const SERVICE_ID = 'service-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new service', async () => {
      const createDto = { name: 'Haircut', durationMin: 60, price: 30 };
      mockPrisma.service.create.mockResolvedValue({ id: SERVICE_ID, ...createDto });

      const result = await service.create(OWNER_ID, createDto);

      expect(mockPrisma.service.create).toHaveBeenCalledWith({
        data: { ...createDto, ownerId: OWNER_ID },
      });
      expect(result).toHaveProperty('id', SERVICE_ID);
    });
  });

  describe('findAllByOwner', () => {
    it('should return all non-deleted services for an owner', async () => {
      mockPrisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);

      const result = await service.findAllByOwner(OWNER_ID);

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { ownerId: OWNER_ID },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update a service successfully', async () => {
      const updateDto = { price: 40 };
      mockPrisma.service.findFirst.mockResolvedValue({ id: SERVICE_ID, ownerId: OWNER_ID });
      mockPrisma.service.update.mockResolvedValue({ id: SERVICE_ID, ...updateDto });

      const result = await service.update(OWNER_ID, SERVICE_ID, updateDto);

      expect(mockPrisma.service.update).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
        data: updateDto,
      });
      expect(result.price).toBe(40);
    });

    it('should throw NotFoundException if service does not exist or does not belong to owner', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);

      await expect(service.update(OWNER_ID, SERVICE_ID, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete service if there are no upcoming confirmed bookings', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({ id: SERVICE_ID, ownerId: OWNER_ID });
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.service.update.mockResolvedValue({ id: SERVICE_ID, isDeleted: true });

      const result = await service.remove(OWNER_ID, SERVICE_ID);

      expect(mockPrisma.service.update).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
        data: { isActive: false },
      });
      expect(result).toEqual({ id: SERVICE_ID, isDeleted: true });
    });

    it('should throw BadRequestException if there are upcoming bookings', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({ id: SERVICE_ID, ownerId: OWNER_ID });
      mockPrisma.booking.count.mockResolvedValue(2);

      await expect(service.remove(OWNER_ID, SERVICE_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
