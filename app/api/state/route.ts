import { NextResponse } from "next/server";
import { apiError } from "@/app/api/_shared";
import { calculateFinancialTotals } from "@/lib/rules";
import { service } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actorId = new URL(request.url).searchParams.get("actorId") ?? "richard";
    const { repo } = service(); const actor = await repo.getEmployee(actorId); if (!actor) throw new Error("Choose a valid demonstration role.");
    const all = await repo.getState();
    const state = actor.role === "MANAGER" ? all : { ...all, sales: all.sales.filter((sale) => sale.submitterId === actor.id), expenses: all.expenses.filter((expense) => expense.submitterId === actor.id), syncAttempts: [], notificationAttempts: [] };
    return NextResponse.json({ actor, state, totals: actor.role === "MANAGER" ? calculateFinancialTotals(all) : null });
  } catch (error) { return apiError(error, 500); }
}
