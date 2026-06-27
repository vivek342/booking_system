import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterOwnerDto } from './dto/register-owner.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('owner/register')
  registerOwner(@Body() dto: RegisterOwnerDto) {
    return this.authService.registerOwner(dto);
  }

  @Post('owner/login')
  @HttpCode(HttpStatus.OK)
  loginOwner(@Body() dto: LoginDto) {
    return this.authService.loginOwner(dto);
  }

  @Post('customer/register')
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Post('customer/login')
  @HttpCode(HttpStatus.OK)
  loginCustomer(@Body() dto: LoginDto) {
    return this.authService.loginCustomer(dto);
  }
}
