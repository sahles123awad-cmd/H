import { Router } from "express";
import { db, zonesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ListZonesQueryParams, GetZoneParams } from "@workspace/api-zod";

const router = Router();

router.get("/zones", async (req, res): Promise<void> => {
  const parsed = ListZonesQueryParams.safeParse(req.query);
  const conditions = [eq(zonesTable.isActive, true)];

  const zones = await db.select().from(zonesTable).where(and(...conditions)).orderBy(zonesTable.governorate, zonesTable.nameAr);
  res.json(zones.map(z => ({
    id: z.id, nameAr: z.nameAr, nameEn: z.nameEn,
    governorate: z.governorate, region: z.region, isActive: z.isActive,
  })));
});

router.get("/zones/:id", async (req, res): Promise<void> => {
  const params = GetZoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [zone] = await db.select().from(zonesTable).where(eq(zonesTable.id, params.data.id));
  if (!zone) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }

  res.json({ id: zone.id, nameAr: zone.nameAr, nameEn: zone.nameEn, governorate: zone.governorate, region: zone.region, isActive: zone.isActive });
});

export default router;
