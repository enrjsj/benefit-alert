import { useEffect, useRef, useState } from 'react';
import { fetchJsonResponse } from './request';
import type { Benefit } from './benefit';
const base=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
const statuses:Record<string,string>={pending:'접수',reviewing:'검토 중',resolved:'처리 완료',rejected:'반려'};
const categories:Record<string,string>={deadline:'신청 기간',eligibility:'지원 대상',region:'지역',link:'공식 링크',other:'기타'};
type Entry={id:number;benefitId:string;title:string;category:string;message:string;status:string;reply:string;revision:number;createdAt:string};
export function CorrectionsDialog({token,benefit,onClose}:{token:string|null;benefit?:Benefit;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),abort=useRef(new AbortController());
 const [access,setAccess]=useState<{enabled:boolean;admin:boolean}|null>(null);
 const [rows,setRows]=useState<Entry[]>([]),[cursor,setCursor]=useState<number|null>(null);
 const [all,setAll]=useState(false),[status,setStatus]=useState('all'),[retry,setRetry]=useState(0);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [message,setMessage]=useState(''),[category,setCategory]=useState('other'),[clientId,setClientId]=useState(()=>crypto.randomUUID());
 const [sent,setSent]=useState(false),[editing,setEditing]=useState<Entry|null>(null),[reply,setReply]=useState(''),[nextStatus,setNextStatus]=useState('reviewing');
 const previousFocus=useRef<Element|null>(null);
 const dirty=(!sent&&!!message)||!!editing;
 const mayLeave=()=>!busy&&(!dirty||window.confirm('저장하지 않은 정정 요청 내용을 버릴까요?'));
 useEffect(()=>{
  abort.current=new AbortController();const node=dialog.current;if(!previousFocus.current)previousFocus.current=document.activeElement;const previous=previousFocus.current;node?.showModal();
  return()=>{abort.current.abort();queueMicrotask(()=>{if(!node?.isConnected&&previous instanceof HTMLElement&&previous.isConnected)previous.focus();});};
 },[]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[dirty]);
 async function request(path:string,method='GET',body?:unknown,signal=abort.current.signal) {
  const r=await fetchJsonResponse(`${base}/api/account/corrections${path}`,{method,signal,cache:'no-store',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw Error(r.status===401?'로그인 상태를 다시 확인해 주세요.':r.status===403?'관리자 권한이 필요해요.':r.status===409?'이미 처리 중인 요청이 있거나 다른 화면에서 변경됐어요. 내 요청 또는 최신 목록을 확인해 주세요.':r.status===429?'정정 요청은 24시간에 10개까지 접수할 수 있어요.':r.status===503?'현재 정정 요청 접수를 준비하고 있어요.':r.status===404?'공고를 찾을 수 없어요. 목록을 새로 확인해 주세요.':'요청을 완료하지 못했어요. 입력 내용은 유지돼요. 다시 시도해 주세요.');
  return r.json();
 }
 useEffect(()=>{
  if(!token)return;
  const controller=new AbortController();setLoading(true);setCursor(null);setError('');
  void (async()=>{try{const a=await request('/access','GET',undefined,controller.signal);if(controller.signal.aborted)return;setAccess(a);
   const data=await request(`?all=${all&&a.admin}&status=${status}`,'GET',undefined,controller.signal);if(!controller.signal.aborted){setRows(data.items);setCursor(data.nextCursor);}
  }catch(e){if(!controller.signal.aborted)setError((e as Error).message);}finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>controller.abort();
 },[token,all,status,retry]);
 async function more(){setBusy(true);setError('');try{const d=await request(`?all=${all}&status=${status}&before=${cursor}`);setRows(current=>[...current,...d.items]);setCursor(d.nextCursor);}catch(e){if(!abort.current.signal.aborted)setError((e as Error).message);}finally{setBusy(false);}}
 return <dialog ref={dialog} className="preparation-dialog" aria-labelledby="correction-title" onCancel={e=>{e.preventDefault();if(mayLeave())onClose();}} onClose={onClose}>
  <div className="dialog-top"><h2 id="correction-title">{benefit?'공고 정보 정정 요청':'내 정정 요청과 검토'}</h2><button aria-label="정정 요청 닫기" className="close-button" disabled={busy} onClick={()=>{if(mayLeave())onClose();}}>×</button></div>
  <p>공고 정보 오류를 운영자에게 알려주세요. 지원 신청·선정 심사와는 별개이며, 처리 결과는 이 화면에서 확인할 수 있어요.</p>
  {!token?<p>로그인 후 정정 요청을 접수하고 처리 상태를 확인할 수 있어요.</p>:<>
   {loading&&<p role="status">정정 요청을 확인하고 있어요…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {access&&!access.enabled&&<p>운영자 계정을 연결한 뒤 접수를 시작해요. 지금은 공식 기관 안내를 확인해 주세요.</p>}
   {benefit&&!sent&&access?.enabled&&<form className="account-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const d=await request('','POST',{clientId,benefitId:benefit.id,category,message});setSent(true);setMessage('');setNotice(`요청 #${d.id}을 접수했어요. 아래에서 처리 상태를 확인할 수 있어요.`);setRetry(n=>n+1);}catch(e){if(!abort.current.signal.aborted)setError((e as Error).message);}finally{setBusy(false);}}}>
    <h3>{benefit.title}</h3><fieldset disabled={busy}><legend>정정할 정보</legend><label>오류 종류<select value={category} onChange={e=>{setCategory(e.target.value);setClientId(crypto.randomUUID());}}>{Object.entries(categories).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
    <label>정정 요청 내용<textarea required maxLength={1000} value={message} onChange={e=>{setMessage(e.target.value);setClientId(crypto.randomUUID());}} /></label><p>주민등록번호·연락처·개인 신청 서류를 입력하지 마세요. 1,000자 이내로 오류와 확인 근거를 적어 주세요.</p><button className="primary-button" disabled={!message.trim()}>정정 요청 접수</button></fieldset>
   </form>}
   <div className="preparation-actions"><button disabled={busy||loading} onClick={()=>{if(mayLeave()){setEditing(null);setRetry(n=>n+1);}}}>요청 목록 새로고침</button>
   {access?.admin&&<label>검토 범위<select disabled={busy||loading} value={all?'all':'mine'} onChange={e=>{if(mayLeave()){setEditing(null);setRows([]);setAll(e.target.value==='all');}}}><option value="mine">내 요청</option><option value="all">관리자 전체 요청</option></select></label>}
   <label>처리 상태<select disabled={busy||loading} value={status} onChange={e=>{if(mayLeave()){setEditing(null);setRows([]);setStatus(e.target.value);}}}><option value="all">전체</option>{Object.entries(statuses).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>
   {!loading&&!error&&!rows.length&&<p>표시할 정정 요청이 없어요.</p>}
   <ul className="preparation-list">{rows.map(row=><li key={row.id}><h3>#{row.id} · {row.title}</h3><p>{categories[row.category]} · {statuses[row.status]}</p><p className="application-note">{row.message}</p>{row.reply&&<p className="application-note">운영자 답변: {row.reply}</p>}
    {access?.admin&&all&&<button disabled={busy} onClick={()=>{if(mayLeave()){setEditing(row);setReply(row.reply);setNextStatus(row.status);}}}>요청 #{row.id} 검토</button>}
   </li>)}</ul>
   {cursor!==null&&<button disabled={busy||loading} onClick={()=>void more()}>요청 더 보기</button>}
   {editing&&<form className="account-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await request(`/${editing.id}`,'PUT',{revision:editing.revision,status:nextStatus,reply});setEditing(null);setNotice('검토 결과를 저장했어요.');setRetry(n=>n+1);}catch(e){if(!abort.current.signal.aborted)setError((e as Error).message);}finally{setBusy(false);}}}>
    <h3>요청 #{editing.id} 검토 결과</h3><p>이 답변은 요청자에게 공개됩니다. 처리 완료 전 원본 데이터 정정 여부를 확인해 주세요. 이 화면은 공고 원문을 자동 수정하지 않아요.</p><fieldset disabled={busy}><legend>운영자 검토</legend><label>검토 상태<select value={nextStatus} onChange={e=>setNextStatus(e.target.value)}>{Object.entries(statuses).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>요청자에게 보낼 답변<textarea maxLength={1000} required={['resolved','rejected'].includes(nextStatus)} value={reply} onChange={e=>setReply(e.target.value)} /></label><button className="primary-button">검토 결과 저장</button><button type="button" onClick={()=>{if(mayLeave())setEditing(null);}}>검토 취소</button></fieldset>
   </form>}
  </>}
 </dialog>;
}
