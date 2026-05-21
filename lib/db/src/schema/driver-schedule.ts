import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const driverScheduleTable = pgTable("driver_schedule", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => usersTable.id),
  date: text("date").notNull(),
  status: text("status", { enum: ["working", "off", "sick"] }).notNull().default("working"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.driverId, t.date),
}));

export type DriverSchedule = typeof driverScheduleTable.$inferSelect;
