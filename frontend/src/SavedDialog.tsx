import { useEffect, useRef, useState } from "react";
import { deadlineLabel, seoulToday } from "./deadline";
import type { Account } from "./account";
import type { Benefit } from "./benefit";
import { fetchJsonResponse } from "./request";
const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function SavedDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Benefit[]>([]);
  const [state, setState] = useState("loading");
  const [retry, setRetry] = useState(0);
  const joined = JSON.stringify(account.saved);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const abort = new AbortController();
    setState("loading");
    void (async () => {
      try {
        const ids: string[] = JSON.parse(joined), result: Benefit[] = [];
        for (let offset = 0; offset < ids.length; offset += 100) {
          const params = new URLSearchParams({ size: "100" });
          ids.slice(offset, offset + 100).forEach(id => params.append("ids", id));
          const response = await fetchJsonResponse(`${base}/api/benefits?${params}`, { signal: abort.signal });
          if (!response.ok) throw Error();
          const data = await response.json();
          if (!Array.isArray(data.items)) throw Error();
          result.push(...data.items);
        }
        if (!abort.signal.aborted) { setItems(result); setState("ready"); }
      } catch { if (!abort.signal.aborted) setState("error"); }
    })();
    return () => abort.abort();
  }, [joined, retry]);
  const byId = new Map(items.map(item => [item.id, item]));
  return <dialog ref={dialog} className="preparation-dialog" aria-labelledby="saved-manager-title" onCancel={onClose} onClose={onClose}>
    <div className="dialog-top"><h2 id="saved-manager-title">관심목록 관리</h2><button className="close-button" aria-label="관심목록 관리 닫기" onClick={onClose}>×</button></div>
    <p>검색 조건과 관계없이 저장한 모든 공고를 확인해요. 관심 해제 후에도 신청 상태·메모·체크리스트는 유지돼요.</p>
    {account.error && <p role="alert">{account.error}</p>}
    {state === "loading" ? <p role="status">저장한 공고를 확인하고 있어요…</p> : state === "error" ? <div role="alert"><p>공고를 확인하지 못했어요. 관심목록은 유지돼요.</p><button onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></div> : <>
      <p>전체 {account.saved.length}개 · 조회 중단 {account.saved.filter(id => !byId.has(id)).length}개</p>
      {!account.saved.length && <p>저장한 관심 공고가 없어요.</p>}
      <ul className="preparation-list">{account.saved.map(id => <li key={id}>
        <h3>{byId.get(id)?.title || "더 이상 제공되지 않는 공고"}</h3>
        {byId.get(id)?.deadline && <p>{byId.get(id)?.deadline} · {deadlineLabel(byId.get(id)!.deadline!, seoulToday())}</p>}
        {!byId.has(id) && <p>공고 번호: {id} · 제공 중단 또는 삭제된 공고예요.</p>}
        <button className="secondary-button" disabled={account.busy || (!!account.session && !account.ready)} onClick={() => { if (window.confirm("관심목록에서 해제할까요? 신청 기록은 유지돼요.")) void account.toggle(id, true); }}>관심 해제</button>
      </li>)}</ul>
    </>}
  </dialog>;
}
