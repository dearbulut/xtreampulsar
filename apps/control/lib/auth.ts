export interface ControlAdmin {
  id: string;
  username: string;
  email: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('control_token');
}

export function getAdmin(): ControlAdmin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('control_admin');
    return raw ? (JSON.parse(raw) as ControlAdmin) : null;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, admin: ControlAdmin): void {
  localStorage.setItem('control_token', token);
  localStorage.setItem('control_admin', JSON.stringify(admin));
}

export function clearAuth(): void {
  localStorage.removeItem('control_token');
  localStorage.removeItem('control_admin');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
