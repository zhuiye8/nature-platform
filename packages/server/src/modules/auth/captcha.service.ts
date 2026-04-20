import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as svgCaptcha from 'svg-captcha';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

const REDIS_PREFIX = 'captcha:';

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  /**
   * Whether captcha is required (based on environment).
   * Default: true in production, false elsewhere.
   */
  isEnabled(): boolean {
    const explicit = this.config.get<string>('CAPTCHA_ENABLED');
    if (explicit !== undefined) return explicit === 'true';
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Generate a new SVG captcha.
   * Returns { captchaId, svg } — frontend shows svg, and echoes back
   * captchaId + user-typed answer on login.
   */
  async generate(): Promise<{ captchaId: string; svg: string }> {
    const length = Number(this.config.get<string>('CAPTCHA_LENGTH') || 4);
    const expireSeconds = Number(
      this.config.get<string>('CAPTCHA_EXPIRE_SECONDS') || 300,
    );

    const captcha = svgCaptcha.create({
      size: length,
      noise: 3,
      color: true,
      background: '#f5f7fa',
      width: 140,
      height: 46,
      fontSize: 50,
      ignoreChars: '0o1ilI',
    });

    const captchaId = randomUUID();
    // Store answer lowercased for case-insensitive comparison
    await this.redis.set(
      `${REDIS_PREFIX}${captchaId}`,
      captcha.text.toLowerCase(),
      'EX',
      expireSeconds,
    );

    return { captchaId, svg: captcha.data };
  }

  /**
   * Validate a captcha answer. Always deletes the captcha from Redis
   * after validation (one-time use, prevents replay).
   *
   * @returns true if answer matches; false otherwise (expired, not-found, or wrong)
   */
  async validate(captchaId: string, answer: string): Promise<boolean> {
    if (!captchaId || !answer) return false;

    const key = `${REDIS_PREFIX}${captchaId}`;
    // Atomic: fetch + delete in one round-trip (so even wrong answers burn the captcha)
    const pipeline = this.redis.multi();
    pipeline.get(key);
    pipeline.del(key);
    const results = await pipeline.exec();
    const stored = results?.[0]?.[1] as string | null;

    if (!stored) return false; // expired or not exist
    return stored === answer.trim().toLowerCase();
  }
}
