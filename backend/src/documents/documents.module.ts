import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { AuthModule } from '@/auth/auth.module';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import {
  CmEffectStrategy,
  DocumentEffectsRegistry,
  DvcEffectStrategy,
  EaiEffectStrategy,
  SajEffectStrategy,
  TransferEffectStrategy,
} from './strategies/index';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    PermissionsGuard,
    CmEffectStrategy,
    DvcEffectStrategy,
    EaiEffectStrategy,
    SajEffectStrategy,
    TransferEffectStrategy,
    DocumentEffectsRegistry,
  ],
})
export class DocumentsModule {}
