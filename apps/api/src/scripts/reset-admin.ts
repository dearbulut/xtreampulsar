/**
 * Standalone admin kurtarma script'i.
 * Panel'e bağımsız olarak bir admin hesabı oluşturur veya şifresini sıfırlar.
 * (Endpoint /auth/setup bir kez çalıştıktan sonra kilitlenir; bu script her zaman çalışır.)
 *
 * Container içinde:
 *   docker compose exec api node apps/api/dist/scripts/reset-admin.js <kullanıcı> <şifre>
 * Örnek:
 *   docker compose exec api node apps/api/dist/scripts/reset-admin.js admin 'Admin1234!'
 */
import { PrismaClient } from '@xtreampulsar/database';
import * as bcrypt from 'bcryptjs';

async function main(): Promise<void> {
  const username = process.argv[2] || process.env.ADMIN_USERNAME || 'admin';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || '';

  if (!password) {
    console.error('Kullanım: node apps/api/dist/scripts/reset-admin.js <kullanıcı> <şifre>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const hashed = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing) {
      await prisma.user.update({
        where: { username },
        data: { password: hashed, role: 'ADMIN', status: 'ACTIVE' },
      });
      console.log(`✔ Admin "${username}" şifresi sıfırlandı ve hesap aktifleştirildi.`);
    } else {
      await prisma.user.create({
        data: {
          username,
          password: hashed,
          role: 'ADMIN',
          status: 'ACTIVE',
          maxConnections: 9999,
          expiresAt: new Date('2099-12-31'),
        },
      });
      console.log(`✔ Admin "${username}" oluşturuldu.`);
    }
    console.log('Artık bu bilgilerle panele giriş yapabilirsiniz.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('HATA:', err instanceof Error ? err.message : err);
  process.exit(1);
});
