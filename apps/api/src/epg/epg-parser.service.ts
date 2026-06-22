import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as https from 'https';
import * as http from 'http';
import { parseString } from 'xml2js';
import { PrismaService } from '../prisma/prisma.service';

interface XmltvChannel {
  $: { id: string };
  'display-name'?: string[];
  icon?: [{ $: { src: string } }];
}

interface XmltvProgramme {
  $: { start: string; stop: string; channel: string };
  title?: string[];
  desc?: string[];
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
        await this.parseSource(src.id, src.xmltvUrl, src.daysToKeep);
        await this.prisma.ePGSource.update({
          where: { id: src.id },
          data: { lastParsed: new Date() },
        });
        this.logger.log(`EPG parsed: ${src.name}`);
      } catch (err) {
        this.logger.error(`EPG parse failed for ${src.name}: ${(err as Error).message}`);
      }
    }
  }

  async parseSourceById(sourceId: string): Promise<void> {
    const src = await this.prisma.ePGSource.findUniqueOrThrow({ where: { id: sourceId } });
    await this.parseSource(src.id, src.xmltvUrl, src.daysToKeep);
    await this.prisma.ePGSource.update({
      where: { id: src.id },
      data: { lastParsed: new Date() },
    });
  }

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
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
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

  private parseXmltvDate(dateStr: string): Date {
    // Format: 20240101120000 +0000
    const clean = dateStr.replace(/\s.*$/, '');
    const year = clean.slice(0, 4);
    const month = clean.slice(4, 6);
    const day = clean.slice(6, 8);
    const hour = clean.slice(8, 10);
    const min = clean.slice(10, 12);
    const sec = clean.slice(12, 14);
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
  }

  private async parseSource(sourceId: string, xmltvUrl: string, daysToKeep: number): Promise<void> {
    const raw = await this.fetchXml(xmltvUrl);
    const parsed = await this.parseXml(raw);
    const { channel: channels = [], programme: programmes = [] } = parsed.tv;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    for (const ch of channels) {
      const channelId = ch.$.id;
      const displayName = ch['display-name']?.[0] ?? channelId;
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

    for (const prog of programmes) {
      const epgChannelId = epgChannelMap.get(prog.$.channel);
      if (!epgChannelId) continue;
      const start = this.parseXmltvDate(prog.$.start);
      const stop = this.parseXmltvDate(prog.$.stop);
      if (start < cutoff) continue;
      const title = prog.title?.[0] ?? '(no title)';
      const description = prog.desc?.[0];
      toCreate.push({ epgChannelId, start, stop, title, description });

      if (toCreate.length >= BATCH) {
        await this.prisma.ePGProgramme.createMany({ data: toCreate, skipDuplicates: true });
        toCreate.length = 0;
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.ePGProgramme.createMany({ data: toCreate, skipDuplicates: true });
    }
  }
}
