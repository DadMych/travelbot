import { pgTable, text, timestamp, doublePrecision, integer, uuid, jsonb } from "drizzle-orm/pg-core";
import type { FeatureCollection, Geometry } from "geojson";

export const visits = pgTable("visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  countryCode: text("country_code").notNull(),
  region: text("region"),
  continent: text("continent"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  osmPlaceId: text("osm_place_id"),
  osmType: text("osm_type"),
  osmId: text("osm_id"),
  boundary: jsonb("boundary").$type<Geometry | null>(),
  visitedAt: timestamp("visited_at", { withTimezone: true }),
  notes: text("notes"),
  rating: integer("rating"),
  source: text("source").notNull().default("telegram"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boundaryCache = pgTable("boundary_cache", {
  cacheKey: text("cache_key").primaryKey(),
  kind: text("kind").notNull(),
  label: text("label"),
  countryCode: text("country_code"),
  payload: jsonb("payload").$type<FeatureCollection>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  travelStatus: text("travel_status").notNull().default("home"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
