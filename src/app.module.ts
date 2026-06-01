import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { ThirdPartiesModule } from './third-parties/third-parties.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PrismaModule,
    ThirdPartiesModule,
  ],
})
export class AppModule {}
