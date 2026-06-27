import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Public: anyone can check available slots before logging in
  @Get('slots')
  getAvailableSlots(
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    return this.bookingsService.getAvailableSlots(serviceId, date);
  }

  // Customer: book a slot
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  createBooking(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(user.userId, dto);
  }

  // Customer: view own bookings
  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  getMyBookings(@CurrentUser() user: CurrentUserPayload) {
    return this.bookingsService.getCustomerBookings(user.userId);
  }

  // Customer: cancel own booking
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  cancelBooking(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.cancelBooking(user.userId, id);
  }

  // Owner: view all bookings for their services (optional ?status= filter)
  @Get('owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  getOwnerBookings(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: BookingStatus,
  ) {
    return this.bookingsService.getOwnerBookings(user.userId, status);
  }

  // Owner: mark a booking as COMPLETED or NO_SHOW
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  updateBookingStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateBookingStatus(user.userId, id, dto);
  }
}
