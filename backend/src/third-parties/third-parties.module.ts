import { Module } from '@nestjs/common';
import { ThirdPartiesService } from './third-parties.service';
import { ThirdPartiesController } from './third-parties.controller';

@Module({
  controllers: [ThirdPartiesController],
  providers: [ThirdPartiesService],
})
export class ThirdPartiesModule {}
