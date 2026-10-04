import { NextResponse } from "next/server";
import { apiError, jsonBody } from "@/app/api/_shared";
import { service } from "@/lib/server";
import { validateSaleInput } from "@/lib/validation";

export async function POST(request: Request) {
  try { const body = await jsonBody(request); const actorId = String(body.actorId ?? ""); const sale = await service().transactions.submitSale(actorId, "WEBSITE", null, validateSaleInput(body)); return NextResponse.json({ sale }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
