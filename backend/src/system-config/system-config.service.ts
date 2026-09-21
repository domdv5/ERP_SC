import { Injectable, OnModuleInit } from '@nestjs/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { PrismaService } from '@/prisma/prisma.service';

export interface SystemStatus {
  readOnlyMode: boolean;
  activatedAt: Date | null;
  activatedBy: { id: string; name: string } | null;
}

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private statusSubject!: BehaviorSubject<SystemStatus>;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Se recrea defensivamente por si el seed nunca corrió: SystemConfig siempre debe existir.
    let config = await this.prisma.systemConfig.findFirst({
      include: { activatedBy: { select: { id: true, name: true } } },
    });

    if (!config) {
      config = await this.prisma.systemConfig.create({
        data: {},
        include: { activatedBy: { select: { id: true, name: true } } },
      });
    }

    this.statusSubject = new BehaviorSubject<SystemStatus>(
      this.toStatus(config),
    );
  }

  private toStatus(config: {
    readOnlyMode: boolean;
    activatedAt: Date | null;
    activatedBy: { id: string; name: string } | null;
  }): SystemStatus {
    return {
      readOnlyMode: config.readOnlyMode,
      activatedAt: config.activatedAt,
      activatedBy: config.activatedBy,
    };
  }

  // Caché en memoria, síncrono y barato (el guard lo llama en cada write). Asume un único proceso — sin pub/sub, no sirve en cluster/réplicas.
  getStatus(): SystemStatus {
    return this.statusSubject.getValue();
  }

  get statusChanges$(): Observable<SystemStatus> {
    return this.statusSubject.asObservable();
  }

  async setReadOnlyMode(
    active: boolean,
    userId: string,
  ): Promise<SystemStatus> {
    const current = await this.prisma.systemConfig.findFirstOrThrow();

    const data = active
      ? {
          readOnlyMode: true,
          activatedById: userId,
          activatedAt: new Date(),
        }
      : {
          readOnlyMode: false,
          deactivatedById: userId,
          deactivatedAt: new Date(),
        };

    const updated = await this.prisma.systemConfig.update({
      where: { id: current.id },
      data,
      include: { activatedBy: { select: { id: true, name: true } } },
    });

    const status = this.toStatus(updated);
    this.statusSubject.next(status);
    return status;
  }
}
