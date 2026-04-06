import ExcelJS from "exceljs";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingRow {
  /** Full seat label e.g. "1A", "2D", "BA" — null for NONE-mode buses */
  seatLabel:     string | null;
  passengerName:  string;
  passengerPhone: string;
  bookingStatus:  string;  // CONFIRMED | PENDING | CANCELLED
  paymentStatus:  string;  // "PAID" | "UNPAID"
  paymentRef:     string | null;
  bookedAt:       Date;
  journeyDate:    Date | null;
}

export interface ScheduleInfo {
  from:        string;  // origin station name
  to:          string;  // destination station name
  totalSeats:  number;
  busType:     string;  // BusType enum value e.g. "LUXURY"
  journeyDate: string;  // formatted date string e.g. "01 Apr 2026"
}

export interface DailyBookingRow {
  seatLabel:      string | null;
  passengerName:  string;
  passengerPhone: string;
  busName:        string;
  route:          string;   // "origin → destination"
  departureTime:  Date;
  bookingStatus:  string;   // CONFIRMED | PENDING | CANCELLED
  paymentAmount:  number | null;
  paymentRef:     string | null;
  journeyDate:    Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid",
  fgColor: { argb: "FF1E3A5F" }, // dark navy
};

const META_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid",
  fgColor: { argb: "FFE8EEF7" }, // light steel blue
};

const SEPARATOR_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid",
  fgColor: { argb: "FFD9E1F2" }, // light blue
};

const STRIPE_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid",
  fgColor: { argb: "FFF0F4F8" }, // off-white
};

const SUMMARY_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid",
  fgColor: { argb: "FFFEF9C3" }, // light yellow
};

function formatSLDate(d: Date): string {
  return d.toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatSLDateOnly(d: Date): string {
  return d.toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric", month: "short", day: "numeric",
  });
}

function statusFontColor(status: string): string {
  switch (status) {
    case "CONFIRMED": return "FF166534"; // green
    case "CANCELLED": return "FF991B1B"; // red
    case "PENDING":   return "FF92400E"; // amber
    default:          return "FF374151";
  }
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font      = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill      = HEADER_FILL;
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height    = 22;
}

function addMetaRow(sheet: ExcelJS.Worksheet, label: string, value: string, colCount: number): ExcelJS.Row {
  const row = sheet.addRow([label, value]);
  row.font      = { bold: true };
  row.fill      = META_FILL;
  row.alignment = { vertical: "middle" };
  sheet.mergeCells(row.number, 2, row.number, colCount);
  row.getCell(1).font = { bold: true, color: { argb: "FF1E3A5F" } };
  return row;
}

function busTypeLabel(busType: string): string {
  switch (busType) {
    case "NORMAL":      return "Normal (2+3 layout)";
    case "SEMI_LUXURY": return "Semi-Luxury (2+2 layout)";
    case "LUXURY":      return "Luxury (2+2 layout, window seats)";
    case "EXPRESSWAY":  return "Expressway (2+2 layout)";
    default:            return busType;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateSeatSheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an Excel seat sheet for one schedule / journey date.
 * For NORMAL buses: shows a single crowd-level summary row instead of per-seat rows.
 * Returns a Buffer ready for a file download response.
 */
export async function generateSeatSheet(
  bookings: BookingRow[],
  info: ScheduleInfo
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bus Booking System";
  workbook.created = new Date();

  const sheetName = `${info.from} → ${info.to}`.slice(0, 31);
  const sheet     = workbook.addWorksheet(sheetName);

  const isNormal = info.busType === "NORMAL";
  const COL_COUNT = 7;

  // ── Metadata header rows ───────────────────────────────────────────────────
  sheet.columns = [
    { key: "col1", width: 18 },
    { key: "col2", width: 22 },
    { key: "col3", width: 18 },
    { key: "col4", width: 18 },
    { key: "col5", width: 16 },
    { key: "col6", width: 26 },
    { key: "col7", width: 24 },
  ];

  addMetaRow(sheet, "Route",        `${info.from} → ${info.to}`, COL_COUNT);
  addMetaRow(sheet, "Bus Type",     busTypeLabel(info.busType),   COL_COUNT);
  addMetaRow(sheet, "Journey Date", info.journeyDate,             COL_COUNT);
  addMetaRow(sheet, "Total Seats",  String(info.totalSeats),      COL_COUNT);
  sheet.addRow([]); // blank spacer

  // ── Column headers ─────────────────────────────────────────────────────────
  const colHeaderRow = sheet.addRow([
    "Seat Label", "Passenger Name", "Passenger Phone",
    "Booking Status", "Payment Status", "Payment Ref", "Booked At",
  ]);
  styleHeaderRow(colHeaderRow);

  // ── Data rows ──────────────────────────────────────────────────────────────
  const confirmedCount = bookings.filter((b) => b.bookingStatus === "CONFIRMED").length;

  if (isNormal) {
    // NORMAL buses: show a single crowd-level summary row
    const crowdRow = sheet.addRow([
      `Crowd level: ${confirmedCount} / ${info.totalSeats} passengers`,
    ]);
    sheet.mergeCells(crowdRow.number, 1, crowdRow.number, COL_COUNT);
    crowdRow.font      = { bold: true, italic: true };
    crowdRow.fill      = SUMMARY_FILL;
    crowdRow.alignment = { vertical: "middle", horizontal: "center" };
  } else {
    // LUXURY / SEMI_LUXURY / EXPRESSWAY: show per-seat rows
    const sorted = [...bookings].sort((a, b) =>
      (a.seatLabel ?? "").localeCompare(b.seatLabel ?? "")
    );

    sorted.forEach((b, idx) => {
      const row = sheet.addRow([
        b.seatLabel ?? "—",
        b.passengerName,
        b.passengerPhone,
        b.bookingStatus,
        b.paymentStatus,
        b.paymentRef ?? "",
        formatSLDate(b.bookedAt),
      ]);

      if (idx % 2 === 0) row.fill = STRIPE_FILL;
      row.alignment = { vertical: "middle" };

      const statusCell = row.getCell(4);
      statusCell.font = { bold: true, color: { argb: statusFontColor(b.bookingStatus) } };
    });
  }

  // ── Summary footer ─────────────────────────────────────────────────────────
  const emptySeats = info.totalSeats - confirmedCount;
  sheet.addRow([]);
  const summaryRow = sheet.addRow([
    `Total Seats: ${info.totalSeats}`,
    `Confirmed: ${confirmedCount}`,
    `Empty: ${emptySeats}`,
  ]);
  summaryRow.font = { bold: true };
  summaryRow.fill = SUMMARY_FILL;

  // ── Freeze header ──────────────────────────────────────────────────────────
  sheet.views = [{ state: "frozen", ySplit: 6 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// generateDailyReport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the end-of-day master report Excel.
 * Rows are grouped by bus with a bold separator row before each group.
 * Returns a Buffer ready for a file download response.
 */
export async function generateDailyReport(
  bookings: DailyBookingRow[],
  reportDate: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bus Booking System";
  workbook.created = new Date();

  const sheetName = `Daily Report — ${reportDate}`.slice(0, 31);
  const sheet     = workbook.addWorksheet(sheetName);

  const COLUMN_COUNT = 10;
  sheet.columns = [
    { header: "Seat Label",      key: "seatLabel",      width: 12 },
    { header: "Journey Date",    key: "journeyDate",    width: 16 },
    { header: "Passenger Name",  key: "passengerName",  width: 26 },
    { header: "Passenger Phone", key: "passengerPhone", width: 18 },
    { header: "Bus Name",        key: "busName",        width: 24 },
    { header: "Route",           key: "route",          width: 30 },
    { header: "Departure Time",  key: "departureTime",  width: 16 },
    { header: "Booking Status",  key: "bookingStatus",  width: 18 },
    { header: "Payment Amount",  key: "paymentAmount",  width: 18 },
    { header: "Payment Ref",     key: "paymentRef",     width: 26 },
  ];

  styleHeaderRow(sheet.getRow(1));

  // ── Group by bus name ──────────────────────────────────────────────────────
  const groups = new Map<string, DailyBookingRow[]>();
  for (const row of bookings) {
    if (!groups.has(row.busName)) groups.set(row.busName, []);
    groups.get(row.busName)!.push(row);
  }

  let stripeIdx = 0;

  for (const [, rows] of Array.from(groups)) {
    const sortedRows = [...rows].sort((a, b) =>
      (a.seatLabel ?? "").localeCompare(b.seatLabel ?? "")
    );
    const { busName, route } = sortedRows[0];

    const sep = sheet.addRow({ seatLabel: `${busName}  —  ${route}` });
    sep.font      = { bold: true, color: { argb: "FF1E3A5F" } };
    sep.fill      = SEPARATOR_FILL;
    sep.alignment = { vertical: "middle" };
    sheet.mergeCells(sep.number, 1, sep.number, COLUMN_COUNT);

    for (const b of sortedRows) {
      const row = sheet.addRow({
        seatLabel:     b.seatLabel ?? "—",
        journeyDate:   b.journeyDate ? formatSLDateOnly(b.journeyDate) : "—",
        passengerName: b.passengerName,
        passengerPhone: b.passengerPhone,
        busName:       b.busName,
        route:         b.route,
        departureTime: formatSLDate(b.departureTime),
        bookingStatus: b.bookingStatus,
        paymentAmount: b.paymentAmount != null ? b.paymentAmount.toFixed(2) : "",
        paymentRef:    b.paymentRef ?? "",
      });

      if (stripeIdx % 2 === 0) row.fill = STRIPE_FILL;
      row.alignment = { vertical: "middle" };

      const statusCell = row.getCell("bookingStatus");
      statusCell.font = { bold: true, color: { argb: statusFontColor(b.bookingStatus) } };

      stripeIdx++;
    }
  }

  // ── Summary footer ─────────────────────────────────────────────────────────
  const totalConfirmed = bookings.filter((b) => b.bookingStatus === "CONFIRMED").length;
  const totalCancelled = bookings.filter((b) => b.bookingStatus === "CANCELLED").length;
  const totalRevenue   = bookings.reduce(
    (sum, b) => b.bookingStatus === "CONFIRMED" ? sum + (b.paymentAmount ?? 0) : sum, 0
  );

  sheet.addRow([]);
  const summaryRow = sheet.addRow({
    seatLabel:     `Total Bookings: ${bookings.length}`,
    journeyDate:   `Confirmed: ${totalConfirmed}`,
    passengerName: `Cancelled: ${totalCancelled}`,
    passengerPhone: `Revenue: LKR ${totalRevenue.toFixed(2)}`,
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = SUMMARY_FILL;

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
