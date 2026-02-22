import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

// Keep alive on free tier (pings every 14 minutes)
if (process.env.NODE_ENV === 'production') {
  setInterval(
    () => {
      fetch(
        process.env.RENDER_EXTERNAL_URL ||
          'https://faq-bot-lwt1.onrender.com/health',
      ).catch(() => {});
    },
    14 * 60 * 1000,
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security middleware FIRST
  app.use(helmet());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Configure CORS with restricted origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://faq-bot-lwt1.onrender.com',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  });

  await app.listen(process.env.PORT ?? 3000);

  console.log('🚀 FAQ Bot running on http://localhost:3000');
}
bootstrap();
