const assert=require('assert'),fs=require('fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'http://ha.local/lovelace',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,errors=[],now=Date.parse('2026-11-15T18:00:00Z');
w.Date=class extends Date {constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));
w.Audio=class {addEventListener(){}load(){}play(){return Promise.resolve();}pause(){}};w.ResizeObserver=class {observe(){}disconnect(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;
Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return this.id==='collage'?1200:300;}});Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return this.id==='collage'?800:100;}});
const wait=ms=>new Promise(r=>setTimeout(r,ms)),obj=n=>'/objects/'+String(n).repeat(64)+'.json';
let omitMedium=false,slowMedium=false;
const levels=['strict','high','medium'],payload={},refs={};
for(const [i,level] of levels.entries()){
 refs[level]=obj(i+1);const pages=[];
 for(const [j,site] of ['woodland','kitchen'].entries()){
  const url=obj(i*2+j+4);pages.push({feeder_id:site,url});
  payload[url]=levels.slice(0,i+1).flatMap(tier=>[0,1].map(boundary=>({id:site+tier+boundary,feeder_id:site,scientific_name:'Passer domesticus',common_name:'House sparrow',confidence_tier:tier,observed_at:boundary?Date.parse('2026-11-08T23:59:59Z')/1000:(now-3600000)/1000})));
 }
 payload[refs[level]]={version:1,source:'fieldwatch',timezone:'Europe/London',pages};
}
w.fetch=async url=>{const p=new URL(url).pathname;if(p==='/current.json')return {ok:true,json:async()=>({generated_at:now/1000,visual_feed:refs.strict,visual_feeds:omitMedium?{strict:refs.strict,high:refs.high}:refs})};if(slowMedium&&p===refs.medium)await wait(500);assert(payload[p],p);return {ok:true,json:async()=>payload[p]};};
w.eval(fs.readFileSync('dist/habird-card.js','utf8'));
const card=w.document.createElement('habird-card'),config={data_source:'fieldwatch',feeder:'woodland',window:'today',window_selector:true,confidence_selector:true};card.setConfig(config);card.hass={states:{},themes:{darkMode:false}};w.document.body.appendChild(card);
function count(n){const root=card.shadowRoot;assert(root.querySelector('.gtile').title.includes(n+' visit'));for(const id of ['fieldwatchHourly','fieldwatchCalendar'])assert.equal(root.querySelector('#'+id+' .stats-hm-row .stats-hm-tot').textContent,String(n));}
function choose(id,value){const e=card.shadowRoot.getElementById(id);e.value=value;e.dispatchEvent(new w.Event('change'));}
(async()=>{
 await wait(1000);count(1);
 for(const [level,n] of [['high',2],['medium',3],['strict',1]]){choose('fieldwatchConfidence',level);await wait(650);count(n);assert.equal(card.shadowRoot.getElementById('fieldwatchConfidenceNote').hidden,level==='strict');}
 choose('fieldwatchConfidence','medium');await wait(650);choose('fieldwatchWindow','168');await wait(650);count(3);
 choose('fieldwatchWindow','1000000');await wait(650);count(6);
 choose('fieldwatchFeeder','both');await wait(650);count(12);
 slowMedium=true;card.setConfig({...config,confidence_entity:'input_select.confidence'});card.hass={states:{'input_select.confidence':{state:'medium',last_updated:'one'}},themes:{darkMode:false}};
 await wait(100);card.hass={states:{'input_select.confidence':{state:'strict',last_updated:'two'}},themes:{darkMode:false}};await wait(2000);count(1);
 omitMedium=true;card.setConfig({...config,confidence:'medium',confidence_selector:false});await wait(900);assert.equal(card.shadowRoot.querySelectorAll('.gtile').length,0,'missing candidate feed must not silently show strict counts');
 assert.deepEqual(errors,[]);dom.window.close();console.log('FIELDWATCH CONFIDENCE PASSED: cumulative counts, both heatmaps, calendar boundary, feeder, helper race, missing feed');
})().catch(e=>{console.error(e);process.exit(1)});
