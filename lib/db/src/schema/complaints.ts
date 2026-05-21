import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id),
  customerPhone: text("customer_phone").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Complaint = typeof complaintsTable.$inferSelect;
