import { Module } from '@nestjs/common';
import { RocketsController } from './rockets.controller';
import {RocketsService} from './services/rockets.service'
import {GetRocketsService} from './services/get-rockets.service'
import {RocketStateService} from '../../../shared/services/rocket-state.service'

@Module({
  imports: [],
  controllers: [RocketsController],
  providers: [RocketsService,GetRocketsService, RocketStateService],
})
export class RocketsModule {}
