import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';

interface VerifyResult {
  ok: boolean;
  status?: string;
  expiresAt?: Date | null;
  maxConnections?: number | null;
  error?: string;
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Xtream URL'inden host (scheme+host+port) + username + password ayıklar. */
  parseXtreamUrl(raw: string): { host: string; username?: string; password?: string } {
    const u = new URL(raw.trim());
    return {
      host: `${u.protocol}//${u.host}`,
      username: u.searchParams.get('username') ?? undefined,
      password: u.searchParams.get('password') ?? undefined,
    };
  }

  /** Upstream player_api.php'yi çağırıp auth/durum/expiry/max_connections doğrular. */
  async verifyUpstream(host: string, username?: string, password?: string, userAgent?: string): Promise<VerifyResult> {
    if (!username || !password) return { ok: false, error: 'username/password gerekli' };
    const url = `${host.replace(/\/$/, '')}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url, {
        headers: userAgent ? { 'User-Agent': userAgent } : {},
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = (await res.json()) as {
        user_info?: { auth?: number; status?: string; exp_date?: string | number | null; max_connections?: string | number };
      };
      const info = data?.user_info;
      if (!info || Number(info.auth) !== 1) return { ok: false, error: 'Kimlik doğrulama başarısız (auth != 1)' };
      return {
        ok: true,
        status: info.status ?? 'Active',
        expiresAt: info.exp_date ? new Date(Number(info.exp_date) * 1000) : null,
        maxConnections: info.max_connections != null ? Number(info.max_connections) : null,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async create(dto: CreateProviderDto) {
    let { host, username, password } = dto;
    if (dto.url) {
      const parsed = this.parseXtreamUrl(dto.url);
      host = parsed.host;
      username = username ?? parsed.username;
      password = password ?? parsed.password;
    }
    if (!host) throw new BadRequestException('host veya url gerekli');

    const verify = await this.verifyUpstream(host, username, password, dto.userAgent);
    const name = dto.name?.trim() || new URL(host).host;

    return this.prisma.streamProvider.create({
      data: {
        name,
        type: dto.type ?? 'XTREAM',
        host,
        username: username ?? null,
        password: password ?? null,
        userAgent: dto.userAgent ?? null,
        status: verify.ok ? 'ONLINE' : 'OFFLINE',
        lastCheckedAt: new Date(),
        lastError: verify.ok ? null : (verify.error ?? 'unknown'),
        maxConnections: verify.maxConnections ?? null,
        expiresAt: verify.expiresAt ?? null,
      },
    });
  }

  list() {
    return this.prisma.streamProvider.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.streamProvider.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Sağlayıcı bulunamadı');
    });
  }

  async reverify(id: string) {
    const p = await this.prisma.streamProvider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Sağlayıcı bulunamadı');
    const v = await this.verifyUpstream(p.host, p.username ?? undefined, p.password ?? undefined, p.userAgent ?? undefined);
    return this.prisma.streamProvider.update({
      where: { id },
      data: {
        status: v.ok ? 'ONLINE' : 'OFFLINE',
        lastCheckedAt: new Date(),
        lastError: v.ok ? null : (v.error ?? 'unknown'),
        maxConnections: v.maxConnections ?? p.maxConnections,
        expiresAt: v.expiresAt ?? p.expiresAt,
      },
    });
  }

  /** URL yapıştırıldığında önizleme: host/user/pass parse + doğrulama (kaydetmeden). */
  async preview(url: string) {
    const parsed = this.parseXtreamUrl(url);
    const v = await this.verifyUpstream(parsed.host, parsed.username, parsed.password);
    return { ...parsed, ...v };
  }
}
