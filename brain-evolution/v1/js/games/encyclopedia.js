import { RestoredGame, tr, escapeHTML } from './restored-game.js';
import { arrayValue, shuffle } from '../original.js';
import { i18n } from '../i18n.js';
import { audio } from '../audio.js';

// INTERESTING_VALUES: 99 numeric facts, four study pages, then numeric answers.
// The shell's 222 interesting facts are a separate resource.
export class EncyclopediaGame extends RestoredGame {
  id='encyclopedia';
  get title() { return tr('Энциклопедия','Encyclopedia'); }
  async init(difficulty='easy') {
    if(!await this.begin(difficulty)) return;
    this.level=this.original[`iv_lev_${this.diff}`];
    this.values=Object.entries(this.original).filter(([key])=>/^iv_value_\d+$/.test(key)).map(([,value])=>value);
    this.page=0; this.question=0; this.units=null; this.phase='units'; this.right=0; this.wrong=0;
    this.render();
    this.tick(()=> {
      if(this.phase==='remember' && --this.remaining<=0) this.nextPage();
      this.updateStatus();
    });
  }
  value(item) { return item[`${this.units}_value`] ?? item.value; }
  numeric(item) { return Math.trunc(parseFloat(String(this.value(item)).replace(/\s/g,'').replace(',','.'))) || 0; }
  sortedValues() {
    if(this.sortedFor===this.units) return this.sorted;
    // Exchange sort on the integer value, in database order, exactly like the original.
    const list=this.values.slice();
    for(let i=0;i<list.length-1;i++) for(let j=i+1;j<list.length;j++)
      if(this.numeric(list[i])>this.numeric(list[j])) [list[i],list[j]]=[list[j],list[i]];
    this.sortedFor=this.units; this.sorted=list; return list;
  }
  label(item) { return i18n.t(item.name); }
  unit(item) { return i18n.t(item[`${this.units}_text`]||'',''); }
  study(units) {
    if(!this.playable || this.phase!=='units') return;
    this.units=units;
    this.studied=shuffle(this.values).slice(0,Number(this.level.m_nPages)*Number(this.level.m_nValuesCount));
    this.phase='remember'; this.remaining=Number(this.level.m_nTimePerOneScreen); this.render();
  }
  nextPage() {
    if(!this.playable || this.phase!=='remember') return;
    if(++this.page>=Number(this.level.m_nPages)) {
      this.targets=shuffle(this.studied).slice(0,Number(this.level.m_nTargetsCount));
      this.makeQuestion();
    } else { this.remaining=Number(this.level.m_nTimePerOneScreen); this.render(); }
  }
  makeQuestion() {
    this.phase='answer';
    this.current=this.targets[this.question];
    // Original options (FUN_4a0d18c0): the database is sorted by value, and the distractors are the
    // neighbours at distance 1, 2 and 3 — on whichever side is closer in value (index 0 never on the left).
    const db=this.sortedValues(), t=db.indexOf(this.current), v=this.numeric(this.current), picks=[];
    for(let d=1;d<=3;d++) {
      const left=t-d>=1?Math.abs(v-this.numeric(db[t-d])):1e9, right=t+d<db.length?Math.abs(v-this.numeric(db[t+d])):2e9;
      picks.push(db[right<left?t+d:t-d]);
    }
    this.options=shuffle([this.current,...picks].map(item=>this.value(item))); this.render();
  }
  render() {
    let body,footer='';
    if(this.phase==='units') {
      body=`<p class="restored-instruction">${i18n.t('Please choose measurement units:').replace(/\\n/g,' ')}</p><div class="restored-results">
        <button class="amaze-action-btn" data-units="eu">${tr('Метрические: м, км, кг, °C','Metric: m, km, kg, °C')}</button>
        <button class="amaze-action-btn" data-units="us">${tr('Американские: футы, мили, фунты, °F','US: feet, miles, pounds, °F')}</button></div>`;
    } else if(this.phase==='remember') {
      const perPage=Number(this.level.m_nValuesCount);
      body=`<p class="restored-instruction">${i18n.t('Please remember these values')}</p><div class="iv-study">
        ${this.studied.slice(this.page*perPage,(this.page+1)*perPage).map(item=>`<article class="iv-value"><p>${escapeHTML(this.label(item))}</p><strong>${escapeHTML(this.value(item))}</strong><span>${escapeHTML(this.unit(item))}</span></article>`).join('')}</div>`;
      footer=`<button class="amaze-action-btn" data-next-page>${tr('Далее','Next')}</button>`;
    } else {
      body=`<p class="restored-instruction iv-question">${escapeHTML(this.label(this.current))} ${escapeHTML(this.unit(this.current))}</p>
        <div class="iv-answers">${this.options.map((value,index)=>`<button class="amaze-action-btn" data-answer="${index}">${escapeHTML(value)}</button>`).join('')}</div>`;
      if(this.phase==='feedback') footer=`<p aria-live="polite">${this.wasCorrect?tr('Верно!','Correct!'):tr('Правильный ответ:','Correct answer:')} ${escapeHTML(this.value(this.current))}</p><button class="amaze-action-btn" data-next-question>${tr('Далее','Next')}</button>`;
    }
    this.frame(this.title,body,footer); this.updateStatus();
    this.container.querySelectorAll('[data-units]').forEach(button=>button.onclick=()=>this.study(button.dataset.units));
    this.container.querySelector('[data-next-page]')?.addEventListener('click',()=>this.nextPage());
    this.container.querySelectorAll('[data-answer]').forEach(button=> {
      button.disabled=this.phase!=='answer';
      button.onclick=()=>this.answer(Number(button.dataset.answer));
    });
    this.container.querySelector('[data-next-question]')?.addEventListener('click',()=> {
      if(!this.playable || this.phase!=='feedback') return;
      if(++this.question>=this.targets.length) this.finish(); else this.makeQuestion();
    });
  }
  answer(index) {
    if(!this.playable || this.phase!=='answer') return;
    this.wasCorrect=this.options[index]===this.value(this.current);
    if(this.wasCorrect) this.right++; else this.wrong++;
    const section=this.original.iv_show_results;
    this.score+=arrayValue(section[this.wasCorrect?'i1_points_arr':'i2_points_arr'],this.diff);
    audio.play(this.wasCorrect?'good':'wrong'); this.phase='feedback'; this.render();
  }
  finish(score=this.score) {
    super.finish(score,{section:this.original.iv_show_results,values:{P1:this.right,P2:this.wrong,TOTAL:Math.round(score)}});
  }
  updateStatus() {
    const status=this.container.querySelector('[data-status]');
    if(status) status.textContent=this.phase==='remember'?`${this.page+1}/${this.level.m_nPages} · ${this.remaining} ${tr('с','s')}`:this.targets?`${this.question+1}/${this.targets.length}`:'';
  }
}
