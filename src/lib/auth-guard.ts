import { getServerSession, Session } from "next-auth";
import { NextResponse }               from "next/server";
import { authOptions }                from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result type
// ─────────────────────────────────────────────────────────────────────────────

type GuardResult =
  | { session: Session; error: null }
  | { session: null;    error: NextResponse };

// ─────────────────────────────────────────────────────────────────────────────
// requireBusOwner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call at the top of any /api/portal/* route handler.
 * Returns { session } on success so the caller can use session.user.id.
 * Returns { error } (a ready-to-return NextResponse) on auth failure.
 *
 * Usage:
 *   const { session, error } = await requireBusOwner();
 *   if (error) return error;
 */
export async function requireBusOwner(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      session: null,
      error:   NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      ),
    };
  }

  if (session.user.role !== "BUS_OWNER") {
    return {
      session: null,
      error:   NextResponse.json(
        { error: "Forbidden. Bus owner access required." },
        { status: 403 }
      ),
    };
  }

  return { session, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAdmin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call at the top of any /api/admin/* route handler.
 * Returns { session } on success.
 * Returns { error } on auth failure.
 */
export async function requireAdmin(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      session: null,
      error:   NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      ),
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      error:   NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { session, error: null };
}
