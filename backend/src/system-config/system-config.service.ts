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
    // El seed ya crea la fila única, pero se recrea defensivamente aquí por si
    // el seed nunca corrió en este entorno — SystemConfig siempre debe existir
    // para que getStatus() pueda leer del caché en memoria sin golpear la DB.
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

  // Lee el caché en memoria — nunca golpea la DB. El guard global la llama en
  // cada request de escritura, así que debe ser síncrona y barata.
  // Asume un único proceso backend: si se corre con más de una instancia
  // (cluster/réplicas), cada una tendría su propio caché desincronizado y el
  // toggle de solo lectura solo aplicaría en la instancia que lo recibió.
  // No hay despliegue multi-instancia hoy — si eso cambia, esto necesita
  // pub/sub o polling a la DB antes de confiar en el guard.
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
