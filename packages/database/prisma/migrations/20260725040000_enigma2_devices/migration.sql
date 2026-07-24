-- Roadmap E-2: Enigma2 (VU+/Dreambox) cihaz yonetimi
CREATE TABLE "enigma2_devices" (
  "id"         TEXT NOT NULL,
  "mac"        TEXT NOT NULL,
  "deviceName" TEXT,
  "boxType"    TEXT,
  "oeVersion"  TEXT NOT NULL DEFAULT 'OE2.0',
  "token"      TEXT,
  "lastSeen"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"     TEXT,
  CONSTRAINT "enigma2_devices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "enigma2_devices_mac_key" ON "enigma2_devices"("mac");
CREATE INDEX "enigma2_devices_mac_idx" ON "enigma2_devices"("mac");
CREATE INDEX "enigma2_devices_userId_idx" ON "enigma2_devices"("userId");
ALTER TABLE "enigma2_devices" ADD CONSTRAINT "enigma2_devices_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
