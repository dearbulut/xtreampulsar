import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class LicenseService {
  async validate(key: string, serverIp: string) {
    // TODO: integrate with @xtreampulsar/database PrismaService
    return {
      valid: false,
      key,
      serverIp,
      message: 'License validation not yet implemented',
    };
  }

  async getStatus(key: string) {
    // TODO: fetch from database
    throw new NotFoundException(`License key ${key} not found`);
  }
}
