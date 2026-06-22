import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';

const execFileAsync = promisify(execFile);

interface FfprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  bit_rate?: string;
}

interface FfprobeFormat {
  bit_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

export interface QualityAnalysis {
  qualityScore: string;
  resolution: string | null;
  videoBitrate: number | null;
  videoCodec: string | null;
  fps: number | null;
}

@Injectable()
export class StreamQualityService {
  private readonly logger = new Logger(StreamQualityService.name);
  private readonly ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe';

  constructor(private readonly prisma: PrismaService) {}

  private parseFps(avg_frame_rate?: string): number | null {
    if (!avg_frame_rate || avg_frame_rate === '0/0') return null;
    const [num, den] = avg_frame_rate.split('/').map(Number);
    if (!den || den === 0) return null;
    return Math.round((num / den) * 10) / 10;
  }

  private calcScore(
    height: number | null,
    bitrateKbps: number | null,
    codec: string | null,
    fps: number | null,
  ): string {
    if (height === null) return 'F';
    const goodCodec = codec ? ['h264', 'hevc', 'h265', 'avc'].includes(codec.toLowerCase()) : false;
    if (height >= 1080 && (bitrateKbps ?? 0) >= 4000 && goodCodec && (fps ?? 0) >= 30) return 'A';
    if (height >= 720 && (bitrateKbps ?? 0) >= 2000) return 'B';
    if (height >= 480 && (bitrateKbps ?? 0) >= 1000) return 'C';
    if (height >= 360) return 'D';
    return 'F';
  }

  async analyzeStream(streamId: string): Promise<QualityAnalysis> {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: { primaryUrl: true },
    });

    if (!stream) return { qualityScore: 'F', resolution: null, videoBitrate: null, videoCodec: null, fps: null };

    let analysis: QualityAnalysis = { qualityScore: 'F', resolution: null, videoBitrate: null, videoCodec: null, fps: null };

    try {
      const { stdout } = await execFileAsync(
        this.ffprobePath,
        ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', stream.primaryUrl],
        { timeout: 15_000 },
      );

      const data = JSON.parse(stdout) as FfprobeOutput;
      const videoStream = data.streams?.find((s) => s.codec_type === 'video');
      const audioStream = data.streams?.find((s) => s.codec_type === 'audio');

      const height = videoStream?.height ?? null;
      const width = videoStream?.width ?? null;
      const codec = videoStream?.codec_name ?? null;
      const fps = this.parseFps(videoStream?.avg_frame_rate);

      const rawBitrate = parseInt(videoStream?.bit_rate ?? data.format?.bit_rate ?? '0', 10);
      const bitrateKbps = rawBitrate > 0 ? Math.round(rawBitrate / 1000) : null;

      const resolution = height && width ? `${width}x${height}` : null;

      analysis = {
        qualityScore: this.calcScore(height, bitrateKbps, codec, fps),
        resolution,
        videoBitrate: bitrateKbps,
        videoCodec: codec ?? (audioStream?.codec_name ?? null),
        fps,
      };
    } catch (err) {
      this.logger.warn(`FFprobe failed for ${streamId}: ${(err as Error).message}`);
    }

    await this.prisma.stream.update({
      where: { id: streamId },
      data: {
        qualityScore: analysis.qualityScore,
        resolution: analysis.resolution,
        videoBitrate: analysis.videoBitrate,
        videoCodec: analysis.videoCodec,
        fps: analysis.fps,
        lastAnalyzedAt: new Date(),
      },
    });

    return analysis;
  }

  async getQualitySummary() {
    const streams = await this.prisma.stream.groupBy({
      by: ['qualityScore'],
      _count: { qualityScore: true },
    });

    const summary: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0, '—': 0 };
    for (const row of streams) {
      const key = row.qualityScore ?? '—';
      summary[key] = (summary[key] ?? 0) + row._count.qualityScore;
    }
    return summary;
  }

  @Cron('0 */2 * * *')
  async analyzeAllStreams(): Promise<void> {
    const streams = await this.prisma.stream.findMany({
      where: { workerStatus: 'RUNNING', isActive: true },
      select: { id: true },
      take: 20,
    });

    this.logger.log(`Analyzing quality for ${streams.length} running streams`);

    await Promise.allSettled(streams.map((s) => this.analyzeStream(s.id)));
  }
}
