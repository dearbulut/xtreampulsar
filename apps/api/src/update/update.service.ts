import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const GITHUB_REPO = 'xtreampulsar/xtreampulsar';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour cache

interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string;
  checkedAt: string;
}

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private cached: UpdateInfo | null = null;
  private cacheTime = 0;

  private getCurrentVersion(): string {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
      return pkg.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.replace(/^v/, '').split('.').map(Number);
    const pb = b.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  async checkUpdate(): Promise<UpdateInfo> {
    const now = Date.now();
    if (this.cached && now - this.cacheTime < CHECK_INTERVAL_MS) {
      return this.cached;
    }

    const currentVersion = this.getCurrentVersion();

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { 'User-Agent': 'XtreamPulsar-Panel/1.0' } },
      );

      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const release = await res.json() as GithubRelease;
      const latestVersion = release.tag_name.replace(/^v/, '');
      const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;

      this.cached = {
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseNotes: release.body ?? '',
        releaseUrl: release.html_url,
        publishedAt: release.published_at,
        checkedAt: new Date().toISOString(),
      };
      this.cacheTime = now;
      return this.cached;
    } catch (err) {
      this.logger.warn(`Update check failed: ${(err as Error).message}`);
      return {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseNotes: '',
        releaseUrl: '',
        publishedAt: '',
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async applyUpdate(): Promise<{ started: boolean; message: string }> {
    const updateScript = path.join(process.cwd(), 'update.sh');
    if (!fs.existsSync(updateScript)) {
      return { started: false, message: 'update.sh not found' };
    }

    this.logger.log('Applying update via update.sh');
    execFile('bash', [updateScript], (err, stdout, stderr) => {
      if (err) this.logger.error(`Update failed: ${err.message}`);
      else this.logger.log(`Update output: ${stdout}`);
      if (stderr) this.logger.warn(`Update stderr: ${stderr}`);
    });

    return { started: true, message: 'Update started in background' };
  }
}
