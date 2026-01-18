import {RocketMessageType} from '../enums/rocket-message.enum'

export interface MessageMetadata {
  channel: string;
  messageNumber: number;
  messageTime: string; // ISO8601 string
  messageType: RocketMessageType;
}

export interface RocketLaunchedPayload {
  type: string;
  launchSpeed: number;
  mission: string;
}

export interface SpeedChangePayload {
  by: number;
}

export interface RocketExplodedPayload {
  reason: string;
}

export interface MissionChangedPayload {
  newMission: string;
}

export class RocketMessageDto {
  metadata: MessageMetadata;
  message: RocketLaunchedPayload | SpeedChangePayload | RocketExplodedPayload | MissionChangedPayload;
}
