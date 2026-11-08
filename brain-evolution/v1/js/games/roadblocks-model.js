const directions={'0,1':'>','0,-1':'<','1,0':'v','-1,0':'^'};
export function rollBall(rows,start,dr,dc) {
  if(!directions[`${dr},${dc}`]) throw new Error('Invalid roll direction');
  const path=[];let r=start.r,c=start.c;
  while(true) {
    const nr=r+dr,nc=c+dc;
    if(nr<0||nr>=rows.length||nc<0||nc>=rows[0].length) return {path,lost:true,goal:false};
    if(rows[nr][nc]==='+') return {path,lost:false,goal:false};
    r=nr;c=nc;path.push({r,c});
    if('><^v'.includes(rows[r][c])) return {path,lost:false,goal:true};
  }
}
export function solveRoadblocks(rows) {
  let start;
  rows.forEach((row,r)=>{const c=row.indexOf('*');if(c>=0) start={r,c};});
  if(!start) return null;
  const pending=[{position:start,moves:[]}],seen=new Set([`${start.r},${start.c}`]);
  for(let index=0;index<pending.length;index++) for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const current=pending[index],result=rollBall(rows,current.position,dr,dc);
    if(result.goal) return [...current.moves,[dr,dc]];
    if(result.lost||!result.path.length) continue;
    const position=result.path.at(-1),key=`${position.r},${position.c}`;
    if(!seen.has(key)) {seen.add(key);pending.push({position,moves:[...current.moves,[dr,dc]]});}
  }
  return null;
}
