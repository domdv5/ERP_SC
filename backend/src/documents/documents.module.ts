import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import {
  CmEffectStrategy,
  CmoEffectStrategy,
  CotEffectStrategy,
  DocumentEffectsRegistry,
  DvcEffectStrategy,
  DvvEffectStrategy,
  EaiEffectStrategy,
  PvEffectStrategy,
  RemEffectStrategy,
  PosEffectStrategy,
  PosoEffectStrategy,
  SajEffectStrategy,
  TransferEffectStrategy,
} from './strategies/index';
import {
  CmPrintStrategy,
  DocumentPrintRegistry,
  DocumentPrintService,
  DvcPrintStrategy,
  PosPrintStrategy,
  CotPrintStrategy,
  RemPrintStrategy,
  DvvPrintStrategy,
  PvPrintStrategy,
  PosoPrintStrategy,
  PdfGeneratorService,
} from './print/index';

@Module({
  // Solo acá (no en AppModule): el rate limit queda scoped a GET /documents/:id/print.
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 6 }]),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    CmEffectStrategy,
    DvcEffectStrategy,
    DvvEffectStrategy,
    EaiEffectStrategy,
    SajEffectStrategy,
    TransferEffectStrategy,
    PvEffectStrategy,
    RemEffectStrategy,
    PosEffectStrategy,
    CotEffectStrategy,
    CmoEffectStrategy,
    PosoEffectStrategy,
    DocumentEffectsRegistry,
    DocumentPrintService,
    PdfGeneratorService,
    DocumentPrintRegistry,
    CmPrintStrategy,
    DvcPrintStrategy,
    PosPrintStrategy,
    CotPrintStrategy,
    RemPrintStrategy,
    DvvPrintStrategy,
    PvPrintStrategy,
    PosoPrintStrategy,
  ],
})
export class DocumentsModule {}
