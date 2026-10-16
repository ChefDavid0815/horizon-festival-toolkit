const assert = require('node:assert/strict');
const {parse, replaceDatabase, sha} = require('./profile.cjs');
const {open, rows, catalog} = require('./garage.cjs');
const ZERO_GUID = '00000000-0000-0000-0000-000000000000';
const CLASSES = ['D','C','B','A','S1','S2','R','X'];
// Slider spans recovered from the step grid of saved tunes (e.g. tyre pressure snaps to 1/400 = 0.1 psi over 15–55 psi).
// Springs, ride height, aero and final drive have car-specific spans and stay as slider positions.
const FIELDS = [
  ['tires','frontTirePressure','psi',15,55,400],['tires','rearTirePressure','psi',15,55,400],
  ['gearing','finalDriveRatio','%',0,100,0],
  ...['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'].map(g=>['gearing',g+'Gear','ratio',0.48,6,5520]),
  ['alignment','frontCamber','°',-5,5,100],['alignment','rearCamber','°',-5,5,100],['alignment','frontToe','°',-5,5,100],['alignment','rearToe','°',-5,5,100],['alignment','frontCaster','°',1,7,60],
  ['antiroll','frontSwaybar','',1,65,6400],['antiroll','rearSwaybar','',1,65,6400],
  ['springs','frontSpring','%',0,100,0],['springs','rearSpring','%',0,100,0],['springs','frontRideHeight','%',0,100,0],['springs','rearRideHeight','%',0,100,0],
  ['damping','frontDampingStiffness','',1,20,1900],['damping','rearDampingStiffness','',1,20,1900],['damping','frontBumpRatio','',1,20,1900],['damping','rearBumpRatio','',1,20,1900],
  ['aero','frontDownforce','%',0,100,0],['aero','rearDownforce','%',0,100,0],
  ['brakes','brakeBalance','%',0,100,100],['brakes','brakePressure','%',0,200,200],
  ['differential','frontAccel','%',0,100,200],['differential','frontDecel','%',0,100,200],['differential','rearAccel','%',0,100,200],['differential','rearDecel','%',0,100,200],['differential','centerTorque','%',0,100,100],
].map(([group,key,unit,min,max,steps])=>({group,key,col:'Tuning_'+key,unit,min,max,steps,carSpecific:unit==='%'&&steps===0}));
const FIELD = new Map(FIELDS.map(f=>[f.key,f]));
const GEARS = FIELDS.filter(f=>/Gear$/.test(f.key)).map(f=>f.key);
const SLOTS = [
  ['power','Engine',0],['power','Camshaft',12],['power','Valves',13],['power','Displacement',14],['power','PistonsCompression',15],['power','FuelSystem',16],['power','Ignition',17],['power','Exhaust',18],['power','Intake',19],['power','Flywheel',20],['power','Manifold',21],['power','RestrictorPlate',22],['power','OilCooling',23],['power','SingleTurbo',24],['power','TwinTurbo',25],['power','QuadTurbo',26],['power','SuperchargerCSC',27],['power','SuperchargerDSC',28],['power','Intercooler',29],['power','Motor',3],['power','MotorParts',null],
  ['platform','Brakes',4],['platform','SpringDamper',5],['platform','AntiSwayFront',6],['platform','AntiSwayRear',7],['platform','ChassisStiffness',41],['platform','WeightReduction',40],
  ['drivetrain','Drivetrain',1],['drivetrain','Clutch',30],['drivetrain','Transmission',31],['drivetrain','Driveline',32],['drivetrain','Differential',33],
  ['tires','TireCompound',8],['tires','TireWidthFront',38],['tires','TireWidthRear',39],['tires','RimSizeFront',10],['tires','RimSizeRear',11],['tires','TrackSpacingFront',45],['tires','TrackSpacingRear',46],['tires','FrontAspectRatio',47],['tires','RearAspectRatio',48],
  ['aero','CarBody',2],['aero','FrontBumper',34],['aero','RearBumper',35],['aero','Hood',36],['aero','SideSkirts',37],['aero','RearWing',9],
].map(([group,col,slot])=>({group,col,slot}));
const SLOT = new Map(SLOTS.map(s=>[s.col,s]));
// Columns the game derives from the installed parts; copied together with a build from a car of the same model.
const BUILD_STATS = ['PerformanceIndex','ClassID','SpeedRating','OffroadRating','AccelerationRating','LaunchRating','BrakingRating','HandlingRating','CurbWeight','WeightDistribution','AspirationTypeId','SimPeakPower','SimPeakAngVel','SimPeakTorque','SimPeakTorqueAngVel','SimRedlineAngVel','PeakIntakePSI','TopSpeed','Traction_Road','Traction_OffRoad','Traction_Snow','FrontTireAspectRatioOffset','RearTireAspectRatioOffset'];
const TUNE_META = ['TuneFileName','VersionedTuneId','VersionedTuneXUID'];
const SCENARIOS = {
  road:{psi:[28.5,28],camber:[-1.6,-1.1],toe:[0,0],caster:6,arb:[1,1],spring:[1,1],ride:[.12,.12],rebound:[1,1],bump:.62,aero:[.6,.7],brake:115,bias:40,diff:{RWD:[55,25],FWD:[25,5],AWD:[25,5,60,25,65]}},
  street:{psi:[30,30],camber:[-1.2,-.9],toe:[0,0],caster:5.8,arb:[.8,.8],spring:[.8,.8],ride:[.25,.25],rebound:[.85,.85],bump:.6,aero:[.4,.5],brake:105,bias:30,diff:{RWD:[50,20],FWD:[20,5],AWD:[20,5,55,20,62]}},
  dirt:{psi:[25,25],camber:[-.9,-.5],toe:[0,0],caster:5.5,arb:[.45,.45],spring:[.5,.5],ride:[.6,.6],rebound:[.65,.65],bump:.55,aero:[.35,.45],brake:100,bias:30,diff:{RWD:[60,20],FWD:[35,10],AWD:[35,10,70,25,60]}},
  cross:{psi:[22,22],camber:[-.6,-.3],toe:[0,0],caster:5.2,arb:[.3,.3],spring:[.35,.35],ride:[.9,.9],rebound:[.5,.5],bump:.5,aero:[.3,.4],brake:95,bias:30,diff:{RWD:[65,15],FWD:[40,10],AWD:[40,10,75,20,55]}},
  drift:{psi:[30,33],camber:[-3.5,-.8],toe:[.3,0],caster:7,arb:[.8,.45],spring:[.75,.55],ride:[.2,.2],rebound:[.8,.65],bump:.65,aero:[.2,.5],brake:90,balance:45,diff:{RWD:[100,20],FWD:[100,20],AWD:[40,0,100,15,85]}},
  drag:{psi:[55,15],camber:[0,0],toe:[0,0],caster:5,arb:[.6,.2],spring:[.6,.25],ride:[.15,.15],rebound:[.9,.4],bump:.5,aero:[0,0],brake:100,bias:30,diff:{RWD:[100,0],FWD:[100,0],AWD:[100,0,100,0,70]}},
  snow:{psi:[22,22],camber:[-.8,-.5],toe:[0,0],caster:5.5,arb:[.35,.35],spring:[.4,.4],ride:[.55,.55],rebound:[.55,.55],bump:.5,aero:[.7,.8],brake:90,bias:30,diff:{RWD:[35,10],FWD:[15,0],AWD:[15,0,45,10,55]}},
  speed:{psi:[34,34],camber:[-.6,-.4],toe:[0,0],caster:5.5,arb:[.85,.85],spring:[.95,.95],ride:[.05,.05],rebound:[.95,.95],bump:.6,aero:[0,0],brake:110,bias:30,diff:{RWD:[60,20],FWD:[25,5],AWD:[20,5,60,20,60]}},
};
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const snap=(f,v)=>{v=clamp(v);return f.steps?Math.round(v*f.steps)/f.steps:Math.round(v*10000)/10000;};
const encode=(f,display)=>snap(f,(display-f.min)/(f.max-f.min));
const decode=(f,v)=>v==null||v<0?null:f.min+v*(f.max-f.min);
const piTables=new WeakMap();
function piOf(row,data){
  let table=piTables.get(data);
  if(!table){table=data.cars.map(c=>[c.row.PerformanceIndex,c.pi]).filter(([n,p])=>Number.isFinite(n)&&Number.isFinite(p)).sort((a,b)=>a[0]-b[0]);piTables.set(data,table);}
  if(row.ClassID===7)return 999;
  const n=row.PerformanceIndex;if(!Number.isFinite(n)||!table.length)return null;
  let i=table.findIndex(t=>t[0]>=n);if(i===-1)i=table.length-1;if(i===0)return Math.round(table[0][1]);
  const [x0,y0]=table[i-1],[x1,y1]=table[i];let pi=Math.round(x1===x0?y1:y0+(y1-y0)*(n-x0)/(x1-x0));
  const band=[[100,400],[401,500],[501,600],[601,700],[701,800],[801,900],[901,998]][row.ClassID];
  return band?Math.min(band[1],Math.max(band[0],pi)):pi;
}
const hasTune=r=>r.Tuning_frontTirePressure!=null&&r.Tuning_frontTirePressure>=0;
const gearCount=r=>hasTune(r)?GEARS.filter(g=>r['Tuning_'+g]>=0).length:null;
function tuneOf(r){if(!hasTune(r))return null;return Object.fromEntries(FIELDS.map(f=>[f.key,r[f.col]>=0?r[f.col]:null]));}
function aspiration(r){if(r.Motor>=0)return 'electric';for(const [c,a] of [['QuadTurbo','quad-turbo'],['TwinTurbo','twin-turbo'],['SingleTurbo','turbo'],['SuperchargerDSC','supercharger'],['SuperchargerCSC','centrifugal']])if(r[c]>=0)return a;return 'natural';}
function stats(r){return {power:r.SimPeakPower>0?Math.round(r.SimPeakPower)/10:null,torque:r.SimPeakTorque>0?Math.round(r.SimPeakTorque*100):null,weight:r.CurbWeight>0?Math.round(r.CurbWeight*100):null,front:r.WeightDistribution>0?Math.round(r.WeightDistribution*1000)/10:null,redline:r.SimRedlineAngVel>0?Math.round(r.SimRedlineAngVel*30/Math.PI/10)*10:null,top:r.TopSpeed>0?Math.round(r.TopSpeed*36)/10:null,boost:r.PeakIntakePSI>0?Math.round(r.PeakIntakePSI*10)/10:null,aspiration:aspiration(r),ratings:{speed:r.SpeedRating,handling:r.HandlingRating,acceleration:r.AccelerationRating,launch:r.LaunchRating,braking:r.BrakingRating,offroad:r.OffroadRating}};}
function tuneSource(r,player){const id=r.VersionedTuneId&&r.VersionedTuneId!==ZERO_GUID?r.VersionedTuneId:null,xuid=r.VersionedTuneXUID==null?null:String(r.VersionedTuneXUID);return {state:hasTune(r)?(id?(xuid===player?'own':'downloaded'):'custom'):(id?'linked':'stock'),tuneId:id,creator:id?xuid:null,file:r.TuneFileName||null};}
function upgrades(r,stock){let n=0;for(const s of SLOTS)if(r[s.col]!=null&&r[s.col]>=0&&stock&&stock[s.col]!==r[s.col])n++;return n;}
function owner(b){return parse(b).states[0].id.toString();}
function brief(r,data,index,player){const c=index.get(r.CarId),src=tuneSource(r,player),st=stats(r);return {id:r.Id,carId:r.CarId,make:c?.make||'Unknown',name:c?.name||`#${r.CarId}`,year:c?.year??null,classId:r.ClassID,classLabel:CLASSES[r.ClassID]||'—',pi:piOf(r,data),partsValue:r.PartsValue||0,tune:src.state,creator:src.creator,gears:gearCount(r),upgrades:upgrades(r,c?.row),catalogued:!!c,favorite:r.IsFavorite===1,power:st.power,weight:st.weight,front:st.front,top:st.top,transmission:r.Transmission};}
async function readGarage(b,data=catalog){
  const db=await open(b),player=owner(b),index=new Map(data.cars.map(c=>[c.id,c]));
  try{
    const all=rows(db,'SELECT * FROM Career_Garage ORDER BY Id'),purchases=rows(db,'SELECT count(*) n,coalesce(sum(PricePaid),0) s FROM Career_PurchasedParts')[0];
    const cars=all.map(r=>brief(r,data,index,player));
    const byClass=CLASSES.map((label,id)=>({label,cars:cars.filter(c=>c.classId===id).length,spent:cars.filter(c=>c.classId===id).reduce((n,c)=>n+c.partsValue,0)}));
    const totals={cars:cars.length,tuned:cars.filter(c=>['own','downloaded','custom'].includes(c.tune)).length,downloaded:cars.filter(c=>c.tune==='downloaded').length,own:cars.filter(c=>c.tune==='own').length,linked:cars.filter(c=>c.tune==='linked').length,upgraded:cars.filter(c=>c.partsValue>0).length,spent:cars.reduce((n,c)=>n+c.partsValue,0),parts:purchases.n,paid:purchases.s,byClass,top:[...cars].sort((a,b)=>b.partsValue-a.partsValue).slice(0,5).filter(c=>c.partsValue>0).map(c=>c.id)};
    return {player,cars,totals};
  }finally{db.close();}
}
async function carDetail(b,id,data=catalog){
  assert(Number.isSafeInteger(id),'车辆编号无效');
  const db=await open(b),player=owner(b),index=new Map(data.cars.map(c=>[c.id,c]));
  try{
    const r=rows(db,'SELECT * FROM Career_Garage WHERE Id=?',[id])[0];assert(r,'车库中没有这辆车');
    const stock=index.get(r.CarId)?.row,paid=rows(db,'SELECT rowid,* FROM Career_PurchasedParts WHERE GarageId=? ORDER BY rowid',[id]);
    const bySlot=new Map(SLOTS.filter(s=>s.slot!=null).map(s=>[s.slot,s.col]));
    const build=SLOTS.map(s=>({...s,part:r[s.col],stock:stock?.[s.col]??null,available:r[s.col]!=null&&r[s.col]>=0,upgraded:!!stock&&r[s.col]!=null&&r[s.col]>=0&&stock[s.col]!==r[s.col],owned:paid.filter(p=>p.UngroupedPartEnum===s.slot).length}));
    const siblings=rows(db,'SELECT * FROM Career_Garage WHERE CarId=? AND Id<>? ORDER BY Id',[r.CarId,id]).map(x=>brief(x,data,index,player));
    return {...brief(r,data,index,player),source:tuneSource(r,player),stats:stats(r),values:tuneOf(r),build,purchases:paid.map(p=>({slot:p.UngroupedPartEnum,col:bySlot.get(p.UngroupedPartEnum)||null,part:p.PartId,price:p.PricePaid,installed:bySlot.has(p.UngroupedPartEnum)&&r[bySlot.get(p.UngroupedPartEnum)]===p.PartId})),siblings,player};
  }finally{db.close();}
}
function calculate(car,{scenario='road',drivetrain='RWD',balance=0,stiffness=0}={}){
  const s=SCENARIOS[scenario];assert(s,'未知调校场景');assert(['RWD','FWD','AWD'].includes(drivetrain),'驱动形式无效');
  assert(Number.isInteger(balance)&&Math.abs(balance)<=2&&Number.isInteger(stiffness)&&Math.abs(stiffness)<=2,'微调参数无效');
  assert(car.values,'这辆车还没有保存过调校，无法确定齿轮数量。请先在游戏中打开调校并保存一次，或套用同车型调校。');
  const wf=clamp((car.stats.front??52)/100,.3,.7),k=1+.08*stiffness,v={...car.values},notes=[];
  const drive={RWD:[.92,1],FWD:[.8,1.15],AWD:[.9,1]}[drivetrain];
  const set=(key,display)=>{v[key]=encode(FIELD.get(key),display);};
  const pos=(key,p)=>{v[key]=snap(FIELD.get(key),p);};
  set('frontTirePressure',s.psi[0]);set('rearTirePressure',s.psi[1]);
  set('frontCamber',s.camber[0]);set('rearCamber',s.camber[1]);set('frontToe',s.toe[0]);set('rearToe',s.toe[1]);set('frontCaster',s.caster);
  // Percentage method: front/rear stiffness proportional to the axle load, then scaled by scenario and driver preference.
  set('frontSwaybar',clamp(1+64*wf*s.arb[0]*drive[0]*k*(1-.06*balance),1,65));set('rearSwaybar',clamp(1+64*(1-wf)*s.arb[1]*drive[1]*k*(1+.06*balance),1,65));
  pos('frontSpring',clamp(wf*s.spring[0]*k*(1-.04*balance),.03,.97));pos('rearSpring',clamp((1-wf)*s.spring[1]*k*(1+.04*balance),.03,.97));
  pos('frontRideHeight',s.ride[0]);pos('rearRideHeight',s.ride[1]);
  const rf=clamp(1+19*wf*s.rebound[0]*k,1,20),rr=clamp(1+19*(1-wf)*s.rebound[1]*k,1,20);
  set('frontDampingStiffness',rf);set('rearDampingStiffness',rr);set('frontBumpRatio',clamp(rf*s.bump,1,20));set('rearBumpRatio',clamp(rr*s.bump,1,20));
  pos('frontDownforce',s.aero[0]);pos('rearDownforce',s.aero[1]);
  set('brakeBalance',s.balance??Math.round(50+(wf-.5)*s.bias));set('brakePressure',s.brake);
  const d=s.diff[drivetrain];
  if(drivetrain==='RWD'){set('rearAccel',d[0]);set('rearDecel',d[1]);}
  else if(drivetrain==='FWD'){set('frontAccel',d[0]);set('frontDecel',d[1]);}
  else{set('frontAccel',d[0]);set('frontDecel',d[1]);set('rearAccel',d[2]);set('rearDecel',d[3]);set('centerTorque',d[4]);}
  if(scenario==='drift'&&drivetrain==='FWD')notes.push('前驱车不适合漂移，建议先换装后驱或四驱。');
  if(scenario==='drag')notes.push('直线加速调校保留了原有齿轮比；可在游戏中延长末档。');
  if(s.ride[0]<.2)notes.push('车身高度接近最低，出现触底时请适当升高。');
  notes.push('弹簧、车高、下压力与尾牙比的范围因车而异，按滑块位置写入。');
  return {values:v,notes,changed:FIELDS.filter(f=>v[f.key]!==car.values[f.key]).map(f=>f.key)};
}
function cleanValues(values,gears){
  assert(values&&typeof values==='object'&&!Array.isArray(values),'调校数据无效');
  const out={};
  for(const f of FIELDS){
    const v=values[f.key];
    if(GEARS.includes(f.key)&&GEARS.indexOf(f.key)>=gears){assert(v==null,'齿轮数量与车辆不符');out[f.key]=null;continue;}
    assert(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1,`调校参数无效: ${f.key}`);out[f.key]=v;
  }
  assert(Object.keys(values).every(k=>FIELD.has(k)),'包含未知调校参数');
  return out;
}
function validBuild(build,carId){
  assert(build&&typeof build==='object'&&build.parts&&build.stats,'改装方案无效');
  assert(Object.keys(build.parts).every(k=>SLOT.has(k))&&SLOTS.every(s=>Number.isInteger(build.parts[s.col])&&build.parts[s.col]>=-1&&build.parts[s.col]<2147483647),'改装部件无效');
  assert(Object.keys(build.stats).every(k=>BUILD_STATS.includes(k))&&BUILD_STATS.every(k=>build.stats[k]===null||(typeof build.stats[k]==='number'&&Number.isFinite(build.stats[k]))),'改装性能数据无效');
  assert(Number.isInteger(build.stats.ClassID)&&build.stats.ClassID>=0&&build.stats.ClassID<CLASSES.length,'改装等级无效');
  // Car-specific slots encode the car ordinal; engine and drivetrain families must stay internally consistent.
  for(const col of ['Engine','Drivetrain','CarBody','Brakes','SpringDamper','AntiSwayFront','AntiSwayRear','TireCompound','RearWing','RimSizeFront','RimSizeRear','FrontBumper','RearBumper','Hood','SideSkirts','TireWidthFront','TireWidthRear','WeightReduction','ChassisStiffness','TrackSpacingFront','TrackSpacingRear','FrontAspectRatio','RearAspectRatio'])
    assert(build.parts[col]===-1||Math.floor(build.parts[col]/1000)===carId,'改装部件不属于这款车');
  for(const cols of [['Camshaft','Valves','Displacement','PistonsCompression','FuelSystem','Ignition','Exhaust','Intake','Flywheel','Manifold','RestrictorPlate','OilCooling','SingleTurbo','TwinTurbo','QuadTurbo','SuperchargerCSC','SuperchargerDSC','Intercooler'],['Clutch','Transmission','Driveline','Differential']])
    assert(new Set(cols.map(c=>build.parts[c]).filter(v=>v>=0).map(v=>Math.floor(v/1000))).size<=1,'改装部件组合不一致');
  assert(Array.isArray(build.purchases)&&build.purchases.length<=400&&build.purchases.every(p=>Number.isInteger(p.slot)&&p.slot>=0&&p.slot<64&&Number.isInteger(p.part)&&Number.isInteger(p.price)&&p.price>=0&&p.price<=10000000),'改装价格记录无效');
  return build;
}
function buildOf(r,paid){return {parts:Object.fromEntries(SLOTS.map(s=>[s.col,r[s.col]??-1])),stats:Object.fromEntries(BUILD_STATS.map(k=>[k,r[k]??null])),purchases:paid.map(p=>({slot:p.UngroupedPartEnum,part:p.PartId,price:p.PricePaid}))};}
function metaOf(r){return {TuneFileName:r.TuneFileName??'',VersionedTuneId:r.VersionedTuneId||ZERO_GUID,VersionedTuneXUID:r.VersionedTuneXUID??null};}
const CLEAR_META={TuneFileName:'',VersionedTuneId:ZERO_GUID,VersionedTuneXUID:null};
// Resolves a request into concrete column writes. Sources are re-read from the save or the validated library, never trusted from the renderer.
function resolve(db,req,{library,data}){
  assert(req&&typeof req==='object'&&Object.keys(req).every(k=>['garageId','source','tune','build','values','options'].includes(k)),'调校请求无效');
  const target=rows(db,'SELECT * FROM Career_Garage WHERE Id=?',[req.garageId])[0];assert(target,'车库中没有目标车辆');
  const kind=req.source?.kind,wantTune=req.tune!==false,wantBuild=req.build===true;
  assert(['garage','library','calculator','manual','reset'].includes(kind),'调校来源无效');
  let values=null,meta=null,build=null,label;
  if(kind==='reset'){assert(!wantBuild);values=Object.fromEntries(FIELDS.map(f=>[f.key,-1]));meta=CLEAR_META;label='原厂调校';}
  else if(kind==='garage'){
    assert(Number.isSafeInteger(req.source.garageId)&&req.source.garageId!==req.garageId,'来源车辆无效');
    const src=rows(db,'SELECT * FROM Career_Garage WHERE Id=?',[req.source.garageId])[0];assert(src,'来源车辆不存在');
    assert.equal(src.CarId,target.CarId,'只能在同一车型之间复制');
    if(wantTune){assert(hasTune(src),'来源车辆没有保存调校');values=tuneOf(src);meta=metaOf(src);}
    if(wantBuild)build=buildOf(src,rows(db,'SELECT * FROM Career_PurchasedParts WHERE GarageId=? ORDER BY rowid',[src.Id]));
    label=`#${src.Id}`;
  }else if(kind==='library'){
    const entry=library?.get(req.source.id);assert(entry,'调校库中没有这条记录');assert.equal(entry.carId,target.CarId,'调校来自不同车型');
    if(wantTune){assert(entry.values,'这条记录不包含调校参数');values=entry.values;meta=entry.meta?{...CLEAR_META,...entry.meta}:CLEAR_META;}
    if(wantBuild){assert(entry.build,'这条记录不包含改装方案');build=validBuild(entry.build,entry.carId);}
    label=entry.name;
  }else{
    assert(!wantBuild&&wantTune,'计算器与手动调校只修改调校参数');
    assert(hasTune(target),'这辆车还没有保存过调校，无法确定齿轮数量。请先在游戏中打开调校并保存一次，或套用同车型调校。');
    if(kind==='calculator'){values=calculate({values:tuneOf(target),stats:stats(target)},req.options||{}).values;label=`calculator:${req.options?.scenario}`;}
    else{values={...tuneOf(target),...req.values};label='manual';}
    values=cleanValues(values,gearCount(target));meta=CLEAR_META;
  }
  if(values&&kind!=='reset'){
    // Gear count follows the transmission; a tune may only land on a car whose gearbox matches it.
    const gears=GEARS.filter(g=>values[g]!=null&&values[g]>=0).length,finalTrans=build?build.parts.Transmission:target.Transmission;
    if(hasTune(target)&&!build)assert.equal(gears,gearCount(target),'齿轮数量不同：请连同改装方案一起套用');
    else if(kind==='garage'&&!build){const src=rows(db,'SELECT Transmission FROM Career_Garage WHERE Id=?',[req.source.garageId])[0];assert.equal(src.Transmission,finalTrans,'变速箱不同：请连同改装方案一起套用');}
    else if(kind==='library'&&!build&&req.source){const entry=library.get(req.source.id);assert(entry.transmission===finalTrans||(hasTune(target)&&entry.gears===gearCount(target)),'变速箱不同：请连同改装方案一起套用');}
    cleanValues(Object.fromEntries(FIELDS.map(f=>[f.key,values[f.key]==null||values[f.key]<0?null:values[f.key]])),gears);
  }
  if(build&&!values&&hasTune(target))assert.equal(build.parts.Transmission,target.Transmission,'改装会更换变速箱，请同时套用来源调校');
  assert(values||build,'没有可写入的内容');
  return {target,values,meta,build,label,kind};
}
function priceTable(db){const map=new Map();for(const p of rows(db,'SELECT * FROM Career_PurchasedParts WHERE PricePaid>0 ORDER BY rowid')){const k=p.UngroupedPartEnum+':'+p.PartId;if(!map.has(k))map.set(k,[]);map.get(k).push(p.PricePaid);}return map;}
async function patchTunes(b,requests,{library=null,data=catalog,dryRun=false}={}){
  assert(Array.isArray(requests)&&requests.length&&requests.length<=200,'请选择要调校的车辆');
  assert(new Set(requests.map(r=>r?.garageId)).size===requests.length,'同一辆车只能有一条调校请求');
  const db=await open(b);
  try{
    const quote=s=>'"'+s.replaceAll('"','""')+'"';
    const cols=rows(db,'PRAGMA table_info(Career_Garage)').map(c=>c.name);
    for(const c of [...FIELDS.map(f=>f.col),...SLOTS.map(s=>s.col),...BUILD_STATS,...TUNE_META,'PartsValue'])assert(cols.includes(c),`缺少车库字段 ${c}`);
    const before=new Map(rows(db,'SELECT * FROM Career_Garage ORDER BY Id').map(r=>[r.Id,r])),purchasesBefore=rows(db,'SELECT rowid,* FROM Career_PurchasedParts ORDER BY rowid');
    const tables=rows(db,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('Career_Garage','Career_PurchasedParts')").map(r=>r.name);
    const beforeOther=new Map(tables.map(t=>[t,JSON.stringify(rows(db,`SELECT * FROM ${quote(t)}`))]));
    const plans=requests.map(req=>resolve(db,req,{library,data}));
    const prices=priceTable(db),index=new Map(data.cars.map(c=>[c.id,c])),results=[];
    db.run('BEGIN IMMEDIATE');
    for(const plan of plans){
      const t=plan.target,set={},owned=new Set(rows(db,'SELECT * FROM Career_PurchasedParts WHERE GarageId=?',[t.Id]).map(p=>p.UngroupedPartEnum+':'+p.PartId));
      let cost=0,unknown=0,bought=[];
      if(plan.build){
        const stock=index.get(t.CarId)?.row,source=new Map();for(const p of plan.build.purchases)source.set(p.slot+':'+p.part,p.price);
        for(const s of SLOTS){
          const next=plan.build.parts[s.col];set[s.col]=next;
          if(next<0||next===t[s.col]||stock?.[s.col]===next)continue;
          const key=s.slot+':'+next;if(s.slot==null){unknown++;continue;}if(owned.has(key))continue;
          let price=source.get(key);if(price==null&&prices.has(key)){const list=[...prices.get(key)].sort((a,b)=>a-b);price=list[list.length>>1];}
          if(price==null){unknown++;price=0;}
          bought.push({slot:s.slot,col:s.col,part:next,price});cost+=price;owned.add(key);
        }
        for(const k of BUILD_STATS)set[k]=plan.build.stats[k];
        set.PartsValue=(t.PartsValue||0)+cost;
      }
      if(plan.values){for(const f of FIELDS)set[f.col]=plan.values[f.key]==null?-1:plan.values[f.key];Object.assign(set,plan.meta);}
      const changed=Object.keys(set).filter(k=>set[k]!==t[k]);
      if(changed.length)db.run(`UPDATE Career_Garage SET ${changed.map(k=>quote(k)+'=?').join(',')} WHERE Id=?`,[...changed.map(k=>set[k]),t.Id]);
      for(const p of bought)db.run('INSERT INTO Career_PurchasedParts (GarageId,UngroupedPartEnum,PartId,PricePaid) VALUES (?,?,?,?)',[t.Id,p.slot,p.part,p.price]);
      results.push({garageId:t.Id,carId:t.CarId,source:plan.kind,label:plan.label,tuneFields:changed.filter(k=>k.startsWith('Tuning_')).length,changed:changed.filter(k=>k.startsWith('Tuning_')).map(k=>({key:k.slice(7),before:t[k],after:set[k]})),build:!!plan.build,partsChanged:changed.filter(k=>SLOT.has(k)).length,bought,cost,unknownPrices:unknown,piBefore:piOf(t,data),piAfter:plan.build?piOf({...t,...plan.build.stats},data):piOf(t,data),classBefore:CLASSES[t.ClassID],classAfter:CLASSES[plan.build?plan.build.stats.ClassID:t.ClassID]});
    }
    db.run('COMMIT');
    assert.equal(rows(db,'PRAGMA integrity_check')[0].integrity_check,'ok','车库数据库检查失败');
    // Every untouched vehicle, every untouched column and every other table must survive byte-for-byte.
    const allowed=new Set([...FIELDS.map(f=>f.col),...SLOTS.map(s=>s.col),...BUILD_STATS,...TUNE_META,'PartsValue']),targets=new Set(plans.map(p=>p.target.Id));
    const after=rows(db,'SELECT * FROM Career_Garage ORDER BY Id');assert.equal(after.length,before.size,'车辆数量发生变化');
    for(const r of after){const o=before.get(r.Id);assert(o,'车辆编号发生变化');for(const c of cols)if(!targets.has(r.Id)||!allowed.has(c))assert.deepEqual(r[c],o[c],`非目标字段发生变化: ${c}`);}
    const purchasesAfter=rows(db,'SELECT rowid,* FROM Career_PurchasedParts ORDER BY rowid');assert.deepEqual(purchasesAfter.slice(0,purchasesBefore.length),purchasesBefore,'已购部件记录发生变化');
    assert(purchasesAfter.slice(purchasesBefore.length).every(p=>targets.has(p.GarageId)),'部件记录写入了非目标车辆');
    const added=purchasesAfter.slice(purchasesBefore.length);
    for(const r of after)if(targets.has(r.Id))assert.equal(r.PartsValue,(before.get(r.Id).PartsValue||0)+added.filter(p=>p.GarageId===r.Id).reduce((n,p)=>n+p.PricePaid,0),'改装花费记录不一致');
    for(const t of tables)assert.equal(JSON.stringify(rows(db,`SELECT * FROM ${quote(t)}`)),beforeOther.get(t),'非车库表发生变化');
    const audit={kind:'tuning',cars:results,totalCost:results.reduce((n,r)=>n+r.cost,0),unknownPrices:results.reduce((n,r)=>n+r.unknownPrices,0),validation:'数据库字段与已购部件校验；游戏内驾驶未验证'};
    if(dryRun)return {audit};
    const output=replaceDatabase(b,Buffer.from(db.export()));
    const a=parse(b),z=parse(output);for(const s of a.sections)if(s!==a.database){const other=z.sections.find(v=>v.tag===s.tag);assert(other&&b.subarray(s.start,s.end).equals(output.subarray(other.start,other.end)),'非车库状态块发生变化');}
    return {buffer:output,audit:{...audit,beforeSha256:sha(b),afterSha256:sha(output)}};
  }catch(e){try{db.run('ROLLBACK');}catch{}throw e;}finally{db.close();}
}
// Library entries are captured from real save rows so builds carry game-computed stats and real prices.
async function capture(b,id,{name,build=false,scenario=null}={},data=catalog){
  const db=await open(b),player=owner(b);
  try{
    const r=rows(db,'SELECT * FROM Career_Garage WHERE Id=?',[id])[0];assert(r,'车库中没有这辆车');assert(hasTune(r)||build,'这辆车没有保存调校');
    const c=data.cars.find(x=>x.id===r.CarId),src=tuneSource(r,player);
    return {name:String(name||`${c?.make||''} ${c?.name||'#'+r.CarId}`).trim().slice(0,80),carId:r.CarId,make:c?.make||'Unknown',car:c?.name||`#${r.CarId}`,year:c?.year??null,scenario,classId:r.ClassID,pi:piOf(r,data),gears:gearCount(r),transmission:r.Transmission,values:tuneOf(r),meta:hasTune(r)&&src.tuneId?metaOf(r):null,creator:src.creator,origin:src.state,build:build?buildOf(r,rows(db,'SELECT * FROM Career_PurchasedParts WHERE GarageId=? ORDER BY rowid',[id])):null,partsValue:build?r.PartsValue||0:0};
  }finally{db.close();}
}
module.exports={FIELDS,SLOTS,BUILD_STATS,CLASSES,SCENARIOS,ZERO_GUID,encode,decode,snap,readGarage,carDetail,calculate,patchTunes,capture,validBuild,cleanValues,piOf,hasTune,gearCount};
