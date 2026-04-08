import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import type { Request } from 'express';

interface JwtPayload {
  sub: number;
  username: string;
  iat: number;
  exp: number;
}

function extractJwt(req: Request): string | null {
  // 1. Try Authorization header first
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;
  // 2. Fallback to query param (for file download/preview via window.open)
  const token = req.query?.token as string;
  return token || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: extractJwt,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return this.authService.validateUser(payload.sub);
  }
}
