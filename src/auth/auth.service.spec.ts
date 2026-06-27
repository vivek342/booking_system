import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    businessOwner: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Owner Auth', () => {
    const registerDto = {
      email: 'owner@example.com',
      password: 'password123',
      name: 'Owner',
      businessName: 'Business',
      phone: '1234567890',
    };

    it('should register an owner successfully', async () => {
      mockPrisma.businessOwner.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrisma.businessOwner.create.mockResolvedValue({
        id: 'owner-id',
        email: registerDto.email,
        name: registerDto.name,
      });

      const result = await service.registerOwner(registerDto);

      expect(mockPrisma.businessOwner.findUnique).toHaveBeenCalledWith({ where: { email: registerDto.email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockPrisma.businessOwner.create).toHaveBeenCalled();
      expect(result).toEqual({ 
        token: 'mock-jwt-token',
        owner: { id: 'owner-id', email: 'owner@example.com', name: 'Owner' }
      });
    });

    it('should throw ConflictException if owner email exists', async () => {
      mockPrisma.businessOwner.findUnique.mockResolvedValue({ id: 'owner-id' });

      await expect(service.registerOwner(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should login an owner successfully', async () => {
      mockPrisma.businessOwner.findUnique.mockResolvedValue({
        id: 'owner-id',
        email: 'owner@example.com',
        password: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.loginOwner({ email: 'owner@example.com', password: 'password123' });

      expect(result).toEqual({
        token: 'mock-jwt-token',
        owner: expect.objectContaining({ id: 'owner-id', email: 'owner@example.com' }),
      });
    });

    it('should throw UnauthorizedException for invalid owner password', async () => {
      mockPrisma.businessOwner.findUnique.mockResolvedValue({
        id: 'owner-id',
        password: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.loginOwner({ email: 'owner@example.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Customer Auth', () => {
    const registerDto = {
      email: 'customer@example.com',
      password: 'password123',
      name: 'Customer',
      phone: '0987654321',
    };

    it('should register a customer successfully', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrisma.customer.create.mockResolvedValue({ id: 'customer-id', email: registerDto.email });

      const result = await service.registerCustomer(registerDto);

      expect(result).toEqual({ 
        token: 'mock-jwt-token',
        customer: { id: 'customer-id', email: 'customer@example.com' }
      });
    });

    it('should throw ConflictException if customer email exists', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({ id: 'customer-id' });

      await expect(service.registerCustomer(registerDto)).rejects.toThrow(ConflictException);
    });
  });
});
