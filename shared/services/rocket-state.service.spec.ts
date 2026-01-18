import { Test, TestingModule } from '@nestjs/testing';
import { RocketStateService } from './rocket-state.service';
import { Client } from '@elastic/elasticsearch';
import { RocketStateDto } from '../contracts/rocket-state.dto';
import { RocketMessageDto } from '../contracts/message.dto';
import { RocketMessageType } from '../enums/rocket-message.enum';

describe('RocketStateService', () => {
  let service: RocketStateService;
  let esClient: Client;

  const mockRocketUuid = 'rocket-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RocketStateService],
    }).compile();

    service = module.get<RocketStateService>(RocketStateService);
    esClient = (service as any).esClient;
  });

  const createMsg = (num: number, type: RocketMessageType, payload: any): RocketMessageDto => ({
    metadata: {
      channel: mockRocketUuid,
      messageNumber: num,
      messageTime: new Date().toISOString(),
      messageType: type,
    },
    message: payload,
  });

  describe('reconcileState', () => {
    it('should return default empty state if no messages found', async () => {
      jest.spyOn(esClient, 'search').mockResolvedValue({
        hits: { hits: [] },
      } as any);

      const state = await service.reconcileState(mockRocketUuid);

      expect(state.message.launchSpeed).toBe(0);
      expect(state.metadata.messageNumber).toBeUndefined();
    });

    it('should correctly rebuild state from a single Launch message', async () => {
      const msg1 = createMsg(1, RocketMessageType.LAUNCHED, {
        type: 'Falcon-9',
        launchSpeed: 1000,
        mission: 'MARS',
      });

      jest.spyOn(esClient, 'search').mockResolvedValue({
        hits: { hits: [{ _source: msg1 }] },
      } as any);

      const state = await service.reconcileState(mockRocketUuid);

      expect(state.message.launchSpeed).toBe(1000);
      expect(state.message.mission).toBe('MARS');
      expect(state.message.type).toBe('Falcon-9');
      expect(state.metadata.messageNumber).toBe(1);
    });

    it('should correctly rebuild state from unordered messages (Launch last)', async () => {
      // Order returned from DB: Msg 2 (SpeedUp), Msg 1 (Launch)
      const msg2 = createMsg(2, RocketMessageType.SPEED_INCREASED, { by: 500 });
      const msg1 = createMsg(1, RocketMessageType.LAUNCHED, {
        type: 'Falcon-9',
        launchSpeed: 1000,
        mission: 'MARS',
      });

      jest.spyOn(esClient, 'search').mockResolvedValue({
        hits: { hits: [{ _source: msg2 }, { _source: msg1 }] },
      } as any);

      const state = await service.reconcileState(mockRocketUuid);

      // Expected: Msg 1 sets 1000 -> Msg 2 adds 500 = 1500
      expect(state.message.launchSpeed).toBe(1500);
      expect(state.metadata.messageNumber).toBe(2);
      expect(state.message.mission).toBe('MARS');
    });

    it('should handle speed decrease', async () => {
      const msg1 = createMsg(1, RocketMessageType.LAUNCHED, {
        type: 'Falcon-9', launchSpeed: 1000, mission: 'MARS'
      });
      const msg2 = createMsg(2, RocketMessageType.SPEED_DECREASED, { by: 200 });

      jest.spyOn(esClient, 'search').mockResolvedValue({
        hits: { hits: [{ _source: msg1 }, { _source: msg2 }] },
      } as any);

      const state = await service.reconcileState(mockRocketUuid);

      expect(state.message.launchSpeed).toBe(800);
    });

    it('should handle mission changes', async () => {
      const msg1 = createMsg(1, RocketMessageType.LAUNCHED, {
        type: 'Falcon-9', launchSpeed: 1000, mission: 'MARS'
      });
      const msg2 = createMsg(2, RocketMessageType.MISSION_CHANGED, { newMission: 'VENUS' });

      jest.spyOn(esClient, 'search').mockResolvedValue({
        hits: { hits: [{ _source: msg1 }, { _source: msg2 }] },
      } as any);

      const state = await service.reconcileState(mockRocketUuid);

      expect(state.message.mission).toBe('VENUS');
    });

    it('should handle explosion', async () => {
      const msg1 = createMsg(1, RocketMessageType.LAUNCHED, {
        type: 'Falcon-9', launchSpeed: 1000, mission: 'MARS'
      });
      const msg2 = createMsg(3, RocketMessageType.EXPLODED, { reason: 'BOOM' });

      jest.spyOn(esClient, 'search').mockResolvedValue({
        hits: { hits: [{ _source: msg1 }, { _source: msg2 }] },
      } as any);

      const state = await service.reconcileState(mockRocketUuid);

      expect(state.message.isExploded).toBe(true);
      expect(state.message.explosionReason).toBe('BOOM');
    });
  });
});
