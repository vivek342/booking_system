import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterOwnerDto } from './dto/register-owner.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Business Owner Auth ──────────────────────────────────────────────────

  async registerOwner(dto: RegisterOwnerDto) {
    const exists = await this.prisma.businessOwner.findUnique({
      where: { email: dto.email },
    });
    if (exists)
      throw new ConflictException(
        'Email is already registered as a business owner',
      );

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const owner = await this.prisma.businessOwner.create({
      data: {
        email: dto.email,
        password: hashed,
        name: dto.name,
        businessName: dto.businessName,
        phone: dto.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        businessName: true,
        createdAt: true,
      },
    });

    return { token: this.signToken(owner.id, 'OWNER'), owner };
  }

  async loginOwner(dto: LoginDto) {
    const owner = await this.prisma.businessOwner.findUnique({
      where: { email: dto.email },
    });
    if (!owner) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, owner.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const safeOwner = { ...owner } as Partial<typeof owner>;
    delete safeOwner.password;
    return { token: this.signToken(owner.id, 'OWNER'), owner: safeOwner };
  }

  // ─── Customer Auth ────────────────────────────────────────────────────────

  async registerCustomer(dto: RegisterCustomerDto) {
    const exists = await this.prisma.customer.findUnique({
      where: { email: dto.email },
    });
    if (exists)
      throw new ConflictException('Email is already registered as a customer');

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const customer = await this.prisma.customer.create({
      data: {
        email: dto.email,
        password: hashed,
        name: dto.name,
        phone: dto.phone,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return { token: this.signToken(customer.id, 'CUSTOMER'), customer };
  }

  async loginCustomer(dto: LoginDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { email: dto.email },
    });
    if (!customer) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, customer.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const safeCustomer = { ...customer } as Partial<typeof customer>;
    delete safeCustomer.password;
    return {
      token: this.signToken(customer.id, 'CUSTOMER'),
      customer: safeCustomer,
    };
  }

  // ─── Private Helper ───────────────────────────────────────────────────────

  private signToken(userId: string, role: 'OWNER' | 'CUSTOMER'): string {
    return this.jwtService.sign({ sub: userId, role });
  }
}
