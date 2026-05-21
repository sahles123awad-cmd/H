import { Router } from "express";
import { db, ratingsTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ListRatingsQueryParams, CreateRatingBody } from "@workspace/api-zod";

const router = Router();

router.get("/ratings", async (req, res): Promise<void> => {
  const parsed = ListRatingsQueryParams.safeParse(req.query);
  const conditions: any[] = [];
  if (parsed.success) {
    if (parsed.data.driverId) conditions.push(eq(ratingsTable.driverId, parsed.data.driverId));
    if (parsed.data.orderId) conditions.push(eq(ratingsTable.orderId, parsed.data.orderId));
  }

  const ratings = conditions.length > 0
    ? await db.select().from(ratingsTable).where(and(...conditions)).orderBy(ratingsTable.createdAt)
    : await db.select().from(ratingsTable).orderBy(ratingsTable.createdAt);

  res.json(ratings.map(r => ({
    id: r.id, orderId: r.orderId, driverId: r.driverId, customerName: r.customerName,
    stars: r.stars, comment: r.comment, createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/ratings", async (req, res): Promise<void> => {
  const parsed = CreateRatingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [rating] = await db.insert(ratingsTable).values({
    orderId: parsed.data.orderId,
    driverId: parsed.data.driverId,
    customerName: parsed.data.customerName,
    stars: parsed.data.stars,
    comment: parsed.data.comment ?? null,
  }).returning();

  // Notify driver of new rating
  await db.insert(notificationsTable).values({
    userId: parsed.data.driverId,
    message: `حصلت على تقييم ${parsed.data.stars} نجوم من ${parsed.data.customerName}`,
    type: "rating",
  });

  res.status(201).json({
    id: rating.id, orderId: rating.orderId, driverId: rating.driverId,
    customerName: rating.customerName, stars: rating.stars, comment: rating.comment,
    createdAt: rating.createdAt.toISOString(),
  });
});

export default router;
