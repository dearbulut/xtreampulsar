import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async findByCredentials(username: string, password: string) {
    const user = await this.userRepo.findByUsername(username);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    return user;
  }

  async findById(id: string) {
    return this.userRepo.findById(id);
  }

  async validateConnection(
    userId: string,
    ip: string,
    userAgent?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) return { allowed: false, reason: 'User not found' };
    if (user.status !== 'ACTIVE') {
      return { allowed: false, reason: `Account ${user.status.toLowerCase()}` };
    }
    if (user.expiresAt < new Date()) {
      return { allowed: false, reason: 'Account expired' };
    }

    const active = await this.userRepo.countActiveConnections(userId);
    if (active >= user.maxConnections) {
      return {
        allowed: false,
        reason: `Max connections reached (${user.maxConnections})`,
      };
    }

    return { allowed: true };
  }

  async createConnection(
    userId: string,
    streamId: string,
    ip: string,
    userAgent?: string,
    serverId?: string,
  ) {
    return this.userRepo.createConnection({ userId, streamId, ip, userAgent, serverId });
  }

  async closeConnection(connectionId: string): Promise<void> {
    return this.userRepo.closeConnection(connectionId);
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }
}
