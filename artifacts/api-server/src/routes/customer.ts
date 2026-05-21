import { Router } from "express";
import { db, ordersTable, usersTable, notificationsTable, zonesTable, ratingsTable } from "@workspace/db";
import { eq, sql, avg, count } from "drizzle-orm";
import { requireAuth, AuthRequest, generateTrackingToken, generateOrderId } from "../lib/auth";
import { z } from "zod";

const router = Router();

const CustomerOrderBody = z.object({
  category: z.enum(["food", "flowers", "pharmacy", "grocery", "electronics", "clothing", "other"]),
  fromBusiness: z.string().min(1),
  fromAddress: z.string().min(1),
  fromZoneId: z.number().int().positive(),
  toAddress: z.string().min(1),
  toZoneId: z.number().int().positive(),
  notes: z.string().optional(),
});

function requireCustomer(req: AuthRequest, res: any, next: any): void {
  if (!req.user || req.user.role !== "customer") {
    res.status(403).json({ error: "Forbidden: customer only" });
    return;
  }
  next();
}

function estimatedMinutes(status: string, assignedAt: Date | null, pickedAt: Date | null): number | null {
  const now = Date.now();
  if (status === "pending") return 45;
  if (status === "assigned" && assignedAt) {
    const elapsed = Math.floor((now - assignedAt.getTime()) / 60000);
    return Math.max(5, 40 - elapsed);
  }
  if (status === "picked" && pickedAt) {
    const elapsed = Math.floor((now - pickedAt.getTime()) / 60000);
    return Math.max(2, 20 - elapsed);
  }
  if (status === "delivered" || status === "cancelled") return null;
  return 30;
}

async function buildOrderTracking(order: typeof ordersTable.$inferSelect) {
  const [toZone] = await db.select({ nameAr: zonesTable.nameAr })
    .from(zonesTable).where(eq(zonesTable.id, order.toZoneId));

  let driverName: string | null = null;
  let driverAvgRating: number | null = null;

  if (order.driverId) {
    const [driver] = await db.select({ fullName: usersTable.fullName })
      .from(usersTable).where(eq(usersTable.id, order.driverId));
    driverName = driver?.fullName ?? null;

    const avgResult = await db.select({ avg: avg(ratingsTable.stars) })
      .from(ratingsTable).where(eq(ratingsTable.driverId, order.driverId));
    driverAvgRating = avgResult[0]?.avg ? Math.round(parseFloat(avgResult[0].avg) * 10) / 10 : null;
  }

  const hasRatingResult = (await db.select({ c: count() })
    .from(ratingsTable).where(eq(ratingsTable.orderId, order.id)))[0]?.c > 0;

  return {
    id: order.id,
    orderId: order.orderId,
    status: order.status,
    fromBusiness: order.fromBusiness,
    fromAddress: order.fromAddress,
    fromZoneId: order.fromZoneId,
    toCustomerName: order.toCustomerName,
    toPhone: order.toPhone,
    toAddress: order.toAddress,
    toZoneId: order.toZoneId,
    toZoneName: toZone?.nameAr ?? null,
    priority: order.priority,
    driverId: order.driverId ?? null,
    driverName,
    driverAvgRating,
    customerId: order.customerId ?? null,
    notes: order.notes ?? null,
    createdAt: order.createdAt.toISOString(),
    assignedAt: order.assignedAt?.toISOString() ?? null,
    pickedAt: order.pickedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    trackingToken: order.trackingToken,
    hasRating: hasRatingResult,
    estimatedMinutes: estimatedMinutes(order.status, order.assignedAt, order.pickedAt),
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  food: "طعام", flowers: "ورد", pharmacy: "صيدلية",
  grocery: "بقالة", electronics: "إلكترونيات", clothing: "ملابس", other: "أخرى",
};

router.post("/customer/orders", requireAuth, requireCustomer, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CustomerOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const customer = req.user!;
  const trackingToken = generateTrackingToken();

  const [order] = await db.insert(ordersTable).values({
    orderId: `YW-2026-TEMP`,
    fromBusiness: parsed.data.fromBusiness,
    fromAddress: parsed.data.fromAddress,
    fromZoneId: parsed.data.fromZoneId,
    toCustomerName: customer.fullName,
    toPhone: customer.phone,
    toAddress: parsed.data.toAddress,
    toZoneId: parsed.data.toZoneId,
    priority: "normal",
    notes: parsed.data.notes ?? null,
    customerId: customer.id,
    trackingToken,
  }).returning();

  const [updated] = await db.update(ordersTable)
    .set({ orderId: generateOrderId(order.id) })
    .where(eq(ordersTable.id, order.id))
    .returning();

  const managers = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.role, "manager"));

  await Promise.all(managers.map((m) =>
    db.insert(notificationsTable).values({
      userId: m.id,
      message: `طلب جديد ${updated.orderId} من ${customer.fullName} — ${CATEGORY_LABELS[parsed.data.category] ?? "طلب"}`,
      type: "order",
    })
  ));

  res.status(201).json(await buildOrderTracking(updated));
});

router.get("/customer/orders", requireAuth, requireCustomer, async (req: AuthRequest, res): Promise<void> => {
  const orders = await db.select()
    .from(ordersTable)
    .where(eq(ordersTable.customerId, req.user!.id))
    .orderBy(sql`${ordersTable.createdAt} DESC`);

  const withDetails = await Promise.all(orders.map(buildOrderTracking));
  res.json(withDetails);
});

export default router;
