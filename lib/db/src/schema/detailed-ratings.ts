import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { ratingsTable } from "./ratings";

export const detailedRatingsTable = pgTable("detailed_ratings", {
  id: serial("id").primaryKey(),
  ratingId: integer("rating_id").notNull().references(() => ratingsTable.id),
  speedStars: integer("speed_stars").notNull(),
  honestyStars: integer("honesty_stars").notNull(),
  kindnessStars: integer("kindness_stars").notNull(),
});

export type DetailedRating = typeof detailedRatingsTable.$inferSelect;
