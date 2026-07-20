import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BASE = 'https://api.opensubtitles.com/api/v1';
const UA = 'XtreamPulsar v1.0';

interface SubtitleResult {
  fileId: number | null;
  language: string;
  release: string;
  downloads: number;
  fps: number | null;
  hearingImpaired: boolean;
}

@Injectable()
export class SubtitleService {
  private readonly logger = new Logger(SubtitleService.name);
  private token: { jwt: string; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async cfg() {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { subtitleEnabled: true, subtitleApiKey: true, subtitleUsername: true, subtitlePassword: true },
    });
    return {
      enabled: s?.subtitleEnabled ?? false,
      apiKey: s?.subtitleApiKey ?? '',
      username: s?.subtitleUsername ?? '',
      password: s?.subtitlePassword ?? '',
    };
  }

  async getConfig() {
    const c = await this.cfg();
    // Şifreyi geri gönderme; yalnız ayarlı olup olmadığını bildir.
    return { enabled: c.enabled, apiKey: c.apiKey, username: c.username, passwordSet: !!c.password };
  }

  async updateConfig(dto: { enabled?: boolean; apiKey?: string; username?: string; password?: string }) {
    const data: { subtitleEnabled?: boolean; subtitleApiKey?: string; subtitleUsername?: string; subtitlePassword?: string } = {};
    if (dto.enabled !== undefined) data.subtitleEnabled = Boolean(dto.enabled);
    if (dto.apiKey !== undefined) data.subtitleApiKey = String(dto.apiKey).trim();
    if (dto.username !== undefined) data.subtitleUsername = String(dto.username).trim();
    if (dto.password !== undefined && dto.password !== '') data.subtitlePassword = String(dto.password);
    await this.prisma.settings.update({ where: { id: 'singleton' }, data });
    this.token = null; // yapılandırma değişti → token'ı sıfırla
    return this.getConfig();
  }

  private headers(apiKey: string, withAuth?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
      'User-Agent': UA,
      ...(withAuth ? { Authorization: `Bearer ${withAuth}` } : {}),
    };
  }

  private async getToken(c: { apiKey: string; username: string; password: string }): Promise<string | null> {
    if (this.token && Date.now() - this.token.at < 23 * 3_600_000) return this.token.jwt;
    if (!c.username || !c.password) return null;
    try {
      const res = await fetch(`${BASE}/login`, {
        method: 'POST',
        headers: this.headers(c.apiKey),
        body: JSON.stringify({ username: c.username, password: c.password }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { token?: string };
      if (!data.token) return null;
      this.token = { jwt: data.token, at: Date.now() };
      return data.token;
    } catch (err) {
      this.logger.error(`OpenSubtitles login: ${(err as Error).message}`);
      return null;
    }
  }

  async search(query: string, languages: string): Promise<SubtitleResult[]> {
    const c = await this.cfg();
    if (!c.enabled || !c.apiKey) throw new BadRequestException('Altyazı sağlayıcı yapılandırılmamış (Ayarlar → Altyazı).');
    const q = (query ?? '').trim();
    if (!q) throw new BadRequestException('Arama terimi girin');
    const langs = (languages ?? 'en').trim() || 'en';
    const url = `${BASE}/subtitles?query=${encodeURIComponent(q)}&languages=${encodeURIComponent(langs)}`;
    try {
      const res = await fetch(url, { headers: this.headers(c.apiKey), signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        data?: Array<{ attributes?: { language?: string; release?: string; download_count?: number; fps?: number; hearing_impaired?: boolean; files?: Array<{ file_id?: number }> } }>;
      };
      return (json.data ?? []).slice(0, 40).map((d) => {
        const a = d.attributes ?? {};
        return {
          fileId: a.files?.[0]?.file_id ?? null,
          language: a.language ?? '',
          release: a.release ?? '',
          downloads: a.download_count ?? 0,
          fps: a.fps ?? null,
          hearingImpaired: Boolean(a.hearing_impaired),
        };
      });
    } catch (err) {
      this.logger.error(`OpenSubtitles search: ${(err as Error).message}`);
      throw new BadRequestException(`Altyazı araması başarısız: ${(err as Error).message}`);
    }
  }

  /** file_id → gerçek altyazı metnini (srt) döndürür. İndirme için login gerekir. */
  async download(fileId: number): Promise<{ filename: string; content: string }> {
    const c = await this.cfg();
    if (!c.enabled || !c.apiKey) throw new BadRequestException('Altyazı sağlayıcı yapılandırılmamış.');
    if (!fileId) throw new BadRequestException('Geçersiz dosya');
    const token = await this.getToken(c);
    try {
      const res = await fetch(`${BASE}/download`, {
        method: 'POST',
        headers: this.headers(c.apiKey, token ?? undefined),
        body: JSON.stringify({ file_id: fileId }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      }
      const data = (await res.json()) as { link?: string; file_name?: string };
      if (!data.link) throw new Error('İndirme bağlantısı alınamadı (login gerekebilir)');
      const srtRes = await fetch(data.link, { signal: AbortSignal.timeout(15_000) });
      if (!srtRes.ok) throw new Error(`Altyazı indirilemedi: HTTP ${srtRes.status}`);
      const content = await srtRes.text();
      return { filename: data.file_name || `subtitle-${fileId}.srt`, content };
    } catch (err) {
      this.logger.error(`OpenSubtitles download: ${(err as Error).message}`);
      throw new BadRequestException(`İndirme başarısız: ${(err as Error).message}`);
    }
  }
}
