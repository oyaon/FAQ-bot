import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FaqModule } from './faq/faq.module';
import { MetricsModule } from './metrics/metrics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FaqModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
