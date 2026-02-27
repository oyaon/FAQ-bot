import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Check if x-correlation-id header already exists
    let correlationId = request.headers['x-correlation-id'];

    // Generate new UUID v4 if not present
    if (!correlationId) {
      correlationId = uuidv4();
    }

    // Add correlation ID to response headers
    response.setHeader('x-correlation-id', correlationId);

    // Log the request with correlation ID
    this.logger.log(`[${correlationId}] ${request.method} ${request.path}`);

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `[${correlationId}] Response sent for ${request.method} ${request.path}`,
        );
      }),
    );
  }
}
