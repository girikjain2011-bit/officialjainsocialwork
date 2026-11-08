import type { Config, Context } from "@netlify/functions";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { terms } from "../../db/schema.js";
import { badRequest, clean, isAdmin, unauthorized } from "../../lib/auth.js";

export default async (req: Request, context: Context) => {
  const id = context.params.id ? Number(context.params.id) : null;

  if (req.method === "GET") {
    const rows = await db.select().from(terms).orderBy(asc(terms.position), asc(terms.id));
    return Response.json(rows);
  }

  if (!(await isAdmin(req))) return unauthorized();

  if (req.method === "POST" && id === null) {
    const body = await req.json().catch(() => ({}));
    const title = clean(body.title, 200);
    const text = clean(body.body, 5000);
    if (!title || !text) return badRequest("Title and content are required.");
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${terms.position}), 0)` }).from(terms);
    const [row] = await db.insert(terms).values({ title, body: text, position: Number(max) + 1 }).returning();
    return Response.json(row, { status: 201 });
  }

  if (id === null || Number.isNaN(id)) return badRequest("Missing term id.");

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    const title = clean(body.title, 200);
    const text = clean(body.body, 5000);
    if (!title || !text) return badRequest("Title and content are required.");
    const [row] = await db
      .update(terms)
      .set({ title, body: text, updatedAt: new Date() })
      .where(eq(terms.id, id))
      .returning();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(row);
  }

  if (req.method === "DELETE") {
    await db.delete(terms).where(eq(terms.id, id));
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/terms", "/api/terms/:id"],
};
