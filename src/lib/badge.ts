// What a notification bubble shows: nothing for zero, the number up to 9, then "9+".
export const BADGE_MAX = 9;

export function badgeLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  const whole = Math.floor(count);
  return whole > BADGE_MAX ? `${BADGE_MAX}+` : String(whole);
}
