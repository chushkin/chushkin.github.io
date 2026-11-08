// Local profiles. Existing saves are migrated without erasing earned records.
const STORAGE_KEY='spb_brain_evo_data';
export function createProfile(name='Player 1') {
  return {name,created:Date.now(),brainScore:0,brainRank:1,brainMark:0,trainingDays:0,lastTrainingDate:null,
    history:[],markingHistory:[],scoreHistory:[],highScores:{},awards:[],
    unlockedGames:[],progress:{},promotions:0,
    training:null,marking:null,unlockedFacts:[]};
}
const defaultSettings={sound:true,volume:0.8,locale:'ru',difficulty:'easy'};
const defaultData=()=>({version:2,activeProfile:'Player 1',profiles:{'Player 1':createProfile()},settings:{...defaultSettings}});

export class StorageManager {
  constructor() { this.data=this.load(); }
  load() {
    try {
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(!parsed||!parsed.profiles||typeof parsed.profiles!=='object') return defaultData();
      const profiles={};
      for(const [id,profile] of Object.entries(parsed.profiles)) {
        if(!profile||typeof profile!=='object') continue;
        const merged={...createProfile(),...profile};
        for(const key of ['history','markingHistory','scoreHistory','awards','unlockedGames','unlockedFacts']) {
          if(!Array.isArray(merged[key])) merged[key]=createProfile()[key];
        }
        if(!merged.highScores||typeof merged.highScores!=='object') merged.highScores={};
        if(!merged.progress||typeof merged.progress!=='object') merged.progress={};
        Object.defineProperty(profiles,id,{value:merged,enumerable:true,writable:true,configurable:true});
      }
      if(!Object.keys(profiles).length) return defaultData();
      return {...parsed,version:2,profiles,
        activeProfile:Object.hasOwn(profiles,parsed.activeProfile)?parsed.activeProfile:Object.keys(profiles)[0],
        settings:{...defaultSettings,...parsed.settings}};
    } catch(error) { console.warn('Storage read error:',error); return defaultData(); }
  }
  save() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(this.data)); }
    catch(error) { console.error('Storage write error:',error); }
  }
  getProfile() { return this.data.profiles[this.data.activeProfile]; }
  updateProfile(updater) { updater(this.getProfile()); this.save(); }
  getSettings() { return this.data.settings; }
  updateSettings(updater) { updater(this.data.settings); this.save(); }
  createProfile(name) {
    name=String(name).trim().slice(0,40);
    if(!name) return null;
    const id=`profile_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    this.data.profiles[id]=createProfile(name); this.data.activeProfile=id; this.save(); return id;
  }
  selectProfile(id) {
    if(!Object.hasOwn(this.data.profiles,id)) return false;
    this.data.activeProfile=id; this.save(); return true;
  }
  recordGameScore(gameId,score) {
    if(!Number.isFinite(score)||score<0) return null;
    const profile=this.getProfile(); score=Math.round(score);
    profile.highScores[gameId]=Math.max(profile.highScores[gameId]||0,score);
    profile.scoreHistory.push({gameId,score,date:new Date().toISOString()});
    this.save(); return profile.highScores[gameId];
  }
  getHighScore(gameId,days=null) {
    if(!days) return this.getProfile().highScores[gameId]||0;
    const cutoff=Date.now()-days*86400000;
    return Math.max(0,...this.getProfile().scoreHistory.filter(item=>item.gameId===gameId&&Date.parse(item.date)>=cutoff).map(item=>item.score));
  }
}
export const storage=new StorageManager();
