import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OwnersService } from './owners.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OwnersService', () => {
  let service: OwnersService;
  let prisma: PrismaService;

  const mockPrisma = {
    businessOwner: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OwnersService>(OwnersService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return an owner without the password field', async () => {
      mockPrisma.businessOwner.findUnique.mockResolvedValue({
        id: 'owner-id',
        email: 'test@example.com',
        businessName: 'My Salon',
      });

      const result = await service.getProfile('owner-id');

      expect(mockPrisma.businessOwner.findUnique).toHaveBeenCalledWith({
        where: { id: 'owner-id' },
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(expect.objectContaining({ id: 'owner-id' }));
    });

    it('should throw NotFoundException if owner is not found', async () => {
      mockPrisma.businessOwner.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return the owner', async () => {
      const updateDto = { businessName: 'New Salon Name' };
      mockPrisma.businessOwner.update.mockResolvedValue({
        id: 'owner-id',
        businessName: 'New Salon Name',
      });

      const result = await service.updateProfile('owner-id', updateDto);

      expect(mockPrisma.businessOwner.update).toHaveBeenCalledWith({
        where: { id: 'owner-id' },
        data: updateDto,
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(expect.objectContaining({ businessName: 'New Salon Name' }));
    });
  });
});
