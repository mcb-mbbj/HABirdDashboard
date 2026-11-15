// Exercise real range cutoffs, labels, feeder changes and hidden-selector mode.
const assert=require('assert'),fs=require('fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'http://ha.local:8123/lovelace/birds',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,errors=[];const now=Date.parse('2026-11-13T12:00:00Z');
w.Date=class extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));
w.Audio=class {addEventListener(){}load(){}play(){return Promise.resolve();}pause(){}};
w.ResizeObserver=class {observe(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;
Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return this.id==='collage'?1200:300;}});
Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return this.id==='collage'?800:100;}});
const manifest='/objects/'+'a'.repeat(64)+'.json';
const pages=['woodland','kitchen'].map((site,i)=>({feeder_id:site,url:'/objects/'+String(i+1).repeat(64)+'.json'}));
const ageHours=[1,13,6*24,8*24,29*24,31*24,62*24];
const payload={};
for(const p of pages)payload[p.url]=ageHours.map((h,i)=>({id:p.feeder_id+i,feeder_id:p.feeder_id,scientific_name:'Cyanistes caeruleus',common_name:'Blue tit',observed_at:(now-h*3600000)/1000}));
// UK clock reversal: both UTC instants belong to local 01:30 on 25 October.
for(const p of pages)for(const [i,stamp] of ['2026-10-25T00:30:00Z','2026-10-25T01:30:00Z'].entries())payload[p.url].push({id:p.feeder_id+'dst'+i,feeder_id:p.feeder_id,scientific_name:'Cyanistes caeruleus',common_name:'Blue tit',observed_at:Date.parse(stamp)/1000});
w.fetch=async url=>{const path=new URL(url).pathname;let data;
 if(path==='/current.json')data={generated_at:now/1000,visual_feed:manifest};
 else if(path===manifest)data={version:1,source:'fieldwatch',timezone:'Europe/London',pages};
 else data=payload[path];
 assert(data,'Unexpected network request '+url);return {ok:true,json:async()=>data};};
w.eval(fs.readFileSync('dist/habird-card.js','utf8'));
const card=w.document.createElement('habird-card');
const config={data_source:'fieldwatch',fieldwatch_url:'https://fieldwatch.example/current.json',feeder:'woodland',window:'today',window_selector:true};
card.setConfig(config);card.hass={states:{},themes:{darkMode:false}};w.document.body.appendChild(card);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await wait(1200);let root=card.shadowRoot,select=root.getElementById('fieldwatchWindow');
 assert.deepEqual([...select.options].map(o=>o.textContent),['Today','Last 7 days','Last 30 days','All time']);
 function count(n,label){
  const tile=root.querySelector('.gtile[data-sci="Cyanistes caeruleus"]');assert(tile.title.includes(n+' visit'),tile.title);if(label)assert(tile.title.includes(label),tile.title);
  for(const chart of ['fieldwatchHourly','fieldwatchCalendar']){
   const row=root.querySelector('#'+chart+' .stats-hm-row[data-sci="Cyanistes caeruleus"]');
   assert.equal(row.querySelector('.stats-hm-tot').textContent,String(n),chart+' total uses same range');
   const sum=[...row.querySelectorAll('.stats-hm-cell')].reduce((a,c)=>a+Number(c.textContent.replace(/,/g,'')||0),0);
   assert.equal(sum,n,chart+' cells sum to period total');
  }
  assert(root.getElementById('fieldwatchPeriodSummary').textContent.includes(n+' visits'));
 }

 count(1,'today');
 for(const [range,n,label] of [['168',3,'last 7 days'],['720',7,'last 30 days'],['1000000',9,'retained history'],['today',1,'today']]){
  select.value=range;select.dispatchEvent(new w.Event('change'));await wait(650);count(n,label);
  assert.equal(root.getElementById('fieldwatchCalendar').dataset.bucket,range==='1000000'?'weeks':'days','automatic granularity');
  if(range==='168')assert.equal(root.querySelectorAll('#fieldwatchCalendar .stats-hm-hr').length,7,'week matches seven journal dates');
  if(range==='720'){
   const heads=[...root.querySelectorAll('#fieldwatchCalendar .stats-hm-hr')];
   assert.equal(heads.length,30,'month uses thirty local dates');
   const dst=heads.findIndex(h=>h.title==='2026-10-25');assert(dst>=0);
   assert.equal(root.querySelectorAll('#fieldwatchCalendar .stats-hm-cell')[dst].textContent,'2','both repeated-clock instants stay in same local date');
   assert.equal(root.querySelectorAll('#fieldwatchHourly .stats-hm-cell')[1].textContent,'2','both repeated-clock instants stay in same local hour');
  }
  if(range==='1000000'){
   let bucket=root.getElementById('fieldwatchBuckets');bucket.value='days';bucket.dispatchEvent(new w.Event('change'));count(n,label);
   assert.equal(root.querySelectorAll('#fieldwatchCalendar .stats-hm-hr').length,63,'explicit daily option retains zero-visit dates');
   bucket=root.getElementById('fieldwatchBuckets');bucket.value='weeks';bucket.dispatchEvent(new w.Event('change'));count(n,label);
   for(const h of root.querySelectorAll('#fieldwatchCalendar .stats-hm-hr'))assert.equal(new Date(h.title.replace('Week beginning ','')+'T00:00:00Z').getUTCDay(),1,'Monday weeks');
   bucket=root.getElementById('fieldwatchBuckets');bucket.value='auto';bucket.dispatchEvent(new w.Event('change'));
  }
 }
 select.value='720';select.dispatchEvent(new w.Event('change'));await wait(650);
 const feeder=root.getElementById('fieldwatchFeeder');feeder.value='both';feeder.dispatchEvent(new w.Event('change'));await wait(700);
 assert.equal(select.value,'720');count(14,'last 30 days');
 card.setConfig({...config,window_selector:false});await wait(900);
 assert(!card.shadowRoot.getElementById('fieldwatchWindow'),'selector can be hidden for future display');
 assert.deepEqual(errors,[]);console.log('FIELDWATCH WINDOW TEST PASSED: ranges, both heatmap sums, zero dates, weekly grouping, DST, feeder changes');dom.window.close();
})().catch(e=>{console.error(e);process.exit(1);});
