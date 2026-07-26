/**
 * Roadmap I — FFmpeg argüman üretici (SAF FONKSİYON).
 *
 * Burada hiçbir I/O yoktur: profil + akış ayarları girer, argüman dizisi çıkar.
 * Böylece hem "komut önizleme" endpoint'i hem de (ikinci adımda) StreamWorker
 * aynı kaynaktan beslenir ve davranış birim testiyle doğrulanabilir.
 */

export interface AbrVariant {
  name?: string;
  width?: number;
  height?: number;
  videoBitrate?: number; // kbps
  maxBitrate?: number; // kbps
  audioBitrate?: number; // kbps
}

/** Prisma TranscodeProfile ile uyumlu, gevşek tipli girdi. */
export interface TranscodeProfileLike {
  name?: string;
  videoCodec?: string | null; // copy | none | libx264 | libx265 | h264_nvenc | ...
  videoPreset?: string | null;
  videoBitrate?: number | null; // kbps
  maxBitrate?: number | null; // kbps
  bufSize?: number | null; // kbps
  crf?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  gopSize?: number | null;
  pixFmt?: string | null;
  videoProfile?: string | null;
  videoTune?: string | null;
  audioCodec?: string | null; // copy | none | aac | mp3 | ac3
  audioBitrate?: number | null; // kbps
  audioChannels?: number | null;
  audioRate?: number | null; // Hz
  hlsSegmentSec?: number | null;
  hlsListSize?: number | null;
  hlsDeleteSegments?: boolean | null;
  abrEnabled?: boolean | null;
  abrVariants?: unknown; // Json — AbrVariant[]
  hwAccel?: string | null; // cuda | qsv | vaapi
  threads?: number | null;
  extraArgs?: string | null;
}

export interface BuildHlsArgsInput {
  /** null/undefined ⇒ passthrough (-c copy) */
  profile?: TranscodeProfileLike | null;
  inputUrl: string;
  /** Tek varyant çıkışı, ör. /tmp/hls/<id>/index.m3u8 */
  outputFile: string;
  /** Tek varyant segment deseni, ör. /tmp/hls/<id>/seg%05d.ts */
  segmentPattern: string;
  /** ABR için gerekli — varyant alt klasörleri burada oluşur */
  outputDir?: string;

  // ─── Akış düzeyi ayarlar (Stream tablosundan) ──────────────────────────────
  userAgent?: string | null;
  headers?: string | null; // satır başına "Key: Value"
  cookie?: string | null;
  customMap?: string | null; // ör. "-map 0:v:0 -map 0:a:1"
  customFfmpeg?: string | null; // profilin üstüne eklenen serbest argümanlar
  generatePts?: boolean | null;

  // ─── Global ayarlar (Settings — roadmap C) ────────────────────────────────
  probeSize?: number | null; // bayt
  analyzeDurationUs?: number | null; // mikrosaniye

  /** LOOP/dosya kaynakları için gerçek-zaman okuma (-re) */
  realtime?: boolean;
}

const HW_ACCELS = new Set(['cuda', 'qsv', 'vaapi', 'videotoolbox']);

/** Tırnakları koruyarak serbest argüman metnini böler. */
export function splitArgs(raw?: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

/** "K: V" satırlarını ffmpeg -headers değerine çevirir. */
function headerBlock(headers?: string | null, cookie?: string | null): string | null {
  const lines: string[] = [];
  if (headers) {
    for (const l of headers.split(/\r?\n/)) {
      const t = l.trim();
      if (t && t.includes(':')) lines.push(t);
    }
  }
  if (cookie) lines.push(`Cookie: ${cookie.trim()}`);
  if (!lines.length) return null;
  return lines.join('\r\n') + '\r\n';
}

/** Ölçekleme + fps + pix_fmt filtre zinciri. Hiçbiri yoksa null. */
export function scaleFilter(
  width?: number | null,
  height?: number | null,
  fps?: number | null,
  pixFmt?: string | null,
): string | null {
  const parts: string[] = [];
  if (width && height) {
    parts.push(
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      'setsar=1',
    );
  } else if (width) {
    parts.push(`scale=${width}:-2`);
  } else if (height) {
    parts.push(`scale=-2:${height}`);
  }
  if (fps) parts.push(`fps=${fps}`);
  if (pixFmt) parts.push(`format=${pixFmt}`);
  return parts.length ? parts.join(',') : null;
}

function parseVariants(raw: unknown): AbrVariant[] {
  if (!raw) return [];
  const arr = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!Array.isArray(arr)) return [];
  return arr.filter((v): v is AbrVariant => !!v && typeof v === 'object');
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Girdi (input) tarafı argümanları — hem tek varyant hem ABR için ortak. */
function inputArgs(i: BuildHlsArgsInput, p: TranscodeProfileLike | null): string[] {
  const a: string[] = [];
  if (p?.hwAccel && HW_ACCELS.has(p.hwAccel)) a.push('-hwaccel', p.hwAccel);
  if (i.realtime) a.push('-re');
  if (i.generatePts !== false) a.push('-fflags', '+genpts');
  if (i.probeSize && i.probeSize > 0) a.push('-probesize', String(i.probeSize));
  if (i.analyzeDurationUs && i.analyzeDurationUs > 0) {
    a.push('-analyzeduration', String(i.analyzeDurationUs));
  }
  if (i.userAgent) a.push('-user_agent', i.userAgent);
  const hdr = headerBlock(i.headers, i.cookie);
  if (hdr) a.push('-headers', hdr);
  a.push('-i', i.inputUrl);
  return a;
}

/** HLS muxer argümanları. */
function hlsArgs(p: TranscodeProfileLike | null, segmentPattern: string): string[] {
  const seg = p?.hlsSegmentSec ?? 4;
  const list = p?.hlsListSize ?? 10;
  const del = p?.hlsDeleteSegments ?? true;
  const flags = del ? 'append_list+delete_segments+omit_endlist' : 'append_list';
  return [
    '-f', 'hls',
    '-hls_time', String(seg),
    '-hls_list_size', String(list),
    '-hls_flags', flags,
    '-hls_segment_filename', segmentPattern,
  ];
}

/**
 * Tek varyant (veya passthrough) HLS argümanları.
 * Profil yoksa ya da codec'ler copy ise mevcut davranışla birebir aynı çıktı üretir.
 */
function buildSingle(i: BuildHlsArgsInput, p: TranscodeProfileLike | null): string[] {
  const vCodec = (p?.videoCodec ?? 'copy').trim() || 'copy';
  const aCodec = (p?.audioCodec ?? 'copy').trim() || 'copy';
  const videoOff = vCodec === 'none';
  const audioOff = aCodec === 'none';
  const passthrough = vCodec === 'copy' && aCodec === 'copy';

  const args = inputArgs(i, p);

  // ─── Map ───────────────────────────────────────────────────────────────────
  if (i.customMap) {
    args.push(...splitArgs(i.customMap));
  } else {
    if (!videoOff) args.push('-map', '0:v:0?');
    if (!audioOff) args.push('-map', '0:a?');
    // Altyazı yalnızca tam passthrough'da taşınır — yeniden kodlarken
    // mpegts/HLS altyazı akışı sorun çıkarır.
    if (passthrough) args.push('-map', '0:s?');
  }

  // ─── Video ─────────────────────────────────────────────────────────────────
  if (videoOff) {
    args.push('-vn');
  } else if (vCodec === 'copy') {
    args.push('-c:v', 'copy');
  } else {
    const vf = scaleFilter(p?.width, p?.height, p?.fps, p?.pixFmt);
    if (vf) args.push('-vf', vf);
    args.push('-c:v', vCodec);
    if (p?.videoPreset) args.push('-preset', p.videoPreset);
    if (p?.videoTune) args.push('-tune', p.videoTune);
    if (p?.videoProfile) args.push('-profile:v', p.videoProfile);
    if (p?.crf != null) args.push('-crf', String(p.crf));
    if (p?.videoBitrate) args.push('-b:v', `${p.videoBitrate}k`);
    if (p?.maxBitrate) args.push('-maxrate', `${p.maxBitrate}k`);
    if (p?.bufSize) args.push('-bufsize', `${p.bufSize}k`);
    if (p?.gopSize) args.push('-g', String(p.gopSize));
    if (p?.pixFmt && !vf) args.push('-pix_fmt', p.pixFmt);
  }

  // ─── Audio ─────────────────────────────────────────────────────────────────
  if (audioOff) {
    args.push('-an');
  } else if (aCodec === 'copy') {
    args.push('-c:a', 'copy');
  } else {
    args.push('-c:a', aCodec);
    if (p?.audioBitrate) args.push('-b:a', `${p.audioBitrate}k`);
    if (p?.audioRate) args.push('-ar', String(p.audioRate));
    if (p?.audioChannels) args.push('-ac', String(p.audioChannels));
  }

  if (p?.threads) args.push('-threads', String(p.threads));
  args.push('-max_muxing_queue_size', '1024');
  args.push(...hlsArgs(p, i.segmentPattern));
  args.push(...splitArgs(p?.extraArgs));
  args.push(...splitArgs(i.customFfmpeg));
  args.push(i.outputFile);
  return args;
}

/**
 * Çok-bitrate (ABR) HLS: tek girdi → N varyant + master playlist.
 * Çıkış düzeni: <dir>/v0/index.m3u8 … <dir>/master.m3u8
 */
function buildAbr(
  i: BuildHlsArgsInput,
  p: TranscodeProfileLike,
  variants: AbrVariant[],
): string[] {
  const dir = i.outputDir ?? i.outputFile.replace(/\/[^/]+$/, '');
  const vCodec = p.videoCodec && p.videoCodec !== 'copy' && p.videoCodec !== 'none'
    ? p.videoCodec
    : 'libx264';
  const aCodec = p.audioCodec && p.audioCodec !== 'copy' && p.audioCodec !== 'none'
    ? p.audioCodec
    : 'aac';

  const args = inputArgs(i, p);

  // filter_complex: kaynağı N'e böl, her dalı kendi çözünürlüğüne ölçekle
  const split = `[0:v]split=${variants.length}${variants.map((_, n) => `[in${n}]`).join('')}`;
  const chains = variants.map((v, n) => {
    const f = scaleFilter(v.width, v.height, p.fps, p.pixFmt) ?? 'null';
    return `[in${n}]${f}[out${n}]`;
  });
  args.push('-filter_complex', [split, ...chains].join(';'));

  variants.forEach((v, n) => {
    args.push('-map', `[out${n}]`);
    args.push(`-c:v:${n}`, vCodec);
    if (p.videoPreset) args.push(`-preset:v:${n}`, p.videoPreset);
    if (p.videoTune) args.push(`-tune:v:${n}`, p.videoTune);
    if (v.videoBitrate) args.push(`-b:v:${n}`, `${v.videoBitrate}k`);
    if (v.maxBitrate) args.push(`-maxrate:v:${n}`, `${v.maxBitrate}k`);
    const buf = v.maxBitrate ? Math.round(v.maxBitrate * 1.5) : undefined;
    if (buf) args.push(`-bufsize:v:${n}`, `${buf}k`);
    if (p.gopSize) args.push(`-g:v:${n}`, String(p.gopSize));
  });

  variants.forEach((v, n) => {
    args.push('-map', 'a:0?');
    args.push(`-c:a:${n}`, aCodec);
    const ab = v.audioBitrate ?? p.audioBitrate ?? undefined;
    if (ab) args.push(`-b:a:${n}`, `${ab}k`);
    if (p.audioRate) args.push(`-ar:a:${n}`, String(p.audioRate));
    if (p.audioChannels) args.push(`-ac:a:${n}`, String(p.audioChannels));
  });

  if (p.threads) args.push('-threads', String(p.threads));
  args.push('-max_muxing_queue_size', '1024');
  args.push(...hlsArgs(p, `${dir}/v%v/seg%05d.ts`));
  args.push('-master_pl_name', 'master.m3u8');
  args.push(
    '-var_stream_map',
    variants.map((v, n) => `v:${n},a:${n}${v.name ? `,name:${v.name}` : ''}`).join(' '),
  );
  args.push(...splitArgs(p.extraArgs));
  args.push(...splitArgs(i.customFfmpeg));
  args.push(`${dir}/v%v/index.m3u8`);
  return args;
}

/** Profil + akış ayarlarından tam ffmpeg argüman dizisi üretir. */
export function buildHlsArgs(input: BuildHlsArgsInput): string[] {
  const p = input.profile ?? null;
  if (p?.abrEnabled) {
    const variants = parseVariants(p.abrVariants);
    if (variants.length > 1) return buildAbr(input, p, variants);
  }
  return buildSingle(input, p);
}

/** Kabuğa yapıştırılabilir, insan-okur komut metni. */
export function previewCommand(ffmpegPath: string, args: string[]): string {
  const q = (a: string) => (/[\s"'\\]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a);
  return [ffmpegPath, ...args.map(q)].join(' ');
}

/** ABR profillerinde çıktı klasör yapısı için gereken alt dizinler. */
export function abrVariantDirs(profile?: TranscodeProfileLike | null): string[] {
  if (!profile?.abrEnabled) return [];
  const variants = parseVariants(profile.abrVariants);
  return variants.length > 1 ? variants.map((_, n) => `v${n}`) : [];
}
