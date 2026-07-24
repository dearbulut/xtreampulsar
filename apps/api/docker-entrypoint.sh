#!/bin/sh
# XtreamPulsar API container entrypoint.
# DB'yi image ile senkron tutmak için başlangıçta migration'ları uygular.
# Bu, self-host kurulumlarında "column does not exist" hatalarını (migrate
# adımı atlanınca/başarısız olunca) tamamen önler.
set -e

echo "[entrypoint] Veritabanı migration'ları uygulanıyor (prisma migrate deploy)..."
i=1
until ( cd /repo/packages/database && npx prisma migrate deploy ); do
  if [ "$i" -ge 12 ]; then
    echo "[entrypoint] UYARI: migrate deploy $i denemede de başarısız; API yine de başlatılıyor."
    break
  fi
  echo "[entrypoint] migrate denemesi $i başarısız (DB hazır değil?), 3sn sonra tekrar..."
  i=$((i + 1))
  sleep 3
done

echo "[entrypoint] API başlatılıyor..."
cd /repo
exec node apps/api/dist/main.js
