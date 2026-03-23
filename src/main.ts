import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { JOBS_SWAGGER_TAG } from './module/jobs/docs/jobs.docs';
import { APPLICATIONS_SWAGGER_TAG } from './module/applications/docs/applications.docs';

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, '');

const buildAllowedOrigins = (): string[] => {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) => normalizeOrigin(origin));
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = buildAllowedOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      const normalizedRequestOrigin = normalizeOrigin(origin);
      const isAllowed = allowedOrigins.includes(normalizedRequestOrigin);

      if (isAllowed) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('TalentLens Documentation')
    .setDescription('TalentLens backend API docs')
    .setVersion('1.0')
    .addTag(JOBS_SWAGGER_TAG.name, JOBS_SWAGGER_TAG.description)
    .addTag(APPLICATIONS_SWAGGER_TAG.name, APPLICATIONS_SWAGGER_TAG.description)
    .addBasicAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  const logger = new Logger('bootstrap');
  await app.listen(process.env.PORT ?? 3000);
  logger.log('Application started successfully');
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
