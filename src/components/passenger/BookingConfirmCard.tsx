import { format } from "date-fns";
import { MapPin, Clock, Bus, User, Phone, CreditCard, Hash } from "lucide-react";
import type { Booking } from "@/types/passenger";

interface BookingConfirmCardProps {
  booking: Booking;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

export function BookingConfirmCard({ booking }: BookingConfirmCardProps) {
  const { schedule } = booking;
  const departure = new Date(schedule.departureTime);

  return (
    <div className="bg-white border border-border rounded-xl divide-y divide-border overflow-hidden">
      {/* Header */}
      <div className="bg-green-50 px-4 py-3 flex items-center gap-2">
        <Hash className="h-4 w-4 text-green-600" />
        <p className="text-xs font-mono text-green-700 break-all">{booking.id}</p>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Row
          icon={<User className="h-4 w-4" />}
          label="Passenger"
          value={booking.passengerName}
        />
        <Row
          icon={<Phone className="h-4 w-4" />}
          label="Phone"
          value={booking.passengerPhone}
        />
        <Row
          icon={<Bus className="h-4 w-4" />}
          label="Bus"
          value={`${schedule.bus.name} · ${schedule.bus.registrationNumber}`}
        />
        <Row
          icon={<MapPin className="h-4 w-4" />}
          label="Route"
          value={`${schedule.origin} → ${schedule.destination}`}
        />
        <Row
          icon={<Clock className="h-4 w-4" />}
          label="Departure"
          value={format(departure, "EEEE, dd MMMM yyyy · hh:mm a")}
        />
        <Row
          icon={<Hash className="h-4 w-4" />}
          label="Seat number"
          value={String(booking.seatNumber)}
        />
        {booking.payment && (
          <Row
            icon={<CreditCard className="h-4 w-4" />}
            label="Amount paid"
            value={`LKR ${Number(booking.payment.amount).toLocaleString("en-LK")}`}
          />
        )}
      </div>
    </div>
  );
}
