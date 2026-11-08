import { RestoredGame, tr } from './restored-game.js';
import { arrayValue, shuffle } from '../original.js';
import { i18n } from '../i18n.js';
import { figureAccuracy, toFieldPixels } from './geometry-model.js';
import { audio } from '../audio.js';

export class GeometryGame extends RestoredGame {
  id = 'geometry';
  get title() { return tr('Геометрия', 'Geometry'); }
  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    const section = this.original[`geometry_fig_d${this.diff}`];
    this.figures = shuffle(Object.entries(section).filter(([key]) => key.endsWith('_fig')))
      .slice(0, arrayValue(this.original.geometry_game_field.questions_count, this.diff))
      .map(([, value]) => {
        const numbers = value.trim().split(/\s+/).map(Number);
        return Array.from({length:numbers[0]}, (_,i) => ({x:numbers[1+i*2],y:numbers[2+i*2]}));
      });
    this.round=0; this.nextFigure();
    this.tick(() => {
      if (this.phase==='remember' && --this.remaining<=0) this.startDrawing();
      this.updateStatus();
    });
  }
  nextFigure() {
    this.target=this.figures[this.round]; this.points=[]; this.phase='remember';
    this.remaining=arrayValue(this.original.geometry_game_field.diff_max_time,this.diff);
    this.render();
  }
  render() {
    const messages={remember:'Please remember the original figure',draw:'Please draw the copy of the figure',
      edit:'Now you can change your shape if needed',compare:'Compare the copy with the original figure'};
    this.frame(this.title, `<p class="restored-instruction" data-geo-message>${i18n.t(messages[this.phase])}</p>
      <svg class="geometry-field restored-field" viewBox="0 0 100 100" aria-label="${tr('Поле для рисования','Drawing board')}" role="application"></svg>
      <p class="geometry-feedback" aria-live="polite">${this.phase==='compare' ? `${this.accuracy}% · +${this.roundScore}` : ''}</p>`,
      `<p>${i18n.t("Tip: The size and position of the figure you draw don't matter, only the angles!")}</p>
      <div class="restored-actions">
      ${this.phase==='remember' ? `<button class="spb-action-btn" data-ready>${tr('Запомнил','Ready')}</button>` : ''}
      ${['draw','edit'].includes(this.phase) ? `<button class="spb-action-btn" data-undo>${tr('Отменить точку','Undo point')}</button><button class="spb-action-btn" data-check ${this.points.length!==this.target.length ? 'disabled' : ''}>${tr('Готово','Done')}</button>` : ''}
      ${this.phase==='compare' ? `<button class="spb-action-btn" data-next>${tr('Далее','Next')}</button>` : ''}</div>`);
    this.draw(); this.updateStatus();
    this.container.querySelector('[data-ready]')?.addEventListener('click',() => { if(this.playable) this.startDrawing(); });
    this.container.querySelector('[data-undo]')?.addEventListener('click',() => {
      if(!this.playable) return;
      this.points.pop(); this.phase='draw'; this.render();
    });
    this.container.querySelector('[data-check]')?.addEventListener('click',() => this.check());
    this.container.querySelector('[data-next]')?.addEventListener('click',() => {
      if(!this.playable) return;
      if(++this.round>=this.figures.length) this.finish(); else this.nextFigure();
    });
    const field=this.container.querySelector('svg');
    let dragging=-1;
    const location=event => {
      const rect=field.getBoundingClientRect();
      return {x:Math.max(2,Math.min(98,(event.clientX-rect.left)/rect.width*100)),
        y:Math.max(2,Math.min(98,(event.clientY-rect.top)/rect.height*100))};
    };
    field.onpointerdown=event => {
      if(!this.playable || !['draw','edit'].includes(this.phase)) return;
      event.preventDefault();
      const point=location(event);
      dragging=this.points.findIndex(p => Math.hypot(p.x-point.x,p.y-point.y)<5);
      if(dragging===-1 && this.points.length<this.target.length) {
        this.points.push(point); dragging=this.points.length-1;
      }
      field.setPointerCapture(event.pointerId);
      if(this.points.length===this.target.length) {
        this.phase='edit';
        this.container.querySelector('[data-geo-message]').textContent=i18n.t(messages.edit);
      }
      this.draw();
      this.container.querySelector('[data-check]').disabled=this.points.length!==this.target.length;
      this.updateStatus();
    };
    field.onpointermove=event => {
      if(dragging<0 || !this.playable) return;
      this.points[dragging]=location(event); this.draw();
    };
    field.onpointerup=field.onpointercancel=() => { dragging=-1; };
  }
  draw() {
    const field=this.container.querySelector('svg');
    const polygon=(points,color,closed) => `<${closed?'polygon':'polyline'} points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="0.7"/>`+
      points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="1.4" fill="${color}"/>`).join('');
    field.innerHTML=(['remember','compare'].includes(this.phase)?polygon(this.target,'#078d00',true):'')+
      (this.phase!=='remember'?polygon(this.points,'#0f4b76',this.points.length===this.target.length):'');
  }
  finish(score=this.score) {
    super.finish(score,{section:this.original.geometry_show_results,values:{DIST:Math.round(score),TOTAL:Math.round(score)}});
  }
  updateStatus() {
    const status=this.container.querySelector('[data-status]');
    if(status) status.textContent=`${this.round+1}/${this.figures.length} · ${this.phase==='remember'?`${this.remaining} ${tr('с','s')}`:`${this.points.length}/${this.target.length}`}`;
  }
  startDrawing() { this.phase='draw'; this.render(); }
  check() {
    if(!this.playable || this.phase==='compare' || this.points.length!==this.target.length) return;
    const field=this.original.geometry_game_field;
    // Compared in field pixels with the per-difficulty tolerance (max_fig_diff_miss_percent).
    this.accuracy=figureAccuracy(toFieldPixels(this.target),toFieldPixels(this.points),arrayValue(field.max_fig_diff_miss_percent,this.diff));
    const results=this.original.geometry_results_data;
    let band=5;
    for(let n=1;n<=5;n++) {
      if(this.accuracy<=arrayValue(results[`res_${n}_percents`],this.diff)) { band=n; break; }
    }
    this.roundScore=arrayValue(results[`res_${band}_points`],this.diff);
    this.score+=this.roundScore; audio.play(this.roundScore?'good':'wrong');
    this.phase='compare'; this.render();
  }
}
