export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: 'same-origin' });
  if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => null);
    if (body?.error?.code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new Event('password-change-required'));
    }
  }
  return response;
}

export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return '/';
  const pathname = value.split(/[?#]/)[0];
  return ['/login', '/change-password', '/forgot-password'].includes(pathname) ? '/' : value;
}
