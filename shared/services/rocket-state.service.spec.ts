import { Test, TestingModule } from '@nestjs/testing';
import { RocketStateService } from './rocket-state.service';
import { Client } from '@elastic/elasticsearch';
import { RocketStateDto } from '../contracts/rocket-state.dto';
import { RocketMessageDto } from '../contracts/message.dto';
import {RocketMessageType} from '../enums/rocket-message.enum'

describe('RocketStateService', () => {
  let service: RocketStateService;
  let esClient: Client;

  const mockRocketUuid = 'rocket-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RocketStateService,],
    }).compile();

    service = module.get<RocketStateService>(RocketStateService);
    esClient = (service as any).esClient;
  });

  describe('getCurrentState', () => {
    it('should return the state when document exists', async () => {
      const mockState: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 1, messageTime: '', messageType: '' },
        message: { launchSpeed: 500, isExploded: false },
        receivedAt: new Date().toISOString(),
      };

      jest.spyOn(esClient, 'get').mockResolvedValue({ _source: mockState } as any);

      const result = await service.getCurrentState(mockRocketUuid);
      expect(result).toEqual(mockState);
    });

    it('should return null when document is not found (404)', async () => {
      jest.spyOn(esClient, 'get').mockRejectedValue({
        meta: { statusCode: 404 },
      });

      const result = await service.getCurrentState(mockRocketUuid);
      expect(result).toBeNull();
    });

    it('should throw error for non-404 errors', async () => {
      jest.spyOn(esClient, 'get').mockRejectedValue(new Error('Connection failed'));

      await expect(service.getCurrentState(mockRocketUuid)).rejects.toThrow('Connection failed');
    });
  });

  describe('calculateNewState', () => {
    const createIncoming = (type: RocketMessageType, payload: any, num: number): RocketMessageDto => ({
      metadata: {
        channel: mockRocketUuid,
        messageNumber: num,
        messageTime: '2026-01-18T10:00:00Z',
        messageType: type,
      },
      message: payload,
    });

    it('should initialize state from RocketLaunched when current is null', () => {
      const incoming = createIncoming(RocketMessageType.LAUNCHED, {
        type: 'Falcon-9',
        launchSpeed: 1000,
        mission: 'MARS',
      }, 1);

      const result = service.calculateNewState(null, incoming);

      expect(result.message.type).toBe('Falcon-9');
      expect(result.message.launchSpeed).toBe(1000);
      expect(result.message.mission).toBe('MARS');
      expect(result.metadata.messageNumber).toBe(1);
    });

    it('should accumulate speed on RocketSpeedIncreased', () => {
      const current: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 1, messageTime: '', messageType: '' },
        message: { launchSpeed: 1000, isExploded: false },
        receivedAt: '',
      };
      const incoming = createIncoming(RocketMessageType.SPEED_INCREASED, { by: 500 }, 2);

      const result = service.calculateNewState(current, incoming);

      expect(result.message.launchSpeed).toBe(1500);
      expect(result.metadata.messageNumber).toBe(2);
    });

    it('should decrease speed on RocketSpeedDecreased', () => {
      const current: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 2, messageTime: '', messageType: '' },
        message: { launchSpeed: 1500, isExploded: false },
        receivedAt: '',
      };
      const incoming = createIncoming(RocketMessageType.SPEED_DECREASED, { by: 200 }, 3);

      const result = service.calculateNewState(current, incoming);

      expect(result.message.launchSpeed).toBe(1300);
    });

    it('should update mission on RocketMissionChanged', () => {
      const current: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 3, messageTime: '', messageType: '' },
        message: { mission: 'MARS', launchSpeed: 1300, isExploded: false },
        receivedAt: '',
      };
      const incoming = createIncoming(RocketMessageType.MISSION_CHANGED, { newMission: 'JUPITER' }, 4);

      const result = service.calculateNewState(current, incoming);

      expect(result.message.mission).toBe('JUPITER');
    });

    it('should handle RocketExploded and set explosion properties', () => {
      const current: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 4, messageTime: '', messageType: '' },
        message: { isExploded: false, launchSpeed: 1300 },
        receivedAt: '',
      };
      const incoming = createIncoming(RocketMessageType.EXPLODED, { reason: 'FUEL_LEAK' }, 5);

      const result = service.calculateNewState(current, incoming);

      expect(result.message.isExploded).toBe(true);
      expect(result.message.explosionReason).toBe('FUEL_LEAK');
    });

    it('should skip update and return current state if messageNumber is out of order', () => {
      const current: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 10, messageTime: '', messageType: '' },
        message: { launchSpeed: 5000, isExploded: false },
        receivedAt: '',
      };
      const incoming = createIncoming(RocketMessageType.SPEED_INCREASED, { by: 100 }, 5);

      const result = service.calculateNewState(current, incoming);

      expect(result).toEqual(current);
      expect(result.message.launchSpeed).toBe(5000);
    });

    it('should skip update if messageNumber is equal to current (idempotency)', () => {
      const current: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 10, messageTime: '', messageType: '' },
        message: { launchSpeed: 5000, isExploded: false },
        receivedAt: '',
      };
      const incoming = createIncoming(RocketMessageType.SPEED_INCREASED, { by: 100 }, 10);

      const result = service.calculateNewState(current, incoming);

      expect(result).toEqual(current);
    });

    it('should perform deep copy and not mutate current object', () => {
      const current: RocketStateDto = {
        metadata: { rocketUuid: mockRocketUuid, messageNumber: 1, messageTime: '', messageType: '' },
        message: { launchSpeed: 100, isExploded: false },
        receivedAt: '',
      };
      const incoming = createIncoming(RocketMessageType.SPEED_INCREASED, { by: 100 }, 2);

      const result = service.calculateNewState(current, incoming);

      result.message.launchSpeed = 999;
      expect(current.message.launchSpeed).toBe(100);
    });
  });
});
