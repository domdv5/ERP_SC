import { Module } from '@nestjs/common';
import { RecibosCajaService } from './recibos-caja.service';
import { RecibosCajaController } from './recibos-caja.controller';

@Module({
  controllers: [RecibosCajaController],
  providers: [RecibosCajaService],
})
export class RecibosCajaModule {}
