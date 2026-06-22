import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

interface TestConnectionDto {
  url: string;
  username: string;
  password: string;
}

function fetchJson(url: string, timeoutMs = 10_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'XtreamPulsar-TestClient/1.0' },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Invalid JSON response (status ${res.statusCode})`));
          }
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

@Controller('xtream')
@UseGuards(JwtAuthGuard)
export class XtreamAdminController {
  private readonly logger = new Logger(XtreamAdminController.name);

  @Post('test-connection')
  async testConnection(@Body() dto: TestConnectionDto) {
    const { url, username, password } = dto;

    if (!url || !username || !password) {
      return { valid: false, error: 'url, username ve password zorunludur' };
    }

    const base = url.replace(/\/$/, '');
    const apiUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    try {
      this.logger.log(`Testing Xtream connection: ${base}`);
      const data = await fetchJson(apiUrl) as Record<string, unknown>;

      const userInfo = data['user_info'] as Record<string, unknown> | undefined;
      const serverInfo = data['server_info'] as Record<string, unknown> | undefined;

      if (!userInfo || userInfo['auth'] === 0) {
        return {
          valid: false,
          error: typeof userInfo?.['message'] === 'string'
            ? userInfo['message']
            : 'Kimlik doğrulama başarısız',
        };
      }

      return {
        valid: true,
        userInfo: {
          username: userInfo['username'],
          status: userInfo['status'],
          expDate: userInfo['exp_date'],
          maxConnections: userInfo['max_connections'],
          activeCons: userInfo['active_cons'],
          isTrial: userInfo['is_trial'],
          allowedOutputFormats: userInfo['allowed_output_formats'],
        },
        serverInfo: {
          url: serverInfo?.['url'],
          port: serverInfo?.['port'],
          httpsPort: serverInfo?.['https_port'],
          serverProtocol: serverInfo?.['server_protocol'],
          rtmpPort: serverInfo?.['rtmp_port'],
          timezone: serverInfo?.['timezone'],
          timestampNow: serverInfo?.['timestamp_now'],
          timeNow: serverInfo?.['time_now'],
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bağlantı başarısız';
      this.logger.warn(`Xtream test connection failed: ${message}`);
      return { valid: false, error: message };
    }
  }
}
