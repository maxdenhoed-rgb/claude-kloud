import { sessionBudget } from '@claudekloud/db';
import type { DbClient } from '@claudekloud/db';
import type { BudgetTier } from '@claudekloud/session-token';
import { eq, sql } from 'drizzle-orm';

// Default token caps per budget tier.
// ADR-0001 proposes 200K input / 50K output as the "standard" cap.
const BUDGET_CAPS: Record<BudgetTier, { inputCap: number; outputCap: number }> = {
  standard: { inputCap: 200_000, outputCap: 50_000 },
  extended: { inputCap: 500_000, outputCap: 150_000 },
  'long-context': { inputCap: 1_000_000, outputCap: 300_000 },
};

export interface BudgetRow {
  sessionId: string;
  inputTokensUsed: number;
  outputTokensUsed: number;
  inputCap: number;
  outputCap: number;
  expiresAt: Date;
}

/**
 * Ensure a session_budget row exists for the session.
 * Idempotent — if the row already exists this is a no-op.
 */
export async function ensureSessionBudget(
  db: DbClient,
  sessionId: string,
  budgetTier: BudgetTier,
  expiresAt: Date,
): Promise<void> {
  const caps = BUDGET_CAPS[budgetTier];

  await db
    .insert(sessionBudget)
    .values({
      sessionId,
      inputTokensUsed: 0,
      outputTokensUsed: 0,
      inputCap: caps.inputCap,
      outputCap: caps.outputCap,
      expiresAt,
    })
    .onConflictDoNothing();
}

/**
 * Read the current budget row for a session.
 * Returns null if the session has no budget record.
 */
export async function getSessionBudget(db: DbClient, sessionId: string): Promise<BudgetRow | null> {
  const rows = await db
    .select()
    .from(sessionBudget)
    .where(eq(sessionBudget.sessionId, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    sessionId: row.sessionId,
    inputTokensUsed: row.inputTokensUsed ?? 0,
    outputTokensUsed: row.outputTokensUsed ?? 0,
    inputCap: row.inputCap,
    outputCap: row.outputCap,
    expiresAt: row.expiresAt,
  };
}

/**
 * Check whether the session has remaining budget.
 * Returns null when the session is within budget.
 * Returns an object describing the breach when over budget.
 */
export function checkBudget(budget: BudgetRow):
  | {
      exceeded: false;
      remainingInput: number;
      remainingOutput: number;
    }
  | {
      exceeded: true;
      field: 'input' | 'output';
      remainingInput: number;
      remainingOutput: number;
    } {
  const remainingInput = budget.inputCap - budget.inputTokensUsed;
  const remainingOutput = budget.outputCap - budget.outputTokensUsed;

  if (remainingInput <= 0) {
    return { exceeded: true, field: 'input', remainingInput, remainingOutput };
  }
  if (remainingOutput <= 0) {
    return { exceeded: true, field: 'output', remainingInput, remainingOutput };
  }

  return { exceeded: false, remainingInput, remainingOutput };
}

/**
 * Atomically increment token counters for a session.
 * Uses UPDATE ... RETURNING to avoid a separate SELECT.
 * Returns the updated budget row.
 */
export async function incrementSessionTokens(
  db: DbClient,
  sessionId: string,
  inputDelta: number,
  outputDelta: number,
): Promise<BudgetRow | null> {
  const rows = await db
    .update(sessionBudget)
    .set({
      inputTokensUsed: sql`${sessionBudget.inputTokensUsed} + ${inputDelta}`,
      outputTokensUsed: sql`${sessionBudget.outputTokensUsed} + ${outputDelta}`,
      updatedAt: sql`now()`,
    })
    .where(eq(sessionBudget.sessionId, sessionId))
    .returning();

  const row = rows[0];
  if (!row) return null;

  return {
    sessionId: row.sessionId,
    inputTokensUsed: row.inputTokensUsed ?? 0,
    outputTokensUsed: row.outputTokensUsed ?? 0,
    inputCap: row.inputCap,
    outputCap: row.outputCap,
    expiresAt: row.expiresAt,
  };
}
