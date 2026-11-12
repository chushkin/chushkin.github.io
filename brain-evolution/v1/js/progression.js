import { storage } from './storage.js';
import { loadOriginalConfig } from './original.js';

export const localDate=()=> {
  const date=new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
export function interpolateMark(score,table) {
  const numbers=table.trim().split(/\s+/).map(Number),count=numbers.shift();
  const points=Array.from({length:count},(_,i)=>({score:numbers[i*2],mark:numbers[i*2+1]}));
  if(score<=points[0].score) return points[0].mark;
  for(let i=1;i<points.length;i++) if(score<=points[i].score) {
    const left=points[i-1],right=points[i];
    return Math.round(left.mark+(right.mark-left.mark)*(score-left.score)/(right.score-left.score));
  }
  return points.at(-1).mark;
}
export function markRank(mark,section) {
  const percent=mark/100;
  for(let rank=7;rank>=1;rank--) if(percent>=Number(section[`status${rank}_param`].split(/\s+/)[0])) return rank;
  return 1;
}
const gameIds={101:'guess_who',102:'memorics',103:'arithmetics',105:'encyclopedia',106:'matches',107:'minesweeper',108:'numbers',109:'roadblocks',110:'sudoku',111:'quadronica',112:'pairs',114:'geometry'};
export function miniGameRoute(id) {
  return {gameId:gameIds[Math.floor(id/10)],difficulty:['easy','medium','hard','ultra'][id%10]};
}
export async function startMarking() {
  const original=await loadOriginalConfig(),lists=original.shell.b_mark_lists;
  const sequence=lists[`${1+Math.floor(Math.random()*Number(lists.list_count))}_list`].trim().split(/\s+/).map(Number).slice(2);
  storage.updateProfile(profile=> { profile.marking={date:localDate(),sequence,index:0,results:[]}; });
  return miniGameRoute(sequence[0]);
}
export async function recordMarking(score) {
  const session=storage.getProfile().marking;
  if(!session||!Number.isFinite(score)) return null;
  session.results.push(score); session.index++;
  if(session.index<session.sequence.length) { storage.save(); return {next:miniGameRoute(session.sequence[session.index])}; }
  const original=await loadOriginalConfig();
  const marks=session.results.map((value,index)=>interpolateMark(value,original.shell.b_mark_pnt_tables[Math.floor(session.sequence[index]/10)]));
  const mark=Math.round(marks.reduce((sum,value)=>sum+value,0)/marks.length);
  storage.updateProfile(profile=> {
    const existing=profile.markingHistory.find(item=>item.date===session.date);
    if(existing) existing.score=Math.max(existing.score,mark); else profile.markingHistory.push({date:session.date,score:mark});
    profile.brainMark=profile.markingHistory.find(item=>item.date===session.date).score;
    profile.brainRank=markRank(profile.brainMark,original.shell.b_mark_wnd);
    if(profile.brainMark>=9000&&!profile.awards.includes('nobel')) profile.awards.push('nobel');
    profile.marking=null;
  });
  return {mark};
}

// ---- Brain Training: port of CMiniGames_ManagerWnd / CBrainTrain2MenuWnd -------------------
// Game sections come from [mini_games] game=MG_*; each difficulty reads in_app_ver_level_up_param
// (else level_up_param) = "down up required unlock" (FUN_4a0214d4).
const nativeIdOf=gameId=>Number(Object.entries(gameIds).find(([,value])=>value===gameId)?.[0]);
export function gameSection(config,gameId,diff) {
  const id=nativeIdOf(gameId);
  return Object.values(config.games).find(value=>value&&Number(value.ID)===id&&Number(value.diff)===diff&&value.mg_id)||null;
}
export function levelParams(section) {
  const [down=-1,up=-1,required=0,unlock=-1]=String(section?.in_app_ver_level_up_param??section?.level_up_param??'').trim().split(/\s+/).map(Number);
  return {down,up,required,unlock};
}
// [mini_games] def_in_app_opened_gmid_arr "3 1020 1030 1110": games open from the start.
export function defaultOpenGames(config) {
  return String(config.games.mini_games?.def_in_app_opened_gmid_arr??'').trim().split(/\s+/).slice(1)
    .map(mgid=>gameIds[Math.floor(Number(mgid)/10)]).filter(Boolean);
}
// FUN_4a0e3ebc: train_items_count = ceil(open games / 2), between 2 and 5.
export const trainItemsCount=openCount=>Math.min(5,Math.max(2,Math.ceil(openCount/2)));
// FUN_4a01f8b4: the last three results give an average (-1 until there are three). The progress
// drops by one (to -1 = level down) when the result is under "down" and the average under half of
// it, and grows by one up to "required" when the result reaches "up".
export function updateSkill(stat,score,params) {
  const lres=[score,...(stat.lres||[])].slice(0,3);
  const aver=lres.length===3?Math.trunc(lres.reduce((a,b)=>a+b,0)/3):-1;
  const previous=stat.progress||0;
  let progress=previous;
  if(params.down>=0&&aver>0&&params.down>score&&aver<params.down>>1) progress=previous-1<0?-1:previous-1;
  else if(params.up>=0&&params.up<=score) progress=Math.min(previous+1,params.required);
  return {lres,aver,progress};
}
// FUN_4a0209e4: the next difficulty is diff+1, but "bVar1 = 2 < next" keeps training at hard (2);
// reaching the goal there gives the Best Play award. Sudoku's "ultra" section is never reached.
export const MAX_TRAINING_DIFF=2;
function gameState(profile,gameId) {
  const state=profile.progress[gameId] ||= {difficulty:0};
  state.stats ||= {};
  state.difficulty=Math.min(MAX_TRAINING_DIFF,Number(state.difficulty)||0);
  state.maxDifficulty=Math.max(Number(state.maxDifficulty)||0,state.difficulty);
  return state;
}
export function trainingInfo(profile,config,gameId) {
  const state=profile.progress[gameId]||{difficulty:0},diff=Math.min(MAX_TRAINING_DIFF,Number(state.difficulty)||0);
  const params=levelParams(gameSection(config,gameId,diff));
  const progress=Math.max(0,state.stats?.[diff]?.progress||0);
  return {diff,params,progress,open:profile.unlockedGames.includes(gameId),champion:profile.awards.includes(`best_${gameId}`)};
}
// FUN_4a0e5ae4 with [b_train2_wnd] brain_power_param "20 20 15 -5": every open game adds
// (diff+1)*20, 20 * progress share, and for a game played in this training score*15/up - 5
// (up below 2 -> 7000).
export function brainPower(profile,session,config) {
  const [perDiff,perProgress,perScore,scoreBase]=String(config.shell.b_train2_wnd?.brain_power_param??'20 20 15 -5').trim().split(/\s+/).map(Number);
  let power=0;
  for(const gameId of profile.unlockedGames) {
    const {diff,params,progress}=trainingInfo(profile,config,gameId);
    const share=params.required>0?Math.min(100,Math.trunc(progress*100/params.required)):0;
    power+=diff*perDiff+perDiff+Math.trunc(perProgress*share/100);
    const score=session?.results?.[gameId];
    if(score>0) power+=Math.trunc(score*perScore/(params.up>=2?params.up:7000))+scoreBase;
  }
  return power;
}
export async function ensureOpenGames(profile) {
  if(profile.openGamesChecked) return;
  const config=await loadOriginalConfig();
  if(!profile.unlockedGames.length) profile.unlockedGames=defaultOpenGames(config);
  profile.openGamesChecked=true;
}
export async function startTraining(force=false) {
  const config=await loadOriginalConfig(),profile=storage.getProfile();
  await ensureOpenGames(profile);
  if(!force&&profile.training?.date===localDate()&&profile.training.required) { storage.save(); return profile.training; }
  profile.training={date:localDate(),required:trainItemsCount(profile.unlockedGames.length),results:{},complete:false};
  storage.save();
  return profile.training;
}
// Result of a mini-game played from the training list (CMiniGames_ManagerWnd v35 + FUN_4a0209e4).
// A game counts once per training; after completion or a repeat the result has no effect.
export async function recordTraining(gameId,score) {
  const profile=storage.getProfile(),session=profile.training;
  if(!session||session.complete||Object.hasOwn(session.results,gameId)||!profile.unlockedGames.includes(gameId)) return {noEffect:true};
  const config=await loadOriginalConfig(),events={levelUp:[],levelDown:[],opened:[],champion:[]};
  session.results[gameId]=score;
  const state=gameState(profile,gameId),diff=state.difficulty;
  const params=levelParams(gameSection(config,gameId,diff));
  const stat=state.stats[diff] ||= {lres:[],progress:0};
  Object.assign(stat,updateSkill(stat,score,params));
  if(stat.progress<0) {
    stat.progress=0;
    if(diff>0) { state.difficulty=diff-1; events.levelDown.push(gameId); }
  } else if(params.required>0&&stat.progress>=params.required) {
    if(diff+1<=MAX_TRAINING_DIFF&&gameSection(config,gameId,diff+1)) {
      state.difficulty=diff+1;
      if(state.difficulty>state.maxDifficulty) {
        state.maxDifficulty=state.difficulty; profile.promotions=(profile.promotions||0)+1; events.levelUp.push(gameId);
        for(const id of Object.values(gameIds)) {
          const unlock=levelParams(gameSection(config,id,0)).unlock;
          if(unlock>0&&unlock<=profile.promotions&&!profile.unlockedGames.includes(id)) { profile.unlockedGames.push(id); events.opened.push(id); }
        }
      }
    } else if(!profile.awards.includes(`best_${gameId}`)) {
      profile.awards.push(`best_${gameId}`); events.champion.push(gameId);
      if(Object.values(gameIds).every(id=>profile.awards.includes(`best_${id}`))&&!profile.awards.includes('training_complete')) profile.awards.push('training_complete');
    }
  }
  if(Object.keys(session.results).length>=session.required) {
    session.complete=true;
    const power=session.brainPower=brainPower(profile,session,config);
    profile.history.push({date:session.date,score:power,results:{...session.results}});
    profile.brainScore=power; profile.trainingDays=new Set(profile.history.map(item=>item.date)).size; profile.lastTrainingDate=session.date;
    if(!profile.unlockedFacts.includes(profile.trainingDays-1)) profile.unlockedFacts.push(profile.trainingDays-1);
    events.complete=power;
  }
  storage.save();
  return events;
}
