import { ApiProperty } from '@nestjs/swagger';

export class RocketSummaryDto {
  @ApiProperty({ example: '193270a9-c9cf-404a-8f83-838e71d9ae67' })
  rocketUuid: string;

  @ApiProperty({ required: false, example: 'ARTEMIS' })
  mission?: string;
}

