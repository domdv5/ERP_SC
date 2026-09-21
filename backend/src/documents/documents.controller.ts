import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { DocumentPrintService } from './print/index';
import {
  ConfirmDocumentDto,
  ConvertDocumentDto,
  CreateDocumentDto,
  FindAllDocumentsDto,
  ReleaseItemsDto,
  UpdateDocumentDto,
} from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentPrintService: DocumentPrintService,
  ) {}

  @Get()
  @Permissions('document.read')
  findAll(
    @Query() findAllDocumentsDto: FindAllDocumentsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.findAll(findAllDocumentsDto, req.user);
  }

  // Antes de @Get(':id') para que "customers" no se interprete como un id.
  @Get('customers/:customerId/credit')
  @Permissions('document.create.COT')
  getCustomerCredit(@Param('customerId') customerId: string) {
    return this.documentsService.getCustomerCreditSummary(customerId);
  }

  // No confundir con customers/:customerId/credit (cupo de crédito).
  @Get('customers/:customerId/available-credits')
  @Permissions('document.create.POS')
  getAvailableCustomerCredits(@Param('customerId') customerId: string) {
    return this.documentsService.listAvailableCustomerCredits(customerId);
  }

  @Get(':id')
  @Permissions('document.read')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  // Sin @Permissions: el permiso depende del tipo de documento y se resuelve en el service.
  @Post()
  create(
    @Body() createDocumentDto: CreateDocumentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.create(createDocumentDto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.update(id, updateDocumentDto, req.user);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Body() confirmDocumentDto: ConfirmDocumentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.confirm(id, confirmDocumentDto, req.user);
  }

  @Post(':id/void')
  void(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentsService.void(id, req.user);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentsService.duplicate(id, req.user);
  }

  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body() convertDocumentDto: ConvertDocumentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.convert(id, convertDocumentDto, req.user);
  }

  // passthrough: false evita que ResponseFormatInterceptor envuelva el PDF binario en {success, data}.
  @Get(':id/print')
  @Permissions('document.read')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async print(
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { buffer, filename } = await this.documentPrintService.print(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }

  // Igual que create/update/confirm/void: el permiso (document.release.{type})
  // se resuelve dinámicamente en el service según el tipo del documento.
  @Post(':id/release-items')
  releaseItems(
    @Param('id') id: string,
    @Body() releaseItemsDto: ReleaseItemsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.releaseItems(id, releaseItemsDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentsService.remove(id, req.user);
  }
}
