import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const driverMessagesTable = pgTable("driver_messages", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => usersTable.id),
  message: text("message").notNull(),
  isPreset: boolean("is_preset").notNull().default(false),
  isReadByManager: boolean("is_read_by_manager").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DriverMessage = typeof driverMessagesTable.$inferSelect;
