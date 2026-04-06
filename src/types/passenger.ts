export type BusType = "NORMAL" | "SEMI_LUXURY" | "LUXURY" | "EXPRESSWAY";
export type SeatSelectionMode = "NONE" | "OPTIONAL" | "REQUIRED";

export type SeatStatus = "available" | "pending" | "confirmed" | "disabled";

export interface Seat {
  label:     string;       // e.g. "1A", "2D", "BA"
  letter:    string;       // e.g. "A"
  side:      "left" | "right" | "back";
  isWindow:  boolean;
  position:  number;
  status:    SeatStatus;
}

export interface StationSummary {
  id:        string;
  name:      string;
  nameLocal: string;
  district:  string;
  province:  string;
}

export interface Schedule {
  id:                string;
  fromStation:       StationSummary;
  toStation:         StationSummary;
  departureTime:     string;   // formatted time string e.g. "08:30 AM"
  price:             number;
  isRecurring:       boolean;
  activeDays:        string;
  seatSelectionMode: SeatSelectionMode;
  busName:           string;
  busType:           BusType;
  registrationNumber: string;
  ownerName:         string;
  totalSeats:        number;
  availableSeats:    number;
}

export interface Booking {
  id:             string;
  scheduleId:     string;
  scheduleSeatId: string | null;
  journeyDate:    string;
  passengerName:  string;
  passengerPhone: string;
  passengerEmail?: string;
  status:         "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt:      string;
  updatedAt:      string;
  schedule: {
    id:          string;
    from:        string;
    to:          string;
    departureAt: string;
    price:       number;
  };
  scheduleSeat?: { seatLabel: string } | null;
  payment?: {
    id:               string;
    amount:           number;
    currency:         string;
    gatewayReference?: string;
    paidAt?:          string;
  };
}

export interface PayHerePayment {
  sandbox:     boolean;
  merchant_id: string;
  return_url:  string;
  cancel_url:  string;
  notify_url:  string;
  order_id:    string;
  items:       string;
  amount:      string;
  currency:    string;
  hash:        string;
  first_name:  string;
  last_name:   string;
  email:       string;
  phone:       string;
  address:     string;
  city:        string;
  country:     string;
}

export interface SearchParams {
  fromStationId?: string;
  toStationId?:   string;
  date?:          string;
}

export interface CreateBookingInput {
  scheduleId:     string;
  journeyDate:    string;  // YYYY-MM-DD
  seatLabel?:     string;  // null for NONE-mode buses
  passengerName:  string;
  passengerPhone: string;
  passengerEmail?: string;
}
