import type { Benefit } from "./benefit";

export function seoulToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export function dateTime(date: string | null | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : null;
}
export function deadlineDays(date: string | null | undefined, today = seoulToday()): number | null {
  const end = dateTime(date), start = dateTime(today);
  return end === null || start === null ? null : Math.round((end - start) / 86400000);
}
export function deadlineLabel(date: string, today = seoulToday()): string {
  const days = deadlineDays(date, today);
  return days === null ? "기간 확인 필요" : days < 0 ? "마감" : days === 0 ? "오늘 마감" : `D-${days}`;
}
export type DeadlineFilter = "all" | "week" | "month" | "expired" | "unknown";
export function matchesDeadline(benefit: Benefit | undefined, filter: DeadlineFilter, today = seoulToday()): boolean {
  if (filter === "all") return true;
  if (!benefit) return false;
  const days = deadlineDays(benefit.deadline, today);
  if (filter === "unknown") return days === null;
  if (days === null) return false;
  return filter === "expired" ? days < 0 : days >= 0 && days <= (filter === "week" ? 7 : 30);
}

const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
// RFC 5545 limits content lines to 75 octets, not 75 Unicode characters.
function foldLine(line: string): string {
  let result = "", bytes = 0;
  const encoder = new TextEncoder();
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
    result += char; bytes += size;
  }
  return result;
}
export function deadlineCalendar(benefit: Benefit, now = new Date()): string | null {
  const time = dateTime(benefit.deadline);
  if (time === null) return null;
  const day = (value: number) => new Date(value).toISOString().slice(0, 10).replaceAll("-", "");
  const appLink = `https://benefit-alert.vercel.app/?benefit=${encodeURIComponent(benefit.id)}`;
  const description = `신청 마감일입니다. 정확한 접수 종료 시각과 변경 여부는 공식 안내를 확인해 주세요.\n제공기관: ${benefit.organization}\n신청 기간: ${benefit.periodLabel}\n공고 보기: ${appLink}`;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BenefitOn//Deadline Calendar//KO", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:benefit-${encodeURIComponent(benefit.id)}@benefit-alert.vercel.app`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART;VALUE=DATE:${day(time)}`, `DTEND;VALUE=DATE:${day(time + 86400000)}`,
    `SUMMARY:${escapeText(`[혜택온] ${benefit.title} 신청 마감`)}`, `DESCRIPTION:${escapeText(description)}`,
    `URL:${appLink}`, "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR"].map(foldLine).join("\r\n") + "\r\n";
}
