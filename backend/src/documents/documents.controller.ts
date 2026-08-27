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
  findAll(@Query() findAllDocumentsDto: FindAllDocumentsDto) {
    return this.documentsService.findAll(findAllDocumentsDto);
  }

  // Antes de @Get(':id') para que "customers" no se interprete como un id.
  // Permiso document.create.COT: quien crea una venta a crédito necesita ver el
  // cupo del cliente, sin ampliar ar.read a roles de venta.
  @Get('customers/:customerId/credit')
  @Permissions('document.create.COT')
  getCustomerCredit(@Param('customerId') customerId: string) {
    return this.documentsService.getCustomerCreditSummary(customerId);
  }

  @Get(':id')
  @Permissions('document.read')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  // create/update/confirm/void/duplicate/remove no llevan @Permissions: el permiso
  // requerido depende del tipo de documento (document.create.{type}), así
  // que se resuelve dinámicamente en el service, no con un guard estático.
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
  confirm(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentsService.confirm(id, req.user);
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

  // @Res({ passthrough: false }) toma control manual de la respuesta: lo que
  // el método retorna nunca se usa para construir el HTTP response, así que
  // ResponseFormatInterceptor nunca llega a envolver el PDF binario en
  // {success, data}. ThrottlerGuard queda scoped solo a esta ruta (ver
  // documents.module.ts) — el resto del controller no tiene rate limiting.
  @Get(':id/print')
  @Permissions('document.read')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async print(@Param('id') id: string, @Res({ passthrough: false }) res: Response) {
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
