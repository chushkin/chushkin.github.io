import { RestoredGame, tr } from './restored-game.js';
import { shuffle } from '../original.js';
import { rollBall } from './roadblocks-model.js';
import { audio } from '../audio.js';
import { i18n } from '../i18n.js';

export class RoadblocksGame extends RestoredGame {
  id='roadblocks';
  get title() { return tr('Препятствия','Balltracker'); }
  async init(difficulty='easy') {
    if(!await this.begin(difficulty)) return;
    const generation=this.generation;
    const response=await fetch('data/roadblocks_levels.json');
    if(!response.ok) throw new Error('Roadblocks levels could not be loaded');
    const levels=await response.json();
    this.images={};
    await Promise.all(['rb_field_tile','rb_ball','rb_pointer_up','rb_pointer_down','rb_pointer_left','rb_pointer_right'].map(name=>new Promise((resolve,reject)=> {
      const image=new Image();image.onload=()=>{this.images[name]=image;resolve();};image.onerror=()=>reject(new Error(`Missing ball sprite ${name}`));image.src=`assets/textures/restored/${name}.png`;
    })));
    if(this.destroyed||generation!==this.generation) return;
    this.levels=shuffle(levels[['easy','medium','hard'][this.diff]]).slice(0,Number(this.original[`rb_lev_${this.diff}`].m_nFieldsCount));
    this.levelIndex=0;this.lost=0;this.summary=0;this.moves=0;this.isMoving=false;this.loadLevel();
    this.tick(()=>{if(this.phase==='play'){this.elapsed++;this.fieldTime++;this.updateStatus();}});
    this.keyHandler=event=> {
      const direction={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[event.key];
      if(direction&&this.playable) {event.preventDefault();this.moveBall(...direction);}
    };
    window.addEventListener('keydown',this.keyHandler);
  }
  loadLevel() {
    this.currentLevel=this.levels[this.levelIndex];this.board=this.currentLevel.rows;this.fieldTime=0;this.phase='play';
    this.board.forEach((row,r)=>{const c=row.indexOf('*');if(c>=0) this.start={r,c};});
    this.ball={...this.start};this.render();
  }
  render() {
    this.frame(this.title, `<p class="restored-instruction">${tr('Прокатите шар к выходу со стрелкой','Roll the ball to an exit gate')}</p>
      <div class="spb-board-wrapper"><div class="rb-field-wrap"><canvas id="rbCanvas" width="468" height="572" aria-label="${tr('Лабиринт','Maze')}"></canvas>
      ${this.phase==='solved'?`<div class="game-ending-overlay" role="status"><div class="game-ending-card">
        <h2>${tr('Выход найден!', 'Exit reached!')}</h2>
        <p>${tr('Поле пройдено', 'Field completed')}: ${this.levelIndex+1}/${this.levels.length}</p>
        <button class="spb-action-btn" data-next>${i18n.t('Next')}</button>
      </div></div>`:''}</div></div>
      <p class="geometry-feedback" data-feedback aria-live="polite"></p>`,
      this.phase==='solved'?'':
      `<div class="rb-dpad-section"><button class="dpad-btn" data-roll="-1,0">▲</button><div class="dpad-mid"><button class="dpad-btn" data-roll="0,-1">◀</button><button class="dpad-btn" data-roll="0,1">▶</button></div><button class="dpad-btn" data-roll="1,0">▼</button></div>`);
    this.canvas=this.container.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.drawBoard();this.updateStatus();
    this.container.querySelectorAll('[data-roll]').forEach(button=>button.onclick=()=>this.moveBall(...button.dataset.roll.split(',').map(Number)));
    this.container.querySelector('[data-next]')?.addEventListener('click',()=> {
      if(!this.playable) return;
      if(++this.levelIndex>=this.levels.length) this.finish();else this.loadLevel();
    });
    let start;
    this.canvas.onpointerdown=event=>{start={x:event.clientX,y:event.clientY};this.canvas.setPointerCapture(event.pointerId);};
    this.canvas.onpointerup=event=> {
      if(!start)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;start=null;
      if(Math.max(Math.abs(dx),Math.abs(dy))<15)return;
      this.moveBall(...(Math.abs(dx)>Math.abs(dy)?[0,Math.sign(dx)]:[Math.sign(dy),0]));
    };
  }
  drawBoard() {
    const ctx=this.ctx,size=26;ctx.clearRect(0,0,468,572);
    for(let r=0;r<22;r++)for(let c=0;c<18;c++) {
      const item=this.board[r][c];
      ctx.drawImage(this.images.rb_field_tile,0,item==='+'?26:0,26,26,c*size,r*size,size,size);
      const name={'>':'right','<':'left','^':'up','v':'down'}[item];
      if(name)ctx.drawImage(this.images[`rb_pointer_${name}`],c*size,r*size,size,size);
    }
    ctx.drawImage(this.images.rb_ball,this.ball.c*size,this.ball.r*size,size,size);
  }
  moveBall(dr,dc) {
    if(!this.playable||this.isMoving||this.phase!=='play')return;
    const result=rollBall(this.board,this.ball,dr,dc);
    if(!result.path.length&&!result.lost)return;
    this.moves++;this.isMoving=true;
    const origin={...this.ball};let progress=0,last=null;
    const animate=timestamp=> {
      if(this.destroyed)return;
      const dt=last===null?0:Math.min(50,timestamp-last);last=timestamp;
      if(this.playable)progress+=dt/45;
      const step=Math.min(result.path.length,progress),full=Math.floor(step),fraction=step-full;
      const from=full===0?origin:result.path[full-1],to=result.path[full]||from;
      this.ball={r:from.r+(to.r-from.r)*fraction,c:from.c+(to.c-from.c)*fraction};this.drawBoard();
      if(progress<result.path.length||!this.playable){this.animation=requestAnimationFrame(animate);return;}
      this.isMoving=false;
      if(result.lost) {
        this.lost++;this.ball={...this.start};audio.play('wrong');
        const prefix=['Easy','Med','Hard'][this.diff];this.score+=Number(this.original.rb_game_wnd[`g_nRB${prefix}WrongCfx`]);
        this.container.querySelector('[data-feedback]').textContent=tr('Шар потерян. Попробуйте другой путь.','Ball lost. Try another path.');
        this.updateScore();this.drawBoard();this.updateStatus();
      } else if(result.goal) {
        // CRBGameWnd::v19 adds the field's max_score; g_nRB*TimeCfx is loaded but never used by the
        // original total (FUN_4a10b194 = lost balls * WrongCfx + field points).
        this.score+=Number(this.currentLevel.max_score);this.summary+=Number(this.currentLevel.max_score);
        this.phase='solved';audio.play('good');
        if(this.levelIndex===this.levels.length-1) { this.phase='complete';this.finish(); } else this.render();
      } else {audio.play('hitWall');this.updateStatus();}
    };
    this.animation=requestAnimationFrame(animate);
  }
  finish(score=this.score) {
    super.finish(score,{section:this.original.rb_show_results,values:{DIST:this.summary,P1:this.lost,TOTAL:Math.round(score)}});
  }
  updateStatus() {
    const status=this.container.querySelector('[data-status]');
    if(status)status.textContent=`${this.levelIndex+1}/${this.levels.length} · ${tr('Потери','Lost')}: ${this.lost} · ${this.elapsed} ${tr('с','s')}`;
  }
  destroy() {super.destroy();cancelAnimationFrame(this.animation);if(this.keyHandler)window.removeEventListener('keydown',this.keyHandler);}
}
