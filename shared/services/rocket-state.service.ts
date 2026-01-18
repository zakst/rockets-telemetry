import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { RocketStateDto } from '../contracts/rocket-state.dto';
import {
  RocketMessageDto,
  RocketLaunchedPayload,
  SpeedChangePayload,
  RocketExplodedPayload,
  MissionChangedPayload
} from '../contracts/message.dto';

@Injectable()
export class RocketStateService {
  private readonly logger = new Logger(RocketStateService.name);
  private readonly esClient: Client;

  constructor() {
    this.esClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
  }

  async getCurrentState(rocketUuid: string): Promise<RocketStateDto | null> {
    try {
      const result = await this.esClient.get({
        index: 'rockets-state',
        id: rocketUuid,
      });
      return result._source as RocketStateDto;
    } catch (error) {
      if (error.meta?.statusCode === 404) return null;
      throw error;
    }
  }

  calculateNewState(current: RocketStateDto | null, incoming: RocketMessageDto): RocketStateDto {
    if (current && incoming.metadata.messageNumber <= current.metadata.messageNumber) {
      this.logger.warn(`Out-of-order message received for ${incoming.metadata.channel}. Skipping.`);
      return current;
    }

    const state: RocketStateDto = current ? JSON.parse(JSON.stringify(current)) : {
      metadata: {} as any,
      message: { launchSpeed: 0, isExploded: false },
      receivedAt: new Date().toISOString()
    };

    const { messageType } = incoming.metadata;

    state.metadata = {
      rocketUuid: incoming.metadata.channel,
      messageNumber: incoming.metadata.messageNumber,
      messageTime: incoming.metadata.messageTime,
      messageType: incoming.metadata.messageType,
    };

    switch (messageType) {
      case 'RocketLaunched': {
        const payload = incoming.message as RocketLaunchedPayload;
        state.message.type = payload.type;
        state.message.launchSpeed = payload.launchSpeed;
        state.message.mission = payload.mission;
        break;
      }

      case 'RocketSpeedIncreased': {
        const payload = incoming.message as SpeedChangePayload;
        state.message.launchSpeed = (state.message.launchSpeed || 0) + payload.by;
        break;
      }

      case 'RocketSpeedDecreased': {
        const payload = incoming.message as SpeedChangePayload;
        state.message.launchSpeed = (state.message.launchSpeed || 0) - payload.by;
        break;
      }

      case 'RocketMissionChanged': {
        const payload = incoming.message as MissionChangedPayload;
        state.message.mission = payload.newMission;
        break;
      }

      case 'RocketExploded': {
        const payload = incoming.message as RocketExplodedPayload;
        state.message.isExploded = true;
        state.message.explosionReason = payload.reason;
        break;
      }
    }

    return state;
  }
}
