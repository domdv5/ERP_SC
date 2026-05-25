import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error('DATABASE_URL is not defined');
    }

    const adapter = new PrismaPg(url);

    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('🟢 Connected to PostgreSQL');
  }
}
