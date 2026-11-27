import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';
import { ExcessesService } from './excesses.service';
import { CreateExcessDto, FindAllExcessesDto, VoidExcessDto } from './dto';

@Controller('excesses')
@Permissions('excedente.create')
export class ExcessesController {
  constructor(private readonly excessesService: ExcessesService) {}

  @Get()
  findAll(@Query() findAllExcessesDto: FindAllExcessesDto) {
    return this.excessesService.findAll(findAllExcessesDto);
  }

  @Post()
  create(
    @Body() createExcessDto: CreateExcessDto,
    @Req() req: RequestWithUser,
  ) {
    return this.excessesService.create(createExcessDto, req.user);
  }

  @Post('customers/:id/void')
  voidCustomerExcess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() voidExcessDto: VoidExcessDto,
    @Req() req: RequestWithUser,
  ) {
    return this.excessesService.void('customer', id, voidExcessDto, req.user);
  }

  @Post('suppliers/:id/void')
  voidSupplierExcess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() voidExcessDto: VoidExcessDto,
    @Req() req: RequestWithUser,
  ) {
    return this.excessesService.void('supplier', id, voidExcessDto, req.user);
  }
}
