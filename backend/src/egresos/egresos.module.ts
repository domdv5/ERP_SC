import { Module } from '@nestjs/common';
import { EgresosService } from './egresos.service';
import { EgresosController } from './egresos.controller';

@Module({
  controllers: [EgresosController],
  providers: [EgresosService],
})
export class EgresosModule {}
