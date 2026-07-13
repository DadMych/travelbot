import { cookies } from "next/headers";

const AUTH_COOKIE = "travel_map_auth";

export function getSitePassword(): string {
  return process.env.SITE_PASSWORD ?? "";
}

export function isAuthConfigured(): boolean {
  return Boolean(getSitePassword());
}

export async function isAuthenticated(): Promise<boolean> {
  const password = getSitePassword();
  if (!password) return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return token === hashPassword(password);
}

export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return `tm_${Math.abs(hash).toString(36)}`;
}

export { AUTH_COOKIE };

export function getTelegramOwnerId(): number | null {
  const id = process.env.TELEGRAM_OWNER_ID;
  if (!id) return null;
  const parsed = parseInt(id, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isOwnerTelegramUser(userId: number): boolean {
  const ownerId = getTelegramOwnerId();
  if (!ownerId) return true;
  return userId === ownerId;
}
