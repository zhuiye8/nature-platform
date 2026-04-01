import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  roleCode!: string;

  @IsString()
  @IsNotEmpty()
  roleName!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  roleName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class AssignPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}
