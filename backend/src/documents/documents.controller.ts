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
  UseGuards,
} from '@nestjs/common';
import { DocumentsService } from '@/documents/documents.service';
import {
  CreateDocumentDto,
  FindAllDocumentsDto,
  UpdateDocumentDto,
} from '@/documents/dto/index';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Permissions('document.read')
  findAll(@Query() findAllDocumentsDto: FindAllDocumentsDto) {
    return this.documentsService.findAll(findAllDocumentsDto);
  }

  @Get(':id')
  @Permissions('document.read')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

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

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentsService.remove(id, req.user);
  }
}
