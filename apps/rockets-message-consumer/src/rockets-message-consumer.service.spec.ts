import { Test, TestingModule } from '@nestjs/testing';
import { RocketsMessageConsumerService } from './rockets-message-consumer.service';
import { RocketStateService } from '../../../shared/services/rocket-state.service';
import { Client } from '@elastic/elasticsearch';

describe('RocketsMessageConsumerService', () => {
  let service: RocketsMessageConsumerService;
  let stateService: RocketStateService;
  let esClient: Client;

  const mockPayload = {
    metadata: {
      channel: 'rocket-uuid-1',
      messageNumber: 10,
      messageTime: '2026-01-18T10:00:00Z',
      messageType: 'RocketSpeedIncreased'
    },
    message: { by: 100 }
  };

  const mockState = {
    metadata: { rocketUuid: 'rocket-uuid-1', messageNumber: 9 },
    message: { launchSpeed: 500 }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RocketsMessageConsumerService,
        {
          provide: RocketStateService,
          useValue: {
            reconcileState: jest.fn()
          }
        }
      ],
    }).compile();

    service = module.get<RocketsMessageConsumerService>(RocketsMessageConsumerService);
    stateService = module.get<RocketStateService>(RocketStateService);
    esClient = (service as any).esClient;
  });

  it('should process and index new messages correctly across both indices', async () => {
    jest.spyOn(esClient, 'search').mockResolvedValue({
      hits: { total: { value: 0 }, hits: [] }
    } as any);

    const indexSpy = jest.spyOn(esClient, 'index').mockResolvedValue({} as any);
    jest.spyOn(stateService, 'reconcileState').mockResolvedValue({
      ...mockState,
      message: { launchSpeed: 600 }
    } as any);

    await service.processMessage(mockPayload as any);

    expect(indexSpy).toHaveBeenCalledWith(expect.objectContaining({
      index: 'rockets',
      document: expect.objectContaining({
        metadata: expect.objectContaining({ rocketUuid: 'rocket-uuid-1' })
      })
    }));

    expect(indexSpy).toHaveBeenCalledWith(expect.objectContaining({
      index: 'rockets-state',
      id: 'rocket-uuid-1',
      document: expect.objectContaining({
        message: { launchSpeed: 600 }
      })
    }));
  });

  it('should skip processing and state updates for duplicate messages', async () => {
    jest.spyOn(esClient, 'search').mockResolvedValue({
      hits: { total: { value: 1 }, hits: [{ _id: '1' }] }
    } as any);

    const indexSpy = jest.spyOn(esClient, 'index');

    await service.processMessage(mockPayload as any);

    expect(indexSpy).not.toHaveBeenCalled();
    expect(stateService.reconcileState).not.toHaveBeenCalled();
  });

  it('should log error and rethrow when search fails', async () => {
    jest.spyOn(esClient, 'search').mockRejectedValue(new Error('ES Down'));
    const loggerSpy = jest.spyOn((service as any).logger, 'error');

    await expect(service.processMessage(mockPayload as any)).rejects.toThrow('ES Down');
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Process Failed: ES Down'));
  });
});
