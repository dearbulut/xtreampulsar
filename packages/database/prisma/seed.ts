import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed başlıyor...\n');

  // ── Admin kullanıcısı ────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: passwordHash,
      role: 'ADMIN',
      maxConnections: 999,
      status: 'ACTIVE',
      expiresAt: new Date('2099-12-31T23:59:59Z'),
    },
  });
  console.log(`✓ Admin kullanıcısı  : ${admin.username} (id: ${admin.id})`);

  // ── Paketler ─────────────────────────────────────────────────────────────
  const packages = [
    { name: 'Starter',    durationDays: 30,  maxConnections: 1, creditCost: 5,  price: 0,    description: 'Başlangıç paketi — 30 gün, 1 bağlantı' },
    { name: 'Aylık',      durationDays: 30,  maxConnections: 2, creditCost: 10, price: 0,    description: 'Aylık paket — 30 gün, 2 bağlantı' },
    { name: '3 Aylık',    durationDays: 90,  maxConnections: 2, creditCost: 25, price: 0,    description: '3 aylık paket — 90 gün, 2 bağlantı' },
    { name: '6 Aylık',    durationDays: 180, maxConnections: 3, creditCost: 45, price: 0,    description: '6 aylık paket — 180 gün, 3 bağlantı' },
    { name: 'Yıllık',     durationDays: 365, maxConnections: 4, creditCost: 80, price: 0,    description: 'Yıllık paket — 365 gün, 4 bağlantı' },
  ];

  for (const pkg of packages) {
    const existing = await prisma.package.findFirst({ where: { name: pkg.name } });
    if (!existing) {
      const created = await prisma.package.create({ data: pkg });
      console.log(`✓ Paket              : ${created.name} (${created.durationDays}g, ${created.maxConnections} bağlantı, ${created.creditCost} kredi)`);
    } else {
      console.log(`→ Paket zaten var    : ${existing.name}`);
    }
  }

  // ── Varsayılan Bouquet ───────────────────────────────────────────────────
  const defaultBouquet = await prisma.bouquet.upsert({
    where: { id: 'default-bouquet' },
    update: {},
    create: {
      id: 'default-bouquet',
      name: 'Varsayılan',
      description: 'Sistem tarafından oluşturulan varsayılan bouquet',
      sortOrder: 0,
      isActive: true,
    },
  });
  console.log(`✓ Varsayılan bouquet : ${defaultBouquet.name} (id: ${defaultBouquet.id})`);

  // ── Kategoriler ──────────────────────────────────────────────────────────
  const categories = [
    { name: 'Genel',   type: 'LIVE'   as const, sortOrder: 0 },
    { name: 'Movies',  type: 'VOD'    as const, sortOrder: 1 },
    { name: 'Series',  type: 'SERIES' as const, sortOrder: 2 },
  ];

  for (const cat of categories) {
    const existing = await prisma.category.findFirst({ where: { name: cat.name, type: cat.type } });
    if (!existing) {
      const created = await prisma.category.create({
        data: {
          ...cat,
          bouquetId: defaultBouquet.id,
          isActive: true,
        },
      });
      console.log(`✓ Kategori           : ${created.name} (${created.type}, externalId: ${created.externalId})`);
    } else {
      console.log(`→ Kategori zaten var : ${existing.name} (${existing.type})`);
    }
  }

  console.log('\n✅ Seed tamamlandı!');
  console.log('─────────────────────────────────────────');
  console.log('  Admin giriş bilgileri:');
  console.log('    Kullanıcı adı : admin');
  console.log('    Şifre         : Admin123!');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
