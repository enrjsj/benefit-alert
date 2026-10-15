import { test, expect, type Page } from '@playwright/test';
const benefits = [
  {id:'a', title:'강남 주거 지원', region:'서울', district:'강남구', category:'주거'},
  {id:'b', title:'서울 공통 교육', region:'서울', district:'', category:'교육'},
  {id:'c', title:'성남 생활 지원', region:'경기', district:'성남시', category:'생활'},
  {id:'d', title:'전국 건강 지원', region:'전국', district:'', category:'건강'},
].map(b=>({...b,organization:b.region+' '+b.district+' 기관',summary:'지원 안내',eligibility:'공식 자격 확인',support:'지원 내용',applicationMethod:'온라인 신청',deadline:'2099-12-31',periodLabel:'2099.01.01~2099.12.31',sourceUrl:'https://www.gov.kr/'}));
async function api(page: Page) {
  await page.route('**/api/**', async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/api/client-config') return route.fulfill({json:{authEnabled:false}});
    if(u.pathname==='/api/data-status') return route.fulfill({json:{}});
    if(u.pathname==='/api/regions/districts') return route.fulfill({json:u.searchParams.get('region')==='서울'?['강남구']:['성남시']});
    if(u.pathname==='/api/benefits') {
      const p=u.searchParams;
      if(!Number.isInteger(Number(p.get('page')||1))) return route.fulfill({status:400,json:{}});
      const ids=p.getAll('ids').flatMap(v=>v.split(','));
      const items=benefits.filter(b=>(!ids.length||ids.includes(b.id))&&(!p.get('region')||p.get('region')==='전체'||b.region===p.get('region'))&&(!p.get('district')||b.district===p.get('district'))&&(!p.get('category')||p.get('category')==='전체'||b.category===p.get('category'))&&(!p.get('q')||b.title.includes(p.get('q')!)));
      return route.fulfill({json:{items,total:items.length,totalPages:items.length?1:0,page:1,size:12,demo:false}});
    }
    const b=benefits.find(b=>u.pathname==='/api/benefits/'+b.id);
    return route.fulfill(b?{json:b}:{status:404,json:{}});
  });
}
const cards=(page:Page)=>page.locator('.benefit-card');
test.beforeEach(async({page})=>{await api(page);});

test('malformed shared URLs recover to valid search conditions',async({page})=>{
  await page.goto('/?page=1.5&sort=broken&region=unknown&district=wrong&category=invalid');
  await expect(cards(page)).toHaveCount(4);
  await expect(page.getByLabel('거주 지역',{exact:true})).toHaveValue('전체');
  await expect(page).not.toHaveURL(/page=1.5|sort=broken|region=unknown/);
});
test('region, district, category, search, reset and detail history agree',async({page})=>{
  await page.goto('/'); await expect(cards(page)).toHaveCount(4);
  await page.getByLabel('거주 지역',{exact:true}).selectOption('서울');
  await expect(cards(page)).toHaveCount(2);
  await page.getByLabel('시·군·구',{exact:true}).selectOption('강남구');
  await expect(cards(page)).toHaveCount(1);
  await page.getByLabel('지원 분야',{exact:true}).selectOption('교육');
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole('button',{name:'조건 초기화',exact:true}).click();
  await expect(cards(page)).toHaveCount(4);
  await page.getByRole('searchbox').fill('성남'); await expect(cards(page)).toHaveCount(1);
  await page.getByRole('button',{name:'성남 생활 지원 자세히 보기',exact:true}).click();
  await expect(page.locator('#detail-title')).toBeVisible();
  await page.goBack(); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(1);
});
test('guest favorites from two tabs are merged and removals synchronize',async({page,context})=>{
  await page.goto('/'); await expect(cards(page)).toHaveCount(4);
  const other=await context.newPage();await api(other);await other.goto('/');await expect(cards(other)).toHaveCount(4);
  await page.getByRole('button',{name:'강남 주거 지원 관심목록 저장',exact:true}).click();
  await other.getByRole('button',{name:'서울 공통 교육 관심목록 저장',exact:true}).click();
  await expect(page.getByRole('button',{name:'관심 혜택 2',exact:true})).toBeVisible();
  await expect(other.getByRole('button',{name:'관심 혜택 2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'강남 주거 지원 관심목록 해제',exact:true}).click();
  await expect(other.getByRole('button',{name:'관심 혜택 1',exact:true})).toBeVisible();
  await other.reload();await expect(other.getByRole('button',{name:'관심 혜택 1',exact:true})).toBeVisible();
});
test('application notes survive failed stale-tab edits, filters, reload and deletion',async({page})=>{
  await page.goto('/?benefit=a');
  await page.getByLabel('내 메모',{exact:true}).fill('작성 중인 메모');
  page.once('dialog',d=>d.dismiss());await page.getByLabel('상세 닫기',{exact:true}).click();
  await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('작성 중인 메모');
  await page.evaluate(()=>localStorage.setItem('benefit-planning:v2:guest',JSON.stringify({version:1,compareIds:[],checklists:{},applications:{a:{status:'approved',note:'다른 탭 메모'}}})));
  await page.getByRole('button',{name:'신청 기록 저장',exact:true}).click();
  await expect(page.locator('.application-record')).toContainText('다른 화면에서');
  await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('작성 중인 메모');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'저장된 기록 불러오기',exact:true}).click();
  await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('다른 탭 메모');
  await page.getByLabel('신청 상태',{exact:true}).selectOption('submitted');
  await page.getByLabel('내 메모',{exact:true}).fill('<b>제출 완료</b>');
  await page.getByRole('button',{name:'신청 기록 저장',exact:true}).click();
  await expect(page.locator('.application-record')).toContainText('저장된 신청 기록');
  await page.reload();await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('<b>제출 완료</b>');
  await page.getByLabel('상세 닫기',{exact:true}).click();
  await page.getByRole('button',{name:'신청 준비 1',exact:true}).click();
  await expect(page.locator('.preparation-list li')).toHaveCount(1);
  await page.getByLabel('신청 준비 신청 상태',{exact:true}).selectOption('approved');
  await expect(page.locator('.preparation-list li')).toHaveCount(0);
  await page.getByLabel('신청 준비 신청 상태',{exact:true}).selectOption('submitted');
  await expect(page.locator('.application-note b')).toHaveCount(0);
  await expect(page.locator('.application-note')).toHaveText('<b>제출 완료</b>');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'기록 삭제',exact:true}).click();
  await expect(page.locator('.preparation-dialog')).toContainText('신청 준비를 시작해 보세요');
});
test('comparison limit, checklist and mobile layout',async({page})=>{
  await page.goto('/');await expect(cards(page)).toHaveCount(4);
  for(const b of benefits.slice(0,3)) await page.getByRole('button',{name:b.title+' 비교 담기',exact:true}).click();
  await page.getByRole('button',{name:benefits[3].title+' 비교 담기',exact:true}).click();
  await expect(page.locator('.toast')).toContainText('최대 3개');
  await page.getByRole('button',{name:'비교하기',exact:true}).click();
  await expect(page.locator('.comparison-table thead th')).toHaveCount(4);
  await page.getByLabel('혜택 비교 닫기',{exact:true}).click();
  await page.goto('/?benefit=a');await page.locator('.application-checklist input').first().check();
  await page.getByLabel('상세 닫기',{exact:true}).click();await page.getByRole('button',{name:'신청 준비 1',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.preparation-list li')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('list failures expose retry and recover without losing the selected district',async({page})=>{
  let failed=true;
  await page.route('**/api/benefits?**',route=>failed?route.fulfill({status:503,json:{}}):route.fallback());
  await page.goto('/?region=서울&district=강남구');
  await expect(page.getByRole('button',{name:'다시 불러오기',exact:true})).toBeVisible();
  failed=false;await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();
  await expect(cards(page)).toHaveCount(1);await expect(page.getByLabel('시·군·구',{exact:true})).toHaveValue('강남구');
});
test('a stalled request becomes retryable while retaining the selected district',async({page})=>{
  await page.clock.install();
  let stalled=true;
  await page.route('**/api/benefits?**',async route=>{
    if(stalled) return; // deliberately no response; client deadline must settle the UI
    await route.fallback();
  });
  await page.goto('/?region=서울&district=강남구');
  await page.clock.runFor(300);
  await expect(page.getByText('혜택을 불러오는 중입니다.')).toBeVisible();
  await page.clock.fastForward(20001);
  await expect(page.getByRole('button',{name:'다시 불러오기',exact:true})).toBeVisible();
  stalled=false;await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await page.clock.runFor(300);
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByLabel('시·군·구',{exact:true})).toHaveValue('강남구');
});
const owner='11111111-1111-4111-8111-111111111111';
const user={id:owner,aud:'authenticated',role:'authenticated',email:'test@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'};
async function member(page:Page) {
  await page.addInitScript(({user})=>{
    localStorage.setItem('sb-benefit-test-auth-token',JSON.stringify({access_token:'fixture-only-never-a-real-token',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}));
  },{user});
  await page.route('**/api/client-config',r=>r.fulfill({json:{authEnabled:true,supabaseUrl:'https://benefit-test.supabase.co',publishableKey:'sb_publishable_fixture_only'}}));
  await page.route('https://benefit-test.supabase.co/**',r=>r.fulfill(r.request().url().includes('/logout')?{status:204}:{json:user}));
  await page.route('**/api/account/**',r=>{
    const path=new URL(r.request().url()).pathname;
    return r.fulfill({json:path.endsWith('/profile')?{region:'전체',category:'전체',notificationsEnabled:false}:path.endsWith('/planning')?{revision:0,data:{version:1,compareIds:[],checklists:{},applications:{}}}:[]});
  });
}
test('logging out during account refresh suppresses the old response and its errors',async({page})=>{
  await member(page);let release:()=>void=()=>{};let pending=false;let held=false;
  await page.route('**/api/account/profile',async r=>{if(pending)await new Promise<void>(resolve=>{release=resolve;held=true;});await r.fulfill({json:{region:'서울',category:'주거',notificationsEnabled:false}});});
  await page.goto('/');await page.getByRole('button',{name:/내 계정/}).click();
  await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toBeVisible();
  pending=true;await page.getByRole('button',{name:'계정 정보 새로고침',exact:true}).click();
  await expect.poll(()=>held).toBe(true);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  await expect(page.getByRole('heading',{name:'로그인하고 이어서 모아보세요'})).toBeVisible();
  release();await page.waitForTimeout(100);
  await expect(page.getByText('계정이 변경되었어요.',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toHaveCount(0);
});
test('member notes retain drafts on save failure and revision conflict; logout hides member records',async({page})=>{
  await member(page);
  let state={revision:0,data:{version:1,compareIds:[],checklists:{},applications:{} as Record<string,{status:string,note:string}>}};
  let mode='fail';
  await page.route('**/api/account/planning',r=>{
    if(r.request().method()==='PUT') {
      if(mode==='fail')return r.fulfill({status:503,json:{}});
      if(mode==='conflict'){state={...state,revision:state.revision+1,data:{...state.data,applications:{a:{status:'approved',note:'다른 기기에서 저장한 메모'}}}};return r.fulfill({status:409,json:{}});}
      state={revision:state.revision+1,data:r.request().postDataJSON().data};
    }
    return r.fulfill({json:state});
  });
  await page.goto('/?benefit=a');await expect(page.getByRole('button',{name:'신청 기록 저장',exact:true})).toBeEnabled();
  await page.getByLabel('내 메모',{exact:true}).fill('보존할 작성 내용');
  await page.getByRole('button',{name:'신청 기록 저장',exact:true}).click();
  await expect(page.locator('.application-record')).toContainText('연결을 확인');
  await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('보존할 작성 내용');
  mode='conflict';await page.getByRole('button',{name:'신청 기록 저장',exact:true}).click();
  await expect(page.locator('.application-record')).toContainText('다른 기기에서');
  await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('보존할 작성 내용');
  expect(state.data.applications.a.note).toBe('다른 기기에서 저장한 메모');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'저장된 기록 불러오기',exact:true}).click();
  await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('다른 기기에서 저장한 메모');
  mode='ok';await page.getByLabel('내 메모',{exact:true}).fill('최종 메모');await page.getByRole('button',{name:'신청 기록 저장',exact:true}).click();
  await expect(page.locator('.application-record')).toContainText('저장된 신청 기록');
  expect(state.data.applications.a.note).toBe('최종 메모');
  await page.getByLabel('상세 닫기',{exact:true}).click();await page.getByRole('button',{name:/내 계정/}).click();await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  await page.getByLabel('내 계정 닫기',{exact:true}).click();
  await expect(page.getByRole('button',{name:'신청 준비 0',exact:true})).toBeVisible();
});
test('missing comparison benefits can be removed without losing other selections',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('benefit-planning:v2:guest',JSON.stringify({version:1,compareIds:['a','missing'],checklists:{},applications:{}})));
  await page.goto('/');await page.getByRole('button',{name:'비교하기',exact:true}).click();
  await expect(page.locator('.comparison-dialog')).toContainText('선택한 공고 중 1개는 더 이상 조회할 수 없어요.');
  await page.getByRole('button',{name:'조회할 수 없는 공고 1 빼기',exact:true}).click();
  await expect(page.locator('.comparison-table thead th')).toHaveCount(2);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('benefit-planning:v2:guest')!).compareIds)).toEqual(['a']);
});
test('a late list response cannot replace a newer region selection',async({page})=>{
  let release:()=>void=()=>{};let held=false;
  await page.route('**/api/benefits?**',async r=>{
    if(new URL(r.request().url()).searchParams.get('region')==='서울') {
      await new Promise<void>(resolve=>{release=resolve;held=true;});
      await r.fulfill({json:{items:benefits.filter(b=>b.region==='서울'),total:2,totalPages:1}});
    } else await r.fallback();
  });
  await page.goto('/');await expect(cards(page)).toHaveCount(4);
  await page.getByLabel('거주 지역',{exact:true}).selectOption('서울');await expect.poll(()=>held).toBe(true);
  await page.getByLabel('거주 지역',{exact:true}).selectOption('경기');await expect(cards(page)).toHaveCount(1);
  release();await page.waitForTimeout(100);
  await expect(cards(page)).toContainText('성남 생활 지원');
  await expect(page.getByLabel('거주 지역',{exact:true})).toHaveValue('경기');
});
test('calendar download contains the selected benefit and an all-day exclusive end',async({page})=>{
  await page.goto('/?benefit=a');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:/캘린더/}).click();
  const file=await download;const stream=await file.createReadStream();const buffers=[];
  for await(const chunk of stream!)buffers.push(chunk);
  const text=Buffer.concat(buffers).toString('utf8').replace(/\r\n /g,'');
  expect(text).toContain('DTSTART;VALUE=DATE:20991231');expect(text).toContain('DTEND;VALUE=DATE:21000101');expect(text).toContain('강남 주거 지원');
});
const reportFixture={demo:false,generatedAt:'2026-10-07T00:00:00Z',coverage:{total:4,nationwide:1,regionKnown:2,districtKnown:1,regionUnknown:1,deadlineKnown:3},history:[{status:'INTERRUPTED',startedAt:'2026-10-07T00:00:00Z',finishedAt:null,fetchedCount:10,rejectedCount:0},{status:'SUCCESS',startedAt:'2026-10-06T18:00:00Z',finishedAt:'2026-10-06T18:03:00Z',fetchedCount:4,rejectedCount:0}]};
test('data report recovers from failure, preserves the last snapshot and fits mobile',async({page})=>{
 let fail=true;await page.route('**/api/data-report',r=>fail?r.fulfill({status:503,json:{}}):r.fulfill({json:reportFixture}));
 await page.goto('/?region=서울&district=강남구');await expect(cards(page)).toHaveCount(1);
 await page.getByRole('button',{name:'데이터 현황과 업데이트 보기',exact:true}).click();
 await expect(page.locator('.data-report-dialog [role=alert]')).toContainText('현황을 불러오지 못');
 fail=false;await page.getByRole('button',{name:'현황 새로고침',exact:true}).click();
 await expect(page.locator('.coverage-grid > div').first()).toContainText('4건');
 await expect(page.locator('.collection-history li')).toHaveCount(2);
 await expect(page.locator('.collection-history li').first()).toContainText('중단 · 복구 대기');
 await page.setViewportSize({width:390,height:844});
 expect(await page.locator('.data-report-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 fail=true;await page.getByRole('button',{name:'현황 새로고침',exact:true}).click();
 await expect(page.locator('.data-report-dialog [role=alert]')).toContainText('마지막으로 확인한 현황');
 await expect(page.locator('.coverage-grid > div').first()).toContainText('4건');
 await page.keyboard.press('Escape');await expect(page.locator('.data-report-dialog')).toHaveCount(0);
 await expect(page).toHaveURL(/district=/);await expect(cards(page)).toHaveCount(1);
});
test('demo reports have empty history and benefit provenance uses explicit source timestamps',async({page})=>{
 await page.route('**/api/data-report',r=>r.fulfill({json:{...reportFixture,demo:true,history:[]}}));
 await page.route('**/api/benefits/a',r=>r.fulfill({json:{...benefits[0],sourceKind:'gov24',updatedAt:'2026-10-07T00:00:00Z'}}));
 await page.goto('/?benefit=a');
 await expect(page.getByLabel('정보 출처와 갱신 시각')).toContainText('정부24 공공서비스 정보');
 await expect(page.getByLabel('정보 출처와 갱신 시각')).toContainText('9:00:00');
 await page.getByLabel('상세 닫기',{exact:true}).click();
 await page.getByRole('button',{name:'데이터 현황과 업데이트 보기',exact:true}).click();
 await expect(page.locator('.data-report-dialog')).toContainText('가상 예시 공고의 현황');
 await expect(page.locator('.data-report-dialog')).toContainText('아직 업데이트 이력이 없어요');
});

test('unavailable favorites can be removed while application records survive', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('benefit-saved', JSON.stringify(['a', 'missing']));
    localStorage.setItem('benefit-planning:v2:guest', JSON.stringify({version:1,compareIds:[],checklists:{},applications:{missing:{status:'submitted',note:'보관할 기록'}}}));
  });
  await page.goto('/?view=saved');
  await page.getByRole('button',{name:'관심목록 관리',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'관심목록 관리'});
  await expect(dialog).toContainText('조회 중단 1개');
  page.once('dialog',d=>d.dismiss());
  await dialog.locator('li').filter({hasText:'공고 번호: missing'}).getByRole('button',{name:'관심 해제'}).click();
  await expect(dialog.locator('li')).toHaveCount(2);
  page.once('dialog',d=>d.accept());
  await dialog.locator('li').filter({hasText:'공고 번호: missing'}).getByRole('button',{name:'관심 해제'}).click();
  await expect(dialog.locator('li')).toHaveCount(1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('benefit-planning:v2:guest')!).applications.missing.note)).toBe('보관할 기록');
  await page.getByLabel('관심목록 관리 닫기').click();
  await page.getByRole('button',{name:'신청 준비 1',exact:true}).click();
  await page.getByRole('button',{name:'신청 기록 편집',exact:true}).click();
  await page.getByLabel('내 메모',{exact:true}).fill('종료 후에도 수정');
  page.once('dialog',d=>d.dismiss()); await page.keyboard.press('Escape');
  await expect(page.getByLabel('내 메모',{exact:true})).toHaveValue('종료 후에도 수정');
  page.once('dialog',d=>d.dismiss()); await page.getByRole('button',{name:'신청 준비 목록으로'}).click();
  await expect(page.getByLabel('내 메모',{exact:true})).toBeVisible();
  await page.getByLabel('신청 상태',{exact:true}).selectOption('approved');
  await page.getByRole('button',{name:'신청 기록 저장',exact:true}).click();
  await expect(page.locator('.application-record')).toContainText('저장된 신청 기록');
  await page.getByRole('button',{name:'신청 준비 목록으로'}).click();
  await expect(page.locator('.preparation-list')).toContainText('종료 후에도 수정');
  await expect(page.locator('.preparation-list')).toContainText('선정');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('favorite lookup errors are retryable and never classify records as unavailable', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('benefit-saved',JSON.stringify(['a'])));
  let fail=true;
  await page.route('**/api/benefits?**',r=>new URL(r.request().url()).searchParams.get('size')==='100' && fail ? r.fulfill({status:503,json:{}}) : r.fallback());
  await page.goto('/?view=saved'); await page.getByRole('button',{name:'관심목록 관리',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'관심목록 관리'});
  await expect(dialog).toContainText('공고를 확인하지 못했어요');
  await expect(dialog.getByRole('button',{name:'관심 해제'})).toHaveCount(0);
  fail=false; await dialog.getByRole('button',{name:'다시 불러오기'}).click();
  await expect(dialog).toContainText('강남 주거 지원');
});

test('preference drafts survive refresh and failed saves, and guard close, logout and search', async ({page}) => {
  await member(page);
  let profile={region:'서울',category:'주거',notificationsEnabled:false};
  let fail=true;
  await page.route('**/api/account/profile', r=>{
    if(r.request().method()==='PUT') {
      if(fail)return r.fulfill({status:503,json:{}});
      profile=r.request().postDataJSON();
    }
    return r.fulfill({json:profile});
  });
  await page.goto('/');await page.getByRole('button',{name:/내 계정/}).click();
  await expect(page.getByRole('combobox',{name:'관심 지역',exact:true})).toHaveValue('서울');
  await page.getByRole('combobox',{name:'관심 지역',exact:true}).selectOption('부산');
  profile={...profile,region:'경기'};
  await page.getByRole('button',{name:'계정 정보 새로고침',exact:true}).click();
  await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toBeEnabled();
  await expect(page.getByRole('combobox',{name:'관심 지역',exact:true})).toHaveValue('부산');
  for(const action of [()=>page.keyboard.press('Escape'),()=>page.getByLabel('내 계정 닫기').click(),()=>page.getByRole('button',{name:'로그아웃',exact:true}).click(),()=>page.getByRole('button',{name:'이 조건으로 찾아보기',exact:true}).click()]) {
    page.once('dialog',d=>d.dismiss()); await action();
    await expect(page.getByRole('combobox',{name:'관심 지역',exact:true})).toHaveValue('부산');
  }
  await page.getByRole('button',{name:'조건 저장',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('연결이 지연');
  await expect(page.getByRole('combobox',{name:'관심 지역',exact:true})).toHaveValue('부산');
  fail=false; await page.getByRole('button',{name:'조건 저장',exact:true}).click();
  await expect(page.getByText('맞춤 조건을 저장했어요.',{exact:true})).toBeVisible();
  await expect(page.getByText(/아직 저장하지 않은 관심 조건/)).toHaveCount(0);
  await page.getByLabel('내 계정 닫기').click();
  await page.getByRole('button',{name:/내 계정/}).click();
  await expect(page.getByRole('combobox',{name:'관심 지역',exact:true})).toHaveValue('부산');
});

test('member saved management spans batches, retains failed removals and hides records on logout', async ({page}) => {
  await member(page);
  let saved=['a',...Array.from({length:100},(_,i)=>`missing-${i}`)];
  let fail=true;
  const batches:number[]=[];
  await page.route('**/api/benefits?**',r=>{
    const params=new URL(r.request().url()).searchParams;
    if(params.get('size')==='100')batches.push(params.getAll('ids').length);
    return r.fallback();
  });
  await page.route('**/api/account/saved',r=>r.fulfill({json:saved}));
  await page.route('**/api/account/saved/*',r=>{
    expect(r.request().method()).toBe('DELETE');
    if(fail)return r.fulfill({status:503,json:{}});
    saved=saved.filter(id=>id!==decodeURIComponent(new URL(r.request().url()).pathname.split('/').pop()!));
    return r.fulfill({json:saved});
  });
  await page.goto('/?view=saved');await expect(page.getByRole('button',{name:'관심 혜택 101',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'관심목록 관리',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'관심목록 관리'});
  await expect(dialog.locator('li')).toHaveCount(101);
  expect(batches).toContain(100);expect(batches).toContain(1);
  const target=dialog.locator('li').filter({hasText:'공고 번호: missing-99'});
  page.once('dialog',d=>d.accept());await target.getByRole('button',{name:'관심 해제'}).click();
  await expect(dialog.getByRole('alert')).toContainText('연결이 지연');
  await expect(dialog.locator('li')).toHaveCount(101);
  fail=false;page.once('dialog',d=>d.accept());await target.getByRole('button',{name:'관심 해제'}).click();
  await expect(dialog.locator('li')).toHaveCount(100);
  await page.getByLabel('관심목록 관리 닫기').click();
  await page.getByRole('button',{name:/내 계정/}).click();
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  await page.getByLabel('내 계정 닫기').click();
  await page.getByRole('button',{name:'관심목록 관리',exact:true}).click();
  await expect(dialog).toContainText('저장한 관심 공고가 없어요');
  await expect(dialog).not.toContainText('missing-');
});

test('preparation search includes unavailable notes and exports the complete saved data',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('benefit-planning:v2:guest',JSON.stringify({version:1,compareIds:['b'],checklists:{a:['documents']},applications:{missing:{status:'approved',note:'검증 메모'}}})));
 await page.goto('/');await page.getByRole('button',{name:'신청 준비 2',exact:true}).click();
 await expect(page.locator('.preparation-list li')).toHaveCount(2);
 await page.getByRole('searchbox',{name:'신청 기록 검색'}).fill('검증 메모');
 await expect(page.locator('.preparation-list li')).toHaveCount(1);
 await expect(page.locator('.preparation-list')).toContainText('더 이상 제공되지 않는 공고');
 const jsonDownload=page.waitForEvent('download');await page.getByRole('button',{name:'전체 기록 JSON 다운로드'}).click();
 const json=await (await jsonDownload).createReadStream();let content='';for await(const chunk of json!)content+=chunk;
 const data=JSON.parse(content);expect(data.planning.checklists.a).toEqual(['documents']);expect(data.planning.applications.missing.note).toBe('검증 메모');expect(data.planning.compareIds).toEqual(['b']);
 const csvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'전체 기록 CSV 다운로드'}).click();
 const csv=await (await csvDownload).createReadStream();let csvText='';for await(const chunk of csv!)csvText+=chunk;
 expect(csvText).toContain('강남 주거 지원');expect(csvText).toContain('검증 메모');
 await page.getByRole('searchbox',{name:'신청 기록 검색'}).fill('없는 검색어');
 await page.getByRole('button',{name:'모든 준비 기록 보기'}).click();await expect(page.locator('.preparation-list li')).toHaveCount(2);
 await page.setViewportSize({width:390,height:844});expect(await page.locator('.preparation-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});

test('failed notifications do not block favorites or make a successful profile save look failed',async({page})=>{
 await member(page);let fail=true;let profile={region:'서울',category:'주거',notificationsEnabled:true};
 await page.route('**/api/account/notifications',r=>r.fulfill(fail?{status:503,json:{}}:{json:[{id:1,benefitId:'a',title:'복구된 알림',kind:'new',read:false}]}));
 await page.route('**/api/account/profile',r=>{if(r.request().method()==='PUT')profile=r.request().postDataJSON();return r.fulfill({json:profile});});
 await page.route('**/api/account/saved',r=>r.fulfill({json:['a']}));
 await page.goto('/');await expect(page.getByRole('button',{name:'관심 혜택 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/내 계정/}).click();
 await expect(page.getByRole('combobox',{name:'관심 지역',exact:true})).toHaveValue('서울');
 await expect(page.locator('.inbox')).toContainText('알림을 불러오지 못했어요');
 await page.getByRole('combobox',{name:'관심 지역',exact:true}).selectOption('부산');await page.getByRole('button',{name:'조건 저장',exact:true}).click();
 await expect(page.getByText('맞춤 조건을 저장했어요.',{exact:true})).toBeVisible();expect(profile.region).toBe('부산');
 fail=false;await page.getByRole('button',{name:'알림 새로고침',exact:true}).click();await expect(page.locator('.inbox')).toContainText('복구된 알림');
 fail=true;await page.getByRole('button',{name:'알림 새로고침',exact:true}).click();await expect(page.locator('.inbox')).toContainText('알림을 불러오지 못했어요');await expect(page.locator('.inbox')).toContainText('복구된 알림');
});

test('pending notifications allow profile use and late responses cannot reappear after logout',async({page})=>{
 await member(page);let release:()=>void=()=>{};let held=false;
 await page.route('**/api/account/notifications',async r=>{await new Promise<void>(resolve=>{release=resolve;held=true;});await r.fulfill({json:[{id:1,benefitId:'a',title:'이전 계정 알림',kind:'new',read:false}]});});
 await page.goto('/');await page.getByRole('button',{name:/내 계정/}).click();
 await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toBeEnabled();await expect.poll(()=>held).toBe(true);
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByRole('heading',{name:'로그인하고 이어서 모아보세요'})).toBeVisible();
 release();await expect(page.getByText('이전 계정 알림',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toHaveCount(0);
});

const importFile=(planning:unknown)=>({name:'benefit-records.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'benefit-alert-planning',version:1,planning}))});
const importData={version:1,compareIds:['d'],checklists:{a:['documents'],missing:['schedule']},applications:{a:{status:'approved',note:'파일에서 가져온 메모'},missing:{status:'submitted',note:'중단 공고 기록'}}};
async function openImport(page:Page,count:number){await page.getByRole('button',{name:`신청 준비 ${count}`,exact:true}).click();await page.getByText('파일·기기 기록 가져오기',{exact:true}).click();}

test('file import previews conflicts, resolves comparison overflow and persists selected records',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('benefit-planning:v2:guest'))localStorage.setItem('benefit-planning:v2:guest',JSON.stringify({version:1,compareIds:['a','b','c'],checklists:{a:['eligibility']},applications:{a:{status:'submitted',note:'현재 메모'}}}));});
 await page.goto('/');await openImport(page,1);await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles(importFile(importData));
 const preview=page.getByRole('region',{name:'가져오기 미리보기'});await expect(preview).toContainText('선택 필요 1개');
 await page.setViewportSize({width:390,height:844});expect(await page.locator('.preparation-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await expect(page.getByRole('button',{name:'선택한 내용 가져오기'})).toBeDisabled();
 await page.getByRole('radio',{name:/가져온 기록 사용/}).check();await expect(preview).toContainText('비교는 합쳐서 3개');
 await page.getByRole('checkbox',{name:/비교 목록 1개도 합치기/}).uncheck();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'선택한 내용 가져오기'}).click();await expect(preview).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택한 내용 가져오기'}).click();
 await expect(page.locator('.planning-import')).toContainText('선택한 기록을 반영했어요');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('benefit-planning:v2:guest')!));
 expect(stored.compareIds).toEqual(['a','b','c']);expect(stored.checklists.a).toEqual(['eligibility','documents']);expect(stored.applications.a.note).toBe('파일에서 가져온 메모');expect(stored.applications.missing.note).toBe('중단 공고 기록');
 await page.getByLabel('신청 준비 공고 제공 상태').selectOption('missing');await expect(page.locator('.preparation-list').filter({has:page.locator('progress')}).locator('li')).toHaveCount(1);
 await expect(page.getByRole('region',{name:'신청 준비 현황'})).toContainText('조회 중단 1개');
 await page.reload();await openImport(page,2);await expect(page.locator('.preparation-list')).toContainText('파일에서 가져온 메모');
});

test('invalid imports and cancellation never mutate existing records',async({page})=>{
 await page.goto('/');await openImport(page,0);
 await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
 await expect(page.locator('.planning-import')).toContainText('올바른 JSON 기록');await expect(page.getByRole('button',{name:'선택한 내용 가져오기'})).toHaveCount(0);
 await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles(importFile(importData));await expect(page.getByRole('region',{name:'가져오기 미리보기'})).toBeVisible();
 await page.getByRole('button',{name:'가져오기 취소',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('benefit-planning:v2:guest'))).toBeNull();
});

test('reserved IDs reject the whole import before preview and preserve existing records',async({page})=>{
 const existing={version:1,compareIds:[],checklists:{a:['eligibility']},applications:{a:{status:'submitted',note:'보존할 메모'}}};
 await page.addInitScript(data=>localStorage.setItem('benefit-planning:v2:guest',JSON.stringify(data)),existing);
 await page.goto('/');await openImport(page,1);
 for(const incoming of [
  {...existing,checklists:{...existing.checklists,toString:['documents']}},
  {...existing,applications:{...existing.applications,hasOwnProperty:{status:'preparing',note:'invalid'}}},
  {...existing,compareIds:['valueOf']},
 ]) {
  await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles(importFile(incoming));
  await expect(page.locator('.planning-import')).toContainText('올바른 JSON 기록');
  await expect(page.getByRole('region',{name:'가져오기 미리보기'})).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('benefit-planning:v2:guest')!))).toEqual(existing);
 }
 await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles(importFile(importData));
 await expect(page.getByRole('region',{name:'가져오기 미리보기'})).toContainText('선택 필요 1개');
});

test('a second tab changing records invalidates an import preview without losing either draft',async({page,context})=>{
 await page.goto('/');await openImport(page,0);await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles(importFile(importData));
 const other=await context.newPage();await api(other);await other.goto('/?benefit=a');await other.getByLabel('내 메모',{exact:true}).fill('다른 탭에서 저장');await other.getByRole('button',{name:'신청 기록 저장',exact:true}).click();
 await expect(page.locator('.planning-import')).toContainText('미리보기 이후 기록이 변경');await expect(page.getByRole('button',{name:'선택한 내용 가져오기'})).toBeDisabled();
 await page.getByRole('button',{name:'최신 기록으로 미리보기 갱신'}).click();await expect(page.locator('.planning-import')).toContainText('다른 탭에서 저장');
 await page.getByRole('radio',{name:/현재 기록 유지/}).check();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택한 내용 가져오기'}).click();
 await expect(page.locator('.planning-import')).toContainText('선택한 기록을 반영했어요');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('benefit-planning:v2:guest')!).applications.a.note)).toBe('다른 탭에서 저장');
 await other.close();
});

test('member device import survives failure and revision conflict and rechecks explicit choices',async({page})=>{
 await member(page);await page.addInitScript(data=>localStorage.setItem('benefit-planning:v2:guest',JSON.stringify(data)),importData);
 let state={revision:0,data:{version:1,compareIds:[],checklists:{},applications:{a:{status:'submitted',note:'계정 메모'}}}};
 let mode='fail';
 await page.route('**/api/account/planning',r=>{
  if(r.request().method()==='PUT'){
   if(mode==='fail')return r.fulfill({status:503,json:{}});
   if(mode==='conflict'){state={revision:1,data:{...state.data,applications:{a:{status:'submitted',note:'다른 기기 메모'}}}};return r.fulfill({status:409,json:{}});}
   expect(r.request().postDataJSON().revision).toBe(1);state={revision:2,data:r.request().postDataJSON().data};
  }
  return r.fulfill({json:state});
 });
 await page.goto('/');await expect(page.getByRole('button',{name:'신청 준비 1',exact:true})).toBeVisible();await openImport(page,1);
 await page.getByRole('button',{name:'비회원 기기 기록 미리보기'}).click();await page.getByRole('radio',{name:/가져온 기록 사용/}).check();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택한 내용 가져오기'}).click();await expect(page.locator('.planning-import')).toContainText('가져오기를 완료하지 못했어요');expect(state.data.applications.a.note).toBe('계정 메모');
 mode='conflict';page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택한 내용 가져오기'}).click();await expect(page.locator('.planning-import')).toContainText('미리보기 이후 기록이 변경');
 await page.getByRole('button',{name:'최신 기록으로 미리보기 갱신'}).click();await expect(page.locator('.planning-import')).toContainText('다른 기기 메모');await page.getByRole('radio',{name:/현재 기록 유지/}).check();
 mode='ok';page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택한 내용 가져오기'}).click();await expect(page.locator('.planning-import')).toContainText('선택한 기록을 반영했어요');expect(state.data.applications.a.note).toBe('다른 기기 메모');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('benefit-planning:v2:guest')!).applications.a.note)).toBe('파일에서 가져온 메모');
});

test('saved management search combines unavailable and deadline filters and resets empty results',async({page})=>{
 await page.clock.setFixedTime(new Date('2099-12-28T00:00:00Z'));
 await page.addInitScript(()=>localStorage.setItem('benefit-saved',JSON.stringify(['a','b','missing'])));
 await page.route('**/api/benefits?**',r=>new URL(r.request().url()).searchParams.get('size')==='100'?r.fulfill({json:{items:[{...benefits[0],deadline:'2000-01-01'},benefits[1]]}}):r.fallback());
 await page.goto('/?view=saved');await page.getByRole('button',{name:'관심목록 관리',exact:true}).click();const dialog=page.getByRole('dialog',{name:'관심목록 관리'});
 await expect(dialog.locator('li')).toHaveCount(3);await page.getByLabel('관심목록 공고 조건',{exact:true}).selectOption('week');await expect(dialog.locator('li')).toHaveCount(1);await expect(dialog.locator('li')).toContainText('서울 공통 교육');
 await page.getByLabel('관심목록 공고 조건',{exact:true}).selectOption('expired');await expect(dialog.locator('li')).toContainText('강남 주거 지원');
 await page.getByLabel('관심목록 공고 조건',{exact:true}).selectOption('missing');await page.getByRole('searchbox',{name:'관심목록 검색'}).fill('MISSING');await expect(dialog.locator('li')).toHaveCount(1);
 await page.getByRole('searchbox',{name:'관심목록 검색'}).fill('no-match');await expect(dialog.locator('li')).toHaveCount(0);await page.getByRole('button',{name:'관심목록 조건 초기화'}).click();await expect(dialog.locator('li')).toHaveCount(3);
 await page.setViewportSize({width:390,height:844});expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});

test('member import previews are discarded on logout and do not leak into guest planning',async({page})=>{
 await member(page);await page.goto('/');await page.getByRole('button',{name:/내 계정/}).click();await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toBeEnabled();await page.getByLabel('내 계정 닫기').click();
 await openImport(page,0);await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles(importFile(importData));await expect(page.getByRole('region',{name:'가져오기 미리보기'})).toBeVisible();
 await page.getByLabel('신청 준비 닫기').click();await page.getByRole('button',{name:/내 계정/}).click();await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByLabel('내 계정 닫기').click();
 await openImport(page,0);await expect(page.getByRole('region',{name:'가져오기 미리보기'})).toHaveCount(0);await expect(page.locator('.preparation-dialog')).not.toContainText('파일에서 가져온 메모');
 expect(await page.evaluate(()=>localStorage.getItem('benefit-planning:v2:guest'))).toBeNull();
});

test('import with unavailable browser storage retains records in memory and reports the limitation',async({page})=>{
 await page.addInitScript(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('benefit-planning:'))throw new DOMException('quota','QuotaExceededError');return write.call(this,key,value);};});
 await page.goto('/');await openImport(page,0);await page.getByLabel('JSON 기록 파일',{exact:true}).setInputFiles(importFile(importData));
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택한 내용 가져오기'}).click();await expect(page.locator('.planning-import')).toContainText('이번 방문에만 기억');await expect(page.locator('.preparation-list')).toContainText('파일에서 가져온 메모');
 expect(await page.evaluate(()=>localStorage.getItem('benefit-planning:v2:guest'))).toBeNull();
});

test('period filters survive reload, detail navigation and reset',async({page})=>{
 const variants=[{...benefits[0],periodType:'dated'},{...benefits[1],deadline:null,periodLabel:'상시신청',periodType:'ongoing'},{...benefits[2],deadline:null,periodLabel:'상시(예산 소진 시 종료)',periodType:'guidance'}];
 await page.route('**/api/benefits?**',route=>{
  const p=new URL(route.request().url()).searchParams;
  const items=variants.filter(b=>(!p.get('periodType')||p.get('periodType')==='all'||b.periodType===p.get('periodType'))&&(!p.get('region')||p.get('region')==='전체'||b.region===p.get('region')));
  return route.fulfill({json:{items,total:items.length,totalPages:1,page:1,size:12,demo:false}});
 });
 await page.goto('/?region=서울&periodType=ongoing');await expect(cards(page)).toHaveCount(1);
 await expect(page.getByLabel('신청 기간 구분')).toHaveValue('ongoing');await expect(cards(page)).toContainText('상시 신청');
 await page.getByLabel('신청 기간 구분').selectOption('dated');await expect(cards(page)).toContainText('날짜 마감');
 await page.getByRole('button',{name:'강남 주거 지원 자세히 보기',exact:true}).click();await page.goBack();await expect(page.getByLabel('신청 기간 구분')).toHaveValue('dated');
 await page.reload();await expect(cards(page)).toHaveCount(1);await expect(page.getByLabel('신청 기간 구분')).toHaveValue('dated');
 await page.getByRole('button',{name:'조건 초기화',exact:true}).click();await expect(cards(page)).toHaveCount(3);await expect(page.getByLabel('신청 기간 구분')).toHaveValue('all');
 await page.getByLabel('신청 기간 구분').selectOption('guidance');await expect(cards(page)).toContainText('별도 안내');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('member district preferences survive failed saves, reload and apply to strict search',async({page})=>{
 await member(page);let fail=false;
 let profile={region:'서울',district:'은평구',category:'전체',notificationsEnabled:true};
 await page.route('**/api/account/profile',r=>{
  if(r.request().method()==='PUT'){if(fail)return r.fulfill({status:503,json:{}});profile=r.request().postDataJSON();}
  return r.fulfill({json:profile});
 });
 await page.goto('/');await page.getByRole('button',{name:/내 계정/}).click();await expect(page.getByLabel('관심 시·군·구')).toHaveValue('은평구');
 await page.getByLabel('관심 시·군·구').selectOption('강남구');fail=true;await page.getByRole('button',{name:'조건 저장',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('연결이 지연');await expect(page.getByLabel('관심 시·군·구')).toHaveValue('강남구');expect(profile.district).toBe('은평구');
 fail=false;await page.getByRole('button',{name:'조건 저장',exact:true}).click();await expect(page.getByText('맞춤 조건을 저장했어요.',{exact:true})).toBeVisible();expect(profile.district).toBe('강남구');
 await page.reload();await page.getByRole('button',{name:/내 계정/}).click();await expect(page.getByLabel('관심 시·군·구')).toHaveValue('강남구');
 await page.getByRole('button',{name:'이 조건으로 찾아보기'}).click();await expect(page).toHaveURL(/district=/);await expect(page.getByLabel('시·군·구',{exact:true})).toHaveValue('강남구');await expect(cards(page)).toHaveCount(1);
 await page.getByRole('button',{name:/내 계정/}).click();await page.getByLabel('관심 지역',{exact:true}).selectOption('경기');await expect(page.getByLabel('관심 시·군·구')).toHaveValue('');
 await page.getByLabel('관심 시·군·구').selectOption('성남시');await page.setViewportSize({width:390,height:844});expect(await page.locator('.account-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 page.once('dialog',d=>d.dismiss());await page.getByLabel('내 계정 닫기').click();await expect(page.getByLabel('관심 시·군·구')).toHaveValue('성남시');
});

test('district preference choices remain usable when latest district lookup fails',async({page})=>{
 await member(page);await page.route('**/api/regions/districts?**',r=>r.fulfill({status:503,json:{}}));
 await page.goto('/');await page.getByRole('button',{name:/내 계정/}).click();await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toBeEnabled();
 await page.getByLabel('관심 지역',{exact:true}).selectOption('서울');await page.getByLabel('관심 시·군·구').selectOption('은평구');
 await expect(page.getByText('최신 시군구 목록을 확인하지 못해 저장된 목록을 표시해요.')).toBeVisible();await expect(page.getByLabel('관심 시·군·구')).toHaveValue('은평구');
 await page.getByLabel('관심 지역',{exact:true}).selectOption('전체');await expect(page.getByLabel('관심 시·군·구')).toHaveValue('');await expect(page.getByLabel('관심 시·군·구')).toBeDisabled();
});

test('an old profile API cannot falsely confirm a district save',async({page})=>{
 await member(page);
 await page.goto('/');await page.getByRole('button',{name:/내 계정/}).click();await expect(page.getByRole('button',{name:'조건 저장',exact:true})).toBeEnabled();
 await page.getByLabel('관심 지역',{exact:true}).selectOption('서울');await page.getByLabel('관심 시·군·구').selectOption('은평구');
 await page.getByRole('button',{name:'조건 저장',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('시군구 조건의 저장 결과를 확인하지 못했어요');
 await expect(page.getByLabel('관심 시·군·구')).toHaveValue('은평구');await expect(page.getByText('맞춤 조건을 저장했어요.',{exact:true})).toHaveCount(0);
});
