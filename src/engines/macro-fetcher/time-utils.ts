/**
 * Check if current date is in US Daylight Saving Time
 * US DST: 2nd Sunday of March - 1st Sunday of November
 * DST starts/ends at 2:00 AM local time
 */
export function isUsDaylightSavingTime(date: Date = new Date()): boolean {
  const year = date.getFullYear();
  // DST starts: 2nd Sunday of March at 2:00 AM
  const marchSecondSunday = getNthSundayOfMonth(year, 2, 2) + 2 * 60 * 60 * 1000;
  // DST ends: 1st Sunday of November at 2:00 AM
  const novemberFirstSunday = getNthSundayOfMonth(year, 10, 1) + 2 * 60 * 60 * 1000;
  
  const timestamp = date.getTime();
  return timestamp >= marchSecondSunday && timestamp < novemberFirstSunday;
}

/**
 * Get timestamp of the nth Sunday of a given month
 * @param year - Full year (e.g., 2024)
 * @param month - Month 0-11 (0 = January)
 * @param n - Which Sunday (1 = first, 2 = second, etc.)
 * @returns Timestamp in milliseconds (at midnight UTC of that Sunday)
 */
export function getNthSundayOfMonth(year: number, month: number, n: number): number {
  // Create date for 1st of month
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  
  // Calculate days until first Sunday
  // If dayOfWeek is 0 (Sunday), offset is 0
  // Otherwise, offset is (7 - dayOfWeek)
  const daysUntilFirstSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  
  // Calculate the nth Sunday
  const nthSundayDate = 1 + daysUntilFirstSunday + (n - 1) * 7;
  
  return new Date(year, month, nthSundayDate).getTime();
}

/**
 * Get the current US market trading date (YYYY-MM-DD)
 * Accounts for market close time in Beijing timezone
 * Market close: 4:00 AM Beijing (DST) or 5:00 AM Beijing (Standard)
 */
export function getMarketDate(): string {
  const now = new Date();
  const isDST = isUsDaylightSavingTime(now);
  const hour = now.getHours();
  
  // Market close in Beijing time: 4:00 (DST) or 5:00 (Standard)
  const marketCloseHour = isDST ? 4 : 5;
  
  // If before market close in Beijing, it's still the previous US trading day
  if (hour < marketCloseHour) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }
  return formatDate(now);
}

/**
 * Get TTL in milliseconds based on current time
 * Trading hours: shorter TTL (30 min)
 * Non-trading hours: longer TTL (24 hours)
 */
export function getTTLForCurrentTime(): number {
  const now = new Date();
  const isDST = isUsDaylightSavingTime(now);
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  const THIRTY_MIN = 30 * 60 * 1000;
  
  // Weekend: 24 hours
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return ONE_DAY;
  }
  
  // Market hours in Beijing time
  // DST: 21:30 - 04:00 (simplified to 21:00 - 04:00)
  // Standard: 22:30 - 05:00 (simplified to 22:00 - 05:00)
  const marketOpenHour = isDST ? 21 : 22;
  const marketCloseHour = isDST ? 4 : 5;
  
  // Trading hours (e.g., 21:00-04:00 DST or 22:00-05:00 Standard)
  if (hour >= marketOpenHour || hour < marketCloseHour) {
    return THIRTY_MIN;
  }
  
  // Pre-market and after-hours
  return ONE_DAY;
}

/**
 * Format date as YYYY-MM-DD in local timezone
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
