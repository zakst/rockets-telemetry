import { ApiProperty } from '@nestjs/swagger';

class RocketMetadataDto {
  @ApiProperty({ example: '193270a9-c9cf-404a-8f83-838e71d9ae67' })
  rocketUuid: string;

  @ApiProperty({ example: 1 })
  messageNumber: number;

  @ApiProperty({ example: '2026-01-17T10:42:09Z' })
  messageTime: string;

  @ApiProperty({ example: 'RocketLaunched' })
  messageType: string;
}

class RocketMessageContentDto {
  @ApiProperty({ required: false, example: 'Falcon-9' })
  type?: string;

  @ApiProperty({ required: false, example: 500 })
  launchSpeed?: number;

  @ApiProperty({ required: false, example: 'ARTEMIS' })
  mission?: string;

  @ApiProperty({ required: false, example: 3000 })
  by?: number;

  @ApiProperty({ required: false, example: 'PRESSURE_VESSEL_FAILURE' })
  reason?: string;

  @ApiProperty({ required: false, example: 'SHUTTLE_MIR' })
  newMission?: string;
}

export class RocketDto {
  @ApiProperty({ type: RocketMetadataDto })
  metadata: RocketMetadataDto;

  @ApiProperty({ type: RocketMessageContentDto })
  message: RocketMessageContentDto;

  @ApiProperty({ description: 'Timestamp when the message was indexed', example: '2026-01-17T08:55:50.462Z' })
  receivedAt: string;
}
