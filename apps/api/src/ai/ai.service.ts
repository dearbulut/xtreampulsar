import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SuggestCtx {
  title: string;
  message?: string | null;
  type: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Bir destek talebine AI ile yanıt taslağı üretir. AI kapalı/anahtarsızsa 400 döner (uykuda). */
  async suggestReply(ctx: SuggestCtx): Promise<{ reply: string }> {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: {
        aiEnabled: true,
        aiProvider: true,
        aiApiKey: true,
        aiModel: true,
        aiSystemPrompt: true,
        panelName: true,
      },
    });

    if (!s?.aiEnabled || !s.aiApiKey) {
      throw new BadRequestException('AI destek botu yapılandırılmamış (Ayarlar → AI Destek).');
    }

    const system =
      s.aiSystemPrompt?.trim() ||
      `Sen ${s.panelName || 'IPTV paneli'} için nazik bir müşteri destek asistanısın. ` +
        `Aboneden gelen talebe kısa, kibar ve yardımcı bir yanıt TASLAĞI yaz (Türkçe). ` +
        `Kesin taahhütte bulunma; gerekiyorsa ekibin inceleyeceğini belirt.`;

    const userMsg =
      `Talep tipi: ${ctx.type}\n` +
      `Başlık: ${ctx.title}\n` +
      `Mesaj: ${ctx.message || '(yok)'}\n\n` +
      `Aboneye gönderilebilecek bir yanıt taslağı yaz.`;

    const provider = (s.aiProvider || 'anthropic').toLowerCase();

    try {
      const reply =
        provider === 'openai'
          ? await this.callOpenAi(s.aiApiKey, s.aiModel || 'gpt-4o-mini', system, userMsg)
          : await this.callAnthropic(s.aiApiKey, s.aiModel || 'claude-3-5-haiku-latest', system, userMsg);
      const trimmed = reply.trim();
      if (!trimmed) throw new Error('boş yanıt');
      return { reply: trimmed };
    } catch (err) {
      this.logger.error(`AI suggestReply: ${(err as Error).message}`);
      throw new BadRequestException(`AI yanıtı alınamadı: ${(err as Error).message}`);
    }
  }

  private async postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 30000): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      return JSON.parse(text);
    } finally {
      clearTimeout(timer);
    }
  }

  private async callAnthropic(apiKey: string, model: string, system: string, user: string): Promise<string> {
    const data = (await this.postJson(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      { model, max_tokens: 600, system, messages: [{ role: 'user', content: user }] },
    )) as { content?: Array<{ type?: string; text?: string }> };
    return (data.content ?? [])
      .filter((p) => p?.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('\n');
  }

  private async callOpenAi(apiKey: string, model: string, system: string, user: string): Promise<string> {
    const data = (await this.postJson(
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${apiKey}` },
      {
        model,
        max_tokens: 600,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
    )) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}
