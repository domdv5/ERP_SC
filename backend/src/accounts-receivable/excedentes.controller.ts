import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';
import { ExcedentesService } from './excedentes.service';
import { CreateExcedenteDto } from './dto/create-excedente.dto';

@Controller('accounts-receivable')
export class ExcedentesController {
  constructor(private readonly excedentesService: ExcedentesService) {}

  @Post('clients/:clientId/excedentes')
  @Permissions('excedente.create')
  create(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() createExcedenteDto: CreateExcedenteDto,
    @Req() req: RequestWithUser,
  ) {
    return this.excedentesService.create(
      clientId,
      createExcedenteDto,
      req.user,
    );
  }

  @Patch('excedentes/:id/void')
  @Permissions('excedente.create')
  void(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.excedentesService.void(id, req.user);
  }
}
