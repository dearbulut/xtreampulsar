import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; apiKeyUser?: { userId: string; permissions: string[] } }>();
    const rawKey = request.headers['x-api-key'];
    if (!rawKey) throw new UnauthorizedException('X-API-Key header required');

    const result = await this.apiKeyService.validateKey(rawKey);
    if (!result) throw new UnauthorizedException('Invalid or expired API key');

    request.apiKeyUser = result;
    return true;
  }
}
