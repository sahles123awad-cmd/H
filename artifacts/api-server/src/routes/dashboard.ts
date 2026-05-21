import { Router } from "express";
import { db, ordersTable, usersTable, ratingsTable } from "@workspace/db";
import { eq, and, sql, count, avg } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../lib/auth";

const router = Router();

router.get("/dashboard/stats", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const [totalTodayResult] = await db.select({ count: count() }).from(ordersTable)
    .where(sql`${ordersTable.createdAt} >= ${todayStr}`);
  const totalToday = totalTodayResult?.count ?? 0;

  const [deliveredTodayResult] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.status, "delivered"), sql`${ordersTable.deliveredAt} >= ${todayStr}`));
  const deliveredToday = deliveredTodayResult?.count ?? 0;

  const [inProgressResult] = await db.select({ count: count() }).from(ordersTable)
    .where(sql`${ordersTable.status} IN ('assigned', 'picked')`);
  const inProgress = inProgressResult?.count ?? 0;

  const [pendingResult] = await db.select({ count: count() }).from(ordersTable)
    .where(eq(ordersTable.status, "pending"));
  const pending = pendingResult?.count ?? 0;

  const [cancelledResult] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.status, "cancelled"), sql`${ordersTable.createdAt} >= ${todayStr}`));
  const cancelled = cancelledResult?.count ?? 0;

  const [avgRatingResult] = await db.select({ avg: avg(ratingsTable.stars) }).from(ratingsTable)
    .where(sql`${ratingsTable.createdAt} >= ${weekAgoStr}`);
  const avgRatingWeek = avgRatingResult?.avg ? Math.round(parseFloat(avgRatingResult.avg) * 10) / 10 : 0;

  const [totalDriversResult] = await db.select({ count: count() }).from(usersTable)
    .where(and(eq(usersTable.role, "driver"), eq(usersTable.isActive, true)));
  const totalDrivers = totalDriversResult?.count ?? 0;

  const [availableDriversResult] = await db.select({ count: count() }).from(usersTable)
    .where(and(eq(usersTable.role, "driver"), eq(usersTable.status, "available"), eq(usersTable.isActive, true)));
  const availableDrivers = availableDriversResult?.count ?? 0;

  res.json({ totalToday, deliveredToday, inProgress, pending, cancelled, avgRatingWeek, totalDrivers, availableDrivers });
});

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: any, next: any): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    next();
  };
}

export default router;
