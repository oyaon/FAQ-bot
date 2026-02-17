import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FaqModule } from './faq/faq.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FaqModule,
  ],
})
export class AppModule {}
