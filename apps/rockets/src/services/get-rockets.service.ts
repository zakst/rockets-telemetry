import { Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { RocketSummaryDto } from '../../../../shared/contracts/rocket-summary.dto';

@Injectable()
export class GetRocketsService {
  private readonly esClient: Client;

  constructor() {
    this.esClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
  }

  async getAllRockets(): Promise<RocketSummaryDto[]> {
    let allRockets: RocketSummaryDto[] = [];
    let afterKey: any = null;

    do {
      const result = await this.esClient.search({
        index: 'rockets-state',
        size: 0,
        aggs: {
          paged_rockets: {
            composite: {
              size: 1000,
              sources: [
                { rocket_id: { terms: { field: 'metadata.rocketUuid' } } }
              ],
              ...(afterKey && { after: afterKey })
            },
            aggs: {
              top_rocket_hit: {
                top_hits: {
                  size: 1,
                  _source: {
                    includes: ['metadata.rocketUuid', 'message.mission']
                  }
                }
              }
            }
          }
        }
      });

      const compositeAgg = result.aggregations?.paged_rockets as any;
      const buckets = compositeAgg.buckets;

      const pageResults = buckets.map((bucket: any) => {
        const source = bucket.top_rocket_hit.hits.hits[0]?._source;
        return {
          rocketUuid: bucket.key.rocket_id,
          mission: source?.message?.mission || 'Unknown'
        };
      });

      allRockets = [...allRockets, ...pageResults];
      afterKey = compositeAgg.after_key;

    } while (afterKey);

    return allRockets;
  }
}
