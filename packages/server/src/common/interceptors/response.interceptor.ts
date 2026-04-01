import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/**
 * Format a Date or ISO string to Beijing time: YYYY-MM-DD HH:mm:ss
 */
function toBeiijngTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  // UTC+8
  const bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`;
}

/**
 * ISO 8601 pattern: 2026-04-01T19:10:24.947Z or 2026-04-01T19:10:24+08:00
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Recursively transform all Date/ISO-string values in an object to Beijing time strings.
 */
function transformDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return toBeiijngTime(obj);
  if (typeof obj === 'string' && ISO_DATE_RE.test(obj)) return toBeiijngTime(obj);
  if (Array.isArray(obj)) return obj.map(transformDates);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = transformDates(obj[key]);
    }
    return result;
  }
  return obj;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Transform all dates to Beijing time
        const transformed = transformDates(data);

        // If the response already has ApiResponse shape, pass through
        if (
          transformed !== null &&
          transformed !== undefined &&
          typeof transformed === 'object' &&
          'code' in transformed &&
          'data' in transformed &&
          'message' in transformed
        ) {
          return transformed as unknown as ApiResponse<T>;
        }

        return {
          code: 0,
          data: transformed,
          message: 'ok',
        };
      }),
    );
  }
}
