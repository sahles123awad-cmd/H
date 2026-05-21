import { Router } from "express";
import { db, ordersTable, usersTable, zonesTable, ratingsTable, notificationsTable } from "@workspace/db";
import { eq, and, ilike, sql, avg, count } from "drizzle-orm";
import { requireAuth, AuthRequest, generateTrackingToken, generateOrderId } from "../lib/auth";
import {
  ListOrdersQueryParams, CreateOrderBody, GetOrderParams, UpdateOrderParams, UpdateOrderBody,
  DeleteOrderParams, AssignOrderDriverParams, AssignOrderDriverBody,
  UpdateOrderStatusParams, UpdateOrderStatusBody, TrackOrderParams,
} from "@workspace/api-zod";

const router = Router();

async function buildOrderWithDetails(order: typeof ordersTable.$inferSelect) {
  const [fromZone] = await db.select({ nameAr: zonesTable.nameAr }).from(zonesTable).where(eq(zonesTable.id, order.fromZoneId));
  const [toZone] = await db.select({ nameAr: zonesTable.nameAr }).from(zonesTable).where(eq(zonesTable.id, order.toZoneId));
  let driverName: string | null = null;
  let driverPhone: string | null = null;
  let driverAvgRating: number | null = null;

  if (order.driverId) {
    const [driver] = await db.select({ fullName: usersTable.fullName, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, order.driverId));
    driverName = driver?.fullName ?? null;
    driverPhone = driver?.phone ?? null;
    const avgResult = await db.select({ avg: avg(ratingsTable.stars) }).from(ratingsTable)
      .where(eq(ratingsTable.driverId, order.driverId));
    driverAvgRating = avgResult[0]?.avg ? Math.round(parseFloat(avgResult[0].avg) * 10) / 10 : null;
  }

  return {
    id: order.id, orderId: order.orderId,
    fromBusiness: order.fromBusiness, fromAddress: order.fromAddress, fromZoneId: order.fromZoneId,
    fromZoneName: fromZone?.nameAr ?? null, toCustomerName: order.toCustomerName,
    toPhone: order.toPhone, toAddress: order.toAddress, toZoneId: order.toZoneId,
    toZoneName: toZone?.nameAr ?? null, priority: order.priority, status: order.status,
    driverId: order.driverId, driverName, driverPhone, driverAvgRating, notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    assignedAt: order.assignedAt?.toISOString() ?? null,
    pickedAt: order.pickedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    eta: order.eta?.toISOString() ?? null,
    trackingToken: order.trackingToken,
  };
}

router.get("/orders", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  let baseQuery = db.select().from(ordersTable);
  const conditions: any[] = [];

  if (req.user!.role === "driver") {
    conditions.push(eq(ordersTable.driverId, req.user!.id));
  }
  if (parsed.success) {
    if (parsed.data.status) conditions.push(eq(ordersTable.status, parsed.data.status as any));
    if (parsed.data.priority) conditions.push(eq(ordersTable.priority, parsed.data.priority as any));
    if (parsed.data.driverId) conditions.push(eq(ordersTable.driverId, parsed.data.driverId));
    if (parsed.data.fromZoneId) conditions.push(eq(ordersTable.fromZoneId, parsed.data.fromZoneId));
    if (parsed.data.toZoneId) conditions.push(eq(ordersTable.toZoneId, parsed.data.toZoneId));
    if (parsed.data.search) {
      conditions.push(sql`(${ordersTable.orderId} ILIKE ${`%${parsed.data.search}%`} OR ${ordersTable.toCustomerName} ILIKE ${`%${parsed.data.search}%`})`);
    }
    if (parsed.data.date) {
      const d = new Date(parsed.data.date as string);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      conditions.push(sql`${ordersTable.createdAt} >= ${d.toISOString()} AND ${ordersTable.createdAt} < ${next.toISOString()}`);
    }
  }

  const orders = conditions.length > 0
    ? await db.select().from(ordersTable).where(and(...conditions)).orderBy(sql`${ordersTable.createdAt} DESC`)
    : await db.select().from(ordersTable).orderBy(sql`${ordersTable.createdAt} DESC`);

  const withDetails = await Promise.all(orders.map(buildOrderWithDetails));
  res.json(withDetails);
});

router.post("/orders", requireAuth, requireRole("manager"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const trackingToken = generateTrackingToken();
  const tempId = Date.now();

  const [order] = await db.insert(ordersTable).values({
    orderId: `YW-2026-TEMP`,
    fromBusiness: parsed.data.fromBusiness,
    fromAddress: parsed.data.fromAddress,
    fromZoneId: parsed.data.fromZoneId,
    toCustomerName: parsed.data.toCustomerName,
    toPhone: parsed.data.toPhone,
    toAddress: parsed.data.toAddress,
    toZoneId: parsed.data.toZoneId,
    priority: parsed.data.priority,
    notes: parsed.data.notes ?? null,
    trackingToken,
  }).returning();

  const [updated] = await db.update(ordersTable)
    .set({ orderId: generateOrderId(order.id) })
    .where(eq(ordersTable.id, order.id))
    .returning();

  // Notify all managers
  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(m =>
    db.insert(notificationsTable).values({
      userId: m.id,
      message: `طلب جديد ${updated.orderId} من ${updated.fromBusiness}`,
      type: "order",
    })
  ));

  res.status(201).json(await buildOrderWithDetails(updated));
});

router.get("/orders/track/:token", async (req, res): Promise<void> => {
  const params = TrackOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid token" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.trackingToken, params.data.token));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [toZone] = await db.select({ nameAr: zonesTable.nameAr }).from(zonesTable).where(eq(zonesTable.id, order.toZoneId));
  let driverName: string | null = null;
  let driverAvgRating: number | null = null;

  if (order.driverId) {
    const [driver] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, order.driverId));
    driverName = driver?.fullName ?? null;
    const avgResult = await db.select({ avg: avg(ratingsTable.stars) }).from(ratingsTable).where(eq(ratingsTable.driverId, order.driverId));
    driverAvgRating = avgResult[0]?.avg ? Math.round(parseFloat(avgResult[0].avg) * 10) / 10 : null;
  }

  const hasRating = (await db.select({ count: count() }).from(ratingsTable).where(eq(ratingsTable.orderId, order.id)))[0]?.count > 0;

  res.json({
    orderId: order.orderId, status: order.status, fromBusiness: order.fromBusiness,
    toCustomerName: order.toCustomerName, toAddress: order.toAddress,
    toZoneName: toZone?.nameAr ?? null, priority: order.priority,
    driverName, driverAvgRating,
    createdAt: order.createdAt.toISOString(),
    assignedAt: order.assignedAt?.toISOString() ?? null,
    pickedAt: order.pickedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    eta: order.eta?.toISOString() ?? null,
    trackingToken: order.trackingToken,
    hasRating,
  });
});

router.get("/orders/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  res.json(await buildOrderWithDetails(order));
});

router.patch("/orders/:id/assign", requireAuth, requireRole("manager"), async (req: AuthRequest, res): Promise<void> => {
  const params = AssignOrderDriverParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AssignOrderDriverBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [driver] = await db.select({ id: usersTable.id, status: usersTable.status, fullName: usersTable.fullName })
    .from(usersTable).where(and(eq(usersTable.id, body.data.driverId), eq(usersTable.role, "driver")));

  if (!driver) { res.status(404).json({ error: "السائق غير موجود" }); return; }
  if (driver.status === "busy") {
    res.status(409).json({ error: `السائق ${driver.fullName} مشغول حالياً بطلب آخر` });
    return;
  }

  const [order] = await db.update(ordersTable)
    .set({ driverId: body.data.driverId, status: "assigned", assignedAt: new Date() })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  await db.update(usersTable).set({ status: "busy" }).where(eq(usersTable.id, body.data.driverId));

  await db.insert(notificationsTable).values({
    userId: body.data.driverId,
    message: `تم تعيينك لطلب ${order.orderId}`,
    type: "order",
  });

  res.json(await buildOrderWithDetails(order));
});

router.patch("/orders/:id/eta", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { minutesFromNow } = req.body as { minutesFromNow?: number };
  if (!minutesFromNow || minutesFromNow < 5 || minutesFromNow > 180) {
    res.status(400).json({ error: "minutesFromNow يجب أن يكون بين 5 و 180 دقيقة" }); return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (req.user!.role !== "manager" && order.driverId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const eta = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const [updated] = await db.update(ordersTable).set({ eta }).where(eq(ordersTable.id, params.data.id)).returning();

  res.json(await buildOrderWithDetails(updated));
});

router.patch("/orders/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: any = { status: body.data.status };
  if (body.data.status === "picked") updates.pickedAt = new Date();
  if (body.data.status === "delivered") updates.deliveredAt = new Date();

  const [order] = await db.update(ordersTable).set(updates)
    .where(eq(ordersTable.id, params.data.id)).returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (body.data.status === "delivered" && order.driverId) {
    await db.update(usersTable).set({ status: "available" }).where(eq(usersTable.id, order.driverId));

    // Auto-rating based on ETA: early → 5★, on-time (±5 min) → no change, late → 2★
    const [finalOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    if (finalOrder?.eta && finalOrder.deliveredAt) {
      const existingRating = await db.select({ count: count() }).from(ratingsTable)
        .where(eq(ratingsTable.orderId, finalOrder.id));
      if (existingRating[0]?.count === 0) {
        const etaMs = finalOrder.eta.getTime();
        const deliveredMs = finalOrder.deliveredAt.getTime();
        const diffMinutes = (deliveredMs - etaMs) / 60000; // positive = late, negative = early

        if (diffMinutes > 5) {
          // Late delivery — penalty
          await db.insert(ratingsTable).values({
            orderId: finalOrder.id,
            driverId: order.driverId,
            customerName: "تقييم تلقائي",
            stars: 2,
            comment: `تم التسليم متأخراً بـ ${Math.round(diffMinutes)} دقيقة`,
          });
        } else if (diffMinutes < -5) {
          // Early delivery — bonus
          await db.insert(ratingsTable).values({
            orderId: finalOrder.id,
            driverId: order.driverId,
            customerName: "تقييم تلقائي",
            stars: 5,
            comment: `تم التسليم مبكراً بـ ${Math.round(-diffMinutes)} دقيقة`,
          });
        }
        // On time (within ±5 min) → no auto-rating
      }
    }
  }

  // Notify managers of status change
  const managers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "manager"));
  await Promise.all(managers.map(m =>
    db.insert(notificationsTable).values({
      userId: m.id,
      message: `الطلب ${order.orderId} تغير إلى "${body.data.status}"`,
      type: "order",
    })
  ));

  res.json(await buildOrderWithDetails(order));
});

router.patch("/orders/:id", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = UpdateOrderBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [order] = await db.update(ordersTable).set(body.data)
    .where(eq(ordersTable.id, params.data.id)).returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(await buildOrderWithDetails(order));
});

router.delete("/orders/:id", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const params = DeleteOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [order] = await db.update(ordersTable).set({ status: "cancelled" })
    .where(eq(ordersTable.id, params.data.id)).returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.sendStatus(204);
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
