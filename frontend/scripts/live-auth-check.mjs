// Opt-in real backend check. Uses two independent auth sessions; never logs credentials.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
const base = (process.env.BENEFIT_AUTH_TEST_BASE || 'https://benefit-alert.vercel.app').replace(/\/$/, '');
const email = process.env.BENEFIT_AUTH_TEST_EMAIL;
const password = process.env.BENEFIT_AUTH_TEST_PASSWORD;
if (!email || !password || process.env.BENEFIT_AUTH_TEST_WRITES !== '1') {
  console.log('NOT RUN: configure a dedicated confirmed test account with BENEFIT_AUTH_TEST_EMAIL, BENEFIT_AUTH_TEST_PASSWORD and BENEFIT_AUTH_TEST_WRITES=1 in secure environment settings.');
  process.exit(2);
}
const target = new URL(base);
if (base !== 'https://benefit-alert.vercel.app' && !(target.protocol === 'http:' && target.hostname === '127.0.0.1')) throw Error('Unsupported test target');
const fetchBounded = (url, init = {}) => fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
const id = `auth-check-${randomUUID()}`;
let stage = 'configuration', clients = [], sessions = [], created = false, failed = false;
async function request(session, method = 'GET', body) {
  const response = await fetchBounded(`${base}/api/account/planning`, {method,headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:body ? JSON.stringify(body) : undefined});
  return {status:response.status,data:await response.json()};
}
const check = (value) => { if (!value) throw Error('Check failed'); };
try {
  const response = await fetchBounded(`${base}/api/client-config`);check(response.ok);
  const config = await response.json();check(config.authEnabled);
  clients = [0,1].map(()=>createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetchBounded}}));
  stage = 'two independent logins';
  for(const client of clients) {const r=await client.auth.signInWithPassword({email,password});check(!r.error && r.data.session);sessions.push(r.data.session);}
  check(sessions[0].user.id===sessions[1].user.id);
  stage = 'read baseline';
  const baseline=await request(sessions[0]);check(baseline.status===200);
  stage = 'create isolated test record';
  // Set before sending: a timeout can still mean that the server committed the write.
  created=true;
  const first=await request(sessions[0],'PUT',{revision:baseline.data.revision,data:{...baseline.data.data,applications:{...baseline.data.data.applications,[id]:{status:'preparing',note:'Automated dedicated-account sync check'}}}});check(first.status===200);
  stage = 'second session reads record';
  const second=await request(sessions[1]);check(second.status===200 && second.data.data.applications[id]?.status==='preparing');
  stage = 'stale update conflict';
  const stale=await request(sessions[1],'PUT',{revision:baseline.data.revision,data:baseline.data.data});check(stale.status===409);
  stage = 'second session writes record';
  const updated=await request(sessions[1],'PUT',{revision:second.data.revision,data:{...second.data.data,applications:{...second.data.data.applications,[id]:{status:'submitted',note:'Automated dedicated-account sync check'}}}});check(updated.status===200);
  stage = 'first session reads update';
  const final=await request(sessions[0]);check(final.status===200 && final.data.data.applications[id]?.status==='submitted');
  console.log('PASS: two real auth sessions, cross-session persistence and stale-write conflict.');
} catch {failed=true;console.error(`FAIL at stage: ${stage}. Credentials and response bodies omitted.`);}
finally {
  if(created && sessions[0]) {
    let cleaned=false;
    for(let attempt=0;attempt<3 && !cleaned;attempt++) {
      try {
        const latest=await request(sessions[0]);check(latest.status===200);
        if(!latest.data.data.applications[id]) {cleaned=true;break;}
        const data=structuredClone(latest.data.data);delete data.applications[id];
        const result=await request(sessions[0],'PUT',{revision:latest.data.revision,data});cleaned=result.status===200;
      } catch { /* Bound cleanup retries; never overwrite a revision conflict. */ }
    }
    if(!cleaned) {failed=true;console.error(`CLEANUP REQUIRED: remove only application record ${id} from the dedicated account.`);}
    else console.log('PASS: isolated test record removed; other records preserved.');
  }
  for(const client of clients) {try {const result=await client.auth.signOut({scope:'local'});if(result.error) throw result.error;}catch{failed=true;console.error('Test-session sign-out failed; revoke the dedicated test sessions manually.');}}
}
process.exitCode=failed?1:0;
