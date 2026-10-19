import { NextResponse } from "next/server";
import { read, mutate } from "@/server/store";
import {
  readMutation,
  privateHeaders,
  failure,
  requireLocalHost,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    requireLocalHost(req);
  } catch (e) {
    return failure(e, 403);
  }
  try {
    const db = read();
    return NextResponse.json(
      { ...db, links: db.links.map((l) => ({ ...l, token: "" })) },
      { headers: privateHeaders },
    );
  } catch {
    return failure(
      Error(
        "Data lokal tidak dapat dibaca. Periksa berkas data/db.json tanpa menghapusnya.",
      ),
      500,
    );
  }
}
export async function POST(req: Request) {
  try {
    return NextResponse.json(mutate(await readMutation(req)), {
      headers: privateHeaders,
    });
  } catch (e) {
    return failure(e);
  }
}
