import { NextResponse } from "next/server";
import {
  checkPassword,
  failure,
  privateHeaders,
  readMutation,
  sessionCookie,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { password } = await readMutation(req);
    if (!checkPassword(password))
      return failure(Error("Kata sandi salah."), 401);
    const res = NextResponse.json({ ok: true }, { headers: privateHeaders });
    res.cookies.set(sessionCookie(new URL(req.url).protocol === "https:"));
    return res;
  } catch (e) {
    return failure(e);
  }
}
