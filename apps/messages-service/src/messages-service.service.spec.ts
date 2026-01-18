import { Test, TestingModule } from '@nestjs/testing';
import { MessagesServiceService } from './messages-service.service';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { InternalServerErrorException } from '@nestjs/common';
import { RocketMessageType } from '../../../shared/enums/rocket-message.enum';

describe('MessagesServiceService', () => {
  let service: MessagesServiceService;
  let sqsClient: SQSClient;

  const mockMessage = {
    metadata: {
      channel: 'rocket-123',
      messageNumber: 10,
      messageTime: new Date().toISOString(),
      messageType: RocketMessageType.LAUNCHED,
    },
    message: { type: 'Falcon-9', launchSpeed: 500, mission: 'TEST' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesServiceService],
    }).compile();

    service = module.get<MessagesServiceService>(MessagesServiceService);
    sqsClient = (service as any).sqsClient;
  });

  it('should successfully send a message to SQS', async () => {
    const sendSpy = jest.spyOn(sqsClient, 'send').mockImplementation(() =>
      Promise.resolve({} as any)
    );

    const result = await service.queueMessage(mockMessage as any);

    expect(result).toEqual({ status: 'queued' });
    expect(sendSpy).toHaveBeenCalled();

    const command = sendSpy.mock.calls[0][0] as SendMessageCommand;
    expect(command.input.MessageBody).toBe(JSON.stringify(mockMessage));
  });

  it('should throw InternalServerErrorException when SQS fails', async () => {
    jest.spyOn(sqsClient, 'send').mockImplementation(() => {
      return Promise.reject(new Error('SQS Failure'));
    });

    await expect(service.queueMessage(mockMessage as any))
      .rejects
      .toThrow(InternalServerErrorException);
  });
});
