import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appointments } from "../../db/schema.js";
import { badRequest, clean, isAdmin, unauthorized } from "../../lib/auth.js";

const STATUSES = ["pending", "confirmed", "completed", "cancelled"];

function readFields(body: Record<string, unknown>) {
  return {
    name: clean(body.name, 200),
    mobile: clean(body.mobile, 20),
    email: clean(body.email, 200),
    purpose: clean(body.purpose, 50),
    otherPurpose: clean(body.otherPurpose, 300) || null,
    preferredDate: clean(body.date ?? body.preferredDate, 20),
    preferredTime: clean(body.time ?? body.preferredTime, 20),
    details: clean(body.details, 3000) || null,
  };
}

export default async (req: Request, context: Context) => {
  const id = context.params.id ? Number(context.params.id) : null;

  // Public: create a new appointment request
  if (req.method === "POST" && id === null) {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid request.");
    if (body["bot-field"]) return Response.json({ ok: true }); // honeypot
    if (body.terms !== "accepted") return badRequest("Please accept the Terms & Conditions.");
    const values = readFields(body);
    if (!values.name || !values.mobile || !values.email || !values.purpose || !values.preferredDate || !values.preferredTime) {
      return badRequest("Please fill in all required fields.");
    }
    if (values.purpose === "other" && !values.otherPurpose) return badRequest("Please specify the program you require.");
    await db.insert(appointments).values(values);
    return Response.json({ ok: true }, { status: 201 });
  }

  // Everything below is admin-only
  if (!(await isAdmin(req))) return unauthorized();

  if (req.method === "GET" && id === null) {
    const rows = await db.select().from(appointments).orderBy(desc(appointments.createdAt));
    return Response.json(rows);
  }

  if (id === null || Number.isNaN(id)) return badRequest("Missing appointment id.");

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid request.");
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return badRequest("Invalid status.");
      update.status = body.status;
    }
    if (body.preferredDate !== undefined) update.preferredDate = clean(body.preferredDate, 20);
    if (body.preferredTime !== undefined) update.preferredTime = clean(body.preferredTime, 20);
    const [row] = await db.update(appointments).set(update).where(eq(appointments.id, id)).returning();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(row);
  }

  if (req.method === "DELETE") {
    await db.delete(appointments).where(eq(appointments.id, id));
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/appointments", "/api/appointments/:id"],
};
