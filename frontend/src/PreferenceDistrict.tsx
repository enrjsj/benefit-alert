import { useEffect, useState } from 'react';
import bundled from './district-options.json';
import { createDistrictCache, mergeDistrictOptions, requestDistricts } from './districts';
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/,'');
const cache = createDistrictCache((() => { try { return localStorage; } catch { return null; } })());
export function PreferenceDistrict({region,value,onChange}: {region:string; value:string; onChange:(value:string)=>void}) {
 const [state,setState]=useState({region:'',items:[] as string[],loading:false,error:false});
 const [retry,setRetry]=useState(0);
 const initial=(bundled as Record<string,string[]>)[region] || [];
 useEffect(()=>{
  const abort=new AbortController();
  if(region==='전체'){setState({region,items:[],loading:false,error:false});return()=>abort.abort();}
  const saved=mergeDistrictOptions((bundled as Record<string,string[]>)[region] || [],cache.get(region) || []);
  setState({region,items:saved,loading:true,error:false});
  requestDistricts(`${base}/api/regions/districts?${new URLSearchParams({region})}`,abort.signal).then(latest=>{
   if(abort.signal.aborted)return;
   const items=mergeDistrictOptions(saved,latest);cache.save(region,items);setState({region,items,loading:false,error:false});
  }).catch(()=>{if(!abort.signal.aborted)setState({region,items:saved,loading:false,error:true});});
  return()=>abort.abort();
 },[region,retry]);
 const items=state.region===region?state.items:initial;
 return <div className="preference-district"><label>관심 시·군·구
  <select aria-label="관심 시·군·구" value={value} disabled={region==='전체'} onChange={e=>onChange(e.target.value)}>
   <option value="">{region==='전체'?'시·도를 먼저 선택':'시·군·구 전체'}</option>
   {value && !items.includes(value) && <option value={value}>{value}</option>}
   {items.map(item=><option key={item} value={item}>{item}</option>)}
  </select></label>
  {state.region===region && state.error && <><p role="status">최신 시군구 목록을 확인하지 못해 저장된 목록을 표시해요.</p><button type="button" className="text-button" onClick={()=>setRetry(n=>n+1)}>관심 시군구 다시 불러오기</button></>}
 </div>;
}
