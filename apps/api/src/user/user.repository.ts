import { Injectable } from '@nestjs/common';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';

// HLS'te istemci "ayrıldım" demez; aktiflik son aktivite (Connection.updatedAt) ile
// ölçülür. updatedAt her segment/manifest isteğinde (findOrCreateConnection reuse +
// serveHlsSegment heartbeat) tazelenir. Bu süreden eski + endedAt=null bağlantılar
// "hayalet" sayılır ve kapatılır. 90sn: canlı izleyen ~10-30sn'de tazeler, ağ
// dalgalanmasında yanlış düşme yok, hayaleti hızlı temizler.
export const STALE_CONNECTION_MS = 90_000;

// "Aktif bağlantı" TEK tanımı — her yerde (enforcement + tüm UI/dashboard sayaçları)
// bunu kullan; tanım bir daha ayrışmasın. Aktif = kapanmamış (endedAt IS NULL) VE
// son STALE_CONNECTION_MS içinde aktivite (updatedAt taze). Yalnız updatedAt filtresi
// kapanmış (endedAt dolu) kayıtları "aktif" sayardı — panelin şişik sayacının nedeni.
export function activeConnectionWhere(): Prisma.ConnectionWhereInput {
  return { endedAt: null, updatedAt: { gte: new Date(Date.now() - STALE_CONNECTION_MS) } };
}

// Zap (kanal değiştirme) için daha kısa eşik. HLS segment süresi 4sn
// (-hls_time 4); canlı izleyen manifest'i ~4sn'de yeniler → updatedAt tazelenir.
// 15sn (≈3.5 segment) tazelenmemiş = izleyici o stream'den ayrılmış.
export const ZAP_STALE_MS = 15_000;

export interface CreateConnectionData {
  userId: string;
  streamId: string;
  ip: string;
  userAgent?: string;
  serverId?: string;
  token?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // Yalnız GERÇEKTEN aktif (endedAt=null VE son STALE_CONNECTION_MS içinde aktivite)
  // bağlantıları sayar — hayalet kayıtlar maxConnections kotasını bloke etmesin.
  // Hattin AKTIF eszamanli yayin sayisi. maxConnections = ham eszamanlı yayin
  // (Xtream modeli, cihaz ayirt etmez → NAT+ayni-UA bypass edemez). Distinct streamId
  // (ayni yayin cift row olsa da 1 sayilir). excludeStreamId: acilmakta olan yayini
  // sayma (kendi baglantisini yeniden dogrularken self-block olmasin).
  async countActiveConnections(userId: string, excludeStreamId?: string): Promise<number> {
    const rows = await this.prisma.connection.findMany({
      where: {
        userId,
        ...activeConnectionWhere(),
        ...(excludeStreamId ? { streamId: { not: excludeStreamId } } : {}),
      },
      select: { streamId: true },
    });
    return new Set(rows.map((r) => r.streamId)).size;
  }

  async countActiveOtherDevices(userId: string, ip: string, userAgent?: string): Promise<number> {
    const rows = await this.prisma.connection.findMany({
      where: { userId, ...activeConnectionWhere() },
      select: { ip: true, userAgent: true },
    });
    const self = `${ip}|${userAgent ?? ''}`;
    const others = new Set<string>();
    for (const r of rows) {
      const key = `${r.ip}|${r.userAgent ?? ''}`;
      if (key !== self) others.add(key);
    }
    return others.size;
  }

  // Anti-restream: aynı IP'den GERÇEKTEN aktif (endedAt=null + taze) bağlantı sayısı.
  countActiveConnectionsByIp(ip: string): Promise<number> {
    return this.prisma.connection.count({
      where: { ip, ...activeConnectionWhere() },
    });
  }

  // Zap fix: yeni bir stream açılırken, aynı kullanıcının DİĞER stream'lerdeki
  // artık geçerli olmayan açık bağlantılarını kapat. "Geçerli değil" =
  //   (a) aynı cihaz (IP + userAgent) — kanal değiştiren cihazın eski bağlantısı, VEYA
  //   (b) ZAP_STALE_MS'tir tazelenmemiş (ölü).
  // Böylece hızlı zap'te bağlantı birikmez; farklı cihazdan (farklı IP/UA + taze)
  // eşzamanlı izleyen KORUNUR → maxConnections çoklu-cihaz için doğru çalışır.
  closeSupersededConnections(
    userId: string,
    keepStreamId: string,
    ip: string,
    userAgent: string | undefined,
  ): Promise<{ count: number }> {
    // YALNIZ AYNI CIHAZIN (ip+ua) diger-yayin baglantilarini kapat = zapping temizligi.
    // BASKA cihazin baglantisini burada KAPATMA — aksi halde 2. cihaz, 1. cihazin
    // (henuz taze olmayan) baglantisini "bayat" diye kapatip maxConn limitini
    // BYPASS ediyordu. Gercekten bayat/hayalet baglantilar 90sn stale-cron ile temizlenir.
    return this.prisma.connection.updateMany({
      where: {
        userId,
        streamId: { not: keepStreamId },
        endedAt: null,
        ip,
        userAgent: userAgent ?? null,
      },
      data: { endedAt: new Date() },
    });
  }

  // Hayalet bağlantıları kapat (cron). Döner: kapatılan sayısı.
  closeStaleConnections(): Promise<{ count: number }> {
    const cutoff = new Date(Date.now() - STALE_CONNECTION_MS);
    return this.prisma.connection.updateMany({
      where: { endedAt: null, updatedAt: { lt: cutoff } },
      data: { endedAt: new Date() },
    });
  }

  createConnection(data: CreateConnectionData) {
    return this.prisma.connection.create({ data });
  }

  // Aynı user+stream için tek açık (endedAt=null) bağlantı döndürür ya da oluşturur.
  // Her HLS segment/manifest isteğinde yeni satır oluşmasını engeller.
  //
  // YARIŞ KOŞULU KORUMASI: VLC bir stream açarken neredeyse eşzamanlı birden çok
  // istek atar (manifest + segment). Salt "SELECT-sonra-INSERT" bunların hepsinin
  // "açık kayıt yok" görüp ayrı ayrı INSERT etmesine → duplicate bağlantıya yol
  // açardı. Bu yüzden DB'de partial unique index var:
  //   CREATE UNIQUE INDEX ... ON connections(userId, streamId) WHERE endedAt IS NULL
  // (Prisma partial unique index'i schema'da temsil edemediğinden migration-only.)
  // Burada INSERT deneriz; eşzamanlı istek önce oluşturmuşsa index P2002 fırlatır,
  // biz de mevcut kaydı bulup güncelleriz → tek satır garantisi.
  async findOrCreateConnection(data: CreateConnectionData): Promise<{ id: string; token: string | null; isNew: boolean }> {
    // Hızlı yol: çoğu istek zaten açık olan kaydı yeniden kullanır.
    const existing = await this.prisma.connection.findFirst({
      where: { userId: data.userId, streamId: data.streamId, endedAt: null },
      select: { id: true, token: true },
    });
    if (existing) {
      await this.prisma.connection.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
      return { id: existing.id, token: existing.token ?? null, isNew: false };
    }

    try {
      const conn = await this.prisma.connection.create({ data });
      return { id: conn.id, token: conn.token ?? null, isNew: true };
    } catch (err) {
      // P2002 = eşzamanlı istek aynı user+stream için açık bağlantıyı oluşturdu.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.connection.findFirst({
          where: { userId: data.userId, streamId: data.streamId, endedAt: null },
          select: { id: true, token: true },
        });
        if (winner) {
          await this.prisma.connection.update({
            where: { id: winner.id },
            data: { updatedAt: new Date() },
          });
          return { id: winner.id, token: winner.token ?? null, isNew: false };
        }
      }
      throw err;
    }
  }

  async closeConnection(connectionId: string): Promise<void> {
    await this.prisma.connection.update({
      where: { id: connectionId },
      data: { endedAt: new Date() },
    });
  }

  // Heartbeat: açık bağlantının updatedAt'ini tazele → stale-cron (90s) uzun VOD/series
  // proxy'sini ortada kesmez. update hatası (kayıt kapanmış/silinmiş) yutulur.
  async touchConnection(id: string): Promise<void> {
    await this.prisma.connection
      .update({ where: { id }, data: { updatedAt: new Date() } })
      .catch(() => {});
  }

  closeAllUserConnections(userId: string): Promise<{ count: number }> {
    return this.prisma.connection.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }
}
