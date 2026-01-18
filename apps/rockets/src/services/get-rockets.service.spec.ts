import { Test, TestingModule } from '@nestjs/testing';
import { GetRocketsService } from './get-rockets.service';

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      search: jest.fn(),
    })),
  };
});

describe('GetRocketsService', () => {
  let service: GetRocketsService;
  let mockEsClient: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetRocketsService],
    }).compile();

    service = module.get<GetRocketsService>(GetRocketsService);
    mockEsClient = (service as any).esClient;
  });

  describe('getAllRockets', () => {
    it('should return a paged list of rocketUuid and mission using composite aggregation', async () => {
      const mockEsResponse = {
        aggregations: {
          paged_rockets: {
            after_key: null,
            buckets: [
              {
                key: { rocket_id: 'rocket-111' },
                top_rocket_hit: {
                  hits: {
                    hits: [{ _source: { message: { mission: 'APOLLO' } } }]
                  }
                }
              },
              {
                key: { rocket_id: 'rocket-222' },
                top_rocket_hit: {
                  hits: {
                    hits: [{ _source: { message: { mission: 'ARTEMIS' } } }]
                  }
                }
              }
            ]
          }
        }
      };

      mockEsClient.search.mockResolvedValue(mockEsResponse);

      const result = await service.getAllRockets();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ rocketUuid: 'rocket-111', mission: 'APOLLO' });
      expect(result[1]).toEqual({ rocketUuid: 'rocket-222', mission: 'ARTEMIS' });
    });

    it('should handle pagination correctly if after_key is present', async () => {
      const firstResponse = {
        aggregations: {
          paged_rockets: {
            after_key: { rocket_id: 'rocket-1' },
            buckets: [{
              key: { rocket_id: 'rocket-1' },
              top_rocket_hit: { hits: { hits: [{ _source: { message: { mission: 'MARS' } } }] } }
            }]
          }
        }
      };

      const secondResponse = {
        aggregations: {
          paged_rockets: {
            after_key: null,
            buckets: [{
              key: { rocket_id: 'rocket-2' },
              top_rocket_hit: { hits: { hits: [{ _source: { message: { mission: 'MOON' } } }] } }
            }]
          }
        }
      };

      mockEsClient.search
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      const result = await service.getAllRockets();

      expect(result).toHaveLength(2);
      expect(mockEsClient.search).toHaveBeenCalledTimes(2);
      expect(mockEsClient.search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          aggs: expect.objectContaining({
            paged_rockets: expect.objectContaining({
              composite: expect.objectContaining({
                after: { rocket_id: 'rocket-1' }
              })
            })
          })
        })
      );
    });

    it('should return "Unknown" if mission is missing in the state document', async () => {
      const mockMissingMissionResponse = {
        aggregations: {
          paged_rockets: {
            buckets: [{
              key: { rocket_id: 'rocket-333' },
              top_rocket_hit: { hits: { hits: [{ _source: { message: {} } }] } }
            }]
          }
        }
      };

      mockEsClient.search.mockResolvedValue(mockMissingMissionResponse);

      const result = await service.getAllRockets();

      expect(result[0].mission).toBe('Unknown');
    });

    it('should query the rockets-state index with composite aggregation DSL', async () => {
      mockEsClient.search.mockResolvedValue({
        aggregations: { paged_rockets: { buckets: [] } }
      });

      await service.getAllRockets();

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'rockets-state',
          size: 0,
          aggs: expect.objectContaining({
            paged_rockets: expect.objectContaining({
              composite: expect.any(Object)
            })
          })
        })
      );
    });
  });
});
