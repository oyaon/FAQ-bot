import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';

const logger = new Logger('Bootstrap');

// Keep alive on free tier (pings every 14 minutes)
if (process.env.NODE_ENV === 'production') {
  const externalUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';

  setInterval(
    () => {
      fetch(`${externalUrl}/health`)
        .then((res) => {
          if (!res.ok) {
            logger.warn(
              `Health check failed with status ${res.status}`,
            );
          }
        })
        .catch((err) => {
          logger.error(`Health check error: ${err.message}`);
        });
    },
    14 * 60 * 1000,
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security middleware FIRST
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'self'"], // Allow inline event handlers like onclick
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          childSrc: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Configure CORS with restricted origins
  let allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://faq-bot-lwt1.onrender.com',
  ];

  // Allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins = [
      'http://localhost:3000',
      'http://localhost',
      ...allowedOrigins,
    ];
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  });

  await app.listen(process.env.PORT ?? 3000);

  const port = process.env.PORT ?? 3000;
  logger.log(`FAQ Bot API running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed:', err);
  process.exit(1);
});
