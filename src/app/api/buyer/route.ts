import { NextResponse } from "next/server";
import { buyerView, buyerSubmit, withDB } from "@/server/store";
import {
  readMutation,
  privateHeaders,
  failure,
  requireBuyer,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    requireBuyer(req);
    const p = new URL(req.url).searchParams;
    return NextResponse.json(
      await withDB(() =>
        buyerView(p.get("token") || "", p.get("invoice") || ""),
      ),
      { headers: privateHeaders },
    );
  } catch (e) {
    return failure(e, 403);
  }
}
export async function POST(req: Request) {
  try {
    requireBuyer(req);
    const input = await readMutation(req);
    return NextResponse.json(await withDB(() => buyerSubmit(input)), {
      headers: privateHeaders,
    });
  } catch (e) {
    return failure(e);
  }
}
