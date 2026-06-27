import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { OwnersService } from './owners.service';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('owners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.ownersService.getProfile(user.userId);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateOwnerDto,
  ) {
    return this.ownersService.updateProfile(user.userId, dto);
  }
}
