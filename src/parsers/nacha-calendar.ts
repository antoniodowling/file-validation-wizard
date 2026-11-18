/**
 * Federal Reserve Bank (FedACH settlement) standard holidays.
 * Source: https://www.frbservices.org/about/holiday-schedules/
 * Saturday fixed-date holidays do NOT close the preceding Friday;
 * Sunday fixed-date holidays close the following Monday.
 * Weekend dates are handled by nacha.effective-weekend, not duplicated here.
 */
const nthWeekday = (year: number, month: number, weekday: number, ordinal: number): number => {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + (weekday - firstWeekday + 7) % 7 + 7 * (ordinal - 1);
};

const lastWeekday = (year: number, month: number, weekday: number): number => {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - (last.getUTCDay() - weekday + 7) % 7;
};

const observedFixedHoliday = (year: number, month: number, day: number, candidate: Date): boolean => {
  const observed = new Date(Date.UTC(year, month - 1, day));
  if (observed.getUTCDay() === 0) observed.setUTCDate(observed.getUTCDate() + 1);
  // No preceding-Friday observance when the actual holiday is Saturday.
  return observed.getUTCMonth() === candidate.getUTCMonth()
    && observed.getUTCDate() === candidate.getUTCDate();
};

/** Returns the holiday name only for a weekday on which FedACH cannot settle. */
export function federalReserveHoliday(candidate: Date): string | null {
  const year = candidate.getUTCFullYear();
  const month = candidate.getUTCMonth() + 1;
  const day = candidate.getUTCDate();
  const weekday = candidate.getUTCDay();
  if (weekday === 0 || weekday === 6) return null;

  if (observedFixedHoliday(year, 1, 1, candidate)) return "New Year's Day";
  if (month === 1 && day === nthWeekday(year, 1, 1, 3)) return "Martin Luther King Jr. Day";
  if (month === 2 && day === nthWeekday(year, 2, 1, 3)) return "Washington's Birthday";
  if (month === 5 && day === lastWeekday(year, 5, 1)) return "Memorial Day";
  if (year >= 2021 && observedFixedHoliday(year, 6, 19, candidate)) return "Juneteenth";
  if (observedFixedHoliday(year, 7, 4, candidate)) return "Independence Day";
  if (month === 9 && day === nthWeekday(year, 9, 1, 1)) return "Labor Day";
  if (month === 10 && day === nthWeekday(year, 10, 1, 2)) return "Columbus Day";
  if (observedFixedHoliday(year, 11, 11, candidate)) return "Veterans Day";
  if (month === 11 && day === nthWeekday(year, 11, 4, 4)) return "Thanksgiving Day";
  if (observedFixedHoliday(year, 12, 25, candidate)) return "Christmas Day";
  return null;
}

const easternDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});

/** Only derives today's calendar date; ACH dates themselves have no timezone. */
export function easternValidationDate(instant: Date): string {
  const parts = easternDay.formatToParts(instant);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
