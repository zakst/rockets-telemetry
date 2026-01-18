import { ApiProperty } from '@nestjs/swagger';

class RocketMetadataDto {
  @ApiProperty({ description: 'The unique radio ID of the rocket', example: '193270a9-c9cf-404a-8f83-838e71d9ae67' })
  rocketUuid: string;

  @ApiProperty({ description: 'Sequence number of the last processed message', example: 42 })
  messageNumber: number;

  @ApiProperty({ description: 'Original timestamp of the last message from the rocket', example: '2026-01-18T10:42:09Z' })
  messageTime: string;

  @ApiProperty({ description: 'Type of the last message that updated this state', example: 'RocketSpeedIncreased' })
  messageType: string;
}

class RocketMessageContentDto {
  @ApiProperty({ required: false, description: 'Model type of the rocket', example: 'Falcon-9' })
  type?: string;

  @ApiProperty({ required: false, description: 'Current calculated speed of the rocket', example: 3500 })
  launchSpeed?: number;

  @ApiProperty({ required: false, description: 'The current active mission name', example: 'ARTEMIS' })
  mission?: string;

  @ApiProperty({ required: false, description: 'Status indicating if the rocket has exploded', example: false })
  isExploded?: boolean;

  @ApiProperty({ required: false, description: 'If exploded, the reason provided', example: 'PRESSURE_VESSEL_FAILURE' })
  explosionReason?: string;
}

export class RocketStateDto {
  @ApiProperty({ type: RocketMetadataDto })
  metadata: RocketMetadataDto;

  @ApiProperty({ type: RocketMessageContentDto })
  message: RocketMessageContentDto;

  @ApiProperty({
    description: 'Timestamp when this specific state version was persisted to Elasticsearch',
    example: '2026-01-18T11:13:00.000Z'
  })
  receivedAt: string;
}
