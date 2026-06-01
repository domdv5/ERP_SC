import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ThirdPartiesService } from './third-parties.service';
import { CreateThirdPartyDto } from './dto/create-third-party.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';

@Controller('third-parties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ThirdPartiesController {
  constructor(private readonly thirdPartiesService: ThirdPartiesService) {}

  @Post()
  @Permissions('thirdparty.create')
  create(@Body() createThirdPartyDto: CreateThirdPartyDto) {
    return this.thirdPartiesService.create(createThirdPartyDto);
  }
}
