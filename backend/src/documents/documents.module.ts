import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import {
  CmEffectStrategy,
  DocumentEffectsRegistry,
  DvcEffectStrategy,
  EaiEffectStrategy,
  PvEffectStrategy,
  SajEffectStrategy,
  TransferEffectStrategy,
} from './strategies/index';
import {
  CmPrintStrategy,
  DocumentPrintRegistry,
  DocumentPrintService,
  DvcPrintStrategy,
  PdfGeneratorService,
} from './print/index';

@Module({
  // ThrottlerModule solo se importa acá (no en AppModule): el rate limit
  // debe quedar scoped únicamente a GET /documents/:id/print, sin afectar
  // el resto de la API.
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 6 }]),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    CmEffectStrategy,
    DvcEffectStrategy,
    EaiEffectStrategy,
    SajEffectStrategy,
    TransferEffectStrategy,
    PvEffectStrategy,
    DocumentEffectsRegistry,
    DocumentPrintService,
    PdfGeneratorService,
    DocumentPrintRegistry,
    CmPrintStrategy,
    DvcPrintStrategy,
  ],
})
export class DocumentsModule {}
