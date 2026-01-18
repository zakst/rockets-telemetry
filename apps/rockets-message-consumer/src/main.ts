import { SQSEvent, Context } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { RocketsMessageConsumerModule } from './rockets-message-consumer.module';
import { RocketsMessageConsumerService } from './rockets-message-consumer.service';
import { RocketMessageDto } from '../../../shared/contracts/message.dto';

let cachedApp: INestApplicationContext;

async function bootstrap() {
  if (!cachedApp) {
    cachedApp = await NestFactory.createApplicationContext(RocketsMessageConsumerModule);
  }
  return cachedApp;
}

export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  const app = await bootstrap();
  const service = app.get(RocketsMessageConsumerService);

  try {
    for (const record of event.Records) {
      const message: RocketMessageDto = JSON.parse(record.body);

      await service.processMessage(message);
    }
  } catch (error) {
    throw error;
  }
};

exports.handler = handler;
