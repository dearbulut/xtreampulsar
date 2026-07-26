-- Roadmap I: Transcode profilleri / ABR
-- Yeniden kullanilabilir ffmpeg kodlama profili. Akisa atanir; TRANSCODE modunda
-- ffmpeg argumanlari buradan uretilir.

CREATE TABLE "transcode_profiles" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "isDefault"         BOOLEAN NOT NULL DEFAULT false,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "isSystem"          BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"         INTEGER NOT NULL DEFAULT 0,
  "videoCodec"        TEXT NOT NULL DEFAULT 'copy',
  "videoPreset"       TEXT DEFAULT 'veryfast',
  "videoBitrate"      INTEGER,
  "maxBitrate"        INTEGER,
  "bufSize"           INTEGER,
  "crf"               INTEGER,
  "width"             INTEGER,
  "height"            INTEGER,
  "fps"               INTEGER,
  "gopSize"           INTEGER,
  "pixFmt"            TEXT DEFAULT 'yuv420p',
  "videoProfile"      TEXT,
  "videoTune"         TEXT,
  "audioCodec"        TEXT NOT NULL DEFAULT 'copy',
  "audioBitrate"      INTEGER,
  "audioChannels"     INTEGER,
  "audioRate"         INTEGER,
  "hlsSegmentSec"     INTEGER NOT NULL DEFAULT 4,
  "hlsListSize"       INTEGER NOT NULL DEFAULT 10,
  "hlsDeleteSegments" BOOLEAN NOT NULL DEFAULT true,
  "abrEnabled"        BOOLEAN NOT NULL DEFAULT false,
  "abrVariants"       JSONB,
  "hwAccel"           TEXT,
  "threads"           INTEGER,
  "extraArgs"         TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transcode_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transcode_profiles_name_key" ON "transcode_profiles"("name");
CREATE INDEX "transcode_profiles_isActive_idx" ON "transcode_profiles"("isActive");

-- Stream: serbest metin alanini gercek profil referansi ile degistir
ALTER TABLE "streams" DROP COLUMN IF EXISTS "transcodeProfile";
ALTER TABLE "streams" ADD COLUMN "transcodeProfileId" TEXT;
CREATE INDEX "streams_transcodeProfileId_idx" ON "streams"("transcodeProfileId");
ALTER TABLE "streams"
  ADD CONSTRAINT "streams_transcodeProfileId_fkey"
  FOREIGN KEY ("transcodeProfileId") REFERENCES "transcode_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Hazir sistem profilleri ────────────────────────────────────────────────
INSERT INTO "transcode_profiles"
  ("id","name","description","isDefault","isSystem","sortOrder",
   "videoCodec","videoPreset","videoBitrate","maxBitrate","bufSize","width","height","fps","gopSize","videoProfile","videoTune",
   "audioCodec","audioBitrate","audioChannels","audioRate","updatedAt")
VALUES
  ('tp_copy','Copy / Passthrough','Yeniden kodlama yok — kaynak akisi oldugu gibi HLS''e paketlenir. En dusuk CPU.',
   true,true,0,'copy',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'copy',NULL,NULL,NULL,CURRENT_TIMESTAMP),

  ('tp_1080p','1080p H.264','Full HD yeniden kodlama — 5000 kbps video, 192 kbps AAC.',
   false,true,10,'libx264','veryfast',5000,5350,7500,1920,1080,30,60,'high','zerolatency','aac',192,2,48000,CURRENT_TIMESTAMP),

  ('tp_720p','720p H.264','HD yeniden kodlama — 2800 kbps video, 128 kbps AAC. Dengeli varsayilan.',
   false,true,20,'libx264','veryfast',2800,3000,4200,1280,720,30,60,'main','zerolatency','aac',128,2,48000,CURRENT_TIMESTAMP),

  ('tp_480p','480p Mobil','Dusuk bant genisligi / mobil — 1000 kbps video, 96 kbps AAC.',
   false,true,30,'libx264','veryfast',1000,1100,1600,854,480,25,50,'main','zerolatency','aac',96,2,44100,CURRENT_TIMESTAMP),

  ('tp_radio','Radyo (ses)','Yalniz ses — 128 kbps AAC stereo. Radyo istasyonlari icin.',
   false,true,40,'none',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'aac',128,2,44100,CURRENT_TIMESTAMP);

-- ABR ornegi: 3 varyantli cok-bitrate HLS (varsayilan kapali)
INSERT INTO "transcode_profiles"
  ("id","name","description","isSystem","sortOrder","videoCodec","videoPreset","audioCodec","audioRate","audioChannels",
   "abrEnabled","abrVariants","updatedAt")
VALUES
  ('tp_abr3','ABR 1080p/720p/480p','Cok-bitrate HLS — oynatici bant genisligine gore varyant secer. CPU maliyeti yuksektir.',
   true,50,'libx264','veryfast','aac',48000,2,true,
   '[{"name":"1080p","width":1920,"height":1080,"videoBitrate":5000,"maxBitrate":5350,"audioBitrate":192},
     {"name":"720p","width":1280,"height":720,"videoBitrate":2800,"maxBitrate":3000,"audioBitrate":128},
     {"name":"480p","width":854,"height":480,"videoBitrate":1000,"maxBitrate":1100,"audioBitrate":96}]'::jsonb,
   CURRENT_TIMESTAMP);
