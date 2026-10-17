import { useEffect, useRef, useState } from 'react';
import { decodeDraft, encodeDraft, IMPORT_DRAFT_KEY, type ImportDraft } from './importDraft';
type State={owner:string;draft:ImportDraft|null;remember:boolean;notice:string};
export type DraftRecovery={remember:boolean;notice:string;ready:boolean;setRemember:(value:boolean)=>void};
const empty=(owner:string):State=>({owner,draft:null,remember:false,notice:''});
export function useImportDraft(owner:string,ready:boolean) {
 const [state,setState]=useState<State>(()=>empty(owner));
 const current=useRef(state),activeOwner=useRef(owner),loadedOwner=useRef<string|null>(null);
 activeOwner.current=owner;
 function publish(next:State){current.current=next;setState(next);}
 useEffect(()=>{
  if(!ready||loadedOwner.current===owner)return;
  const initial=loadedOwner.current===null;loadedOwner.current=owner;
  let next=current.current.owner===owner?current.current:empty(owner);
  try{
   const raw=sessionStorage.getItem(IMPORT_DRAFT_KEY);
   if(initial&&raw&&!next.draft){
    const draft=decodeDraft(raw,owner);
    if(draft)next={owner,draft,remember:true,notice:'임시 보관한 미리보기를 복원했어요. 실제 기록에 반영하기 전에 내용을 확인해 주세요.'};
    else{sessionStorage.removeItem(IMPORT_DRAFT_KEY);next={...next,notice:'만료되었거나 현재 계정에서 사용할 수 없는 미리보기를 지웠어요.'};}
   }else if(!initial||!next.remember)sessionStorage.removeItem(IMPORT_DRAFT_KEY);
  }catch{next={...next,remember:false,notice:'브라우저 임시 저장 공간을 사용할 수 없어요. 새로고침하면 미리보기가 사라져요.'};}
  publish(next);
 },[owner,ready]);
 function commit(draft:ImportDraft|null,remember:boolean){
  if(activeOwner.current!==owner)return;
  let next:State={owner,draft,remember:!!draft&&remember,notice:''};
  try{
   if(next.remember&&draft){sessionStorage.setItem(IMPORT_DRAFT_KEY,encodeDraft(draft,owner));next.notice='이 탭에 미리보기를 임시 보관했어요. 마지막 저장부터 24시간 동안 복원할 수 있어요.';}
   else sessionStorage.removeItem(IMPORT_DRAFT_KEY);
  }catch{
   next.remember=false;
   try{sessionStorage.removeItem(IMPORT_DRAFT_KEY);next.notice='임시 보관하지 못했어요. 현재 미리보기는 유지되지만 새로고침하면 사라져요.';}
   catch{next.notice='임시 저장 공간에 접근하지 못했어요. 이전 보관본 삭제도 확인할 수 없으니 공용 기기에서는 사이트 저장 공간을 지워 주세요.';}
  }
  publish(next);
 }
 const visible=state.owner===owner?state:empty(owner);
 return {draft:visible.draft,setDraft:(draft:ImportDraft|null)=>commit(draft,current.current.owner===owner&&current.current.remember),
  recovery:{remember:visible.remember,notice:visible.notice,ready,setRemember:(value:boolean)=>{if(ready)commit(visible.draft,value);}} satisfies DraftRecovery};
}
