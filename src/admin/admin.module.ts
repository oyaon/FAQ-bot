import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { BasicAuthMiddleware } from '../auth/basic-auth.middleware';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public/admin'),
      serveRoot: '/admin',
    }),
  ],
  controllers: [AdminController],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(BasicAuthMiddleware).forRoutes('/admin');
  }
}

