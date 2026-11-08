// Retrofit cancellable transitions onto the earlier restored games.
export function attachGameLifetime(game) {
  let generation=0;
  const timers=new Set();
  const init=game.init.bind(game),destroy=game.destroy?.bind(game);
  game.defer=(callback,delay=0)=> {
    const expected=generation;
    const run=()=> {
      timers.delete(timer);
      if(expected!==generation||game.destroyed) return;
      if(game.isPaused) { timer=setTimeout(run,50); timers.add(timer); return; }
      callback();
    };
    let timer=setTimeout(run,delay); timers.add(timer); return timer;
  };
  game.destroy=()=> {
    generation++; game.destroyed=true;
    timers.forEach(clearTimeout); timers.clear(); destroy?.();
  };
  game.init=(...args)=> {
    game.destroy(); game.destroyed=false;
    return init(...args);
  };
  return game;
}
