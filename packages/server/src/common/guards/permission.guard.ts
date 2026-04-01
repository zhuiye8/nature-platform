import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission metadata → public endpoint
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      throw new ForbiddenException('No permissions found');
    }

    // Super admin wildcard
    if (user.permissions.includes('*:*')) {
      return true;
    }

    if (user.permissions.includes(requiredPermission)) {
      return true;
    }

    throw new ForbiddenException(
      `Permission denied: ${requiredPermission} required`,
    );
  }
}
