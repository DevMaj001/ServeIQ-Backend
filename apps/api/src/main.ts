import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import helmet from 'helmet';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StructuredLogger } from './common/services/logger.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validateProductionEnv } from './common/bootstrap/validate-env';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
async function bootstrap() {
  validateProductionEnv();

  // Schema is owned exclusively by versioned migrations: the AppModule's
  // TypeORM connection runs pending migrations on init (migrationsRun: true).
  // The Render startCommand deliberately does NOT run a separate migration
  // step — boot-time migrationsRun is the single migration path.
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger('ServeIQ'),
    rawBody: true,
  });

  // Allow Nest to run onModuleDestroy / beforeApplicationShutdown hooks
  // (e.g. closing the Socket.io Redis adapter) on SIGINT/SIGTERM / app.close().
  app.enableShutdownHooks();

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
    });
    // NOTE: no SentryExceptionFilter here. Nest uses the FIRST matching
    // global @Catch() filter, so registering it alongside HttpExceptionFilter
    // silently disabled the error envelope and DB error mapping. 5xx capture
    // happens inside HttpExceptionFilter instead.
  }

  // A floating rejection outside any request context (timers, socket
  // handlers) must not kill the process silently — log, report, keep serving.
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    console.error('[unhandledRejection]', err);
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
    // Sync exceptions leave the process in an undefined state: report, then
    // exit so the platform restarts a clean instance.
    process.exit(1);
  });

  // Security headers
  app.use(helmet());
  app.use(cookieParser());

  // Global Prefix
  app.setGlobalPrefix('api');

  // Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Global Interceptors & Filters
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new TransformInterceptor(reflector),
    new ClassSerializerInterceptor(reflector),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? [
    'http://localhost:3000',
    'http://localhost:4200',
    'https://serveiq-admin.vercel.app',
    'https://serve-iq-one.vercel.app',
    'https://serve-iq-waiter.vercel.app',
    'https://serveiqhq.com',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-paystack-signature',
      'x-moniepoint-signature',
      'x-opay-signature',
      'x-simulate',
    ],
  });

  // Swagger / OpenAPI (disabled in production unless SWAGGER_ENABLED=true)
  const swaggerEnabled =
    (process.env.NODE_ENV ?? 'development') !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('ServeIQ API')
      .setDescription(
        readFileSync(join(__dirname, '..', '..', '..', 'README.md'), 'utf-8'),
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'access-token',
      )
      .addServer(`https://serveiq-backend.onrender.com`, 'Production')
      .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap().catch((err) => {
  const e = err as Error & { stack?: string };
  console.error('[Bootstrap] FATAL:', e?.message ?? err, '\n', e?.stack ?? '');
  process.exit(1);
});
