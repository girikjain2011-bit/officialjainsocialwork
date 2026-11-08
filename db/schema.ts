import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const appointments = pgTable("appointments", {
  id: serial().primaryKey(),
  name: text().notNull(),
  mobile: text().notNull(),
  email: text().notNull(),
  purpose: text().notNull(),
  otherPurpose: text("other_purpose"),
  preferredDate: text("preferred_date").notNull(),
  preferredTime: text("preferred_time").notNull(),
  details: text(),
  status: text().notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const terms = pgTable("terms", {
  id: serial().primaryKey(),
  title: text().notNull(),
  body: text().notNull(),
  position: integer().notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminSessions = pgTable("admin_sessions", {
  token: text().primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: serial().primaryKey(),
  ip: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
