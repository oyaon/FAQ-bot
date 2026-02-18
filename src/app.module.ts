import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FaqModule } from './faq/faq.module';
import { MetricsModule } from './metrics/metrics.module';
import { AppController } from './app.controller';
import { FaqController } from './faq/faq.controller';
import { MetricsController } from './metrics/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FaqModule,
    MetricsModule,
  ],
  controllers: [AppController, FaqController, MetricsController],
})
export class AppModule {}
