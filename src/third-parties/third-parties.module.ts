import { Module } from '@nestjs/common';
import { ThirdPartiesService } from './third-parties.service';
import { ThirdPartiesController } from './third-parties.controller';
import { AuthModule } from '@/auth/auth.module';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@Module({
  imports: [AuthModule],
  controllers: [ThirdPartiesController],
  providers: [ThirdPartiesService, PermissionsGuard],
})
export class ThirdPartiesModule {}
