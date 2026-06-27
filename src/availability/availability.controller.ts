import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { UpsertAvailabilityDto } from './dto/upsert-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // Public: anyone can view a business's availability
  @Get('public/:ownerId')
  getPublic(@Param('ownerId', ParseUUIDPipe) ownerId: string) {
    return this.availabilityService.getPublicAvailability(ownerId);
  }

  // Owner: view own availability schedule
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  getMyAvailability(@CurrentUser() user: CurrentUserPayload) {
    return this.availabilityService.getOwnerAvailability(user.userId);
  }

  // Owner: set/update availability for a specific day
  // :day param must be MONDAY, TUESDAY, etc. (case-insensitive)
  @Put(':day')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  upsert(
    @CurrentUser() user: CurrentUserPayload,
    @Param('day') day: string,
    @Body() dto: UpsertAvailabilityDto,
  ) {
    return this.availabilityService.upsert(user.userId, day, dto);
  }

  // Owner: remove availability for a specific day
  @Delete(':day')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('day') day: string) {
    return this.availabilityService.remove(user.userId, day);
  }
}
