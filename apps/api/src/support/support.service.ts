import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly http: HttpService) {}

  private controlPanelUrl(): string {
    return (process.env.CONTROL_PANEL_URL ?? 'https://control.xtreampulsar.com').replace(/\/$/, '');
  }

  private licenseKey(): string {
    return process.env.PANEL_LICENSE_KEY ?? '';
  }

  private headers() {
    return { 'X-License-Key': this.licenseKey() };
  }

  private async proxy<T>(fn: () => Promise<{ data: unknown }>): Promise<T> {
    try {
      const res = await fn();
      const body = res.data as Record<string, unknown>;
      return (body.data ?? body) as T;
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown; status?: number }; message?: string };
      this.logger.error('Control panel proxy error', e.response?.data ?? e.message);
      throw new BadGatewayException('Control panel iletişim hatası');
    }
  }

  createTicket(dto: { subject: string; message: string; category?: string; priority?: string }) {
    return this.proxy(() =>
      firstValueFrom(
        this.http.post(`${this.controlPanelUrl()}/api/v1/support/tickets`, dto, {
          headers: this.headers(),
        }),
      ),
    );
  }

  getTickets() {
    return this.proxy(() =>
      firstValueFrom(
        this.http.get(`${this.controlPanelUrl()}/api/v1/support/tickets`, {
          headers: this.headers(),
        }),
      ),
    );
  }

  getTicket(id: string) {
    return this.proxy(() =>
      firstValueFrom(
        this.http.get(`${this.controlPanelUrl()}/api/v1/support/tickets/${id}`, {
          headers: this.headers(),
        }),
      ),
    );
  }

  closeTicket(id: string) {
    return this.proxy(() =>
      firstValueFrom(
        this.http.post(`${this.controlPanelUrl()}/api/v1/support/tickets/${id}/close`, {}, {
          headers: this.headers(),
        }),
      ),
    );
  }
}
