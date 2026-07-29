import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';
import { activeConnectionWhere } from '../user/user.repository';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';

@Injectable()
export class ServerService {
  private readonly metricsCache = new Map<string, { at: number; v: unknown }>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bir sunucunun "aktif bağlantı" filtresi.
   *
   * Connection.serverId çoğunlukla NULL'dur: proxy/HLS yolu bağlantıyı
   * oluştururken sunucu bilgisini yazmaz. Bu yüzden sahibi yazılmamış
   * bağlantıları YAYININ bağlı olduğu sunucudan türetiyoruz; hiçbir sunucuya
   * bağlanamayanlar da birincil (ilk MAIN) sunucuya sayılır. Aksi hâlde
   * tek sunuculu kurulumda kart her zaman 0 gösterirdi.
   */
  private connectionWhere(serverId: string, isPrimary: boolean): Prisma.ConnectionWhereInput {
    const or: Prisma.ConnectionWhereInput[] = [
      { serverId },
      { serverId: null, stream: { serverId } },
    ];
    if (isPrimary) or.push({ serverId: null, stream: { serverId: null } });
    return { ...activeConnectionWhere(), OR: or };
  }

  /** apiSecret istemciye HİÇ dönmez; yalnızca "tanımlı mı" bilgisi döner. */
  private mask<T extends { apiSecret?: string | null }>(server: T) {
    const { apiSecret, ...rest } = server;
    return { ...rest, hasSecret: Boolean(apiSecret) };
  }

  async findAll() {
    const servers = await this.prisma.server.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    const primaryId = servers.find((s) => s.role === 'MAIN')?.id ?? servers[0]?.id;
    const counts = await Promise.all(
      servers.map((s) =>
        this.prisma.connection
          .count({ where: this.connectionWhere(s.id, s.id === primaryId) })
          .catch(() => 0),
      ),
    );
    return servers.map((s, i) => ({ ...this.mask(s), currentClients: counts[i] }));
  }

  /** Dahili kullanım — apiSecret dahil ham kayıt. */
  private async findRaw(id: string) {
    const server = await this.prisma.server.findUnique({ where: { id } });
    if (!server) throw new NotFoundException(`Server ${id} not found`);
    return server;
  }

  async findById(id: string) {
    const server = await this.findRaw(id);
    const primary = await this.prisma.server.findFirst({
      where: { role: 'MAIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const currentClients = await this.prisma.connection
      .count({ where: this.connectionWhere(server.id, server.id === primary?.id) })
      .catch(() => 0);
    return { ...this.mask(server), currentClients };
  }

  async create(dto: CreateServerDto) {
    return this.mask(await this.prisma.server.create({ data: dto }));
  }

  /**
   * Sunucu metrik kartı: sistem (cpu/ram/disk/ağ) node'dan secret ile çekilir;
   * bağlantı/limit/ping panelin kendi kayıtlarından. Sistem ulaşılamazsa 0 döner
   * + systemAvailable=false (UI "secret gir/çevrimdışı" ipucu gösterir). Hep obje döner.
   */
  async getServerMetrics(serverId: string): Promise<{
    cpu: number; memory: number; disk: number; rxMbps: number; txMbps: number; uptime: number;
    connections: number; maxClients: number; responseTime: number; isOnline: boolean;
    lastCheckedAt: Date | null; systemAvailable: boolean; systemReason?: string;
  }> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: { ip: true, port: true, isOnline: true, apiSecret: true, maxClients: true, responseTime: true, lastCheckedAt: true },
    });
    const base = {
      cpu: 0, memory: 0, disk: 0, rxMbps: 0, txMbps: 0, uptime: 0,
      connections: 0,
      maxClients: server?.maxClients ?? 0,
      responseTime: server?.responseTime ?? 0,
      isOnline: server?.isOnline ?? false,
      lastCheckedAt: server?.lastCheckedAt ?? null,
      systemAvailable: false as boolean,
      systemReason: undefined as string | undefined,
    };
    if (!server) return { ...base, systemReason: 'not-found' };

    const primary = await this.prisma.server.findFirst({
      where: { role: 'MAIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    base.connections = await this.prisma.connection
      .count({ where: this.connectionWhere(serverId, serverId === primary?.id) })
      .catch(() => 0);

    if (!server.apiSecret) return { ...base, systemReason: 'no-secret' };

    const cached = this.metricsCache.get(serverId);
    if (cached && Date.now() - cached.at < 15_000) {
      const sys = cached.v as { cpu: number; memory: number; disk: number; rxMbps: number; txMbps: number; uptime: number; ok: boolean; reason?: string };
      return { ...base, cpu: sys.cpu, memory: sys.memory, disk: sys.disk, rxMbps: sys.rxMbps, txMbps: sys.txMbps, uptime: sys.uptime, systemAvailable: sys.ok, systemReason: sys.reason };
    }

    let sys = { cpu: 0, memory: 0, disk: 0, rxMbps: 0, txMbps: 0, uptime: 0, ok: false, reason: 'unreachable' as string | undefined };
    try {
      const res = await fetch(`http://${server.ip}:${server.port}/api/v1/node/metrics`, {
        headers: { 'x-node-secret': server.apiSecret },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        sys.reason = res.status === 403 ? 'bad-secret' : 'unreachable';
      } else {
        const body = (await res.json()) as { data?: { cpu?: number; mem?: number; disk?: number; rxMbps?: number; txMbps?: number; uptimeSecs?: number } };
        const d = body?.data ?? {};
        sys = { cpu: d.cpu ?? 0, memory: d.mem ?? 0, disk: d.disk ?? 0, rxMbps: d.rxMbps ?? 0, txMbps: d.txMbps ?? 0, uptime: d.uptimeSecs ?? 0, ok: true, reason: undefined };
      }
    } catch {
      sys.reason = 'unreachable';
    }
    this.metricsCache.set(serverId, { at: Date.now(), v: sys });
    return { ...base, cpu: sys.cpu, memory: sys.memory, disk: sys.disk, rxMbps: sys.rxMbps, txMbps: sys.txMbps, uptime: sys.uptime, systemAvailable: sys.ok, systemReason: sys.reason };
  }
  async update(id: string, dto: UpdateServerDto) {
    await this.findRaw(id);
    return this.mask(await this.prisma.server.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findRaw(id);
    await this.prisma.server.delete({ where: { id } });
  }
}
