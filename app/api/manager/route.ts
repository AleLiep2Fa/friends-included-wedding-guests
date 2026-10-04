import { NextResponse } from "next/server";
import { apiError, jsonBody } from "@/app/api/_shared";
import { employeeIds, type EmployeeId, type ExpenseAllocation } from "@/lib/domain";
import { service } from "@/lib/server";
import { validateFinalSplit } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request); const actorId = String(body.actorId ?? ""); const action = String(body.action ?? ""); const reference = String(body.reference ?? "").trim().toUpperCase();
    if (action === "APPROVE_SALE") return NextResponse.json(await service().transactions.approveSale(actorId, reference, validateFinalSplit(body)));
    if (action === "APPROVE_EXPENSE") {
      const allocation = String(body.allocation ?? ""); if (!["A", "B", "OVERHEAD"].includes(allocation)) throw new Error("Choose a valid final allocation.");
      return NextResponse.json(await service().transactions.approveExpense(actorId, reference, allocation as ExpenseAllocation));
    }
    if (action === "RETRY_SYNC") { await service().transactions.retrySync(actorId, reference); return NextResponse.json({ ok: true }); }
    if (action === "RETRY_NOTIFICATION") { await service().transactions.retryNotification(actorId, reference); return NextResponse.json({ ok: true }); }
    if (action === "LINK_TELEGRAM") { const employeeId = String(body.employeeId ?? ""); if (!(employeeIds as readonly string[]).includes(employeeId)) throw new Error("Choose a valid fictional employee."); await service().transactions.linkTelegramEmployee(actorId, String(body.telegramUserId ?? ""), String(body.chatId ?? ""), employeeId as EmployeeId); return NextResponse.json({ ok: true }); }
    throw new Error("Unknown manager action.");
  } catch (error) { return apiError(error); }
}
