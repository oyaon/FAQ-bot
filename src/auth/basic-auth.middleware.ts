import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import basicAuth from 'basic-auth';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

interface BasicAuthCredentials {
  name: string;
  pass: string;
}

@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const credentials = basicAuth(req) as BasicAuthCredentials | undefined;
    const expectedUser = this.configService.get<string>('ADMIN_USER') || 'admin';
    const expectedPass = this.configService.get<string>('ADMIN_PASS') || 'password';

    if (
      !credentials ||
      credentials.name !== expectedUser ||
      credentials.pass !== expectedPass
    ) {
      res.set('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
      throw new UnauthorizedException('Unauthorized');
    }
    next();
  }
}

