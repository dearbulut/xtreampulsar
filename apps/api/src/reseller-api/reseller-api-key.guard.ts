import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ResellerApiKeyService } from './reseller-api-key.service';

@Injectable()
export class ResellerApiKeyGuard implements CanActivate {
  constructor(private readonly service: ResellerApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; resellerApiKey?: { resellerId: string } }>();
    const raw = req.headers['x-api-key'];
    if (!raw) throw new UnauthorizedException('X-API-Key header required');
    const res = await this.service.validate(raw);
    if (!res) throw new UnauthorizedException('Invalid or inactive API key');
    req.resellerApiKey = res;
    return true;
  }
}
