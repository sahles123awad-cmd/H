import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["manager", "driver", "customer"] }).notNull().default("customer"),
  zoneId: integer("zone_id").references(() => zonesTable.id),
  status: text("status", { enum: ["available", "busy", "off", "suspended"] }).notNull().default("off"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  dailyGoal: integer("daily_goal").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
