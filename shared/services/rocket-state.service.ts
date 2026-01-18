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

  async reconcileState(rocketUuid: string): Promise<RocketStateDto> {
    const messages = await this.getAllMessagesForRocket(rocketUuid);

    const state: RocketStateDto = {
      metadata: {} as any,
      message: { launchSpeed: 0, isExploded: false },
      receivedAt: new Date().toISOString()
    };

    if (messages.length === 0) {
      return state;
    }

    messages.sort((a, b) => a.metadata.messageNumber - b.metadata.messageNumber);

    for (const msg of messages) {
      this.applyMessageToState(state, msg);
    }

    return state;
  }

  private async getAllMessagesForRocket(rocketUuid: string): Promise<RocketMessageDto[]> {
    const response = await this.esClient.search({
      index: 'rockets',
      size: 5000,
      query: {
        term: { 'metadata.rocketUuid': rocketUuid }
      },
      sort: [
        { 'metadata.messageNumber': { order: 'asc' } }
      ]
    });

    return response.hits.hits.map(hit => hit._source as RocketMessageDto);
  }

  private applyMessageToState(state: RocketStateDto, incoming: RocketMessageDto) {
    const { messageType } = incoming.metadata;

    state.metadata = {
      rocketUuid: (incoming.metadata as any).rocketUuid || incoming.metadata.channel,
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
  }
}
