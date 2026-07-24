import { Controller, Get, Param, Req, Res, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';

const MIME: Record<string, string> = {
  mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo',
  mov: 'video/quicktime', ts: 'video/mp2t', m4v: 'video/x-m4v',
};

/** Watch-folder dosyasını Range destegiyle sunar (id = WatchImport cuid, tahmin edilemez). */
@Controller('watch-media')
export class WatchMediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async serve(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const db = this.prisma as unknown as { watchImport: { findUnique: (a: unknown) => Promise<{ path?: string } | null> } };
    const rec = await db.watchImport.findUnique({ where: { id } });
    const fp = rec?.path;
    if (!fp) throw new NotFoundException('Kayit bulunamadi');
    let stat: fs.Stats;
    try { stat = fs.statSync(fp); } catch { throw new NotFoundException('Dosya diskte yok'); }

    const ext = (fp.split('.').pop() ?? '').toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (start >= stat.size || end >= stat.size) {
        res.status(416).set('Content-Range', `bytes */${stat.size}`).end();
        return;
      }
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': mime,
      });
      fs.createReadStream(fp, { start, end }).pipe(res);
    } else {
      res.status(200).set({ 'Content-Length': String(stat.size), 'Accept-Ranges': 'bytes', 'Content-Type': mime });
      fs.createReadStream(fp).pipe(res);
    }
  }
}
