import { Router } from "express";
import {
  db, ordersTable, usersTable, ratingsTable, notificationsTable, zonesTable,
  driverScheduleTable, driverZonesTable, rewardPointsTable, badgesTable,
  complaintsTable, dayOffRequestsTable, detailedRatingsTable, driverMessagesTable,
} from "@workspace/db";
import { eq, and, sql, count, avg, inArray, desc, gte, isNull } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../lib/auth";

const router = Router();

// ============================================================
// ARCHIVE & EXPORT
// ============================================================

router.patch("/orders/:id/archive", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const [o] = await db.update(ordersTable).set({ isArchived: true }).where(eq(ordersTable.id, id)).returning();
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

router.patch("/orders/:id/unarchive", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  await db.update(ordersTable).set({ isArchived: false }).where(eq(ordersTable.id, id));
  res.json({ ok: true });
});

router.patch("/orders/auto-archive", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const updated = await db.update(ordersTable)
    .set({ isArchived: true })
    .where(and(eq(ordersTable.status, "delivered"), sql`${ordersTable.deliveredAt} < ${sevenDaysAgo.toISOString()}`))
    .returning({ id: ordersTable.id });
  res.json({ archived: updated.length });
});

// ============================================================
// ORDER EXTRAS — notes, reject, problem, schedule, cancel reason
// ============================================================

router.patch("/orders/:id/driver-note", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { note } = req.body as { note?: string };
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user!.role === "driver" && o.driverId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.update(ordersTable).set({ driverNote: note ?? null }).where(eq(ordersTable.id, id));
  res.json({ ok: true });
});

router.patch("/orders/:id/customer-note", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { note, token } = req.body as { note?: string; token?: string };
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o || o.trackingToken !== token) { res.status(403).json({ error: "Forbidden" }); return; }
  if (o.status === "picked" || o.status === "delivered") {
    res.status(400).json({ error: "لا يمكن إضافة ملاحظة بعد استلام الطلب" }); return;
  }
  await db.update(ordersTable).set({ customerNote: note ?? null }).where(eq(ordersTable.id, id));
  res.json({ ok: true });
});

router.patch("/orders/:id/reject", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { reason } = req.body as { reason?: string };
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user!.role !== "driver" || o.driverId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.update(ordersTable)
    .set({ status: "pending", driverId: null, rejectReason: reason ?? "غير محدد", assignedAt: null })
    .where(eq(ordersTable.id, id));
  await db.update(usersTable).set({ status: "available" }).where(eq(usersTable.id, req.user!.id));

  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(m =>
    db.insert(notificationsTable).values({
      userId: m.id,
      message: `${req.user!.fullName} رفض الطلب ${o.orderId} — السبب: ${reason ?? "غير محدد"}`,
      type: "order",
    })
  ));
  res.json({ ok: true });
});

router.patch("/orders/:id/report-problem", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { problem } = req.body as { problem?: string };
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user!.role === "driver" && o.driverId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.update(ordersTable).set({ problemReport: problem ?? "مشكلة" }).where(eq(ordersTable.id, id));
  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(m =>
    db.insert(notificationsTable).values({
      userId: m.id,
      message: `🚨 مشكلة في الطلب ${o.orderId}: ${problem ?? "مشكلة"}`,
      type: "order",
    })
  ));
  res.json({ ok: true });
});

router.patch("/orders/:id/schedule", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { scheduledFor, token } = req.body as { scheduledFor?: string; token?: string };
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o || o.trackingToken !== token) { res.status(403).json({ error: "Forbidden" }); return; }
  if (o.status !== "pending") { res.status(400).json({ error: "لا يمكن التأجيل" }); return; }
  await db.update(ordersTable).set({ scheduledFor: scheduledFor ? new Date(scheduledFor) : null }).where(eq(ordersTable.id, id));
  res.json({ ok: true });
});

router.patch("/orders/:id/cancel-with-reason", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { reason } = req.body as { reason?: string };
  await db.update(ordersTable).set({ status: "cancelled", cancelReason: reason ?? "غير محدد" }).where(eq(ordersTable.id, id));
  res.json({ ok: true });
});

router.patch("/orders/:id/address", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { toAddress, token } = req.body as { toAddress?: string; token?: string };
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o || o.trackingToken !== token) { res.status(403).json({ error: "Forbidden" }); return; }
  if (o.status !== "pending" && o.status !== "assigned") {
    res.status(400).json({ error: "لا يمكن التعديل" }); return;
  }
  if (!toAddress || toAddress.length < 5) { res.status(400).json({ error: "عنوان غير صالح" }); return; }
  await db.update(ordersTable).set({ toAddress }).where(eq(ordersTable.id, id));
  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(m =>
    db.insert(notificationsTable).values({
      userId: m.id,
      message: `✏️ العميل عدّل عنوان الطلب ${o.orderId}`,
      type: "order",
    })
  ));
  res.json({ ok: true });
});

router.get("/orders/by-phone/:phone", async (req, res): Promise<void> => {
  const phone = req.params.phone;
  const orders = await db.select({
    id: ordersTable.id, orderId: ordersTable.orderId, status: ordersTable.status,
    toAddress: ordersTable.toAddress, fromBusiness: ordersTable.fromBusiness,
    createdAt: ordersTable.createdAt, trackingToken: ordersTable.trackingToken,
  }).from(ordersTable).where(eq(ordersTable.toPhone, phone))
    .orderBy(desc(ordersTable.createdAt)).limit(5);
  res.json(orders);
});

// ============================================================
// DRIVER SCHEDULE
// ============================================================

router.get("/driver-schedule", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  let q = db.select().from(driverScheduleTable);
  if (startDate && endDate) {
    q = q.where(and(
      sql`${driverScheduleTable.date} >= ${startDate}`,
      sql`${driverScheduleTable.date} <= ${endDate}`,
    )) as any;
  }
  const rows = await q;
  res.json(rows);
});

router.post("/driver-schedule", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const { driverId, date, status } = req.body as { driverId: number; date: string; status: "working" | "off" | "sick" };
  const existing = await db.select().from(driverScheduleTable)
    .where(and(eq(driverScheduleTable.driverId, driverId), eq(driverScheduleTable.date, date)));
  if (existing[0]) {
    const [updated] = await db.update(driverScheduleTable).set({ status })
      .where(eq(driverScheduleTable.id, existing[0].id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(driverScheduleTable).values({ driverId, date, status }).returning();
    res.json(created);
  }
});

// ============================================================
// DRIVER ZONES (fixed zones assigned to driver)
// ============================================================

router.get("/drivers/:id/zones", requireAuth, async (req, res): Promise<void> => {
  const driverId = parseInt(String(req.params.id));
  const rows = await db.select({
    id: zonesTable.id, nameAr: zonesTable.nameAr, nameEn: zonesTable.nameEn,
  }).from(driverZonesTable).innerJoin(zonesTable, eq(driverZonesTable.zoneId, zonesTable.id))
    .where(eq(driverZonesTable.driverId, driverId));
  res.json(rows);
});

router.put("/drivers/:id/zones", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const driverId = parseInt(String(req.params.id));
  const { zoneIds } = req.body as { zoneIds: number[] };
  await db.delete(driverZonesTable).where(eq(driverZonesTable.driverId, driverId));
  if (zoneIds && zoneIds.length > 0) {
    await db.insert(driverZonesTable).values(zoneIds.map(z => ({ driverId, zoneId: z })));
  }
  res.json({ ok: true });
});

// ============================================================
// SUSPEND DRIVER
// ============================================================

router.patch("/drivers/:id/suspend", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.patch("/drivers/:id/reactivate", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  await db.update(usersTable).set({ status: "available" }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.patch("/drivers/:id/daily-goal", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { goal } = req.body as { goal: number };
  await db.update(usersTable).set({ dailyGoal: goal }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

// ============================================================
// REWARD POINTS & BADGES
// ============================================================

router.get("/drivers/:id/points", requireAuth, async (req, res): Promise<void> => {
  const driverId = parseInt(String(req.params.id));
  const rows = await db.select().from(rewardPointsTable)
    .where(eq(rewardPointsTable.driverId, driverId))
    .orderBy(desc(rewardPointsTable.createdAt)).limit(50);
  const [totalRow] = await db.select({ total: sql<number>`COALESCE(SUM(${rewardPointsTable.points}),0)` })
    .from(rewardPointsTable).where(eq(rewardPointsTable.driverId, driverId));
  const total = Number(totalRow?.total ?? 0);
  const level = total >= 1500 ? "gold" : total >= 500 ? "silver" : "bronze";
  const nextThreshold = total >= 1500 ? 3000 : total >= 500 ? 1500 : 500;
  res.json({ total, level, nextThreshold, recent: rows });
});

router.get("/drivers/:id/badges", requireAuth, async (req, res): Promise<void> => {
  const driverId = parseInt(String(req.params.id));
  const rows = await db.select().from(badgesTable).where(eq(badgesTable.driverId, driverId));
  res.json(rows);
});

async function awardPoints(driverId: number, points: number, reason: string, orderId?: number) {
  await db.insert(rewardPointsTable).values({ driverId, points, reason, orderId: orderId ?? null });
}

async function awardBadgeIfMissing(driverId: number, badgeType: string) {
  const existing = await db.select().from(badgesTable)
    .where(and(eq(badgesTable.driverId, driverId), eq(badgesTable.badgeType, badgeType)));
  if (existing.length === 0) {
    await db.insert(badgesTable).values({ driverId, badgeType });
  }
}

// Endpoint to trigger awards (called when delivery completed; idempotent-ish)
router.post("/orders/:id/award", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o || o.status !== "delivered" || !o.driverId) { res.status(400).json({ error: "Not eligible" }); return; }
  // Already awarded?
  const existing = await db.select().from(rewardPointsTable).where(eq(rewardPointsTable.orderId, id));
  if (existing.length > 0) { res.json({ alreadyAwarded: true }); return; }

  const basePoints = o.priority === "urgent" ? 15 : 10;
  await awardPoints(o.driverId, basePoints, o.priority === "urgent" ? "توصيلة عاجلة" : "توصيلة ناجحة", id);

  // Bonus for 5★ rating
  const [r] = await db.select().from(ratingsTable).where(eq(ratingsTable.orderId, id));
  if (r && r.stars === 5) {
    await awardPoints(o.driverId, 5, "تقييم 5 نجوم", id);
  }

  // Check badges
  const deliveredCount = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.driverId, o.driverId), eq(ordersTable.status, "delivered")));
  const total = deliveredCount[0]?.c ?? 0;
  if (total >= 1) await awardBadgeIfMissing(o.driverId, "first_delivery");
  if (total >= 100) await awardBadgeIfMissing(o.driverId, "hundred_deliveries");

  res.json({ awarded: true });
});

// ============================================================
// COMPLAINTS
// ============================================================

router.post("/complaints", async (req, res): Promise<void> => {
  const { orderId, customerPhone, reason, description } = req.body as {
    orderId?: number; customerPhone: string; reason: string; description?: string;
  };
  const [c] = await db.insert(complaintsTable).values({
    orderId: orderId ?? null, customerPhone, reason, description: description ?? null,
  }).returning();
  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(m =>
    db.insert(notificationsTable).values({
      userId: m.id, message: `📢 شكوى جديدة: ${reason}`, type: "system",
    })
  ));
  res.status(201).json(c);
});

router.get("/complaints", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(complaintsTable).orderBy(desc(complaintsTable.createdAt));
  res.json(rows);
});

router.patch("/complaints/:id/resolve", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  await db.update(complaintsTable).set({ status: "resolved" }).where(eq(complaintsTable.id, id));
  res.json({ ok: true });
});

// ============================================================
// DAY OFF REQUESTS
// ============================================================

router.post("/day-off-requests", requireAuth, requireRole("driver"), async (req: AuthRequest, res): Promise<void> => {
  const { requestedDate } = req.body as { requestedDate: string };
  const [r] = await db.insert(dayOffRequestsTable).values({
    driverId: req.user!.id, requestedDate,
  }).returning();
  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(m =>
    db.insert(notificationsTable).values({
      userId: m.id, message: `📅 ${req.user!.fullName} طلب إجازة بتاريخ ${requestedDate}`, type: "system",
    })
  ));
  res.status(201).json(r);
});

router.get("/day-off-requests", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  let rows;
  if (req.user!.role === "driver") {
    rows = await db.select().from(dayOffRequestsTable)
      .where(eq(dayOffRequestsTable.driverId, req.user!.id))
      .orderBy(desc(dayOffRequestsTable.createdAt));
  } else {
    rows = await db.select({
      id: dayOffRequestsTable.id, driverId: dayOffRequestsTable.driverId,
      requestedDate: dayOffRequestsTable.requestedDate, status: dayOffRequestsTable.status,
      managerNote: dayOffRequestsTable.managerNote, createdAt: dayOffRequestsTable.createdAt,
      driverName: usersTable.fullName,
    }).from(dayOffRequestsTable)
      .innerJoin(usersTable, eq(dayOffRequestsTable.driverId, usersTable.id))
      .orderBy(desc(dayOffRequestsTable.createdAt));
  }
  res.json(rows);
});

router.patch("/day-off-requests/:id", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const { status, note } = req.body as { status: "approved" | "rejected"; note?: string };
  const [r] = await db.update(dayOffRequestsTable)
    .set({ status, managerNote: note ?? null })
    .where(eq(dayOffRequestsTable.id, id)).returning();
  if (r) {
    await db.insert(notificationsTable).values({
      userId: r.driverId,
      message: `طلب إجازتك بتاريخ ${r.requestedDate} تم ${status === "approved" ? "قبوله ✅" : "رفضه ❌"}`,
      type: "system",
    });
  }
  res.json(r);
});

// ============================================================
// DETAILED RATINGS
// ============================================================

router.post("/ratings/:id/detailed", async (req, res): Promise<void> => {
  const ratingId = parseInt(String(req.params.id));
  const { speedStars, honestyStars, kindnessStars } = req.body as {
    speedStars: number; honestyStars: number; kindnessStars: number;
  };
  const [d] = await db.insert(detailedRatingsTable).values({
    ratingId, speedStars, honestyStars, kindnessStars,
  }).returning();
  res.json(d);
});

// ============================================================
// DRIVER MESSAGES (quick chat to manager)
// ============================================================

router.post("/driver-messages", requireAuth, requireRole("driver"), async (req: AuthRequest, res): Promise<void> => {
  const { message, isPreset } = req.body as { message: string; isPreset?: boolean };
  const [m] = await db.insert(driverMessagesTable).values({
    driverId: req.user!.id, message, isPreset: !!isPreset,
  }).returning();
  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(mgr =>
    db.insert(notificationsTable).values({
      userId: mgr.id, message: `💬 ${req.user!.fullName}: ${message}`, type: "system",
    })
  ));
  res.status(201).json(m);
});

router.get("/driver-messages", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: driverMessagesTable.id, message: driverMessagesTable.message,
    isPreset: driverMessagesTable.isPreset, isReadByManager: driverMessagesTable.isReadByManager,
    createdAt: driverMessagesTable.createdAt, driverName: usersTable.fullName,
  }).from(driverMessagesTable)
    .innerJoin(usersTable, eq(driverMessagesTable.driverId, usersTable.id))
    .orderBy(desc(driverMessagesTable.createdAt)).limit(50);
  res.json(rows);
});

// ============================================================
// ANALYTICS
// ============================================================

router.get("/analytics/driver-comparison", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const drivers = await db.select().from(usersTable).where(eq(usersTable.role, "driver"));

  const stats = await Promise.all(drivers.map(async (d) => {
    const [todayCount] = await db.select({ c: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered"),
        sql`${ordersTable.deliveredAt} >= ${today.toISOString()}`));
    const [weekCount] = await db.select({ c: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered"),
        sql`${ordersTable.deliveredAt} >= ${weekAgo.toISOString()}`));
    const [monthCount] = await db.select({ c: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered"),
        sql`${ordersTable.deliveredAt} >= ${monthAgo.toISOString()}`));
    const [avgR] = await db.select({ a: avg(ratingsTable.stars) }).from(ratingsTable)
      .where(eq(ratingsTable.driverId, d.id));
    const [totalAssigned] = await db.select({ c: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), sql`${ordersTable.status} IN ('delivered','cancelled')`));
    const [totalDelivered] = await db.select({ c: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered")));

    // Fastest delivery (assigned->delivered)
    const deliveredOrders = await db.select({
      assignedAt: ordersTable.assignedAt, deliveredAt: ordersTable.deliveredAt,
    }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered")));
    let fastestMin: number | null = null;
    for (const o of deliveredOrders) {
      if (o.assignedAt && o.deliveredAt) {
        const m = (o.deliveredAt.getTime() - o.assignedAt.getTime()) / 60000;
        if (fastestMin === null || m < fastestMin) fastestMin = m;
      }
    }

    return {
      driverId: d.id, driverName: d.fullName,
      today: todayCount?.c ?? 0,
      week: weekCount?.c ?? 0,
      month: monthCount?.c ?? 0,
      avgRating: avgR?.a ? Math.round(parseFloat(avgR.a) * 10) / 10 : 0,
      completionRate: (totalAssigned?.c ?? 0) > 0
        ? Math.round(((totalDelivered?.c ?? 0) / (totalAssigned?.c ?? 1)) * 100)
        : 100,
      fastestMin: fastestMin !== null ? Math.round(fastestMin) : null,
    };
  }));

  res.json(stats);
});

router.get("/analytics/zones-heatmap", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db.select({
    zoneId: ordersTable.toZoneId,
    zoneName: zonesTable.nameAr,
    orderCount: count(),
  }).from(ordersTable)
    .innerJoin(zonesTable, eq(ordersTable.toZoneId, zonesTable.id))
    .where(sql`${ordersTable.createdAt} >= ${monthAgo.toISOString()}`)
    .groupBy(ordersTable.toZoneId, zonesTable.nameAr);
  res.json(rows);
});

router.get("/analytics/peak-hours", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*)::int AS count
    FROM orders WHERE created_at >= ${weekAgo.toISOString()}
    GROUP BY hour ORDER BY hour
  `);
  res.json(rows.rows);
});

router.get("/analytics/cancellation", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [total] = await db.select({ c: count() }).from(ordersTable)
    .where(sql`${ordersTable.createdAt} >= ${monthAgo.toISOString()}`);
  const [cancelled] = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.status, "cancelled"), sql`${ordersTable.createdAt} >= ${monthAgo.toISOString()}`));
  const rate = (total?.c ?? 0) > 0 ? Math.round(((cancelled?.c ?? 0) / (total?.c ?? 1)) * 1000) / 10 : 0;

  const reasons = await db.execute(sql`
    SELECT COALESCE(cancel_reason, 'غير محدد') AS reason, COUNT(*)::int AS count
    FROM orders
    WHERE status = 'cancelled' AND created_at >= ${monthAgo.toISOString()}
    GROUP BY reason
  `);
  res.json({ rate, total: total?.c ?? 0, cancelled: cancelled?.c ?? 0, reasons: reasons.rows });
});

router.get("/analytics/revenue", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Realistic fare:
  //  base 2.50 JOD normal / 4.00 JOD urgent
  //  +1.00 JOD if cross-zone (from_zone_id != to_zone_id)
  //  +0.50 JOD scheduled orders
  //  fallback to stored delivery_fee if present (>0)
  const fareExpr = sql`COALESCE(
    NULLIF(delivery_fee, 0),
    (CASE WHEN priority='urgent' THEN 4.00 ELSE 2.50 END)
      + (CASE WHEN from_zone_id IS NOT NULL AND to_zone_id IS NOT NULL AND from_zone_id <> to_zone_id THEN 1.00 ELSE 0 END)
      + (CASE WHEN scheduled_for IS NOT NULL THEN 0.50 ELSE 0 END)
  )`;

  const sumOf = async (since: Date) => {
    const r = await db.execute(sql`
      SELECT
        COALESCE(SUM(${fareExpr}), 0)::float AS revenue,
        COUNT(*)::int AS orders
      FROM orders
      WHERE status='delivered' AND delivered_at >= ${since.toISOString()}
    `);
    const row: any = r.rows[0] || {};
    return { revenue: Number(row.revenue || 0), orders: Number(row.orders || 0) };
  };

  const [dStat, wStat, mStat] = await Promise.all([sumOf(today), sumOf(weekAgo), sumOf(monthAgo)]);

  const trend = await db.execute(sql`
    SELECT DATE(delivered_at) AS day,
           SUM(${fareExpr})::float AS revenue,
           COUNT(*)::int AS orders
    FROM orders
    WHERE status='delivered' AND delivered_at >= ${monthAgo.toISOString()}
    GROUP BY day ORDER BY day
  `);

  const avgOrderValue = mStat.orders > 0 ? mStat.revenue / mStat.orders : 0;

  res.json({
    today: Number(dStat.revenue.toFixed(2)),
    todayOrders: dStat.orders,
    week: Number(wStat.revenue.toFixed(2)),
    weekOrders: wStat.orders,
    month: Number(mStat.revenue.toFixed(2)),
    monthOrders: mStat.orders,
    avgOrderValue: Number(avgOrderValue.toFixed(2)),
    trend: trend.rows.map((r: any) => ({
      day: r.day, revenue: Number(Number(r.revenue || 0).toFixed(2)), orders: Number(r.orders || 0),
    })),
  });
});

router.get("/analytics/delay-alert", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  const fortyFiveAgo = new Date(Date.now() - 45 * 60 * 1000);
  const orders = await db.select({
    id: ordersTable.id, orderId: ordersTable.orderId, pickedAt: ordersTable.pickedAt,
    driverName: usersTable.fullName,
  }).from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.driverId, usersTable.id))
    .where(and(eq(ordersTable.status, "picked"), sql`${ordersTable.pickedAt} < ${fortyFiveAgo.toISOString()}`));
  res.json(orders);
});

router.get("/analytics/ai-prediction", requireAuth, requireRole("manager"), async (_req, res): Promise<void> => {
  // Rule-based prediction: avg of last 7 days
  const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalRow] = await db.select({ c: count() }).from(ordersTable)
    .where(sql`${ordersTable.createdAt} >= ${sevenAgo.toISOString()}`);
  const avgDaily = Math.round((totalRow?.c ?? 0) / 7);

  // Busiest zone last 7 days
  const zones = await db.select({
    zoneName: zonesTable.nameAr, c: count(),
  }).from(ordersTable).innerJoin(zonesTable, eq(ordersTable.toZoneId, zonesTable.id))
    .where(sql`${ordersTable.createdAt} >= ${sevenAgo.toISOString()}`)
    .groupBy(zonesTable.nameAr);
  zones.sort((a, b) => Number(b.c) - Number(a.c));
  const top = zones.slice(0, 2).map(z => z.zoneName);

  res.json({
    expectedToday: avgDaily,
    busiestZones: top,
    recommendation: top[0]
      ? `يُنصح بتوفير سائق إضافي في ${top[0]} اليوم لتغطية الطلب المتوقع.`
      : "اليوم متوقع أن يكون عادياً.",
  });
});

// ============================================================
// DRIVER HISTORY DETAIL
// ============================================================

router.get("/drivers/:id/history", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const driverId = parseInt(String(req.params.id));
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.driverId, driverId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit).offset(offset);

  const [totalRow] = await db.select({ c: count() }).from(ordersTable).where(eq(ordersTable.driverId, driverId));
  const [deliveredRow] = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.driverId, driverId), eq(ordersTable.status, "delivered")));
  const [avgR] = await db.select({ a: avg(ratingsTable.stars) }).from(ratingsTable)
    .where(eq(ratingsTable.driverId, driverId));
  const ratings = await db.select().from(ratingsTable)
    .where(eq(ratingsTable.driverId, driverId)).orderBy(desc(ratingsTable.createdAt)).limit(20);

  // Monthly perf last 6 months
  const monthly = await db.execute(sql`
    SELECT TO_CHAR(delivered_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
    FROM orders
    WHERE driver_id = ${driverId} AND status='delivered'
      AND delivered_at >= NOW() - INTERVAL '6 months'
    GROUP BY month ORDER BY month
  `);

  res.json({
    orders, ratings,
    monthlyPerformance: monthly.rows,
    totalOrders: totalRow?.c ?? 0,
    totalDelivered: deliveredRow?.c ?? 0,
    avgRating: avgR?.a ? Math.round(parseFloat(avgR.a) * 10) / 10 : 0,
    completionRate: (totalRow?.c ?? 0) > 0
      ? Math.round(((deliveredRow?.c ?? 0) / (totalRow?.c ?? 1)) * 100)
      : 100,
    page,
  });
});

// ============================================================
// OPTIMAL ROUTE (AI rule-based)
// ============================================================

router.post("/ai/optimal-route", requireAuth, requireRole("driver"), async (req: AuthRequest, res): Promise<void> => {
  const orders = await db.select({
    id: ordersTable.id, orderId: ordersTable.orderId, priority: ordersTable.priority,
    toZoneId: ordersTable.toZoneId, toZoneName: zonesTable.nameAr, status: ordersTable.status,
    eta: ordersTable.eta, createdAt: ordersTable.createdAt,
  }).from(ordersTable).innerJoin(zonesTable, eq(ordersTable.toZoneId, zonesTable.id))
    .where(and(eq(ordersTable.driverId, req.user!.id), sql`${ordersTable.status} IN ('assigned','picked')`));

  if (orders.length === 0) { res.json({ orderedIds: [], explanation: "لا يوجد طلبات نشطة." }); return; }

  // Sort: urgent first, then by ETA (soonest first), then group by zone
  const sorted = [...orders].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
    const aEta = a.eta ? a.eta.getTime() : Infinity;
    const bEta = b.eta ? b.eta.getTime() : Infinity;
    if (aEta !== bEta) return aEta - bEta;
    return a.toZoneId - b.toZoneId;
  });

  const explanation = "تم ترتيب الطلبات: العاجلة أولاً، ثم حسب أقرب وقت تسليم، ثم تجميع حسب المنطقة لتقليل التنقل.";
  res.json({ orderedIds: sorted.map(o => o.id), orders: sorted, explanation });
});

// ============================================================
// PERSONAL PERFORMANCE
// ============================================================

router.get("/driver/me/performance", requireAuth, requireRole("driver"), async (req: AuthRequest, res): Promise<void> => {
  const driverId = req.user!.id;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [myAvg] = await db.select({ a: avg(ratingsTable.stars) }).from(ratingsTable)
    .where(eq(ratingsTable.driverId, driverId));
  const [teamAvg] = await db.select({ a: avg(ratingsTable.stars) }).from(ratingsTable);

  const [myToday] = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.driverId, driverId), eq(ordersTable.status, "delivered"),
      sql`${ordersTable.deliveredAt} >= ${today.toISOString()}`));

  // Today goal for this driver
  const [me] = await db.select({ goal: usersTable.dailyGoal }).from(usersTable).where(eq(usersTable.id, driverId));

  // Compare rank
  const allDrivers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "driver"));
  const allRatings = await Promise.all(allDrivers.map(async d => {
    const [r] = await db.select({ a: avg(ratingsTable.stars) }).from(ratingsTable).where(eq(ratingsTable.driverId, d.id));
    return parseFloat(r?.a ?? "0") || 0;
  }));
  const myR = parseFloat(myAvg?.a ?? "0") || 0;
  const better = allRatings.filter(r => r < myR).length;
  const percentile = allRatings.length > 0 ? Math.round((better / allRatings.length) * 100) : 0;

  res.json({
    myRating: Math.round(myR * 10) / 10,
    teamRating: Math.round((parseFloat(teamAvg?.a ?? "0") || 0) * 10) / 10,
    todayDelivered: myToday?.c ?? 0,
    dailyGoal: me?.goal ?? 10,
    percentile,
  });
});

export default router;
