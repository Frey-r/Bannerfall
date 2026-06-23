// API Client for Tiny Tacticians with automated idempotency tokens and developer profile switching
const DEV_USER_KEY = 'tiny_tacticians_dev_user_id';

export function getDevUserId(): string {
  return localStorage.getItem(DEV_USER_KEY) || 't2_devuser';
}

export function setDevUserId(userId: string): void {
  localStorage.setItem(DEV_USER_KEY, userId.trim());
}

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-user-id': getDevUserId(),
  };
}

function generateIdempToken(): string {
  return `idemp_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${res.status}`);
    }

    return res.json() as Promise<T>;
  },

  async post<T>(endpoint: string, body: any = {}, idemp = true): Promise<T> {
    const reqBody = { ...body };
    if (idemp && !reqBody.idempToken) {
      reqBody.idempToken = generateIdempToken();
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${res.status}`);
    }

    return res.json() as Promise<T>;
  },
};
