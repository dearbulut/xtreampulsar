import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SearchType = 'users' | 'streams' | 'resellers' | 'categories';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, types: SearchType[] = ['users', 'streams', 'resellers', 'categories']) {
    if (!q || q.trim().length < 1) {
      return { users: [], streams: [], resellers: [], categories: [] };
    }

    const term = q.trim();
    const MAX = 5;

    const [users, streams, resellers, categories] = await Promise.all([
      types.includes('users')
        ? this.prisma.user.findMany({
            where: {
              deletedAt: null,
              OR: [
                { username: { contains: term, mode: 'insensitive' } },
                { notes: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { id: true, username: true, status: true, expiresAt: true, role: true },
            take: MAX,
          })
        : [],
      types.includes('streams')
        ? this.prisma.stream.findMany({
            where: {
              name: { contains: term, mode: 'insensitive' },
            },
            select: {
              id: true,
              name: true,
              status: true,
              tvgLogo: true,
              externalId: true,
              category: { select: { name: true, type: true } },
            },
            take: MAX,
          })
        : [],
      types.includes('resellers')
        ? this.prisma.reseller.findMany({
            where: {
              deletedAt: null,
              OR: [
                { username: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { id: true, username: true, email: true, tier: true, isActive: true, credits: true },
            take: MAX,
          })
        : [],
      types.includes('categories')
        ? this.prisma.category.findMany({
            where: {
              name: { contains: term, mode: 'insensitive' },
            },
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
              _count: { select: { streams: true } },
            },
            take: MAX,
          })
        : [],
    ]);

    return { users, streams, resellers, categories };
  }
}
