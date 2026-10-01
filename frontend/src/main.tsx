import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

// 배포 시 VITE_API_BASE_URL에 실제 Spring 서버 주소를 지정합니다.
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

type Benefit = {id:string;title:string;organization:string;region:string;category:string;summary:string;eligibility:string;support:string;applicationMethod:string;deadline:string|null;periodLabel:string;sourceUrl:string};
// 관심목록은 첫 버전에서 이 브라우저에만 저장합니다. 회원 동기화는 추후 연결합니다.
function readSaved():string[] {try {const value=JSON.parse(localStorage.getItem('benefit-saved')||'[]');return Array.isArray(value)?value.filter(v=>typeof v==='string'):[];}catch{return [];}}
function App(){
 const [items,setItems]=useState<Benefit[]>([]),[demo,setDemo]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [q,setQ]=useState(''),[region,setRegion]=useState('전체'),[category,setCategory]=useState('전체'),[openOnly,setOpenOnly]=useState(false),[savedOnly,setSavedOnly]=useState(false);
 const [saved,setSaved]=useState(readSaved),[selected,setSelected]=useState<Benefit|null>(null),[retry,setRetry]=useState(0),[notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 // 이전 검색 응답이 최신 결과를 덮어쓰지 않도록 요청을 취소합니다.
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');const timer=setTimeout(()=>{
 const params=new URLSearchParams({q,region,category,openOnly:String(openOnly)});
 fetch(apiBase+'/api/benefits?'+params,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{setItems(data.items);setDemo(data.demo);}).catch(e=>{if(e.name!=='AbortError')setError('혜택을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
 },250);return()=>{clearTimeout(timer);abort.abort();};},[q,region,category,openOnly,retry]);
 useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close();},[selected]);
 function toggle(id:string){const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];setSaved(next);try{localStorage.setItem('benefit-saved',JSON.stringify(next));}catch{setNotice('브라우저 저장 공간을 사용할 수 없어 이번 방문에만 저장됩니다.');}}
 function reset(){setQ('');setRegion('전체');setCategory('전체');setOpenOnly(false);setSavedOnly(false);}
 const visible=items.filter(b=>!savedOnly||saved.includes(b.id));
 return <><header><a className="brand" href="/">혜택<span>온</span><i>●</i></a><nav aria-label="주 메뉴"><button className={!savedOnly?'active':''} onClick={()=>setSavedOnly(false)}>지원금 찾기</button><button className={savedOnly?'active':''} onClick={()=>setSavedOnly(true)}>관심 혜택 <small>{saved.length}</small></button></nav><span className="header-note">일상에 필요한 혜택을 가까이</span></header>
 <main><section className="hero"><div><span className="eyebrow">나를 위한 혜택 가이드</span><h1>놓치기 쉬운 지원금,<br/>이제 한곳에서 찾아보세요.</h1><p>사는 지역부터 관심 분야까지.<br className="mobile"/> 내 일상에 필요한 혜택을 차근차근 확인하세요.</p></div><div className="hero-art" aria-hidden="true"><div className="art-card"><span>나의 새로운 가능성</span><strong>혜택을 발견하는<br/>가벼운 시작</strong><b>↗</b></div><div className="orb">✦</div></div></section>
 {demo&&<div className="demo" role="status">개발 미리보기 · 아래 공고는 화면 확인을 위한 가상 예시입니다. 실제 지원사업이 아닙니다.</div>}
 <section className="explorer"><div className="section-title"><div><span className="eyebrow">EXPLORE BENEFITS</span><h2>{savedOnly?'저장한 관심 혜택':'어떤 혜택을 찾고 있나요?'}</h2></div><button className="reset" onClick={reset}>조건 초기화 ↻</button></div>
 <div className="search-row"><label className="search"><span aria-hidden="true">⌕</span><input aria-label="지원금 검색" placeholder="지원금 이름이나 키워드를 검색하세요" value={q} onChange={e=>setQ(e.target.value)}/></label><label className="region">거주 지역<select value={region} onChange={e=>setRegion(e.target.value)}>{['전체','서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'].map(r=><option key={r}>{r}</option>)}</select></label></div>
 <div className="filters"><div className="chips">{['전체','주거','취업','생활','가족'].map(c=><button key={c} aria-pressed={category===c} className={category===c?'chosen':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="check"><input type="checkbox" checked={openOnly} onChange={e=>setOpenOnly(e.target.checked)}/>마감된 공고 제외</label></div>
 <div className="results-line" aria-live="polite">{loading?'혜택을 확인하고 있어요':error?'조회에 실패했어요':<>총 <strong>{visible.length}</strong>개의 혜택</>}<span>기간 미정 공고는 상세 확인이 필요해요</span></div>
 {loading?<div className="grid" aria-label="불러오는 중">{[1,2,3,4].map(n=><div className="skeleton" key={n}/>)}</div>:error?<div className="empty" role="alert"><h3>{error}</h3><button onClick={()=>setRetry(v=>v+1)}>다시 시도</button></div>:visible.length===0?<div className="empty"><div>⌕</div><h3>{savedOnly?'아직 저장된 혜택이 없거나 현재 조건과 일치하지 않아요':'조건에 맞는 혜택이 없어요'}</h3><p>지역이나 검색 조건을 바꿔보세요.</p><button onClick={reset}>전체 혜택 보기</button></div>:<div className="grid">{visible.map(b=><article className="card" key={b.id}><div className="card-top"><div><span className="tag">{b.category}</span><span className="place">{b.region}</span></div><button className={'bookmark '+(saved.includes(b.id)?'saved':'')} aria-label={`${b.title} 관심목록 ${saved.includes(b.id)?'해제':'저장'}`} aria-pressed={saved.includes(b.id)} onClick={()=>toggle(b.id)}>{saved.includes(b.id)?'♥':'♡'}</button></div><p className="org">{b.organization}</p><h3><button onClick={()=>setSelected(b)}>{b.title}</button></h3><p className="summary">{b.summary}</p><div className="card-bottom"><span>{b.deadline?`${b.deadline}까지`:b.periodLabel}</span><button onClick={()=>setSelected(b)}>자세히 보기 ↗</button></div></article>)}</div>}
 </section><aside className="upcoming"><span className="bell" aria-hidden="true">✦</span><div><h3>필요한 혜택을, 필요한 순간에.</h3><p>맞춤 조건과 신규·마감 알림 기능을 준비하고 있어요.</p></div><span className="soon">준비 중</span></aside><p className="footnote">지원 여부와 신청 기간은 해당 기관의 공식 안내를 확인해 주세요. 관심 혜택은 현재 브라우저에 저장됩니다.</p>{notice&&<p role="status">{notice}</p>}</main>
 <footer><span className="brand">혜택<span>온</span></span><span>더 나은 일상을 위한 작은 발견</span></footer>
 <dialog ref={dialog} onCancel={()=>setSelected(null)} onClick={e=>{if(e.target===dialog.current)setSelected(null);}} aria-labelledby="detail-title">{selected&&<><button className="close" aria-label="상세 닫기" onClick={()=>setSelected(null)}>✕</button><span className="tag">{selected.category} · {selected.region}</span><h2 id="detail-title">{selected.title}</h2>{demo&&<p className="demo">가상 예시 공고입니다. 실제 신청할 수 없습니다.</p>}<p>{selected.summary}</p><dl>{[['지원 대상',selected.eligibility],['지원 내용',selected.support],['신청 기간',selected.deadline||selected.periodLabel],['신청 방법',selected.applicationMethod]].map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl><div className="dialog-actions"><button onClick={()=>toggle(selected.id)}>{saved.includes(selected.id)?'관심 해제':'관심 혜택 저장'}</button>{!demo&&/^https?:\/\//.test(selected.sourceUrl)&&<a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">공식 안내 확인 ↗</a>}</div></>}</dialog></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
