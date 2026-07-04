import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly http: HttpService) {}

  private internalApiUrl(): string {
    const port = process.env.PORT ?? '3000';
    return (process.env.INTERNAL_API_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
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
      this.logger.error('Support proxy error', e.response?.data ?? e.message);
      throw new BadGatewayException('Destek servisi geçici olarak kullanılamıyor');
    }
  }

  createTicket(dto: { subject: string; message: string; category?: string; priority?: string }) {
    return this.proxy(() =>
      firstValueFrom(
        this.http.post(`${this.internalApiUrl()}/api/v1/control/support/tickets`, dto, {
          headers: this.headers(),
        }),
      ),
    );
  }

  getTickets() {
    return this.proxy(() =>
      firstValueFrom(
        this.http.get(`${this.internalApiUrl()}/api/v1/control/support/tickets`, {
          headers: this.headers(),
        }),
      ),
    );
  }

  getTicket(id: string) {
    return this.proxy(() =>
      firstValueFrom(
        this.http.get(`${this.internalApiUrl()}/api/v1/control/support/tickets/${id}`, {
          headers: this.headers(),
        }),
      ),
    );
  }

  closeTicket(id: string) {
    return this.proxy(() =>
      firstValueFrom(
        this.http.post(`${this.internalApiUrl()}/api/v1/control/support/tickets/${id}/close`, {}, {
          headers: this.headers(),
        }),
      ),
    );
  }
}
