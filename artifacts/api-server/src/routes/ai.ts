import { Router } from "express";
import { db, ordersTable, usersTable, zonesTable, ratingsTable } from "@workspace/db";
import { eq, and, avg, count } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../lib/auth";
import { SuggestDriverBody, DetectZoneBody } from "@workspace/api-zod";

const router = Router();

// Smart rule-based driver suggestion
router.post("/ai/suggest-driver", requireAuth, requireRole("manager"), async (req, res): Promise<void> => {
  const parsed = SuggestDriverBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const availableDrivers = await db.select().from(usersTable)
    .where(and(eq(usersTable.role, "driver"), eq(usersTable.status, "available"), eq(usersTable.isActive, true)));

  if (availableDrivers.length === 0) {
    res.status(404).json({ error: "لا يوجد سائقون متاحون حالياً" });
    return;
  }

  // Score each driver
  const scored = await Promise.all(availableDrivers.map(async d => {
    let score = 50;
    const reasons: string[] = [];

    // Zone proximity bonus
    if (d.zoneId === order.fromZoneId || d.zoneId === order.toZoneId) {
      score += 30;
      reasons.push("يعمل في نفس منطقة الطلب");
    }

    // Rating bonus
    const avgResult = await db.select({ avg: avg(ratingsTable.stars), total: count() })
      .from(ratingsTable).where(eq(ratingsTable.driverId, d.id));
    const avgRating = parseFloat(avgResult[0]?.avg ?? "0") || 0;
    const totalRatings = avgResult[0]?.total ?? 0;

    if (avgRating >= 4.5) { score += 20; reasons.push("تقييم عالٍ جداً"); }
    else if (avgRating >= 4.0) { score += 10; reasons.push("تقييم جيد"); }
    else if (avgRating >= 3.0) { score += 5; }

    // Urgent order: prefer high-rated drivers
    if (order.priority === "urgent" && avgRating >= 4.5) {
      score += 15;
      reasons.push("مناسب للطلبات العاجلة");
    }

    // Delivery count (experienced drivers get a small bonus)
    const deliveredResult = await db.select({ count: count() }).from(ordersTable)
      .where(and(eq(ordersTable.driverId, d.id), eq(ordersTable.status, "delivered")));
    const delivered = deliveredResult[0]?.count ?? 0;
    if (delivered >= 50) { score += 10; reasons.push("سائق متمرس"); }
    else if (delivered >= 20) { score += 5; }

    const reason = reasons.length > 0
      ? reasons.join("، ")
      : "متاح حالياً ويمكنه استلام الطلب";

    return { driver: d, score, reason, avgRating };
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  res.json({
    driverId: best.driver.id,
    driverName: best.driver.fullName,
    reason: best.reason,
  });
});

// AI zone detection from address text (rule-based keyword matching)
router.post("/ai/detect-zone", async (req, res): Promise<void> => {
  const parsed = DetectZoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const address = parsed.data.address.toLowerCase();
  const zones = await db.select().from(zonesTable).where(eq(zonesTable.isActive, true));

  let bestMatch: typeof zones[0] | null = null;
  let bestScore = 0;

  for (const zone of zones) {
    const arabicWords = zone.nameAr.toLowerCase().split(/\s+/);
    const englishWords = zone.nameEn.toLowerCase().split(/[\s\-_]+/);
    let score = 0;

    for (const word of arabicWords) {
      if (word.length > 2 && address.includes(word)) score += word.length;
    }
    for (const word of englishWords) {
      if (word.length > 2 && address.includes(word)) score += word.length;
    }

    if (score > bestScore) { bestScore = score; bestMatch = zone; }
  }

  if (!bestMatch || bestScore === 0) {
    // Default to first zone
    const [defaultZone] = zones;
    res.json({ zoneId: defaultZone.id, zoneName: defaultZone.nameAr, confidence: "low" });
    return;
  }

  const confidence = bestScore >= 10 ? "high" : bestScore >= 5 ? "medium" : "low";
  res.json({ zoneId: bestMatch.id, zoneName: bestMatch.nameAr, confidence });
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
