import { Module } from '@nestjs/common';
import { SequenceModule } from '@/common/sequence/sequence.module';
import { ExcessesController } from './excesses.controller';
import { ExcessesService } from './excesses.service';

@Module({
  imports: [SequenceModule],
  controllers: [ExcessesController],
  providers: [ExcessesService],
})
export class ExcessesModule {}
