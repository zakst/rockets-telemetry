import {Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { RocketMessageDto } from '../../../shared/contracts/message.dto';

@Injectable()
export class MessagesServiceService {
  private readonly sqsClient: SQSClient;
  private readonly queueUrl = process.env.MESSAGES_QUEUE || 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/rocket-messages-queue';
  private readonly logger = new Logger(MessagesServiceService.name);

  constructor() {
    this.sqsClient = new SQSClient({
      region: 'us-east-1',
      endpoint: process.env.SQS_ENDPOINT || 'http://localhost:4566',
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.SECRET_ACCESS_KEY|| 'test',
      },
    });
  }

  async queueMessage(message: RocketMessageDto) {
    const { channel, messageNumber } = message.metadata;
    this.logger.log(`Queuing msg #${messageNumber} for rocket: ${channel}`);

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      });

      await this.sqsClient.send(command);
      return { status: 'queued' };
    } catch (error) {
      this.logger.error('Failed to send to SQS:', error);
      throw new InternalServerErrorException('Queue unavailable');
    }
  }
}
