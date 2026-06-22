import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execSync } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const execAsync = promisify(exec);

function parseDatabaseUrl(): { host: string; port: string; user: string; password: string; dbname: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: url.username,
    password: decodeURIComponent(url.password),
    dbname: url.pathname.replace(/^\//, ''),
  };
}

function checkPgDump(): void {
  try {
    execSync('which pg_dump', { stdio: 'ignore' });
  } catch {
    throw new Error('pg_dump not found — install postgresql-client');
  }
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getBackupDir(): Promise<string> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    return settings?.localBackupDir ?? '/opt/xtreampulsar/backups';
  }

  async createLocalBackup(): Promise<{ filename: string; size: number; createdAt: Date }> {
    checkPgDump();
    const backupDir = await this.getBackupDir();
    fs.mkdirSync(backupDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${ts}.sql.gz`;
    const filePath = path.join(backupDir, filename);

    this.logger.log(`Creating backup: ${filePath}`);

    const db = parseDatabaseUrl();
    const cmd = `pg_dump -h "${db.host}" -p "${db.port}" -U "${db.user}" "${db.dbname}" | gzip > "${filePath}"`;
    const env = { ...process.env, PGPASSWORD: db.password };

    try {
      await execAsync(cmd, { shell: '/bin/sh', env });
    } catch (err) {
      await this.prisma.backupLog.create({
        data: { filename, size: 0, type: 'LOCAL', status: 'FAILED' },
      });
      throw new Error(`Backup failed: ${(err as Error).message}`);
    }

    const stat = fs.statSync(filePath);
    const log = await this.prisma.backupLog.create({
      data: { filename, size: stat.size, type: 'LOCAL', status: 'SUCCESS' },
    });

    return { filename: log.filename, size: log.size, createdAt: log.createdAt };
  }

  async listLocalBackups(): Promise<Array<{ filename: string; size: number; createdAt: Date }>> {
    const backupDir = await this.getBackupDir();
    if (!fs.existsSync(backupDir)) return [];

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sql.gz'));
    return files
      .map((filename) => {
        const stat = fs.statSync(path.join(backupDir, filename));
        return { filename, size: stat.size, createdAt: stat.birthtime };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteBackup(filename: string): Promise<void> {
    this.validateFilename(filename);
    const backupDir = await this.getBackupDir();
    const filePath = path.join(backupDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await this.prisma.backupLog.deleteMany({ where: { filename } });
  }

  async restoreBackup(filename: string): Promise<{ message: string }> {
    this.validateFilename(filename);
    const backupDir = await this.getBackupDir();
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException(`Backup not found: ${filename}`);

    this.logger.warn(`RESTORING database from ${filename}`);
    const db = parseDatabaseUrl();
    const env = { ...process.env, PGPASSWORD: db.password };
    await execAsync(
      `gunzip -c "${filePath}" | psql -h "${db.host}" -p "${db.port}" -U "${db.user}" "${db.dbname}"`,
      { shell: '/bin/sh', env },
    );
    return { message: `Database restored from ${filename}` };
  }

  async uploadToDropbox(filename: string, apiKey?: string): Promise<{ message: string }> {
    this.validateFilename(filename);
    const backupDir = await this.getBackupDir();
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException(`Backup not found: ${filename}`);

    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const token = apiKey ?? settings?.dropboxApiKey ?? '';
    if (!token) throw new Error('Dropbox API key not configured');

    const fileBuffer = fs.readFileSync(filePath);
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: `/${filename}`, mode: 'overwrite' }),
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`Dropbox upload failed: ${response.status} ${response.statusText}`);
    }

    await this.prisma.backupLog.create({
      data: { filename, size: fileBuffer.length, type: 'DROPBOX', status: 'SUCCESS' },
    });

    return { message: `Uploaded ${filename} to Dropbox` };
  }

  @Cron('0 */6 * * *')
  async autoBackup(): Promise<void> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.enableLocalBackups) return;

    this.logger.log('Running automatic backup…');
    try {
      await this.createLocalBackup();
      await this.cleanOldBackups(settings.backupsToKeep);
    } catch (err) {
      this.logger.error(`Auto-backup failed: ${(err as Error).message}`);
    }
  }

  private async cleanOldBackups(keepCount: number): Promise<void> {
    const backups = await this.listLocalBackups();
    const backupDir = await this.getBackupDir();
    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      const fp = path.join(backupDir, backup.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      await this.prisma.backupLog.deleteMany({ where: { filename: backup.filename } });
      this.logger.log(`Deleted old backup: ${backup.filename}`);
    }
  }

  private validateFilename(filename: string): void {
    if (!filename || filename.includes('/') || filename.includes('..') || filename.includes('\0')) {
      throw new Error('Invalid filename');
    }
  }
}
