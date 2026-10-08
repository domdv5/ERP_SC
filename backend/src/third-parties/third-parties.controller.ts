import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Get,
  Query,
} from '@nestjs/common';
import { ThirdPartiesService } from './third-parties.service';
import {
  CreateThirdPartyDto,
  FindAllThirdPartiesDto,
  UpdateThirdPartyDto,
} from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('third-parties')
export class ThirdPartiesController {
  constructor(private readonly thirdPartiesService: ThirdPartiesService) {}

  @Get()
  @Permissions('thirdparty.read')
  findAll(@Query() findAllThirdPartiesDto: FindAllThirdPartiesDto) {
    return this.thirdPartiesService.findAll(findAllThirdPartiesDto);
  }

  @Post()
  @Permissions('thirdparty.create')
  create(
    @Body() createThirdPartyDto: CreateThirdPartyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.thirdPartiesService.create(createThirdPartyDto, req.user);
  }

  @Patch(':id')
  @Permissions('thirdparty.update')
  update(
    @Param('id') id: string,
    @Body() updateThirdPartyDto: UpdateThirdPartyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.thirdPartiesService.update(id, updateThirdPartyDto, req.user);
  }

  @Patch(':id/brands/:brandId')
  @Permissions('thirdparty.update')
  renameBrand(
    @Param('id') id: string,
    @Param('brandId') brandId: string,
    @Body('name') name: string,
    @Req() req: RequestWithUser,
  ) {
    return this.thirdPartiesService.renameBrand(id, brandId, name, req.user);
  }

  @Delete(':id')
  @Permissions('thirdparty.delete')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.thirdPartiesService.remove(id, req.user.sub);
  }

  @Post(':id/reactivate')
  @Permissions('thirdparty.delete')
  reactivate(@Param('id') id: string) {
    return this.thirdPartiesService.reactivate(id);
  }
}
