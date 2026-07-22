import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ResponseFormat } from '@/common/types';

@Injectable()
export class ResponseFormatInterceptor<T> implements NestInterceptor<
  T,
  ResponseFormat<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        // undefined -> null: rutas void (ej. DELETE) no deben perder la key
        // `data` en el JSON serializado (JSON.stringify omite undefined).
        data: data === undefined ? null : data,
      })),
    );
  }
}
