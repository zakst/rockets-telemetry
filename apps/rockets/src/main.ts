import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { RocketsModule } from './rockets.module';

async function bootstrap() {
  const logger = new Logger('RocketsBootstrap');

  const app = await NestFactory.create(RocketsModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const config = new DocumentBuilder()
    .setTitle('Rockets API')
    .setVersion('1.0')
    .addTag('rockets')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = 8089;
  await app.listen(port);

  logger.log(`\n\nApplication is running on: http://localhost:${port}/api`);
}

bootstrap();
