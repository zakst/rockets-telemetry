import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RocketsService } from './rockets.service';

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      search: jest.fn(),
    })),
  };
});

describe('RocketsService', () => {
  let service: RocketsService;
  let mockEsClient: any;

  const mockRocketData = {
    metadata: {
      rocketUuid: '193270a9-c9cf-404a-8f83-838e71d9ae67',
      messageNumber: 1,
      messageTime: '2022-02-02T19:39:05.86337+01:00',
      messageType: 'RocketLaunched',
    },
    message: { type: 'Falcon-9', launchSpeed: 500, mission: 'ARTEMIS' },
    receivedAt: '2026-01-17T08:55:50.462Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RocketsService],
    }).compile();

    service = module.get<RocketsService>(RocketsService);
    mockEsClient = (service as any).esClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchByProperty - Sorting Logic', () => {
    it('should use default sort when no sortBy is provided', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      await service.searchByProperty({ 'message.mission': 'GEMINI' });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [
            { 'metadata.messageNumber': { order: 'desc' } },
            { 'metadata.rocketUuid': { order: 'asc' } },
          ],
        }),
      );
    });

    it('should append .keyword to "message.type" and sort ascending', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      await service.searchByProperty({}, 'message.type');

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: expect.arrayContaining([
            {
              'message.type.keyword': {
                order: 'asc',
                unmapped_type: 'keyword',
              },
            },
          ]),
        }),
      );
    });

    it('should append .keyword to "mission" fields when nested in criteria', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      await service.searchByProperty({}, 'message.mission');

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: expect.arrayContaining([
            {
              'message.mission.keyword': {
                order: 'asc',
                unmapped_type: 'keyword',
              },
            },
          ]),
        }),
      );
    });

    it('should not append .keyword to metadata fields like messageTime', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      await service.searchByProperty({}, 'metadata.messageTime');

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: expect.arrayContaining([
            {
              'metadata.messageTime': {
                order: 'asc',
                unmapped_type: 'keyword',
              },
            },
          ]),
        }),
      );
    });
  });

  describe('searchByProperty - Result Handling', () => {
    it('should return an empty array if no results are found', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      const result = await service.searchByProperty({ 'message.mission': 'VOID' });

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should limit search results to 1000 documents', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      await service.searchByProperty({});

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ size: 1000 }),
      );
    });

    it('should map multiple hits back to RocketDto objects', async () => {
      const secondRocket = { ...mockRocketData, metadata: { ...mockRocketData.metadata, rocketUuid: 'uuid-2' } };
      mockEsClient.search.mockResolvedValue({
        hits: {
          hits: [
            { _source: mockRocketData },
            { _source: secondRocket },
          ],
        },
      });

      const result = await service.searchByProperty({});

      expect(result).toHaveLength(2);
      expect(result[0].metadata.rocketUuid).toBe('193270a9-c9cf-404a-8f83-838e71d9ae67');
      expect(result[1].metadata.rocketUuid).toBe('uuid-2');
    });
  });

  describe('getRocketState - Operational Edge Cases', () => {
    it('should sort by messageNumber descending to get the absolute latest state', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { hits: [{ _source: mockRocketData }] },
      });

      await service.getRocketState('uuid-1');

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [{ 'metadata.messageNumber': 'desc' }],
          size: 1,
        }),
      );
    });
  });
});
