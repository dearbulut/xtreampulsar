import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';
/** Roadmap D — bir endpoint'i tek bir izin anahtarina baglar (opt-in). */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
