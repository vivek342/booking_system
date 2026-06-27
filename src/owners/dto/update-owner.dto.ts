import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateOwnerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  businessName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
