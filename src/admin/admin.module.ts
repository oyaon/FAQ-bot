import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public/admin'),
      serveRoot: '/admin',
    }),
    SupabaseModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}

