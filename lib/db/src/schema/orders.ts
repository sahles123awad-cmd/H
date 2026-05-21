import { pgTable, serial, text, integer, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";
import { usersTable } from "./users";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  fromBusiness: text("from_business").notNull(),
  fromAddress: text("from_address").notNull(),
  fromZoneId: integer("from_zone_id").notNull().references(() => zonesTable.id),
  toCustomerName: text("to_customer_name").notNull(),
  toPhone: text("to_phone").notNull(),
  toAddress: text("to_address").notNull(),
  toZoneId: integer("to_zone_id").notNull().references(() => zonesTable.id),
  priority: text("priority", { enum: ["urgent", "normal"] }).notNull().default("normal"),
  status: text("status", { enum: ["pending", "assigned", "picked", "delivered", "cancelled"] }).notNull().default("pending"),
  driverId: integer("driver_id").references(() => usersTable.id),
  customerId: integer("customer_id").references(() => usersTable.id),
  notes: text("notes"),
  trackingToken: text("tracking_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  pickedAt: timestamp("picked_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  eta: timestamp("eta", { withTimezone: true }),
  // New fields
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  rejectReason: text("reject_reason"),
  problemReport: text("problem_report"),
  driverNote: text("driver_note"),
  customerNote: text("customer_note"),
  deliveryFee: doublePrecision("delivery_fee").notNull().default(3.0),
  isArchived: boolean("is_archived").notNull().default(false),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
