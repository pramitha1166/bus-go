// ─── Core owner domain types ───────────────────────────────────────────────────

export type BookingStatus = "CONFIRMED" | "PENDING" | "CANCELLED";
export type BusType = "NORMAL" | "SEMI_LUXURY" | "LUXURY" | "EXPRESSWAY";
export type SeatSelectionMode = "NONE" | "OPTIONAL" | "REQUIRED";
export type SeatStatus = "available" | "pending" | "confirmed" | "disabled";

export interface OwnerPayment {
  amount:           number;
  currency:         string;
  gatewayReference: string | null;
  paidAt:           string | null;
}

export interface OwnerBooking {
  id:             string;
  seatLabel:      string | null;
  journeyDate:    string;
  passengerName:  string;
  passengerPhone: string;
  status:         BookingStatus;
  payment:        OwnerPayment | null;
  createdAt:      string;
}

// NEW: per-seat data for the seat management grid
export interface OwnerSeat {
  label:       string;        // e.g. "1A", "BA"
  letter:      string;
  side:        "left" | "right" | "back";
  isWindow:    boolean;
  position:    number;
  status:      SeatStatus;
  booking:     {
    id:             string;
    passengerName:  string;
    passengerPhone: string;
    status:         BookingStatus;
  } | null;
}

export interface OwnerSchedule {
  id:                  string;
  from:                string;
  to:                  string;
  departureAt:         string;
  price:               number;
  isRecurring:         boolean;
  isActive:            boolean;
  activeDays:          string;
  seatSelectionMode:   SeatSelectionMode;
  busType:             BusType;
  smsNotificationSent: boolean;
  confirmedBookings:   number;
  pendingBookings:     number;
  cancelledBookings:   number;
  availableSeats:      number;
  revenue:             number;
}

export interface OwnerBus {
  id:         string;
  name:       string;
  regNumber:  string;
  busType:    BusType;
  rows:       number;
  totalSeats: number;
  schedules:  OwnerSchedule[];
}

export interface OwnerProfile {
  id:    string;
  name:  string;
  email: string | null;
  phone: string;
}

export interface OwnerStats {
  totalBuses:             number;
  totalSchedules:         number;
  totalConfirmedBookings: number;
  totalRevenue:           number;
}

// ─── API response shapes ───────────────────────────────────────────────────────

export interface OwnerDashboardResponse {
  owner: OwnerProfile;
  stats: OwnerStats;
  buses: OwnerBus[];
}

export interface OwnerStatsResponse {
  thisMonth: {
    totalBookings:     number;
    confirmedBookings: number;
    cancelledBookings: number;
    totalRevenue:      number;
    totalJourneys:     number;
  };
  today: {
    totalBookings:     number;
    confirmedBookings: number;
    totalRevenue:      number;
  };
}

export interface ScheduleBookingsResponse {
  schedule: {
    id:               string;
    from:             string;
    to:               string;
    departureAt:      string;
    price:            number;
    isRecurring:      boolean;
    isActive:         boolean;
    busType:          BusType;
    totalSeats:       number;
    seatSelectionMode: SeatSelectionMode;
  };
  bookings: OwnerBooking[];
}

// NEW: response for the seat management grid
export interface ScheduleSeatsResponse {
  seats:      OwnerSeat[];
  totalSeats: number;
  confirmed:  number;
  pending:    number;
  available:  number;
  disabled:   number;
}

// ─── Form input types ──────────────────────────────────────────────────────────

export interface CreateBusInput {
  name:      string;
  regNumber: string;
  busType:   BusType;
  rows:      number;
}

export interface CreateScheduleInput {
  busId:         string;
  fromStationId: string;
  toStationId:   string;
  departureAt:   string;  // HH:MM for recurring, full ISO for non-recurring
  price:         number;
  isRecurring:   boolean;
  activeDays?:   string;
}

export interface CreateOwnerInput {
  name:   string;
  email?: string;
  phone:  string;
}
