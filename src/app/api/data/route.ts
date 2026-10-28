import { NextResponse } from "next/server";
import { read, mutate, withDB } from "@/server/store";
import {
  readMutation,
  privateHeaders,
  failure,
  requireVendor,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    requireVendor(req);
  } catch (e) {
    return failure(e, 403);
  }
  try {
    const db = await withDB(read);
    return NextResponse.json(
      { ...db, links: db.links.map((l) => ({ ...l, token: "" })) },
      { headers: privateHeaders },
    );
  } catch {
    return failure(
      Error(
        "Data tidak dapat dibaca. Periksa penyimpanan data tanpa menghapusnya.",
      ),
      500,
    );
  }
}
export async function POST(req: Request) {
  try {
    requireVendor(req);
    const input = await readMutation(req);
    return NextResponse.json(await withDB(() => mutate(input)), {
      headers: privateHeaders,
    });
  } catch (e) {
    return failure(e);
  }
}
