import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock PrismaService ───────────────────────────────────────────────────────

const mockPrisma = {
  service: { findFirst: jest.fn() },
  availability: { findUnique: jest.fn() },
  booking: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const MOCK_SERVICE = {
  id: 'service-uuid-1',
  ownerId: 'owner-uuid-1',
  name: 'Haircut',
  durationMin: 60,
  price: 25.0,
  isActive: true,
};

const MOCK_AVAILABILITY = {
  ownerId: 'owner-uuid-1',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '17:00',
};

// June 29, 2026 is a Monday — a valid future date
const FUTURE_MONDAY = '2026-06-29';
const CUSTOMER_ID = 'customer-uuid-1';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  // ─── Test 1: createBooking — happy path ───────────────────────────────────

  describe('createBooking', () => {
    it('should create a booking successfully when the slot is available', async () => {
      const expectedBooking = {
        id: 'booking-uuid-1',
        serviceId: MOCK_SERVICE.id,
        customerId: CUSTOMER_ID,
        date: new Date(FUTURE_MONDAY + 'T00:00:00.000Z'),
        startTime: '09:00',
        endTime: '10:00',
        status: BookingStatus.CONFIRMED,
        service: { name: 'Haircut', durationMin: 60, price: 25.0 },
        customer: { name: 'Alice', email: 'alice@example.com' },
      };

      mockPrisma.service.findFirst.mockResolvedValue(MOCK_SERVICE);
      mockPrisma.availability.findUnique.mockResolvedValue(MOCK_AVAILABILITY);

      // Simulate $transaction executing the callback with no conflict found
      mockPrisma.$transaction.mockImplementation(
        (callback: (tx: any) => Promise<unknown>) => {
          const txMock = {
            booking: {
              findFirst: jest.fn().mockResolvedValue(null), // no existing booking
              create: jest.fn().mockResolvedValue(expectedBooking),
            },
          };
          return callback(txMock);
        },
      );

      const result = await service.createBooking(CUSTOMER_ID, {
        serviceId: MOCK_SERVICE.id,
        date: FUTURE_MONDAY,
        startTime: '09:00',
      });

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('10:00');
    });

    // ─── Test 2: createBooking — double booking ───────────────────────────

    it('should throw ConflictException when the slot is already booked', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(MOCK_SERVICE);
      mockPrisma.availability.findUnique.mockResolvedValue(MOCK_AVAILABILITY);

      // Simulate $transaction finding an existing CONFIRMED booking for that slot
      mockPrisma.$transaction.mockImplementation(
        (callback: (tx: any) => Promise<unknown>) => {
          const txMock = {
            booking: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'existing-booking-id',
                status: BookingStatus.CONFIRMED,
              }),
            },
          };
          return callback(txMock);
        },
      );

      await expect(
        service.createBooking(CUSTOMER_ID, {
          serviceId: MOCK_SERVICE.id,
          date: FUTURE_MONDAY,
          startTime: '09:00',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Test 3: cancelBooking — customer tries to cancel another's booking ───

  describe('cancelBooking', () => {
    it('should throw ForbiddenException when customer tries to cancel someone elses booking', async () => {
      const ANOTHER_CUSTOMER_ID = 'another-customer-uuid';

      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-uuid-1',
        customerId: ANOTHER_CUSTOMER_ID, // booking belongs to a DIFFERENT customer
        status: BookingStatus.CONFIRMED,
        date: new Date(FUTURE_MONDAY + 'T00:00:00.000Z'),
      });

      await expect(
        service.cancelBooking(CUSTOMER_ID, 'booking-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
