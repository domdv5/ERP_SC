import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { buildLoggerParams } from '@/common/logger/logger.config';
import { PrismaModule } from '@/prisma/prisma.module';
import { SequenceModule } from '@/common/sequence/sequence.module';
import { AuthModule } from '@/auth/auth.module';
import { ThirdPartiesModule } from './third-parties/third-parties.module';
import { ProductsModule } from './products/products.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { DocumentsModule } from './documents/documents.module';
import { AccountsPayableModule } from '@/accounts-payable/accounts-payable.module';
import { CreditsModule } from '@/credits/credits.module';
import { AccountsReceivableModule } from '@/accounts-receivable/accounts-receivable.module';
import { SupplierPaymentsModule } from '@/supplier-payments/supplier-payments.module';
import { RecibosCajaModule } from '@/recibos-caja/recibos-caja.module';
import { SystemConfigModule } from '@/system-config/system-config.module';
import { OfficialLedgerModule } from '@/official-ledger/official-ledger.module';
import { ReportsModule } from '@/reports/reports.module';
import { InventoryCasesModule } from '@/inventory-cases/inventory-cases.module';
import { LocationsModule } from '@/locations/locations.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ReadOnlyModeGuard } from '@/common/guards/read-only-mode.guard';
import {
  THROTTLER_OPTIONS,
  UserThrottlerGuard,
} from '@/common/guards/user-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildLoggerParams({
          nodeEnv: config.get<string>('NODE_ENV'),
          logLevel: config.get<string>('LOG_LEVEL'),
          logHttpConsole: config.get<string>('LOG_HTTP_CONSOLE'),
        }),
    }),
    ThrottlerModule.forRoot(THROTTLER_OPTIONS),
    AuthModule,
    PrismaModule,
    SequenceModule,
    ThirdPartiesModule,
    ProductsModule,
    WarehousesModule,
    DocumentsModule,
    AccountsPayableModule,
    AccountsReceivableModule,
    SupplierPaymentsModule,
    RecibosCajaModule,
    SystemConfigModule,
    OfficialLedgerModule,
    ReportsModule,
    LocationsModule,
    InventoryCasesModule,
    CreditsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ReadOnlyModeGuard },
    // Último: necesita el req.user que deja JwtAuthGuard para contar por persona
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}
