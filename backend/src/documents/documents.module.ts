import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsQueryService } from './documents-query.service';
import { DocumentConversionService } from './document-conversion.service';
import { DocumentVoidService } from './document-void.service';
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
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentsQueryService,
    DocumentConversionService,
    DocumentVoidService,
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
