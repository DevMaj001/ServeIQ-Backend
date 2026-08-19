import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import helmet from 'helmet';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { StructuredLogger } from './common/services/logger.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from './database/data-source';
import { ensureTables } from './database/ensure-tables';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
async function bootstrap() {
  let ds;
  try {
    ds = await AppDataSource.initialize();
    await ensureTables(ds).catch((e) =>
      console.error('[bootstrap] ensureTables error:', e),
    );
    await ds.destroy().catch(() => {});
  } catch (e) {
    console.error('[bootstrap] DataSource init error (non-fatal):', e);
  }

  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger('ServeIQ'),
    rawBody: true,
  });

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
    });
    app.useGlobalFilters(new SentryExceptionFilter(app.get(HttpAdapterHost)));
  }

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
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger / OpenAPI
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

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap().catch((err) => {
  console.error('[Bootstrap]', err);
  process.exit(1);
});
