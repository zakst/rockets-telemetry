import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { MessagesServiceService } from './messages-service.service';
import { RocketMessageDto } from '../../../shared/contracts/message.dto';

@Controller('messages')
export class MessagesServiceController {
  constructor(private readonly messagesService: MessagesServiceService) {}

  @Post()
  @HttpCode(202)
  async receiveMessage(@Body() message: RocketMessageDto) {
    return this.messagesService.queueMessage(message);
  }
}
