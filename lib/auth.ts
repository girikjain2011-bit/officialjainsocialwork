import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminSessions, loginAttempts } from "../db/schema.js";

export const ADMIN_EMAIL = "jainsocialwork@gmail.com";
// SHA-256 of the admin passcode. The passcode itself is never stored in the code.
const PASSCODE_HASH = "9da484647cddd7985d9ef506f9bd1580f5a8dc065238db701bc57e08a33c5ca9";

const SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

export function credentialsValid(email: unknown, passcode: unknown) {
  if (typeof email !== "string" || typeof passcode !== "string") return false;
  const emailOk = email.trim().toLowerCase() === ADMIN_EMAIL;
  const passOk = timingSafeEqual(sha256(passcode.trim()), Buffer.from(PASSCODE_HASH, "hex"));
  return emailOk && passOk;
}

export async function isLockedOut(ip: string) {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);
  const rows = await db
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gt(loginAttempts.createdAt, since)));
  return rows.length >= MAX_FAILED_ATTEMPTS;
}

export async function recordFailedAttempt(ip: string) {
  await db.insert(loginAttempts).values({ ip });
  // Housekeeping: drop attempts older than a day.
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 86_400_000)));
}

export async function createSession() {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await db.insert(adminSessions).values({ token, expiresAt });
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  return { token, expiresAt };
}

function getToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function isAdmin(req: Request) {
  const token = getToken(req);
  if (!token) return false;
  const [session] = await db
    .select()
    .from(adminSessions)
    .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, new Date())));
  return Boolean(session);
}

export async function destroySession(req: Request) {
  const token = getToken(req);
  if (token) await db.delete(adminSessions).where(eq(adminSessions.token, token));
}

export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });
export const badRequest = (error: string) => Response.json({ error }, { status: 400 });

export const clean = (value: unknown, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
