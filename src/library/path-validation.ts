/** Bounded SVG grammar. Geometry may exceed the plot for clipping of explicit domains. */
export function validateNativePath(path: string, width: number, height: number): void {
  const number = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  const arity: Record<string, number> = {M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7};
  const values = new Array<number>(7);
  const space = /\s/;
  const letter = /[a-z]/i;
  const coordinateLimit=Math.max(width,height)*1024;
  let index=0,command='',x=0,y=0,startX=0,startY=0,started=false,commaAllowed=false;
  const fail=():never=>{throw new Error('Invalid native path geometry');};
  const whitespace=()=>{while(index<path.length&&space.test(path[index]!))index++;};
  const read=():number=>{
    whitespace();
    if(path[index]===','){if(!commaAllowed)fail();index++;whitespace();}
    number.lastIndex=index;const match=number.exec(path);
    if(!match)fail();index=number.lastIndex;commaAllowed=true;
    const value=Number(match![0]);if(!Number.isFinite(value))throw new Error('Nonfinite native path geometry');if(Math.abs(value)>coordinateLimit)fail();return value;
  };
  while(index<path.length){
    whitespace();if(index===path.length)break;
    const token=path[index]!;
    if(letter.test(token)){
      command=token;index++;commaAllowed=false;
      if(!started&&command.toUpperCase()!=='M')fail();
      if(command.toUpperCase()==='Z'){x=startX;y=startY;command='';continue;}
    }
    const upper=command.toUpperCase(),count=arity[upper];if(!count)fail();
    for(let i=0;i<count;i++)values[i]=read();
    const relative=command!==upper,baseX=relative?x:0,baseY=relative?y:0;
    if(upper==='A'&&(values[0]!<0||values[1]!<0||![0,1].includes(values[3]!)||![0,1].includes(values[4]!)))fail();
    if(upper==='H')x=baseX+values[0]!;
    else if(upper==='V')y=baseY+values[0]!;
    else{x=baseX+values[count-2]!;y=baseY+values[count-1]!;}
    if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>coordinateLimit||Math.abs(y)>coordinateLimit)fail();
    if(upper==='M'){started=true;startX=x;startY=y;command=relative?'l':'L';}
  }
}
