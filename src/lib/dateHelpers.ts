import { getISODay, startOfDay, endOfDay, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TZ = 'Asia/Colombo'

export function nowInColombo() {
  return toZonedTime(new Date(), TZ)
}

export function todayDayOfWeek() {
  return getISODay(nowInColombo()) // 1=Monday, 7=Sunday
}

export function startOfDayColombo(date: Date) {
  return startOfDay(toZonedTime(date, TZ))
}

export function endOfDayColombo(date: Date) {
  return endOfDay(toZonedTime(date, TZ))
}

export function formatTime12h(time: string) {
  // Converts "08:30" to "8:30 AM"
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export function isDayActive(activeDays: string, date: Date) {
  const day = getISODay(toZonedTime(date, TZ))
  return activeDays.split(',').map(Number).includes(day)
}
