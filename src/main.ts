import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Global request body size limit to prevent large payload abuse
  app.use(bodyParser.json({ limit: '10kb' }));
  app.use(bodyParser.urlencoded({ limit: '10kb', extended: true }));

  // Security middleware FIRST
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Scripts: self + CDN (Chart.js)
          // Removed: unsafe-eval (not needed), unsafe-hashes (not needed), unsafe-inline (using nonce approach)
          scriptSrc: ["'self'", 'cdn.jsdelivr.net'],
          // Script elements (like <script src="">)
          scriptSrcElem: ["'self'", 'cdn.jsdelivr.net'],
          // Script attributes (inline event handlers like onclick)
          // Keep unsafe-inline for existing inline handlers in admin.js (addEventListener pattern)
          scriptSrcAttr: ["'self'", "'unsafe-inline'"],
          // Styles: self + inline styles (needed for dynamic styling)
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Images: self + data URLs + HTTPS
          imgSrc: ["'self'", 'data:', 'https:'],
          // Connections: ONLY same origin (removed broad "https:")
          // Frontend only calls internal APIs: /search, /feedback, /metrics
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          childSrc: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
          // CSP violation reporting
          reportUri: ['/csp-report'],
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

  // Register correlation ID interceptor globally
  app.useGlobalInterceptors(new CorrelationIdInterceptor());

  await app.listen(process.env.PORT ?? 3000);

  const port = process.env.PORT ?? 3000;
  logger.log(`FAQ Bot API running on http://localhost:${port}`);

  // Keep alive on free tier (pings every 14 minutes)
  // Stored in variable to clear on graceful shutdown
  let keepAliveInterval: NodeJS.Timeout;
  if (process.env.NODE_ENV === 'production') {
    const externalUrl =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.APP_URL ||
      'http://localhost:3000';

    keepAliveInterval = setInterval(
      () => {
        fetch(`${externalUrl}/health`)
          .then((res) => {
            if (!res.ok) {
              logger.warn(`Health check failed with status ${res.status}`);
            }
          })
          .catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`Health check error: ${errorMessage}`);
          });
      },
      14 * 60 * 1000,
    );
  }

  // Graceful shutdown hooks
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    process.on(signal, () => {
      logger.log(`Received ${signal}, shutting down gracefully...`);

      // Clear keep-alive interval
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        logger.log('Keep-alive interval cleared');
      }

      app.close().then(() => {
        logger.log('FAQ Bot API closed');
        process.exit(0);
      });
    });
  }
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed:', err);
  process.exit(1);
});

