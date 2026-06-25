import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import {
  CmEffectStrategy,
  DocumentEffectsRegistry,
  DvcEffectStrategy,
  EaiEffectStrategy,
  SajEffectStrategy,
  TransferEffectStrategy,
} from './strategies/index';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    CmEffectStrategy,
    DvcEffectStrategy,
    EaiEffectStrategy,
    SajEffectStrategy,
    TransferEffectStrategy,
    DocumentEffectsRegistry,
  ],
})
export class DocumentsModule {}
