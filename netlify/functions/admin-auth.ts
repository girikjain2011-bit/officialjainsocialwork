import type { Config, Context } from "@netlify/functions";
import { createSession, credentialsValid, destroySession, isAdmin, isLockedOut, recordFailedAttempt } from "../../lib/auth.js";

export default async (req: Request, context: Context) => {
  const action = context.params.action;

  if (action === "login" && req.method === "POST") {
    const ip = context.ip || "unknown";
    if (await isLockedOut(ip)) {
      return Response.json({ error: "Too many failed attempts. Please try again in 15 minutes." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    if (!credentialsValid(body.email, body.passcode)) {
      await recordFailedAttempt(ip);
      return Response.json({ error: "Incorrect email or passcode." }, { status: 401 });
    }
    const session = await createSession();
    return Response.json(session);
  }

  if (action === "logout" && req.method === "POST") {
    await destroySession(req);
    return Response.json({ ok: true });
  }

  if (action === "session" && req.method === "GET") {
    return Response.json({ valid: await isAdmin(req) });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: "/api/admin/:action",
};
