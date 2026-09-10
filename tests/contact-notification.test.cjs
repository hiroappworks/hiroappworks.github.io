const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../gas/contact-form/Code.gs'), 'utf8');
const SENTINEL = 'SYNTHETIC_PRIVATE_VALUE';
function harness(options = {}) {
  const events = [], mails = [], saved = [], logs = [], cache = new Map();
  const types = {LIST:'LIST', MULTIPLE_CHOICE:'CHOICE', PARAGRAPH_TEXT:'PARAGRAPH', TEXT:'TEXT'};
  const defs = [ ['対象アプリ',types.LIST,true,['委託販売ノート','その他']], ['お問い合わせ種別',types.LIST,true,['操作方法','不具合','購入・復元','機能要望','その他']], ['お問い合わせ内容',types.PARAGRAPH_TEXT,true], ['返信先メールアドレス',types.TEXT,true], ['アプリのバージョン',types.TEXT,false], ['iOSバージョン／iPhone機種',types.TEXT,false] ];
  const items = defs.map(([title,type,required,choices]) => {
    const item = {getTitle:()=>title,getType:()=>type,isRequired:()=>required,getChoices:()=>choices.map(v=>({getValue:()=>v})),createResponse:value=>({title,value})};
    item.asTextItem=item.asParagraphTextItem=item.asListItem=item.asMultipleChoiceItem=()=>item;
    return item;
  });
  const props = {GOOGLE_FORM_ID:'synthetic_form_id',TURNSTILE_SECRET:SENTINEL+'_secret',ALLOWED_HOSTNAMES:'hiroappworks.com',CONTACT_NOTIFICATION_EMAIL:'contact@example.test',...options.props};
  const context = vm.createContext({
    FormApp:{ItemType:types,openById:id=>{assert.equal(id,'synthetic_form_id');return {getItems:()=>items,createResponse:()=>{const values=[];return {withItemResponse(x){values.push(x);return this;},submit(){events.push('submit');if(options.saveFail)throw Error(SENTINEL);saved.push(values);}};}};}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>{if(k==='CONTACT_NOTIFICATION_EMAIL'&&options.propertyFail)throw Error(SENTINEL);return props[k];}})},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v,ttl)=>{assert.equal(ttl,600);events.push('cache');cache.set(k,v);}})},
    LockService:{getScriptLock:()=>({tryLock:()=>!options.lockFail,releaseLock:()=>events.push('unlock')})},
    UrlFetchApp:{fetch:()=>{events.push('verify');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:!options.verifyFail,hostname:'hiroappworks.com'})};}},
    MailApp:{sendEmail:m=>{events.push('mail');if(options.mailFail)throw Error(SENTINEL);mails.push(m);}},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()]},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({text:s,setMimeType(){return this;}})},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'all'},createHtmlOutput:s=>({text:s,setXFrameOptionsMode(){return this;}})},
    console:{warn:s=>{if(options.logFail)throw Error(SENTINEL);logs.push(s);}},
  });
  vm.runInContext(source,context);
  const payload = {appId:'app_consignment_note',inquiryTypeId:'usage',message:SENTINEL+'_message\nsecond line',email:'synthetic-reply@example.test',appVersion:SENTINEL+'_version',iosDevice:SENTINEL+'_device',locale:'ja',requestId:'synthetic_request_001',turnstileToken:SENTINEL+'_token',honeypot:''};
  const send = (changes={})=>context.doPost({postData:{contents:JSON.stringify({...payload,...changes})}});
  return {context,send,payload,events,mails,saved,logs,cache};
}
for(const locale of ['ja','en']) test(locale+' saves all existing fields then caches then notifies once',()=>{
  const h=harness();assert.deepEqual(JSON.parse(h.send({locale}).text),{ok:true});
  assert.deepEqual(h.events,['verify','submit','cache','mail','unlock']);assert.equal(h.saved.length,1);assert.equal(h.mails.length,1);
  const values=Object.fromEntries(h.saved[0].map(x=>[x.title,x.value]));
  assert.equal(values['お問い合わせ内容'],h.payload.message);assert.equal(values['返信先メールアドレス'],h.payload.email);assert.equal(values['アプリのバージョン'],h.payload.appVersion);assert.equal(values['iOSバージョン／iPhone機種'],h.payload.iosDevice);
  assert.equal(h.mails[0].to,'contact@example.test');assert.equal(h.mails[0].subject,'【Hiro App Works】新しいお問い合わせ');
  assert.match(h.mails[0].body,/https:\/\/docs.google.com\/forms\/d\/synthetic_form_id\/edit#responses$/);
  assert.deepEqual(Object.keys(h.mails[0]).sort(),['body','subject','to']);assert.ok(!JSON.stringify(h.mails).includes(SENTINEL));assert.ok(!JSON.stringify(h.mails).includes(h.payload.email));
});
for(const changes of [{email:''},{message:''},{honeypot:'bot'},{locale:'xx'},{appId:'unknown'}]) test('invalid input '+JSON.stringify(changes),()=>{const h=harness();assert.equal(JSON.parse(h.send(changes).text).ok,false);assert.equal(h.saved.length,0);assert.equal(h.mails.length,0);});
for(const option of ['verifyFail','saveFail','lockFail']) test(option+' never notifies',()=>{const h=harness({[option]:true});assert.equal(JSON.parse(h.send().text).ok,false);assert.equal(h.mails.length,0);assert.equal(h.saved.length,0);if(option!=='lockFail')assert.equal(h.events.at(-1),'unlock');});
test('accepted cache and fetch-to-iframe retry do not save or notify again',()=>{const h=harness();h.send();const second=h.send({transport:'iframe'});assert.match(second.text,/"ok":true/);assert.equal(h.saved.length,1);assert.equal(h.mails.length,1);assert.equal(h.events.filter(x=>x==='verify').length,1);assert.equal(h.events.filter(x=>x==='unlock').length,2);});
for(const recipient of [undefined,'',' contact@example.test','contact@example.test\n','a@example.test,b@example.test','a@example.test;b@example.test','Name <a@example.test>','invalid']) test('invalid recipient skipped '+JSON.stringify(recipient),()=>{const h=harness({props:{CONTACT_NOTIFICATION_EMAIL:recipient}});assert.equal(JSON.parse(h.send().text).ok,true);assert.equal(h.saved.length,1);assert.equal(h.mails.length,0);assert.deepEqual(h.logs,['contact_notification_invalid_settings']);});
for(const options of [{mailFail:true},{propertyFail:true},{mailFail:true,logFail:true},{propertyFail:true,logFail:true}]) test('notification failure isolated '+JSON.stringify(options),()=>{const h=harness(options);assert.equal(JSON.parse(h.send().text).ok,true);assert.equal(h.saved.length,1);assert.equal(h.cache.size,1);assert.equal(h.events.at(-1),'unlock');assert.ok(!JSON.stringify(h.logs).includes(SENTINEL));h.send();assert.equal(h.saved.length,1);assert.ok(h.events.filter(x=>x==='mail').length<=1);});
test('private helpers only and manifest keeps required scopes',()=>{const names=[...source.matchAll(/^function (\w+)\(/gm)].map(x=>x[1]);assert.deepEqual(names.filter(x=>!x.endsWith('_')),['doGet','doPost']);const m=JSON.parse(fs.readFileSync(path.join(__dirname,'../gas/contact-form/appsscript.json'),'utf8'));assert.deepEqual(m.oauthScopes,['https://www.googleapis.com/auth/forms','https://www.googleapis.com/auth/script.external_request','https://www.googleapis.com/auth/script.send_mail']);});
