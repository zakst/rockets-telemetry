import { Module } from '@nestjs/common';
import { RocketsMessageConsumerService } from './rockets-message-consumer.service';
import {RocketStateService} from '../../../shared/services/rocket-state.service'

@Module({
  imports: [],
  providers: [RocketsMessageConsumerService,
    RocketStateService],
})
export class RocketsMessageConsumerModule {}
