import { Router } from "express";
import { db, usersTable, zonesTable, ordersTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken, requireAuth, AuthRequest } from "../lib/auth";
import { LoginBody, RegisterBody } from "@workspace/api-zod";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { phone, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "الحساب غير نشط" });
    return;
  }

  let zoneName: string | null = null;
  if (user.zoneId) {
    const [zone] = await db.select({ nameAr: zonesTable.nameAr }).from(zonesTable).where(eq(zonesTable.id, user.zoneId));
    zoneName = zone?.nameAr ?? null;
  }

  const token = generateToken(user.id, user.role);

  res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      zoneId: user.zoneId,
      zoneName,
      status: user.status,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fullName, phone, password, role, zoneId } = parsed.data;

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone));
  if (existing) {
    res.status(409).json({ error: "رقم الهاتف مسجل مسبقاً" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    fullName,
    phone,
    passwordHash: hashPassword(password),
    role,
    zoneId: zoneId ?? null,
    status: "available",
  }).returning();

  const token = generateToken(user.id, user.role);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      zoneId: user.zoneId,
      zoneName: null,
      status: user.status,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  let zoneName: string | null = null;
  if (user.zoneId) {
    const [zone] = await db.select({ nameAr: zonesTable.nameAr }).from(zonesTable).where(eq(zonesTable.id, user.zoneId));
    zoneName = zone?.nameAr ?? null;
  }

  let deliveredToday = 0;
  if (user.role === "driver") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [result] = await db.select({ count: count() }).from(ordersTable)
      .where(and(
        eq(ordersTable.driverId, user.id),
        eq(ordersTable.status, "delivered"),
        sql`${ordersTable.deliveredAt} >= ${today.toISOString()}`
      ));
    deliveredToday = result?.count ?? 0;
  }

  res.json({
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    zoneId: user.zoneId,
    zoneName,
    status: user.status,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    deliveredToday,
  });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "تم تسجيل الخروج" });
});

export default router;
