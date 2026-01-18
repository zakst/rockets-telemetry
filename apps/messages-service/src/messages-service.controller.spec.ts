import { Test, TestingModule } from '@nestjs/testing';
import { MessagesServiceController } from './messages-service.controller';
import { MessagesServiceService } from './messages-service.service';

describe('MessagesServiceController', () => {
  let controller: MessagesServiceController;
  let service: MessagesServiceService;

  const mockService = {
    queueMessage: jest.fn().mockResolvedValue({ status: 'queued' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesServiceController],
      providers: [
        { provide: MessagesServiceService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<MessagesServiceController>(MessagesServiceController);
    service = module.get<MessagesServiceService>(MessagesServiceService);
  });

  it('should call messagesService.queueMessage with the provided body', async () => {
    const body = { metadata: { channel: 'test' } } as any;
    const result = await controller.receiveMessage(body);

    expect(result).toEqual({ status: 'queued' });
    expect(service.queueMessage).toHaveBeenCalledWith(body);
  });
});
