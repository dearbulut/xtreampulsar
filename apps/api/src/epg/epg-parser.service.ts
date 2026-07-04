import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as https from 'https';
import * as http from 'http';
import { parseString } from 'xml2js';
import { PrismaService } from '../prisma/prisma.service';

// xml2js: <title lang="tr">Metin</title> → { _: 'Metin', $: { lang: 'tr' } }.
// Öznitelik yoksa düz string döner. Her iki durumu da temsil eder.
type XmlTextNode = string | { _?: string; $?: Record<string, string> };

interface XmltvChannel {
  $: { id: string };
  'display-name'?: XmlTextNode[];
  icon?: [{ $: { src: string } }];
}

interface XmltvProgramme {
  $: { start: string; stop: string; channel: string };
  title?: XmlTextNode[];
  desc?: XmlTextNode[];
}

@Injectable()
export class EpgParserService {
  private readonly logger = new Logger(EpgParserService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async parseAllSources(): Promise<void> {
    let sources: Awaited<ReturnType<typeof this.prisma.ePGSource.findMany>>;
    try {
      sources = await this.prisma.ePGSource.findMany({ where: { isActive: true } });
    } catch (err) {
      this.logger.error(`EPG cron: failed to fetch sources — ${(err as Error).message}`);
      return;
    }

    if (!sources.length) return;

    this.logger.log(`EPG parse started — ${sources.length} sources`);

    for (const src of sources) {
      try {
        await this.parseSourceById(src.id); // status + lastParsed'ı yönetir
        this.logger.log(`EPG parsed: ${src.name}`);
      } catch (err) {
        this.logger.error(`EPG parse failed for ${src.name}: ${(err as Error).message}`);
      }
    }
  }

  async parseSourceById(sourceId: string): Promise<void> {
    const src = await this.prisma.ePGSource.findUniqueOrThrow({ where: { id: sourceId } });
    await this.prisma.ePGSource.update({ where: { id: src.id }, data: { status: 'RUNNING', lastError: null } });
    try {
      await this.parseSource(src.id, src.xmltvUrl, src.daysToKeep);
      await this.prisma.ePGSource.update({
        where: { id: src.id },
        data: { lastParsed: new Date(), status: 'SUCCESS', lastError: null },
      });
    } catch (err) {
      await this.prisma.ePGSource
        .update({
          where: { id: src.id },
          data: { status: 'FAILED', lastError: String((err as Error).message).slice(0, 500) },
        })
        .catch(() => { /* status yazımı da başarısızsa yut */ });
      throw err;
    }
  }

  // İndirilen EPG içeriği için üst sınır — büyük XMLTV dump'ları container'ı
  // OOM ile düşürebiliyor. Aşılırsa indirme iptal edilir ve reddedilir.
  private static readonly MAX_EPG_BYTES = 100 * 1024 * 1024; // 100MB

  private fetchXml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode ?? 'unknown'}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let aborted = false;
        res.on('data', (chunk: Buffer) => {
          if (aborted) return;
          size += chunk.length;
          if (size > EpgParserService.MAX_EPG_BYTES) {
            aborted = true;
            req.destroy();
            res.destroy();
            reject(new Error(`EPG dosyası çok büyük (>${Math.round(EpgParserService.MAX_EPG_BYTES / 1024 / 1024)}MB)`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => { if (!aborted) resolve(Buffer.concat(chunks).toString('utf-8')); });
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }

  private parseXml(xml: string): Promise<{ tv: { channel?: XmltvChannel[]; programme?: XmltvProgramme[] } }> {
    if (!xml || !xml.trim()) {
      return Promise.resolve({ tv: { channel: [], programme: [] } });
    }
    return new Promise((resolve) => {
      try {
        parseString(xml, { explicitArray: true, mergeAttrs: false }, (err, result) => {
          if (err) {
            this.logger.error(`XML parse error: ${err.message}`);
            resolve({ tv: { channel: [], programme: [] } });
          } else {
            resolve(result as { tv: { channel?: XmltvChannel[]; programme?: XmltvProgramme[] } });
          }
        });
      } catch (err) {
        this.logger.error(`XML parse exception: ${(err as Error).message}`);
        resolve({ tv: { channel: [], programme: [] } });
      }
    });
  }

  // XMLTV tarih formatı: "YYYYMMDDHHMMSS ±HHMM" (offset opsiyonel).
  // Offset UYGULANIR: duvar-saati bileşenleri UTC alınıp offset çıkarılır.
  //   "20260704120000 +0300" → 12:00 - 3s = 09:00 UTC
  //   "20260704120000 -0500" → 12:00 + 5s = 17:00 UTC
  // Offset yoksa (naif damga) UTC varsayılır (eski davranışla uyumlu).
  // Geçersiz damga → Invalid Date (çağıran tarafta filtrelenir).
  private parseXmltvDate(dateStr: string): Date {
    const m = dateStr
      .trim()
      .match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
    if (!m) return new Date(NaN);
    const [, y, mo, d, h, mi, s, sign, oh, om] = m;
    let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    if (sign) {
      const offsetMin = (+oh * 60 + +om) * (sign === '-' ? -1 : 1);
      ms -= offsetMin * 60_000; // UTC = duvar-saati - offset
    }
    return new Date(ms);
  }

  // xml2js metin düğümünü güvenli STRING'e çevirir. TR EPG kaynakları başlık/
  // açıklama/kanal adını dil-öznitelikli verir (<title lang="tr">…</title> →
  // { _: '…', $: { lang } }); düz string durumunu da karşılar. Aksi halde obje
  // doğrudan String kolonuna yazılıp insert kırılıyordu (programme tablosu boş).
  private xmlText(node: XmlTextNode[] | XmlTextNode | undefined): string {
    const v = Array.isArray(node) ? node[0] : node;
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && typeof v._ === 'string') return v._;
    return '';
  }

  private async parseSource(sourceId: string, xmltvUrl: string, daysToKeep: number): Promise<void> {
    const raw = await this.fetchXml(xmltvUrl);
    const parsed = await this.parseXml(raw);
    // Geçerli XML ama XMLTV olmayan içerik (ör. HTML hata sayfası) → parsed.tv
    // undefined olur; destructure crash'ini önlemek için guard.
    const tv = parsed?.tv ?? {};
    const channels = tv.channel ?? [];
    const programmes = tv.programme ?? [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    for (const ch of channels) {
      const channelId = ch.$.id;
      const displayName = this.xmlText(ch['display-name']) || channelId;
      const icon = ch.icon?.[0]?.$.src;

      await this.prisma.ePGChannel.upsert({
        where: { epgSourceId_channelId: { epgSourceId: sourceId, channelId } },
        create: { epgSourceId: sourceId, channelId, displayName, icon },
        update: { displayName, icon },
      });
    }

    const epgChannelMap = new Map<string, string>();
    const storedChannels = await this.prisma.ePGChannel.findMany({
      where: { epgSourceId: sourceId },
      select: { id: true, channelId: true },
    });
    storedChannels.forEach((c) => epgChannelMap.set(c.channelId, c.id));

    await this.prisma.ePGProgramme.deleteMany({
      where: {
        epgChannel: { epgSourceId: sourceId },
        start: { lt: cutoff },
      },
    });

    const BATCH = 500;
    const toCreate: { epgChannelId: string; start: Date; stop: Date; title: string; description?: string }[] = [];

    let candidates = 0; // filtreleri geçen (yazılmaya aday) programme sayısı
    let written = 0;    // createMany'nin gerçekten yazdığı satır (skipDuplicates hariç)

    const flush = async () => {
      if (toCreate.length === 0) return;
      const res = await this.prisma.ePGProgramme.createMany({ data: toCreate, skipDuplicates: true });
      written += res.count;
      toCreate.length = 0;
    };

    for (const prog of programmes) {
      const epgChannelId = epgChannelMap.get(prog.$.channel);
      if (!epgChannelId) continue;
      const start = this.parseXmltvDate(prog.$.start);
      const stop = this.parseXmltvDate(prog.$.stop);
      if (isNaN(start.getTime()) || isNaN(stop.getTime())) continue; // geçersiz damga
      if (start < cutoff) continue;
      // Dil-öznitelikli obje veya düz string → güvenli STRING.
      const title = this.xmlText(prog.title) || '(no title)';
      const description = this.xmlText(prog.desc) || undefined; // description nullable
      candidates++;
      toCreate.push({ epgChannelId, start, stop, title, description });

      if (toCreate.length >= BATCH) await flush();
    }
    await flush();

    // Şüphe #4: sessiz başarı olmasın. Aday varken tabloda bu kaynağa ait hiç
    // programme kalmadıysa insert kırılmıştır → hata fırlat (status=FAILED olur).
    // (Reparse'ta tüm satırlar duplicate ise written=0 olabilir ama total>0 kalır.)
    if (candidates > 0) {
      const total = await this.prisma.ePGProgramme.count({
        where: { epgChannel: { epgSourceId: sourceId } },
      });
      this.logger.log(
        `EPG parse (${sourceId}): ${channels.length} kanal, ${candidates} aday, ${written} yeni programme yazıldı, toplam ${total}.`,
      );
      if (total === 0) {
        throw new Error(
          `0 programme yazıldı: ${candidates} aday parse edildi ama tabloda bu kaynağa ait programme yok (title/format/eşleşme kontrol et).`,
        );
      }
    } else {
      this.logger.log(
        `EPG parse (${sourceId}): ${channels.length} kanal, 0 aday programme (kaynak boş veya tümü filtrelendi).`,
      );
    }
  }
}
