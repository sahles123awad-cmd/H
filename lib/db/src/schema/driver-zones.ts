import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { zonesTable } from "./zones";

export const driverZonesTable = pgTable("driver_zones", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => usersTable.id),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id),
}, (t) => ({
  uniq: unique().on(t.driverId, t.zoneId),
}));

export type DriverZone = typeof driverZonesTable.$inferSelect;
