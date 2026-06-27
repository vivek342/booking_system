import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: PrismaService;

  const mockPrisma = {
    availability: {
      upsert: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    booking: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
  };

  const OWNER_ID = 'owner-123';
  const DAY = DayOfWeek.MONDAY;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsert', () => {
    it('should upsert availability successfully if valid times', async () => {
      const dto = { startTime: '09:00', endTime: '17:00' };
      mockPrisma.availability.upsert.mockResolvedValue({ id: 'avail-id', dayOfWeek: DAY, ...dto });

      const result = await service.upsert(OWNER_ID, DAY, dto);

      expect(mockPrisma.availability.upsert).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'avail-id');
    });

    it('should throw BadRequestException if startTime >= endTime', async () => {
      const dto = { startTime: '17:00', endTime: '09:00' };
      
      await expect(service.upsert(OWNER_ID, DAY, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete availability if no upcoming bookings exist for that day', async () => {
      mockPrisma.availability.findUnique.mockResolvedValue({ id: 'avail-id' });
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'service-1' }]);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.availability.delete.mockResolvedValue({ id: 'avail-id' });

      const result = await service.remove(OWNER_ID, DAY);

      expect(mockPrisma.availability.delete).toHaveBeenCalledWith({
        where: { ownerId_dayOfWeek: { ownerId: OWNER_ID, dayOfWeek: DAY } },
      });
      expect(result).toEqual({ id: 'avail-id' });
    });

    it('should throw BadRequestException if upcoming bookings exist', async () => {
      mockPrisma.availability.findUnique.mockResolvedValue({ id: 'avail-id' });
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'service-1' }]);
      
      // Simulate an upcoming booking on Monday
      const nextMonday = new Date();
      nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7)); // Get next monday
      mockPrisma.booking.findMany.mockResolvedValue([{ date: nextMonday }]);

      await expect(service.remove(OWNER_ID, DAY)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPublicAvailability', () => {
    it('should return availability in a mapped format', async () => {
      const expected = [{ dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '17:00' }];
      mockPrisma.availability.findMany.mockResolvedValue(expected);

      const result = await service.getPublicAvailability(OWNER_ID);

      expect(result).toEqual(expected);
    });
  });
});
