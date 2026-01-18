import { Test, TestingModule } from '@nestjs/testing';
import { RocketsController } from './rockets.controller';
import { RocketsService } from './services/rockets.service';
import { GetRocketsService } from './services/get-rockets.service';
import { RocketStateService } from '../../../shared/services/rocket-state.service';
import { RocketStateDto } from '../../../shared/contracts/rocket-state.dto';
import { RocketSummaryDto } from '../../../shared/contracts/rocket-summary.dto';
import { NotFoundException } from '@nestjs/common';

describe('RocketsController', () => {
  let controller: RocketsController;
  let rocketsService: RocketsService;
  let rocketStateService: RocketStateService;
  let getRocketsService: GetRocketsService;

  const mockRocketSummary: RocketSummaryDto = {
    rocketUuid: '193270a9-c9cf-404a-8f83-838e71d9ae67',
    mission: 'ARTEMIS',
  };

  const mockRocketState: RocketStateDto = {
    metadata: {
      rocketUuid: '193270a9-c9cf-404a-8f83-838e71d9ae67',
      messageNumber: 1,
      messageTime: '2022-02-02T19:39:05.86337+01:00',
      messageType: 'RocketLaunched',
    },
    message: {
      type: 'Falcon-9',
      launchSpeed: 500,
      mission: 'ARTEMIS',
      isExploded: false
    },
    receivedAt: '2026-01-17T08:55:50.462Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RocketsController],
      providers: [
        {
          provide: RocketsService,
          useValue: {
            searchByProperty: jest.fn().mockResolvedValue([mockRocketState]),
          },
        },
        {
          provide: GetRocketsService,
          useValue: {
            getAllRockets: jest.fn().mockResolvedValue([mockRocketSummary]),
          },
        },
        {
          provide: RocketStateService,
          useValue: {
            getCurrentState: jest.fn().mockResolvedValue(mockRocketState),
          },
        },
      ],
    }).compile();

    controller = module.get<RocketsController>(RocketsController);
    rocketsService = module.get<RocketsService>(RocketsService);
    rocketStateService = module.get<RocketStateService>(RocketStateService);
    getRocketsService = module.get<GetRocketsService>(GetRocketsService);
  });

  describe('search with sortBy logic', () => {
    it('should call searchByProperty with criteria and undefined sortBy when not provided', async () => {
      const criteria = { 'message.mission': 'GEMINI' };

      await controller.search(criteria, undefined);

      expect(rocketsService.searchByProperty).toHaveBeenCalledWith(criteria, undefined);
    });

    it('should pass the sortBy query parameter to the service', async () => {
      const criteria = { 'message.mission': 'GEMINI' };
      const sortBy = 'message.type';

      await controller.search(criteria, sortBy);

      expect(rocketsService.searchByProperty).toHaveBeenCalledWith(criteria, sortBy);
    });

    it('should handle sorting by metadata fields', async () => {
      const criteria = { 'message.type': 'Falcon-9' };
      const sortBy = 'metadata.messageTime';

      await controller.search(criteria, sortBy);

      expect(rocketsService.searchByProperty).toHaveBeenCalledWith(criteria, sortBy);
    });

    it('should return results correctly sorted by the service', async () => {
      const criteria = { 'message.mission': 'GEMINI' };
      const sortBy = 'message.type';
      const mockResults = [mockRocketState, { ...mockRocketState, rocketUuid: 'abc' }];

      jest.spyOn(rocketsService, 'searchByProperty').mockResolvedValueOnce(mockResults);

      const result = await controller.search(criteria, sortBy);

      expect(result).toEqual(mockResults);
      expect(result.length).toBe(2);
    });
  });

  describe('getRocketByRocketUuid edge cases', () => {
    it('should throw NotFoundException if the state service returns null', async () => {
      jest.spyOn(rocketStateService, 'getCurrentState').mockResolvedValueOnce(null);

      await expect(controller.getRocketByRocketUuid('new-uuid'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should call getCurrentState with the provided Param', async () => {
      const uuid = 'target-rocket-uuid';
      await controller.getRocketByRocketUuid(uuid);
      expect(rocketStateService.getCurrentState).toHaveBeenCalledWith(uuid);
    });
  });

  describe('getAllRockets edge cases', () => {
    it('should return an empty array if no rockets are summarized', async () => {
      jest.spyOn(getRocketsService, 'getAllRockets').mockResolvedValueOnce([]);
      const result = await controller.getAllRockets();
      expect(result).toEqual([]);
    });
  });
});
