import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { intializeDataSource } from './database/data-source';
import { Logger } from '@nestjs/common';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const config = new DocumentBuilder()
    .setTitle('TalentLens Documentation')
    .setDescription('TalentLens backend API docs')
    .setVersion('1.0')
    .addBasicAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  const logger = new Logger('bootstrap');
  // Initialize database connection
  try {
    await intializeDataSource();
    logger.log('Data Source has been initialized!');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
    process.exit(1);
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
