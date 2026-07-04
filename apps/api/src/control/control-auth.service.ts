import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ControlAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const admin = await this.prisma.controlAdmin.findUnique({ where: { username } });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.jwtService.sign({ sub: admin.id, username: admin.username });
    return { token, admin: { id: admin.id, username: admin.username, email: admin.email } };
  }

  async me(adminId: string) {
    return this.prisma.controlAdmin.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, email: true, createdAt: true },
    });
  }

  async setup(username: string, email: string, password: string, apiKey: string) {
    const expectedKey = process.env.CONTROL_SETUP_KEY || process.env.ADMIN_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) throw new UnauthorizedException('Invalid setup key');
    const count = await this.prisma.controlAdmin.count();
    if (count > 0) throw new ConflictException('Control panel already initialized');
    const hashed = await bcrypt.hash(password, 12);
    await this.prisma.controlAdmin.create({ data: { username, email, password: hashed } });
    return { success: true };
  }
}
