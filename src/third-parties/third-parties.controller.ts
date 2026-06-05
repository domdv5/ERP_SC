import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
  Delete,
  Req,
  Get,
  Query,
} from '@nestjs/common';
import { ThirdPartiesService } from '@/third-parties/third-parties.service';
import {
  CreateThirdPartyDto,
  FindAllThirdPartiesDto,
  UpdateThirdPartyDto,
} from '@/third-parties/dto/index';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('third-parties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ThirdPartiesController {
  constructor(private readonly thirdPartiesService: ThirdPartiesService) {}

  @Get()
  @Permissions('thirdparty.read')
  findAll(@Query() findAllThirdPartiesDto: FindAllThirdPartiesDto) {
    return this.thirdPartiesService.findAll(findAllThirdPartiesDto);
  }

  @Post()
  @Permissions('thirdparty.create')
  create(@Body() createThirdPartyDto: CreateThirdPartyDto) {
    return this.thirdPartiesService.create(createThirdPartyDto);
  }

  @Patch(':id')
  @Permissions('thirdparty.update')
  update(
    @Param('id') id: string,
    @Body() updateThirdPartyDto: UpdateThirdPartyDto,
  ) {
    return this.thirdPartiesService.update(id, updateThirdPartyDto);
  }

  @Delete(':id')
  @Permissions('thirdparty.delete')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.thirdPartiesService.remove(id, req.user.sub);
  }
}
