import type {CompoundLink} from './project-reactions';
import type {BoardRow} from './whiteboard';
import type {ResearchCase} from './research-case';
type Compound=ResearchCase['compounds'][number];
export type NetworkNode={id:string;kind:'compound'|'reaction';label:string;compound?:Compound;rows:string[];x:number;y:number;width:number;height:number;lane:string;identityConflict?:boolean};
export type NetworkEdge={id:string;source:string;target:string;row:string;role:string;coefficient:number|null;style:string;conflict:boolean;backward:boolean};
export type Network={nodes:NetworkNode[];edges:NetworkEdge[];lanes:{id:string;x:number;y:number;width:number;height:number}[];width:number;height:number};
const structure=(c:Compound)=>JSON.stringify([c.node_type,c.structure_context,c.formula,c.charge,c.stereochemistry,c.protonation]);
export function reactionNetwork(rows:BoardRow[],links:CompoundLink[]=[]):Network{
 const parents=new Map<string,string>();const root=(id:string):string=>{const p=parents.get(id);return !p||p===id?id:root(p);};const compound=(identity:string,id:string)=>rows.find(r=>r.identity.id===identity)?.identity.definition.compounds.find(c=>c.id===id);
 const latest=new Map<string,CompoundLink>();for(const link of links){const key=link.source_identity+link.source_compound;if(!latest.has(key)||latest.get(key)!.revision<link.revision)latest.set(key,link);}
 for(const link of latest.values()){const a=compound(link.source_identity,link.source_compound),b=compound(link.target_identity,link.target_compound);if(link.decision!=='include'||!a||!b||structure(a)!==structure(b))continue;const x=root(a.id),y=root(b.id);if(x!==y)parents.set(x<y?y:x,x<y?x:y);}

 const nodes:NetworkNode[]=[],edges:NetworkEdge[]=[],lanes:Network['lanes']=[];let laneY=0,maxWidth=0;
 for(const lane of ['oxygen_free','oxygen','unknown']){
  const group=rows.filter(r=>r.group===lane);if(!group.length)continue;const variants=new Map<string,Set<string>>();for(const r of group)for(const c of r.identity.definition.compounds){const set=variants.get(c.id)??new Set<string>();set.add(structure(c));variants.set(c.id,set);}
  const local=new Map<string,NetworkNode>();const localEdges:NetworkEdge[]=[];
  for(const r of group){const linked=['solid','dashed','refuted'].includes(r.projection.line_style),p=r.identity.definition,rid=lane+':reaction:'+r.identity.id;local.set(rid,{id:rid,kind:'reaction',label:r.identity.label,rows:[r.key],x:0,y:0,width:44,height:44,lane});
   p.reaction.participants.forEach((part,i)=>{const c=p.compounds.find(c=>c.id===part.compound_id)!;const conflict=variants.get(c.id)!.size>1,cid=lane+':compound:'+root(c.id)+(conflict?':'+r.identity.id:'');const n=local.get(cid)??{id:cid,kind:'compound' as const,label:c.name,compound:c,rows:[],x:0,y:0,width:164,height:66,lane,identityConflict:conflict};if(!n.rows.includes(r.key))n.rows.push(r.key);local.set(cid,n);if(linked)localEdges.push({id:r.key+':'+i,source:part.role==='product'?rid:cid,target:part.role==='product'?cid:rid,row:r.key,role:part.role,coefficient:part.coefficient,style:r.projection.line_style,conflict:r.projection.conflict,backward:false});});
  }
  // Directed breadth-first ranks keep shared intermediates at one position. Reverse
  // reactions retain back edges; they never manufacture equilibrium or merge claims.
  const rank=new Map<string,number>(),incoming=new Map<string,number>();for(const e of localEdges)incoming.set(e.target,(incoming.get(e.target)??0)+1);
  const visit=(root:string)=>{if(rank.has(root))return;rank.set(root,0);const queue=[root];for(let i=0;i<queue.length;i++){for(const e of localEdges.filter(e=>e.source===queue[i]))if(!rank.has(e.target)){rank.set(e.target,rank.get(e.source)!+1);queue.push(e.target);}}};
  [...local.values()].filter(n=>n.kind==='compound'&&!incoming.has(n.id)).forEach(n=>visit(n.id));for(const n of local.values())visit(n.id);
  const columns=new Map<number,NetworkNode[]>();for(const n of local.values()){const col=columns.get(rank.get(n.id)!)??[];col.push(n);columns.set(rank.get(n.id)!,col);}
  const count=Math.max(1,...[...columns.values()].map(c=>c.length)),height=count*180+100,width=(Math.max(...columns.keys())+1)*215+50;
  for(const [level,col] of columns)col.forEach((n,i)=>{n.x=40+level*215+(164-n.width)/2;n.y=laneY+65+(height-100)/(col.length+1)*(i+1)-n.height/2;});
  for(const e of localEdges)e.backward=local.get(e.target)!.x<=local.get(e.source)!.x;
  nodes.push(...local.values());edges.push(...localEdges);lanes.push({id:lane,x:0,y:laneY,width,height});laneY+=height+30;maxWidth=Math.max(maxWidth,width);
 }
 return {nodes,edges,lanes,width:Math.max(500,maxWidth),height:Math.max(280,laneY)};
}
export function edgePath(edge:NetworkEdge,nodes:NetworkNode[]){const a=nodes.find(n=>n.id===edge.source)!,b=nodes.find(n=>n.id===edge.target)!;if(edge.backward){const sx=a.x+a.width/2,sy=a.y,tx=b.x+b.width/2,ty=b.y,top=Math.min(sy,ty)-55;return `M ${sx} ${sy} C ${sx} ${top}, ${tx} ${top}, ${tx} ${ty}`;}const sx=a.x+a.width,sy=a.y+a.height/2,tx=b.x,ty=b.y+b.height/2,mx=(sx+tx)/2;return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;}
