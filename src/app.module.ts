import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { FaqModule } from './faq/faq.module';
import { MetricsModule } from './metrics/metrics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { SupabaseModule } from './supabase/supabase.module';
import { ConversationModule } from './conversation/conversation.module';
import { ChatModule } from './chat/chat.module';
import { EmbeddingModule } from './embedding/embedding.module';

import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Critical env vars are now required for production
      validationSchema: Joi.object({
        SUPABASE_URL: Joi.string().required(),
        SUPABASE_ANON_KEY: Joi.string().required(),
        GEMINI_API_KEY: Joi.string().optional(),
        ADMIN_API_KEY: Joi.string().optional(),
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),
        RENDER_EXTERNAL_URL: Joi.string().optional(),
        APP_URL: Joi.string().optional(),
        ALLOWED_ORIGINS: Joi.string().optional(),
      }),
      // Fail on missing required vars
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 60,
        },
      ],
    }),
    // SupabaseModule is @Global() - import ONCE here to make it available globally
    SupabaseModule,
    EmbeddingModule,
    FaqModule,
    MetricsModule,
    ConversationModule,
    AdminModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Removed SupabaseService from here - it's provided by SupabaseModule
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

