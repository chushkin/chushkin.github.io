import { RestoredGame, tr } from './restored-game.js';
import { arrayValue, createRandom } from '../original.js';
import * as G from './guess-who-model.js';
import { audio } from '../audio.js';

// ANTENNA_HEAD: identify one object from feature clues, not from a target face.
export class GuessWhoGame extends RestoredGame {
  id='guess_who';
  get title() { return tr('Кто это?','Guess Who'); }
  async init(difficulty='easy') {
    if(!await this.begin(difficulty)) return;
    const cfg=this.original.ant_head_game_field;
    const prefix=['easy','med','hard'][this.diff];
    const genKey=`${this.mode==='marking'?'bm_':''}${prefix}_gen_var`;
    this.genVar=cfg[genKey].trim().split(/\s+/).map(Number);
    this.qa=cfg[`${prefix}_qa_gen_var`].trim().split(/\s+/).map(Number);
    this.rounds=this.genVar[3]; this.round=0; this.correct=0; this.wrong=0;
    this.rand=createRandom(Date.now()); this.pools=G.createPools();
    this.palette=Array.from({length:Number(cfg.colors_count)},(_,i)=>`rgb(${cfg[`color${i+1}`].trim().split(/\s+/).slice(0,3).join(',')})`);
    this.images={};
    const generation=this.generation;
    await Promise.all(['ANTHEAD_FIELD_SHAPES_A','ANTHEAD_FIELD_TEXTURES','AntHead_Filed_AntennasT','AntHead_Filed_AntennasB','AntHead_Filed_AntennasL','AntHead_Filed_AntennasR','AntHead_Bott_Shapes','AntHead_Bott_Textures','AntHead_Bott_Antennas'].map(name=>new Promise((resolve,reject)=> {
      const image=new Image(); image.onload=()=>{this.images[name]=image;resolve();}; image.onerror=()=>reject(new Error(`Missing ant sprite: ${name}`));
      image.src=`assets/textures/restored/${name}.png`;
    })));
    if(this.destroyed||generation!==this.generation) return;
    this.nextRound();
    this.tick(()=>{this.elapsed++;this.calculateScore();this.updateStatus();});
  }
  nextRound() {
    this.phase='answer';
    const round=G.createRound(this.genVar,this.qa,this.pools,this.rand);
    this.candidates=round.objects; this.target=round.target; this.questionCode=round.question; this.question=G.decodeQuestion(round.question);
    this.clues=['antenna','shape','texture','color'].filter(key=>this.question[key]>=0);
    // Objects are scattered over the 438x438 field like the original (radius ~ half an object).
    this.positions=G.place(this.candidates.length,438,438,50,this.rand);
    this.render();
  }
  renderObject(canvas,item) {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,100,100);
    const shape=this.images.ANTHEAD_FIELD_SHAPES_A;
    const mask=document.createElement('canvas');mask.width=100;mask.height=100;
    const m=mask.getContext('2d');
    m.drawImage(shape,0,item.shape*50,60,50,20,25,60,50);
    m.globalCompositeOperation='source-in';m.fillStyle=this.palette[item.color];m.fillRect(0,0,100,100);
    ctx.drawImage(mask,0,0);
    {
      m.globalCompositeOperation='source-atop';m.globalAlpha=.55;m.fillStyle='#173854';
      const texture=this.images.ANTHEAD_FIELD_TEXTURES;
      const layer=document.createElement('canvas');layer.width=100;layer.height=100;
      const l=layer.getContext('2d');l.drawImage(texture,0,item.texture*66,63,66,19,18,63,66);
      l.globalCompositeOperation='source-in';l.fillStyle='#173854';l.fillRect(0,0,100,100);
      m.drawImage(layer,0,0);ctx.clearRect(0,0,100,100);ctx.drawImage(mask,0,0);
    }
    // Antenna slots in config order: L, T, R, B — each side has its own type.
    for(const [slot,suffix,width,height,x,y] of [[0,'L',41,33,0,33],[1,'T',36,41,32,0],[2,'R',41,33,59,33],[3,'B',36,41,32,59]]) {
      ctx.drawImage(this.images[`AntHead_Filed_Antennas${suffix}`],0,item.antennas[slot]*height,width,height,x,y,width,height);
    }
  }
  renderClue(canvas,key) {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,100,100);
    const sprite={shape:['AntHead_Bott_Shapes',46,44],texture:['AntHead_Bott_Textures',72,70],antenna:['AntHead_Bott_Antennas',48,36]}[key];
    if(sprite) {
      const [name,width,height]=sprite;
      const ratio=Math.min(80/width,80/height),w=width*ratio,h=height*ratio;
      ctx.drawImage(this.images[name],0,this.question[key]*height,width,height,(100-w)/2,(100-h)/2,w,h);
    } else {
      ctx.fillStyle=this.palette[this.question.color];ctx.beginPath();ctx.arc(50,50,28,0,Math.PI*2);ctx.fill();
    }
  }
  render() {
    this.frame(this.title, `<p class="restored-instruction">${tr('Найдите объект по признакам внизу','Find the object matching the features below')}</p>
      <div class="guess-field guess-scatter restored-field">${this.candidates.map((_,i)=>`<button class="guess-cell" data-ant="${i}" style="left:${(this.positions[i].x-50)/438*100}%;top:${(this.positions[i].y-50)/438*100}%" aria-label="${tr('Объект','Object')} ${i+1}"><canvas width="100" height="100"></canvas></button>`).join('')}</div>
      <p class="geometry-feedback" data-feedback aria-live="polite"></p>`,
      `<div class="ant-clues">${this.clues.map(key=>`<div><canvas width="100" height="100" data-clue="${key}"></canvas><span>${({shape:tr('Форма','Shape'),color:tr('Цвет','Color'),texture:tr('Узор','Pattern'),antenna:tr('Усики','Antennae')})[key]}</span></div>`).join('')}</div>
      ${this.phase==='feedback'?`<button class="amaze-action-btn" data-next>${tr('Далее','Next')}</button>`:''}`);
    this.container.querySelectorAll('[data-ant]').forEach(button=> {
      this.renderObject(button.querySelector('canvas'),this.candidates[Number(button.dataset.ant)]);
      button.disabled=this.phase!=='answer';
      button.onclick=()=>this.answer(Number(button.dataset.ant));
    });
    this.container.querySelectorAll('[data-clue]').forEach(canvas=>this.renderClue(canvas,canvas.dataset.clue));
    this.container.querySelector('[data-next]')?.addEventListener('click',()=> {
      if(!this.playable) return;
      if(++this.round>=this.rounds) this.finish();else this.nextRound();
    });
    this.updateStatus();
  }
  answer(index) {
    if(!this.playable||this.phase!=='answer') return;
    const correct=G.satisfies(this.candidates[index],this.questionCode);
    if(correct) {this.correct++;this.phase='feedback';this.render();}
    else {this.wrong++;this.container.querySelector('[data-feedback]').textContent=tr('Признаки не совпадают','The features do not match');}
    audio.play(correct?'good':'wrong');this.calculateScore();
  }
  finish(score=this.score) {
    const section=this.original[this.mode==='marking'?'ant_head_sp_show_results':'ant_head_show_results'];
    super.finish(score,{section,values:{P1:this.correct,P2:this.wrong,TIME:this.elapsed,TOTAL:Math.round(score)}});
  }
  calculateScore() {
    const cfg=this.original.ant_head_wnd,prefix=this.mode==='marking'?'sp_':'';
    this.score=this.correct*arrayValue(cfg[`${prefix}points_good_move_arr`],this.diff)+this.wrong*arrayValue(cfg[`${prefix}points_wrong_move_arr`],this.diff)+this.elapsed*arrayValue(cfg[`${prefix}time_penalty_arr`],this.diff);
    this.updateScore();
  }
  updateStatus() {
    const status=this.container.querySelector('[data-status]');
    if(status) status.textContent=`${this.round+1}/${this.rounds} · ${this.elapsed} ${tr('с','s')}`;
  }
}
