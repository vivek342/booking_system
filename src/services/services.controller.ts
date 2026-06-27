import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ─── Public (unauthenticated) ─────────────────────────────────────────────

  @Get('public')
  findAllPublic(@Query('ownerId') ownerId?: string) {
    return this.servicesService.findAllPublic(ownerId);
  }

  @Get('public/:id')
  findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOnePublic(id);
  }

  // ─── Owner-only ───────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.servicesService.findAllByOwner(user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicesService.findOneByOwner(user.userId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicesService.remove(user.userId, id);
  }
}
