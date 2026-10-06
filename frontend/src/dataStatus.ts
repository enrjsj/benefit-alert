export type DataStatus = {
  configured: boolean;
  latest: null | { status: string; finishedAt: string | null; fetchedCount?: number };
  lastSuccessAt?: string | null;
  collecting?: boolean;
  stalled?: boolean;
  freshness?: string;
  nextAttemptAt?: string | null;
};
const time = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "";
export function dataStatusMessage(data: DataStatus): string {
  if (!data.configured) return "공식 공고 연동을 준비하고 있어요.";
  const success = time(data.lastSuccessAt || (data.latest?.status === "SUCCESS" ? data.latest.finishedAt : null));
  const prefix = success ? `마지막 전체 업데이트 · ${success}. ` : "";
  if (data.stalled) return prefix + "공고 업데이트가 중단되어 복구를 기다리고 있어요. 신청 전 공식 안내를 확인해 주세요.";
  if (data.freshness === "STALE") return prefix + "12시간 이상 전체 업데이트가 완료되지 않았어요. 신청 전 공식 안내를 확인해 주세요.";
  if (data.collecting || (data.collecting === undefined && data.latest?.status === "RUNNING")) {
    const count = data.latest?.fetchedCount || 0;
    return prefix + "공식 공고를 업데이트하고 있어요" + (count > 0 ? ` · ${count.toLocaleString("ko-KR")}건 처리` : "") + ".";
  }
  if (data.latest && ["FAILED", "PARTIAL"].includes(data.latest.status)) {
    const next = time(data.nextAttemptAt);
    return prefix + "최근 업데이트를 완료하지 못했어요. " + (next ? `다음 시도 예정 · ${next}. ` : "") + "기존 공고는 유지되며 신청 전 공식 안내를 확인해 주세요.";
  }
  return success ? `공식 공고 전체 업데이트 · ${success}` : "첫 공식 공고 업데이트를 기다리고 있어요.";
}
