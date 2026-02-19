import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FaqModule } from './faq/faq.module';
import { MetricsModule } from './metrics/metrics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminController } from './admin/admin.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    FaqModule,
    MetricsModule,
    ChatModule,
  ],
  controllers: [AppController, AdminController],
  providers: [AppService],
})
export class AppModule {}
