import { NextResponse } from "next/server";
import { apiError, jsonBody } from "@/app/api/_shared";
import { service } from "@/lib/server";
import { validateExpenseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try { const body = await jsonBody(request); const actorId = String(body.actorId ?? ""); const expense = await service().transactions.submitExpense(actorId, "WEBSITE", null, validateExpenseInput(body)); return NextResponse.json({ expense }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
