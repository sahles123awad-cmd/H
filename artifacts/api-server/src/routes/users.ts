import { Router } from "express";
import { db, usersTable, zonesTable, ratingsTable, ordersTable } from "@workspace/db";
import { eq, and, avg, count, sql } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../lib/auth";
import { ListUsersQueryParams, ListDriversQueryParams, GetUserParams, UpdateUserStatusParams, UpdateUserStatusBody } from "@workspace/api-zod";

const router = Router();

router.get("/users", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  let query = db.select().from(usersTable);
  const conditions: any[] = [];
  if (parsed.success && parsed.data.role) conditions.push(eq(usersTable.role, parsed.data.role as any));

  const users = await (conditions.length > 0
    ? db.select().from(usersTable).where(and(...conditions))
    : db.select().from(usersTable));

  const zoneMap = new Map<number, string>();
  const zones = await db.select({ id: zonesTable.id, nameAr: zonesTable.nameAr }).from(zonesTable);
  zones.forEach(z => zoneMap.set(z.id, z.nameAr));

  res.json(users.map(u => ({
    id: u.id, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role,
    zoneId: u.zoneId, zoneName: u.zoneId ? (zoneMap.get(u.zoneId) ?? null) : null,
    status: u.status, avatarUrl: u.avatarUrl, isActive: u.isActive, createdAt: u.createdAt.toISOString(),
  })));
});

router.get("/users/drivers", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListDriversQueryParams.safeParse(req.query);
  const conditions: any[] = [eq(usersTable.role, "driver"), eq(usersTable.isActive, true)];
  if (parsed.success && parsed.data.status) conditions.push(eq(usersTable.status, parsed.data.status as any));
  if (parsed.success && parsed.data.zoneId) conditions.push(eq(usersTable.zoneId, parsed.data.zoneId));

  const drivers = await db.select().from(usersTable).where(and(...conditions));

  const zoneMap = new Map<number, string>();
  const zones = await db.select({ id: zonesTable.id, nameAr: zonesTable.nameAr }).from(zonesTable);
  zones.forEach(z => zoneMap.set(z.id, z.nameAr));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const driversWithStats = await Promise.all(drivers.map(async d => {
    const totalOrdersResult = await db.select({ count: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered")));
    const totalOrders = totalOrdersResult[0]?.count ?? 0;

    const deliveredTodayResult = await db.select({ count: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered"),
        sql`${ordersTable.deliveredAt} >= ${today.toISOString()}`));
    const deliveredToday = deliveredTodayResult[0]?.count ?? 0;

    const avgRatingResult = await db.select({ avg: avg(ratingsTable.stars) }).from(ratingsTable)
      .where(eq(ratingsTable.driverId, d.id));
    const avgRating = parseFloat(avgRatingResult[0]?.avg ?? "0") || 0;

    return {
      id: d.id, fullName: d.fullName, phone: d.phone, role: d.role,
      zoneId: d.zoneId, zoneName: d.zoneId ? (zoneMap.get(d.zoneId) ?? null) : null,
      status: d.status, avatarUrl: d.avatarUrl, isActive: d.isActive, createdAt: d.createdAt.toISOString(),
      totalOrders, deliveredToday, avgRating: Math.round(avgRating * 10) / 10,
      isTrusted: avgRating >= 4.5 && totalOrders >= 10,
    };
  }));

  res.json(driversWithStats);
});

router.get("/users/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  if (req.user!.role !== "manager" && req.user!.id !== params.data.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let zoneName: string | null = null;
  if (user.zoneId) {
    const [zone] = await db.select({ nameAr: zonesTable.nameAr }).from(zonesTable).where(eq(zonesTable.id, user.zoneId));
    zoneName = zone?.nameAr ?? null;
  }

  res.json({
    id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role,
    zoneId: user.zoneId, zoneName, status: user.status, avatarUrl: user.avatarUrl,
    isActive: user.isActive, createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/users/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateUserStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  if (req.user!.role !== "manager" && req.user!.id !== params.data.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const body = UpdateUserStatusBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [updated] = await db.update(usersTable)
    .set({ status: body.data.status })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    id: updated.id, fullName: updated.fullName, phone: updated.phone, email: updated.email,
    role: updated.role, zoneId: updated.zoneId, zoneName: null, status: updated.status,
    avatarUrl: updated.avatarUrl, isActive: updated.isActive, createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
