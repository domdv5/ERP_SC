import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { SequenceModule } from '@/common/sequence/sequence.module';
import { AuthModule } from '@/auth/auth.module';
import { ThirdPartiesModule } from './third-parties/third-parties.module';
import { ProductsModule } from './products/products.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { DocumentsModule } from './documents/documents.module';
import { AccountsPayableModule } from '@/accounts-payable/accounts-payable.module';
import { AccountsReceivableModule } from '@/accounts-receivable/accounts-receivable.module';
import { EgresosModule } from '@/egresos/egresos.module';
import { SystemConfigModule } from '@/system-config/system-config.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ReadOnlyModeGuard } from '@/common/guards/read-only-mode.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PrismaModule,
    SequenceModule,
    ThirdPartiesModule,
    ProductsModule,
    WarehousesModule,
    DocumentsModule,
    AccountsPayableModule,
    AccountsReceivableModule,
    EgresosModule,
    SystemConfigModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ReadOnlyModeGuard },
  ],
})
export class AppModule {}
