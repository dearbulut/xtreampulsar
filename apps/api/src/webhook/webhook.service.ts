import { createHmac } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  listWebhooks() {
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createWebhook(dto: { name: string; url: string; secret?: string; events: string[] }) {
    return this.prisma.webhook.create({ data: dto });
  }

  async updateWebhook(id: string, dto: Partial<{ name: string; url: string; secret: string | null; events: string[]; isActive: boolean }>) {
    await this.assertExists(id);
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.webhook.delete({ where: { id } });
  }

  async triggerWebhook(event: string, data: Record<string, unknown>): Promise<void> {
    const hooks = await this.prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
    });
    if (!hooks.length) return;

    const body: WebhookPayload = { event, timestamp: new Date().toISOString(), data };
    const bodyStr = JSON.stringify(body);

    await Promise.allSettled(
      hooks.map((hook) => this.deliverOne(hook, bodyStr, body)),
    );
  }

  async testWebhook(id: string): Promise<{ status: number | null; ok: boolean; error?: string }> {
    const hook = await this.assertExists(id);
    const body: WebhookPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Bu bir test isteğidir.' },
    };
    const bodyStr = JSON.stringify(body);
    try {
      const res = await this.sendRequest(hook.url, hook.secret ?? null, bodyStr);
      return { status: res.status, ok: res.ok };
    } catch (err) {
      return { status: null, ok: false, error: (err as Error).message };
    }
  }

  private async deliverOne(
    hook: { id: string; url: string; secret: string | null },
    bodyStr: string,
    body: WebhookPayload,
  ): Promise<void> {
    let status: number | null = null;
    try {
      const res = await this.sendRequest(hook.url, hook.secret, bodyStr);
      status = res.status;
    } catch (err) {
      this.logger.warn(`Webhook ${hook.id} delivery failed: ${(err as Error).message}`);
    }

    await this.prisma.webhook.update({
      where: { id: hook.id },
      data: { lastTriggered: new Date(), lastStatus: status },
    }).catch(() => {});

    this.logger.log(`Webhook ${hook.id} → ${body.event} status=${status ?? 'error'}`);
  }

  private sendRequest(url: string, secret: string | null, bodyStr: string): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      const sig = createHmac('sha256', secret).update(bodyStr).digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${sig}`;
    }
    return fetch(url, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(5000),
    });
  }

  private async assertExists(id: string) {
    const hook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!hook) throw new NotFoundException(`Webhook ${id} not found`);
    return hook;
  }
}
