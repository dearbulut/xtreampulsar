import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping email');
      return false;
    }

    let status: 'SENT' | 'FAILED' = 'SENT';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'XtreamPulsar <noreply@xtreampulsar.io>',
          to: [to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        status = 'FAILED';
        this.logger.error(`Email failed: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      status = 'FAILED';
      this.logger.error(`Email error: ${(err as Error).message}`);
    }

    await this.prisma.notificationLog.create({
      data: { type: 'SYSTEM', recipient: to, subject, status },
    });

    return status === 'SENT';
  }

  async sendDiscordAlert(title: string, message: string, color = 15158332): Promise<boolean> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.discordAlerts || !settings.discordWebhookUrl) return false;

    try {
      const res = await fetch(settings.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title,
              description: message,
              color,
              timestamp: new Date().toISOString(),
              footer: { text: 'XtreamPulsar' },
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      this.logger.error(`Discord alert error: ${(err as Error).message}`);
      return false;
    }
  }

  async sendTelegramAlert(message: string): Promise<boolean> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.telegramAlerts || !settings.telegramBotToken || !settings.telegramChatId) return false;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: message,
            parse_mode: 'HTML',
          }),
          signal: AbortSignal.timeout(5000),
        },
      );
      return res.ok;
    } catch (err) {
      this.logger.error(`Telegram alert error: ${(err as Error).message}`);
      return false;
    }
  }

  async notifyStreamDown(streamId: string, streamName: string): Promise<void> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const subject = `[XtreamPulsar] Stream Çevrimdışı: ${streamName}`;
    const html = `
      <h2>Stream Çevrimdışı</h2>
      <p><strong>${streamName}</strong> (ID: <code>${streamId}</code>) yeniden başlatılamadı ve çevrimdışı oldu.</p>
      <p>Panel üzerinden kontrol edin.</p>
    `;

    try {
      if (settings?.streamDownAlert && settings.adminEmail) {
        const sent = await this.sendEmail(settings.adminEmail, subject, html);
        await this.prisma.notificationLog.create({
          data: {
            type: 'STREAM_DOWN',
            recipient: settings.adminEmail,
            subject,
            status: sent ? 'SENT' : 'FAILED',
          },
        });
      }

      await this.sendDiscordAlert(
        '🔴 Stream Çevrimdışı',
        `**${streamName}** yeniden başlatılamadı ve çevrimdışı oldu.\nID: \`${streamId}\``,
        15158332,
      );

      await this.sendTelegramAlert(
        `🔴 <b>Stream Çevrimdışı</b>\n<b>${streamName}</b> yeniden başlatılamadı ve çevrimdışı oldu.\nID: <code>${streamId}</code>`,
      );
    } catch (err) {
      this.logger.error(`notifyStreamDown error: ${(err as Error).message}`);
    }
  }

  async notifyUserExpiring(
    userId: string,
    username: string,
    daysLeft: number,
    resellerEmail: string,
  ): Promise<void> {
    const subject = `[XtreamPulsar] Kullanıcı Süresi Dolmak Üzere: ${username}`;
    const html = `
      <h2>Kullanıcı Süresi Dolmak Üzere</h2>
      <p><strong>${username}</strong> (ID: <code>${userId}</code>) kullanıcısının aboneliği
      <strong>${daysLeft} gün</strong> içinde sona erecek.</p>
      <p>Yenileme işlemi için panel'i ziyaret edin.</p>
    `;

    try {
      await this.sendEmail(resellerEmail, subject, html);
      await this.prisma.notificationLog.create({
        data: {
          type: 'USER_EXPIRING',
          recipient: resellerEmail,
          subject,
          status: 'SENT',
        },
      });
    } catch (err) {
      this.logger.error(`notifyUserExpiring error: ${(err as Error).message}`);
    }
  }

  async testEmail(): Promise<{ sent: boolean; adminEmail: string | null }> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const adminEmail = settings?.adminEmail ?? null;
    if (!adminEmail) return { sent: false, adminEmail: null };

    const sent = await this.sendEmail(
      adminEmail,
      '[XtreamPulsar] Test Bildirimi',
      '<h2>Bu bir test bildirimidir.</h2><p>XtreamPulsar bildirim sistemi çalışıyor.</p>',
    );
    return { sent, adminEmail };
  }

  async testDiscord(): Promise<{ sent: boolean }> {
    const sent = await this.sendDiscordAlert(
      '✅ Test Bildirimi',
      'XtreamPulsar Discord entegrasyonu başarıyla çalışıyor.',
      3066993,
    );
    return { sent };
  }

  async testTelegram(): Promise<{ sent: boolean }> {
    const sent = await this.sendTelegramAlert(
      '✅ <b>Test Bildirimi</b>\nXtreamPulsar Telegram entegrasyonu başarıyla çalışıyor.',
    );
    return { sent };
  }

  @Cron('0 9 * * *')
  async checkExpiringUsers(): Promise<void> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.resellerNotifyExpiry) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 3);

    const expiringUsers = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: cutoff, gte: new Date() },
        resellerId: { not: null },
      },
      include: { reseller: true },
    });

    const byReseller = new Map<string, { email: string; users: typeof expiringUsers }>();
    for (const user of expiringUsers) {
      if (!user.reseller?.email) continue;
      const key = user.resellerId!;
      if (!byReseller.has(key)) {
        byReseller.set(key, { email: user.reseller.email, users: [] });
      }
      byReseller.get(key)!.users.push(user);
    }

    for (const { email, users } of byReseller.values()) {
      for (const user of users) {
        const daysLeft = Math.ceil(
          (new Date(user.expiresAt).getTime() - Date.now()) / 86_400_000,
        );
        await this.notifyUserExpiring(user.id, user.username, daysLeft, email);
      }
    }

    this.logger.log(`Checked ${expiringUsers.length} expiring user(s)`);
  }

  async getLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.notificationLog.count(),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getUnreadCount(): Promise<{ count: number }> {
    const count = await this.prisma.notificationLog.count({ where: { isRead: false } });
    return { count };
  }

  async markRead(id: string): Promise<{ success: boolean }> {
    await this.prisma.notificationLog.update({ where: { id }, data: { isRead: true } });
    return { success: true };
  }

  async markAllRead(): Promise<{ updated: number }> {
    const result = await this.prisma.notificationLog.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}
