import {Body, Controller, Get, NotFoundException, Param, Post, Query} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody} from '@nestjs/swagger';
import { RocketsService } from './services/rockets.service';
import {RocketDto} from '../../../shared/contracts/rocket.dto'
import {GetRocketsService} from './services/get-rockets.service'
import {RocketSummaryDto} from '../../../shared/contracts/rocket-summary.dto'
import {RocketStateService} from '../../../shared/services/rocket-state.service'
import {RocketStateDto} from '../../../shared/contracts/rocket-state.dto'

@ApiTags('Rockets Dashboard')
@Controller('rockets')
export class RocketsController {
  constructor(private readonly rocketsService: RocketsService,
  private readonly getRocketsService: GetRocketsService,
  private readonly rocketStateService: RocketStateService,
              ) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve all rockets',
    description: 'Returns a list of all rockets in the system with optional sorting.'
  })

  @ApiResponse({ status: 200, type: [RocketSummaryDto], description: 'List of rockets' })
  async getAllRockets(): Promise<RocketSummaryDto[]> {
    return this.getRocketsService.getAllRockets();
  }

  @Get(':rocketUuid')
  @ApiOperation({
    summary: 'Get current rocket state',
    description: 'Returns the most recent state for a specific rocket based on its unique radio rocketUuid.'
  })
  @ApiResponse({ status: 200, type: RocketStateDto, description: 'The current state of the rocket' })
  @ApiResponse({ status: 404, description: 'Rocket not found' })
  async getRocketByRocketUuid(@Param('rocketUuid') rocketUuid: string): Promise<RocketStateDto | null> {
    const state = await this.rocketStateService.getCurrentState(rocketUuid);

    if (!state) {
      throw new NotFoundException(`Rocket with UUID ${rocketUuid} not found`);
    }

    return state;
  }

  @Post('search')
  @ApiOperation({
    summary: 'Search rockets by any property',
    description: 'Provide a JSON object for filtering and an optional sortBy query parameter.'
  })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'metadata.messageTime' })
  @ApiBody({
    schema: {
      type: 'object',
      example: { 'metadata.messageType': 'RocketLaunched', 'message.type': 'Falcon-9' }
    }
  })
  @ApiResponse({ status: 200, type: [RocketDto] })
  async search(
    @Body() criteria: Record<string, any>,
    @Query('sortBy') sortBy?: string
  ): Promise<RocketDto[]> {
    return this.rocketsService.searchByProperty(criteria, sortBy);
  }
}
