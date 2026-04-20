import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

const FAIL_PREFIX = 'login:fail:';
const LOCK_PREFIX = 'login:lock:';

@Injectable()
export class LoginThrottleService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  private get maxAttempts(): number {
    return Number(this.config.get<string>('LOGIN_MAX_ATTEMPTS') || 5);
  }

  private get lockoutSeconds(): number {
    return Number(this.config.get<string>('LOGIN_LOCKOUT_MINUTES') || 15) * 60;
  }

  /**
   * If account is currently locked, returns remaining seconds; else 0.
   */
  async getLockRemaining(username: string): Promise<number> {
    const ttl = await this.redis.ttl(`${LOCK_PREFIX}${username}`);
    return ttl > 0 ? ttl : 0;
  }

  /**
   * Record a failed login attempt. If threshold reached, lock the account.
   * Returns { locked, attemptsLeft } — callers can craft a clear message.
   */
  async recordFailure(
    username: string,
  ): Promise<{ locked: boolean; attemptsLeft: number }> {
    const key = `${FAIL_PREFIX}${username}`;
    const attempts = await this.redis.incr(key);
    // Reset failure counter expiry on each increment (rolling window)
    if (attempts === 1) {
      await this.redis.expire(key, this.lockoutSeconds);
    }

    if (attempts >= this.maxAttempts) {
      await this.redis.set(
        `${LOCK_PREFIX}${username}`,
        '1',
        'EX',
        this.lockoutSeconds,
      );
      await this.redis.del(key);
      return { locked: true, attemptsLeft: 0 };
    }

    return { locked: false, attemptsLeft: this.maxAttempts - attempts };
  }

  /**
   * Reset failure counter (called on successful login).
   */
  async reset(username: string): Promise<void> {
    await this.redis.del(`${FAIL_PREFIX}${username}`, `${LOCK_PREFIX}${username}`);
  }
}
