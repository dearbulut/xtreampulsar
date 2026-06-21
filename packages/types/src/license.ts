export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'PENDING';
export type LicenseTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface License {
  id: string;
  key: string;
  serverIp: string;
  tier: LicenseTier;
  status: LicenseStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidateLicenseRequest {
  key: string;
  serverIp: string;
}

export interface ValidateLicenseResponse {
  valid: boolean;
  license?: License;
  message?: string;
}
