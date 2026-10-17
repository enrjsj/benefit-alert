import { useEffect, useRef, useState } from "react";
import { deadlineDays, deadlineLabel, seoulToday } from "./deadline";
import type { Account } from "./account";
import { useBenefitLookup } from "./useBenefitLookup";

export function SavedDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [today, setToday] = useState(seoulToday);
  const dialog = useRef<HTMLDialogElement>(null);
  const { items, checked, loading, error, reload } = useBenefitLookup(account.saved);
  useEffect(() => {
    const update = () => setToday(seoulToday());
    const timer = setInterval(update, 60000); addEventListener("focus", update);
    return () => { clearInterval(timer); removeEventListener("focus", update); };
  }, []);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const byId = new Map(items.map(item => [item.id, item]));
  const needle = query.trim().normalize("NFKC").toLocaleLowerCase("ko");
  const shown = account.saved.filter(id => {
    const benefit = byId.get(id), days = deadlineDays(benefit?.deadline, today);
    return (!needle || [id, benefit?.title, benefit?.organization].some(value => value?.normalize("NFKC").toLocaleLowerCase("ko").includes(needle)))
      && (filter === "all" || (filter === "missing" ? checked.has(id) && !benefit : filter === "unknown" ? !checked.has(id) : filter === "expired" ? days !== null && days < 0 : days !== null && days >= 0 && days <= 7));
  });
  return <dialog ref={dialog} className="preparation-dialog" aria-labelledby="saved-manager-title" onCancel={onClose} onClose={onClose}>
    <div className="dialog-top"><h2 id="saved-manager-title">관심목록 관리</h2><button className="close-button" aria-label="관심목록 관리 닫기" onClick={onClose}>×</button></div>
    <p>검색 조건과 관계없이 저장한 모든 공고를 확인해요. 관심 해제 후에도 신청 상태·메모·체크리스트는 유지돼요.</p>
    <label className="preparation-search">관심목록 검색<input type="search" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} placeholder="공고 제목, 기관, 번호" /></label>
    <label>관심목록 공고 조건<select aria-label="관심목록 공고 조건" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">전체</option><option value="week">7일 이내 마감</option><option value="expired">마감된 공고</option><option value="missing">조회 중단 공고</option><option value="unknown">확인 대기 공고</option></select></label>
    {account.error && <p role="alert">{account.error}</p>}
    {loading && <p role="status">저장한 공고를 확인하고 있어요…</p>}
    {error && <div role="alert"><p>공고를 확인하지 못했어요. 관심목록은 유지돼요. 확인 대기는 제공 중단을 의미하지 않아요.</p><button disabled={loading} onClick={reload}>다시 불러오기</button></div>}
    <>
      <p>전체 {account.saved.length}개 · 조회 중단 {account.saved.filter(id => checked.has(id) && !byId.has(id)).length}개 · 확인 대기 {account.saved.filter(id => !checked.has(id)).length}개</p>
      {!account.saved.length && <p>저장한 관심 공고가 없어요.</p>}
      {account.saved.length > 0 && <p role="status">조건에 맞는 관심 공고 {shown.length}개</p>}
      {account.saved.length > 0 && !shown.length && <button className="secondary-button" onClick={() => { setQuery(""); setFilter("all"); }}>관심목록 조건 초기화</button>}
      <ul className="preparation-list">{shown.map(id => <li key={id}>
        <h3>{byId.get(id)?.title || (checked.has(id) ? "더 이상 제공되지 않는 공고" : "공고 정보 확인 대기")}</h3>
        {byId.get(id)?.deadline && <p>{byId.get(id)?.deadline} · {deadlineLabel(byId.get(id)!.deadline!, today)}</p>}
        {!byId.has(id) && <p>공고 번호: {id} · {checked.has(id) ? "제공 중단 또는 삭제된 공고예요." : "조회가 완료되면 제목과 마감일을 표시해요."}</p>}
        <button className="secondary-button" disabled={account.busy || (!!account.session && !account.ready)} onClick={() => { if (window.confirm("관심목록에서 해제할까요? 신청 기록은 유지돼요.")) void account.toggle(id, true); }}>관심 해제</button>
      </li>)}</ul>
    </>
  </dialog>;
}
