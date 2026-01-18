import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { v4 as uuidv4 } from 'uuid';
import { RocketMessageDto } from '../../../shared/contracts/message.dto';
import { RocketStateService } from '../../../shared/services/rocket-state.service'

@Injectable()
export class RocketsMessageConsumerService {
  private readonly esClient: Client;
  private readonly logger = new Logger(RocketsMessageConsumerService.name);

  constructor(
    private readonly rocketStateService: RocketStateService
  ) {
    this.esClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
    });
  }

  async processMessage(payload: RocketMessageDto): Promise<void> {
    const { channel, messageNumber } = payload.metadata;

    try {
      const response = await this.esClient.search({
        index: 'rockets',
        query: {
          bool: {
            must: [
              { term: { 'metadata.rocketUuid': channel } },
              { term: { 'metadata.messageNumber': messageNumber } },
            ],
          },
        },
      });

      const totalHits = typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value;

      if (totalHits && totalHits > 0) {
        this.logger.log(`Skipping duplicate: Rocket ${channel}, Msg #${messageNumber}`);
        return;
      }
      const transformedPayload = {
        ...payload,
        metadata: {
          ...payload.metadata,
          rocketUuid: channel,
        },
        receivedAt: new Date().toISOString(),
      };

      delete (transformedPayload.metadata as any).channel;

      const documentId = uuidv4();
      await this.esClient.index({
        index: 'rockets',
        id: documentId,
        document: transformedPayload,
        refresh: true // Ensure it's available for immediate reconciliation query
      });

      const nextState = await this.rocketStateService.reconcileState(channel);

      await this.esClient.index({
        index: 'rockets-state',
        id: channel,
        document: nextState,
      });
      this.logger.log(`Stored & Reconciled: Rocket ${channel}, Msg #${messageNumber}`);

    } catch (error) {
      this.logger.error(`Process Failed: ${error.message}`);
      throw error;
    }
  }
}
