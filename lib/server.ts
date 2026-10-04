import "server-only";
import { SupabaseRepository } from "@/lib/supabase-repository";
import { productionSideEffects } from "@/lib/side-effects";
import { TransactionService } from "@/lib/transaction-service";

export function service() {
  const repo = new SupabaseRepository();
  return { repo, transactions: new TransactionService(repo, productionSideEffects(repo)) };
}
