// BusType and SeatSelectionMode are re-declared here as string unions so this
// module compiles before `prisma generate` runs. After generation, these will
// match the Prisma enum values exactly.
export type BusType = "NORMAL" | "SEMI_LUXURY" | "LUXURY" | "EXPRESSWAY";
export type SeatSelectionMode = "NONE" | "OPTIONAL" | "REQUIRED";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SeatInfo {
  /** Full unique label stored in ScheduleSeat.seatLabel — e.g. "1A", "2C", "BA" */
  label: string;
  /** Single letter within the row — "A", "B", "C", "D", "E" */
  letter: string;
  side: "left" | "right" | "back";
  isWindow: boolean;
  /** Display order within the row */
  position: number;
}

export interface RowInfo {
  rowNumber: number;
  isBackRow: boolean;
  seats: SeatInfo[];
}

export interface SeatLayout {
  rows: RowInfo[];
  totalSeats: number;
  seatsPerRow: number;
  seatSelectionMode: SeatSelectionMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getSeatSelectionMode(busType: BusType): SeatSelectionMode {
  switch (busType) {
    case "NORMAL":      return "NONE";
    case "SEMI_LUXURY": return "OPTIONAL";
    case "LUXURY":      return "REQUIRED";
    case "EXPRESSWAY":  return "REQUIRED";
  }
}

export function calculateTotalSeats(busType: BusType, rows: number): number {
  const seatsPerRow = busType === "NORMAL" ? 5 : 4;
  return rows * seatsPerRow + 5;
}

function isWindowSeat(busType: BusType, letter: string, isBackRow: boolean): boolean {
  if (isBackRow) return letter === "A" || letter === "E";
  // Left-side window is always "A"; right-side window depends on layout
  if (busType === "NORMAL") return letter === "A" || letter === "E";
  return letter === "A" || letter === "D";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the full seat layout for a bus.
 *
 * Layout rules:
 *   NORMAL     — left A,B | right C,D,E | back A,B,C,D,E | window: A & E
 *   SEMI_LUXURY — left A,B | right C,D   | back A,B,C,D,E | window: A & D
 *   LUXURY      — same as SEMI_LUXURY + mark A,D as isWindow on every row
 *   EXPRESSWAY  — same layout as SEMI_LUXURY
 *
 * Seat labels (stored in ScheduleSeat.seatLabel):
 *   Regular rows : {rowNumber}{letter}  e.g. "1A", "2C", "9D"
 *   Back row     : B{letter}            e.g. "BA", "BB", "BE"
 */
export function generateSeatLayout(busType: BusType, rows: number): SeatLayout {
  const isNormal     = busType === "NORMAL";
  const leftLetters  = ["A", "B"] as const;
  const rightLetters = isNormal ? ["C", "D", "E"] : ["C", "D"];
  const seatsPerRow  = isNormal ? 5 : 4;

  const rowLayouts: RowInfo[] = [];

  for (let r = 1; r <= rows; r++) {
    const seats: SeatInfo[] = [];
    let pos = 1;

    for (const letter of leftLetters) {
      seats.push({
        label:    `${r}${letter}`,
        letter,
        side:     "left",
        isWindow: isWindowSeat(busType, letter, false),
        position: pos++,
      });
    }

    for (const letter of rightLetters) {
      seats.push({
        label:    `${r}${letter}`,
        letter,
        side:     "right",
        isWindow: isWindowSeat(busType, letter, false),
        position: pos++,
      });
    }

    rowLayouts.push({ rowNumber: r, isBackRow: false, seats });
  }

  // Back row — always 5 seats A-E for all bus types
  const backSeats: SeatInfo[] = ["A", "B", "C", "D", "E"].map((letter, i) => ({
    label:    `B${letter}`,
    letter,
    side:     "back",
    isWindow: isWindowSeat(busType, letter, true),
    position: i + 1,
  }));

  rowLayouts.push({ rowNumber: rows + 1, isBackRow: true, seats: backSeats });

  return {
    rows:              rowLayouts,
    totalSeats:        rows * seatsPerRow + 5,
    seatsPerRow,
    seatSelectionMode: getSeatSelectionMode(busType),
  };
}
