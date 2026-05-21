import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "yalla-wassel-secret-key";

export function hashPassword(password: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(userId: number, role: string): string {
  const payload = { userId, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
  return Buffer.from(data).toString("base64") + "." + sig;
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const [dataB64, sig] = token.split(".");
    if (!dataB64 || !sig) return null;
    const data = Buffer.from(dataB64, "base64").toString("utf8");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(data) as { userId: number; role: string; exp: number };
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export interface AuthRequest extends Request {
  user?: { id: number; role: string; fullName: string; phone: string };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db.select({
    id: usersTable.id,
    role: usersTable.role,
    isActive: usersTable.isActive,
    fullName: usersTable.fullName,
    phone: usersTable.phone,
  })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "User not found or inactive" });
    return;
  }

  req.user = { id: user.id, role: user.role, fullName: user.fullName, phone: user.phone };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function generateOrderId(id: number): string {
  return `YW-2026-${String(id).padStart(4, "0")}`;
}
