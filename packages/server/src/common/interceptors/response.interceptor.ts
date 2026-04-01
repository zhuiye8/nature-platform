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

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the response already has ApiResponse shape, pass through
        if (
          data !== null &&
          data !== undefined &&
          typeof data === 'object' &&
          'code' in data &&
          'data' in data &&
          'message' in data
        ) {
          return data as unknown as ApiResponse<T>;
        }

        return {
          code: 0,
          data,
          message: 'ok',
        };
      }),
    );
  }
}
