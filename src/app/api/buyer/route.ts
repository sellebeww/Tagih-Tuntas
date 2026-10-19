import { NextResponse } from "next/server";
import { buyerView, buyerSubmit } from "@/server/store";
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
    const p = new URL(req.url).searchParams;
    return NextResponse.json(
      buyerView(p.get("token") || "", p.get("invoice") || ""),
      { headers: privateHeaders },
    );
  } catch (e) {
    return failure(e, 403);
  }
}
export async function POST(req: Request) {
  try {
    return NextResponse.json(buyerSubmit(await readMutation(req)), {
      headers: privateHeaders,
    });
  } catch (e) {
    return failure(e);
  }
}
