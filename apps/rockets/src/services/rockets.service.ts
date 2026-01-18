import { Injectable, NotFoundException } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import {RocketDto} from '../../../../shared/contracts/rocket.dto'

@Injectable()
export class RocketsService {
  private readonly esClient: Client;

  constructor() {
    this.esClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
  }

  async getRocketState(rocketUuid: string): Promise<RocketDto> {
    const result = await this.esClient.search({
      index: 'rockets',
      query: { term: { 'metadata.rocketUuid': rocketUuid } },
      sort: [{ 'metadata.messageNumber': 'desc' }],
      size: 1,
    });

    if (result.hits.hits.length === 0) {
      throw new NotFoundException(`Rocket with rocketUuid ${rocketUuid} not found`);
    }

    return result.hits.hits[0]._source as RocketDto;
  }

  async searchByProperty(criteria: Record<string, any>, sortBy?: string): Promise<RocketDto[]> {
    const mustClauses = Object.entries(criteria).map(([field, value]) => ({
      term: { [field]: value }
    }));

    const sort: any[] = [];

    if (sortBy) {
      const sortField = sortBy.includes('message.type') || sortBy.includes('mission')
        ? `${sortBy}.keyword`
        : sortBy;

      sort.push({
        [sortField]: {
          order: 'asc',
          unmapped_type: 'keyword'
        }
      });
    }

    sort.push({ 'metadata.messageNumber': { order: 'desc' } });
    sort.push({ 'metadata.rocketUuid': { order: 'asc' } });

    const result = await this.esClient.search({
      index: 'rockets',
      query: {
        bool: {
          must: mustClauses,
        },
      },
      sort,
      size: 1000,
    });

    return result.hits.hits.map(hit => hit._source as RocketDto);
  }
}
