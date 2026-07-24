import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const execFileP = promisify(execFile);

export interface YtResolveResult {
  title: string;
  url: string;
  isLive: boolean;
  thumbnail: string;
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async cookiesFile(): Promise<string | null> {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { youtubeCookies: true },
    });
    const cookies = (s?.youtubeCookies ?? '').trim();
    if (!cookies) return null;
    const file = path.join(os.tmpdir(), `yt-cookies-${crypto.randomBytes(6).toString('hex')}.txt`);
    await fs.writeFile(file, cookies, { mode: 0o600 });
    return file;
  }

  /** yt-dlp ile bir YouTube (veya desteklenen) URL'i dogrudan oynatilabilir akisa cozer. */
  async resolve(url: string): Promise<YtResolveResult> {
    if (!/^https?:\/\//i.test(url)) throw new BadRequestException('Geçersiz URL');
    const cookies = await this.cookiesFile();
    const args = [
      '--no-warnings', '--no-playlist', '-f', 'best',
      '--print', '%(title)s\n%(is_live)s\n%(thumbnail)s\n%(urls)s',
    ];
    if (cookies) args.push('--cookies', cookies);
    args.push(url);

    try {
      const { stdout } = await execFileP('yt-dlp', args, { timeout: 45_000, maxBuffer: 1024 * 1024 });
      const lines = stdout.trim().split('\n');
      const title = lines[0]?.trim() || 'YouTube';
      const isLive = (lines[1]?.trim() || '').toLowerCase() === 'true';
      const thumbnail = lines[2]?.trim() || '';
      const mediaUrl = (lines[3]?.trim() || '').split(/\s+/)[0] || '';
      if (!mediaUrl) throw new BadRequestException('Akış URL’i çözülemedi');
      return { title, url: mediaUrl, isLive, thumbnail };
    } catch (err) {
      this.logger.error(`yt-dlp resolve failed: ${(err as Error).message}`);
      throw new BadRequestException('YouTube URL çözülemedi (yt-dlp). Gizli/yaşlı içerik için cookies gerekebilir.');
    } finally {
      if (cookies) await fs.unlink(cookies).catch(() => {});
    }
  }

  /** Cozulen URL'i bir LIVE stream olarak ice aktarir. */
  async importStream(dto: { url: string; categoryId: string; name?: string; streamMode?: string }) {
    const resolved = await this.resolve(dto.url);
    const stream = await this.prisma.stream.create({
      data: {
        name: dto.name?.trim() || resolved.title,
        primaryUrl: resolved.url,
        categoryId: dto.categoryId,
        streamMode: dto.streamMode ?? 'PROXY',
        tvgLogo: resolved.thumbnail || undefined,
      },
      include: { category: true },
    });
    return { stream, resolved };
  }
}
