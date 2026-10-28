import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
export const privateHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const sessionName = "tt_session";
const sessionValue = () =>
  createHmac("sha256", process.env.APP_PASSWORD!)
    .update("tagih-tuntas-session")
    .digest("hex");
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function checkPassword(password: unknown) {
  const expected = process.env.APP_PASSWORD;
  return (
    !!expected &&
    typeof password === "string" &&
    same(
      createHmac("sha256", "login").update(password).digest("hex"),
      createHmac("sha256", "login").update(expected).digest("hex"),
    )
  );
}
export function sessionCookie(secure: boolean) {
  return {
    name: sessionName,
    value: sessionValue(),
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
// Without APP_PASSWORD the app stays loopback-only; with it, the vendor side
// needs the session cookie and buyer links rely on their own token.
export function requireVendor(req: Request) {
  if (!process.env.APP_PASSWORD) return requireLocalHost(req);
  const cookie = (req.headers.get("cookie") || "")
    .split(/;\s*/)
    .find((c) => c.startsWith(`${sessionName}=`));
  if (!cookie || !same(cookie.slice(sessionName.length + 1), sessionValue()))
    throw new HttpError("Masuk dengan kata sandi untuk membuka aplikasi.", 401);
}
export function requireBuyer(req: Request) {
  if (!process.env.APP_PASSWORD) requireLocalHost(req);
}
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export function requireLocalHost(req: Request) {
  const host = req.headers.get("host") || new URL(req.url).host;
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(`http://${host}`).hostname,
    )
  )
    throw Error("Aplikasi ini hanya dapat diakses dari localhost.");
}
export async function readMutation(
  req: Request,
): Promise<Record<string, unknown>> {
  const origin = req.headers.get("origin");
  if (
    req.headers.get("sec-fetch-site") === "cross-site" ||
    (origin &&
      (new URL(origin).host !==
        (req.headers.get("host") || new URL(req.url).host) ||
        new URL(origin).protocol !== new URL(req.url).protocol))
  )
    throw Error("Permintaan dari situs lain ditolak.");
  if (
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw Error("Gunakan Content-Type application/json.");
  if (Number(req.headers.get("content-length")) > 1_100_000)
    throw Error("Permintaan terlalu besar.");
  // Bound the stream as well; Content-Length can be missing or untrusted.
  const reader = req.body?.getReader();
  if (!reader) throw Error("Isi permintaan wajib ada.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1_100_000) {
        await reader.cancel();
        throw Error("Permintaan terlalu besar.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Error("JSON tidak valid.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("Isi permintaan harus objek JSON.");
  return data as Record<string, unknown>;
}
export function failure(e: unknown, status = 400) {
  if (e instanceof HttpError) status = e.status;
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Permintaan gagal." },
    { status, headers: privateHeaders },
  );
}
