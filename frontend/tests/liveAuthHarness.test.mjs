import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
const run = env => new Promise(resolve=>{
 const child=spawn(process.execPath,['scripts/live-auth-check.mjs'],{env:{...process.env,...env}});let output='';
 child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('exit',code=>resolve({code,output}));
});
test('live auth runner refuses to run without explicit dedicated-account settings',async()=>{
 const result=await run({BENEFIT_AUTH_TEST_EMAIL:'',BENEFIT_AUTH_TEST_PASSWORD:'',BENEFIT_AUTH_TEST_WRITES:''});assert.equal(result.code,2);assert.match(result.output,/NOT RUN/);
});
test('live auth runner verifies two sessions and cleans up only its own record against a local protocol fixture',async()=>{
 let revision=0,logins=0,logouts=0,conflicts=0;
 let data={version:1,compareIds:[],checklists:{},applications:{existing:{status:'preparing',note:'keep existing'}}};
 const server=createServer(async(req,res)=>{
  let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{};
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/client-config')return res.end(JSON.stringify({authEnabled:true,supabaseUrl:`http://127.0.0.1:${server.address().port}`,publishableKey:'fixture-only'}));
  if(req.url.startsWith('/auth/v1/token'))return res.end(JSON.stringify({access_token:`fixture-token-${++logins}`,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.test',email_confirmed_at:'2026-01-01'}}));
  if(req.url.startsWith('/auth/v1/logout')){logouts++;res.statusCode=204;return res.end();}
  if(req.url==='/api/account/planning'){
   if(req.method==='PUT') {if(body.revision!==revision){conflicts++;res.statusCode=409;return res.end('{}');}data=body.data;revision++;}
   return res.end(JSON.stringify({revision,data}));
  }
  res.statusCode=404;res.end('{}');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const result=await run({BENEFIT_AUTH_TEST_BASE:`http://127.0.0.1:${server.address().port}`,BENEFIT_AUTH_TEST_EMAIL:'fixture@example.test',BENEFIT_AUTH_TEST_PASSWORD:'fixture-password',BENEFIT_AUTH_TEST_WRITES:'1'});
  assert.equal(result.code,0,result.output);assert.equal(logins,2);assert.equal(logouts,2);assert.equal(conflicts,1);assert.deepEqual(Object.keys(data.applications),['existing']);assert.equal(data.applications.existing.note,'keep existing');assert.doesNotMatch(result.output,/fixture-password|fixture-token/);
 }finally{await new Promise(r=>server.close(r));}
});
