import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';

@Module({
  // AuthModule re-exporta JwtModule (y por lo tanto JwtService), necesario
  // para validar el token manualmente en el endpoint SSE @Public().
  imports: [AuthModule],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
