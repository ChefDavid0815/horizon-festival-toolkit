import {useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {SlidersHorizontal, Search, X, Route, Building2, Mountain, Trees, Wind, Zap, Snowflake, Gauge, Library, Wrench, Copy, Check, ExternalLink, BookmarkPlus, RotateCcw, Undo2, Upload, Download, Pencil, Trash2, LoaderCircle, CircleAlert, CarFront, Coins, Info} from 'lucide-react';
import {useI18n} from './Language.jsx';
import {makeAliases, ClassChip as Chip, CLASS_COLORS, CLASS_LABELS, prettyName} from './Garage.jsx';
import {Seal, Roll, PageHead} from './ui.jsx';
const ROWS=[
  {group:'tires',label:'胎压',keys:['frontTirePressure','rearTirePressure']},
  {group:'gearing',label:'尾牙比',keys:['finalDriveRatio']},
  {group:'gearing',label:'各档齿比',gears:true},
  {group:'alignment',label:'外倾角',keys:['frontCamber','rearCamber']},
  {group:'alignment',label:'前束角',keys:['frontToe','rearToe']},
  {group:'alignment',label:'主销后倾角',keys:['frontCaster']},
  {group:'antiroll',label:'防倾杆',keys:['frontSwaybar','rearSwaybar']},
  {group:'springs',label:'弹簧',keys:['frontSpring','rearSpring']},
  {group:'springs',label:'车身高度',keys:['frontRideHeight','rearRideHeight']},
  {group:'damping',label:'回弹阻尼',keys:['frontDampingStiffness','rearDampingStiffness']},
  {group:'damping',label:'压缩阻尼',keys:['frontBumpRatio','rearBumpRatio']},
  {group:'aero',label:'下压力',keys:['frontDownforce','rearDownforce']},
  {group:'brakes',label:'刹车平衡（前）',keys:['brakeBalance']},
  {group:'brakes',label:'刹车力度',keys:['brakePressure']},
  {group:'differential',label:'加速锁止',keys:['frontAccel','rearAccel']},
  {group:'differential',label:'减速锁止',keys:['frontDecel','rearDecel']},
  {group:'differential',label:'中央分配（后）',keys:['centerTorque']},
];
const GROUPS={tires:'轮胎',gearing:'齿轮',alignment:'车轮定位',antiroll:'防倾杆',springs:'弹簧与车高',damping:'阻尼',aero:'空气动力',brakes:'刹车',differential:'差速器'};
const SCENARIOS=[['road','公路赛',Route,'抓地优先，低车身、偏硬悬挂'],['street','街头赛',Building2,'兼顾路肩与路面起伏'],['dirt','泥地赛',Mountain,'碎石路面，提高车身、放软悬挂'],['cross','越野赛',Trees,'跳跃与颠簸，留足悬挂行程'],['drift','漂移',Wind,'前轮大外倾，后差速器全锁'],['drag','直线加速',Zap,'后胎低压，起步重心后移'],['snow','雪地',Snowflake,'低胎压、软悬挂、更多下压力'],['speed','极速',Gauge,'低风阻，高速段保持稳定']];
const SLOT_NAMES={Engine:'引擎替换',Camshaft:'凸轮轴',Valves:'气门',Displacement:'排量',PistonsCompression:'活塞与压缩',FuelSystem:'燃油系统',Ignition:'点火系统',Exhaust:'排气',Intake:'进气',Flywheel:'飞轮',Manifold:'进气歧管',RestrictorPlate:'限流板',OilCooling:'机油冷却',SingleTurbo:'单涡轮',TwinTurbo:'双涡轮',QuadTurbo:'四涡轮',SuperchargerCSC:'离心式增压器',SuperchargerDSC:'机械增压器',Intercooler:'中冷器',Motor:'电机',MotorParts:'电机部件',Brakes:'刹车',SpringDamper:'弹簧与避震',AntiSwayFront:'前防倾杆',AntiSwayRear:'后防倾杆',ChassisStiffness:'车身强化',WeightReduction:'轻量化',Drivetrain:'驱动形式替换',Clutch:'离合器',Transmission:'变速箱',Driveline:'传动轴',Differential:'差速器',TireCompound:'轮胎配方',TireWidthFront:'前轮胎宽度',TireWidthRear:'后轮胎宽度',RimSizeFront:'前轮圈尺寸',RimSizeRear:'后轮圈尺寸',TrackSpacingFront:'前轮距',TrackSpacingRear:'后轮距',FrontAspectRatio:'前胎扁平比',RearAspectRatio:'后胎扁平比',CarBody:'车身套件',FrontBumper:'前保险杠',RearBumper:'后保险杠',Hood:'引擎盖',SideSkirts:'侧裙',RearWing:'尾翼'};
const SLOT_GROUPS={power:'动力',platform:'操控平台',drivetrain:'传动',tires:'轮胎与轮圈',aero:'车身与空力'};
const PLAYSTYLES={'Road':'公路','Dirt':'泥地','Cross Country':'越野','Drift':'漂移','Drag':'直线加速','Grip':'抓地','PR Stunts':'PR 特技','Skill Points':'技巧分','Seasonal Drift':'季节漂移'};
const TUNE_STATES={own:'自己的调校',downloaded:'下载的调校',custom:'本地调校',linked:'已关联调校',stock:'原厂设定'};
const tunedState=s=>['own','downloaded','custom'].includes(s);
const label=(l,t)=>Array.isArray(l)?t(l[0],l[1]):t(l);
function display(f,v){
  if(v==null||v<0)return null;
  if(f.carSpecific)return {text:`${Math.round(v*100)}`,unit:'%'};
  const n=f.min+v*(f.max-f.min),digits=f.unit==='ratio'||f.unit===''&&f.steps===6400?2:f.unit==='%'?(Number.isInteger(Math.round(n*10)/10)?0:1):1;
  return {text:n.toFixed(digits),unit:f.unit==='ratio'?'':f.unit==='psi'?' psi':f.unit};
}
const fmt=(f,v)=>{const d=display(f,v);return d?d.text+d.unit:'—';};
const ClassChip=({car})=><Chip label={car.classLabel} pi={car.pi}/>;
function Track({field,value,next,editing,onChange,label,t}){
  const pos=v=>v==null||v<0?null:Math.max(0,Math.min(1,v))*100;
  const staged=next!==undefined&&next!==value,a=pos(value),b=staged?pos(next):null;
  return <div className={`tune-track ${staged?'staged':''} ${editing?'editing':''}`}>
    <div className="tune-rail">
      {a!=null&&b!=null?<span className="tune-delta" style={{left:`${Math.min(a,b)}%`,width:`${Math.abs(b-a)}%`}}/>:null}
      {a!=null?<span className="tune-mark" style={{left:`${a}%`}}/>:null}
      {b!=null?<span className="tune-ghost" style={{left:`${b}%`}}/>:null}
      {editing&&value!=null?<input type="range" min="0" max="1" step={field.steps?1/field.steps:.001} value={next??value} aria-label={label} aria-valuetext={fmt(field,next??value)} onChange={e=>onChange(field.key,Number(e.target.value))}/>:null}
    </div>
    <output>{staged?<><s>{fmt(field,value)}</s><Roll value={next<0?t('原厂'):fmt(field,next)}/></>:fmt(field,value)}</output>
  </div>;
}
function Gears({fields,values,next,t}){
  const gears=fields.filter(f=>/Gear$/.test(f.key)&&values?.[f.key]!=null);
  if(!gears.length)return <span className="tune-empty-value">—</span>;
  return <div className="gear-ladder" role="list" aria-label={t('各档齿比')}>{gears.map((f,i)=>{const now=f.min+values[f.key]*(f.max-f.min),after=next?.[f.key];return <div role="listitem" key={f.key} className={after!==undefined&&after!==values[f.key]?'staged':''}><span className="gear-bar" style={{'--h':`${Math.min(100,now/f.max*100)}%`,...(after>=0?{'--g':`${Math.min(100,(f.min+after*(f.max-f.min))/f.max*100)}%`}:{})}}/><b>{now.toFixed(2)}</b><small>{i+1}</small></div>;})}</div>;
}
function Sheet({meta,car,next,editing,draft,setDraft,t}){
  const fields=new Map(meta.fields.map(f=>[f.key,f])),values=car.values;
  const merged=editing?{...next,...draft}:next;
  let group=null;
  return <div className="tune-sheet" role="table" aria-label={t('调校参数')}>
    <div className="sheet-columns" role="row"><span role="columnheader">{t('项目')}</span><span role="columnheader">{t('前轴')}</span><span role="columnheader">{t('后轴')}</span></div>
    {ROWS.map(row=>{const heading=row.group!==group?(group=row.group,<div className="sheet-group" role="row" key={'g-'+row.group}><span role="cell">{t(GROUPS[row.group])}</span></div>):null;
      const label=t(row.label);
      return [heading,<div className={`sheet-row ${row.keys?.length===1||row.gears?'single':''}`} role="row" key={row.label}>
        <span className="sheet-label" role="rowheader">{label}{row.keys&&fields.get(row.keys[0]).carSpecific?<small>{t('滑块位置')}</small>:null}</span>
        {row.gears?<div className="sheet-span" role="cell"><Gears fields={meta.fields} values={values} next={next} t={t}/></div>:row.keys.map((k,i)=><div role="cell" className={row.keys.length===1?'sheet-span':''} key={k}><Track field={fields.get(k)} value={values?.[k]} next={merged?.[k]} editing={editing&&!/Gear$/.test(k)} label={`${label} ${row.keys.length>1?t(i?'后轴':'前轴'):''}`} onChange={(key,v)=>setDraft(d=>({...d,[key]:v}))} t={t}/></div>)}
      </div>];})}
  </div>;
}
function useCR(){const {locale}=useI18n();return n=>`${Math.round(n||0).toLocaleString(locale==='zh'?'zh-CN':'en-US')} CR`;}
export default function Tuning({meta,summary,library,setLibrary,queue,setQueue,busy,api,connect}){
  const {t,locale}=useI18n(),cr=useCR();
  const [garage,setGarage]=useState(null),[loading,setLoading]=useState(false),[view,setView]=useState('garage'),[selected,setSelected]=useState(null),[car,setCar]=useState(null),[tab,setTab]=useState('sheet');
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[classFilter,setClassFilter]=useState(null),[sort,setSort]=useState('pi'),[problem,setProblem]=useState(''),[working,setWorking]=useState(false),[note,setNote]=useState('');
  const search=useDeferredValue(query.trim().toLowerCase());
  const source=summary?.sourceHash;
  useEffect(()=>{if(!summary||summary.tuningError){setGarage(null);return;}let live=true;setLoading(true);api.tuningGarage().then(g=>{if(live){setGarage(g);setSelected(s=>s&&g.cars.some(c=>c.id===s)?s:null);}}).catch(e=>live&&setProblem(e.message)).finally(()=>live&&setLoading(false));return ()=>{live=false;};},[source]);
  useEffect(()=>{if(!selected||!garage){setCar(null);return;}let live=true;api.tuningCar(selected).then(c=>live&&setCar(c)).catch(e=>live&&setProblem(e.message));return ()=>{live=false;};},[selected,garage]);
  useEffect(()=>{setProblem('');setNote('');},[selected,tab]);
  const staged=useMemo(()=>new Map(queue.map(q=>[q.garageId,q])),[queue]);
  const cars=useMemo(()=>{
    if(!garage)return [];
    const list=garage.cars.filter(c=>(classFilter===null||c.classId===classFilter)&&(filter==='all'||(filter==='tuned'&&tunedState(c.tune))||(filter==='downloaded'&&c.tune==='downloaded')||(filter==='stock'&&!tunedState(c.tune))||(filter==='upgraded'&&c.partsValue>0)||(filter==='staged'&&staged.has(c.id)))&&(!search||search.split(/\s+/).every(s=>`${c.make} ${makeAliases[c.make]||''} ${c.name} ${c.year} #${c.id} ${c.carId} ${c.classLabel}`.toLowerCase().includes(s))));
    const by={pi:(a,b)=>(b.pi||0)-(a.pi||0),spent:(a,b)=>b.partsValue-a.partsValue,name:(a,b)=>`${a.make} ${a.name}`.localeCompare(`${b.make} ${b.name}`),recent:(a,b)=>b.id-a.id}[sort];
    return list.sort(by);
  },[garage,search,filter,classFilter,sort,staged]);
  const maxSpend=Math.max(1,...(garage?.totals.byClass||[]).map(c=>c.spent));
  async function stage(request,label){
    setProblem('');setWorking(true);
    try{const audit=await api.tuningPreview([request]);setQueue(q=>[...q.filter(x=>x.garageId!==request.garageId),{garageId:request.garageId,request,label,result:audit.cars[0]}]);setTab('sheet');return true;}
    catch(e){setProblem(e.message);return false;}finally{setWorking(false);}
  }
  const unstage=id=>setQueue(q=>q.filter(x=>x.garageId!==id));
  async function libraryAction(fn,message){setProblem('');setWorking(true);try{const r=await fn();if(r?.items)setLibrary(r.items);else if(Array.isArray(r))setLibrary(r);if(message)setNote(typeof message==='function'?message(r):message);return r;}catch(e){setProblem(e.message);}finally{setWorking(false);}}
  const mine=staged.get(car?.id);
  const next=mine?Object.fromEntries((mine.result.changed||[]).map(c=>[c.key,c.after])):undefined;
  const header=<PageHead title={t('每一套调校，都有出处')} sub={t('读取存档中每辆车的调校与改装，按场景生成、从同车型复制，或找到社区分享码。')}>
    <div className="segmented" role="tablist" aria-label={t('调校工坊视图')}>{[['garage',t('我的车库'),CarFront],['library',t('调校库'),Library]].map(([id,label,Icon])=><button key={id} role="tab" aria-selected={view===id} className={view===id?'active':''} onClick={()=>setView(id)}><Icon size={15}/>{label}{id==='library'?<small>{library.length}</small>:null}</button>)}</div></PageHead>;
  if(view==='library')return <div className="tuning">{header}<LibraryView {...{library,setLibrary,garage,api,busy,libraryAction,problem,note,t,locale,cr,open:id=>{setView('garage');setSelected(id);setTab('apply');}}}/></div>;
  return <div className="tuning">{header}
    {summary?.tuningError?<div className="message error" role="alert"><CircleAlert size={18}/><span>{t(summary.tuningError)}</span></div>:null}
    <section className="sheet ledger" aria-label={t('车库改装账本')}>
      <h2 className="panel-tab"><Coins size={14}/>{t('车库改装账本')}</h2>
      <div className="ledger-copy">
        {garage?<><strong className="ledger-total"><Roll value={garage.totals.spent.toLocaleString(locale==='zh'?'zh-CN':'en-US')}/><small>CR</small></strong><p>{t('{0} 辆车已改装，共购买 {1} 个部件。',[garage.totals.upgraded,garage.totals.parts.toLocaleString()])}<br/>{t('已调校 {0} 辆，其中 {1} 套来自其他玩家。',[garage.totals.tuned,garage.totals.downloaded])}</p></>
          :<p>{summary?t('正在读取车库…'):t('连接存档后，这里会算出每个等级的改装花费。')}</p>}
        {!summary?<button className="small-btn" onClick={connect} disabled={busy}><CarFront size={16}/>{t('连接存档')}</button>:null}
      </div>
      <div className="ledger-classes" role="group" aria-label={t('按等级筛选')}>{(garage?.totals.byClass||meta.classes.map(label=>({label,cars:0,spent:0}))).map((c,i)=><button key={c.label} aria-pressed={classFilter===i} className={classFilter===i?'active':''} disabled={!garage||!c.cars} onClick={()=>setClassFilter(v=>v===i?null:i)} style={{'--class':CLASS_COLORS[c.label],'--h':`${garage?Math.max(4,c.spent/maxSpend*100):4}%`}} title={garage?`${c.label}: ${cr(c.spent)}`:c.label}>
        <span className="ledger-bar"><i/></span><b>{c.label}</b><small>{garage?(c.spent>=1e6?(c.spent/1e6).toFixed(1)+'M':c.spent>=1e3?Math.round(c.spent/1e3)+'K':c.spent):'—'}</small><em>{garage?t('{0} 辆',[c.cars]):''}</em></button>)}</div>
    </section>
    {queue.length?<div className="staged-strip" aria-label={t('待写入的调校')}><Seal glyph="改"/><span>{t('待写入 {0} 辆',[queue.length])}</span>{queue.map(q=>{const c=garage?.cars.find(x=>x.id===q.garageId);return <button key={q.garageId} className={selected===q.garageId?'active':''} onClick={()=>{setSelected(q.garageId);setTab('sheet');}}>{c?`${c.make} ${prettyName(c.name)}`:`#${q.garageId}`}<small>{label(q.label,t)}</small></button>;})}<p>{t('点击底部“备份并应用修改”后写入存档。')}</p></div>:null}
    <div className="tuning-bench">
      <aside className="tune-list" aria-label={t('车辆列表')}>
        <div className="tune-list-tools">
          <label className="search-input"><Search size={17}/><input aria-label={t('搜索车辆')} placeholder={t('车型、品牌、年份或编号')} value={query} onChange={e=>setQuery(e.target.value)} disabled={!garage}/>{query?<button aria-label={t('清空搜索')} onClick={()=>setQuery('')}><X size={15}/></button>:null}</label>
          <div className="tune-list-filters">
            <select aria-label={t('调校筛选')} value={filter} onChange={e=>setFilter(e.target.value)} disabled={!garage}>{[['all','全部车辆'],['tuned','已调校'],['downloaded','下载的调校'],['stock','原厂设定'],['upgraded','已改装'],['staged','待写入']].map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select>
            <select aria-label={t('排序')} value={sort} onChange={e=>setSort(e.target.value)} disabled={!garage}>{[['pi','按性能指数'],['spent','按改装花费'],['name','按车名'],['recent','按入库顺序']].map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select>
          </div>
          <div className="tune-list-count">{garage?t('{0} / {1} 辆',[cars.length,garage.cars.length]):loading?t('正在读取车库…'):t('未连接存档')}{classFilter!==null?<button className="text-btn" onClick={()=>setClassFilter(null)}>{t('清除等级筛选')}</button>:null}</div>
        </div>
        <div className="tune-rows" role="listbox" aria-label={t('车辆')}>
          {cars.map(c=><button role="option" aria-selected={selected===c.id} key={c.id} className={`tune-row ${selected===c.id?'active':''} ${staged.has(c.id)?'staged':''}`} onClick={()=>setSelected(c.id)}>
            <ClassChip car={c}/>
            <span className="tune-row-name"><b>{c.make} {prettyName(c.name)}{staged.has(c.id)?<Seal glyph="改" className="row-seal"/>:null}</b><small>{c.year??''} · #{c.id}</small></span>
            <span className="tune-row-meta"><span><i className={`tune-dot ${c.tune}`}/>{t(TUNE_STATES[c.tune])}</span><small>{c.partsValue?cr(c.partsValue):t('未改装')}</small></span>
          </button>)}
          {garage&&!cars.length?<div className="tune-list-empty"><Search size={22}/><p>{t('没有符合条件的车辆。换个关键词或清除筛选试试。')}</p></div>:null}
          {!garage?<div className="tune-list-empty">{loading?<LoaderCircle className="spin" size={22}/>:<CarFront size={24}/>}<p>{loading?t('正在读取车库…'):t('连接存档后，车库里的每辆车都会列在这里。')}</p></div>:null}
        </div>
      </aside>
      <section className="tune-workbench" aria-live="polite">
        {!car?<div className="bench-empty"><SlidersHorizontal size={34} strokeWidth={1.4}/><h2>{garage?t('选一辆车开始'):t('先连接存档')}</h2><p>{garage?t('左侧选择车辆，查看完整调校、改装花费，或为它生成新的调校。'):t('工坊只读取存档中的车库数据库；写入前会自动备份。')}</p></div>
        :<CarBench {...{car,meta,tab,setTab,next,mine,stage,unstage,working,problem,setProblem,note,setNote,library,libraryAction,api,busy,cr,t,locale,garage,select:setSelected}}/>}
      </section>
    </div>
  </div>;
}
function CarBench({car,meta,tab,setTab,next,mine,stage,unstage,working,problem,setProblem,note,library,libraryAction,api,busy,cr,t,locale,select}){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState({});
  useEffect(()=>{setEditing(false);setDraft({});},[car.id]);
  const src=car.source,s=car.stats;
  const stats=[[t('功率'),s.power?`${Math.round(s.power*1.341)} hp`:'—',s.power?`${s.power} kW`:''],[t('扭矩'),s.torque?`${s.torque} N·m`:'—',''],[t('重量'),s.weight?`${s.weight.toLocaleString()} kg`:'—',''],[t('前轴配重'),s.front?`${s.front}%`:'—',''],[t('极速'),s.top?`${Math.round(s.top)} km/h`:'—',''],[t('转速红线'),s.redline?`${s.redline.toLocaleString()} rpm`:'—','']];
  const tabs=[['sheet','调校表',SlidersHorizontal],['calc','场景计算',Gauge],['apply','套用与复制',Copy],['build','改装与花费',Wrench],['community','社区调校',ExternalLink]];
  return <div className="bench" key={car.id}>
    <header className="bench-head">
      <div className="bench-title"><ClassChip car={car}/><h2>{car.make} <b>{prettyName(car.name)}</b></h2><span>{car.year} · {t('车库编号')} #{car.id}</span></div>
      <p className="bench-source"><i className={`tune-dot ${car.tune}`}/>{t(TUNE_STATES[car.tune])}{src.creator?<span>{t('作者 XUID 尾号 {0}',[src.creator.slice(-4)])}</span>:null}{car.tune==='linked'?<span>{t('存档里只有调校编号，没有参数。')}</span>:null}</p>
      <dl className="bench-stats">{stats.map(([k,v,sub])=><div key={k}><dt>{k}</dt><dd>{v}{sub?<small>{sub}</small>:null}</dd></div>)}</dl>
    </header>
    <div className="bench-tabs" role="tablist" aria-label={t('车辆工作台')}>{tabs.map(([id,label,Icon])=><button role="tab" key={id} aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={15}/>{t(label)}</button>)}</div>
    {mine?<div className="staged-banner" role="status"><Seal glyph="改"/><div><b>{t('待写入：{0}',[label(mine.label,t)])}</b><span>{mine.result.tuneFields?t('{0} 项调校参数',[mine.result.tuneFields]):null}{mine.result.build?` ${t('改装 {0} 个槽位，花费 {1}',[mine.result.partsChanged,cr(mine.result.cost)])}`:''}{mine.result.build&&mine.result.classBefore!==mine.result.classAfter||mine.result.piBefore!==mine.result.piAfter?` ${t('性能 {0} {1} → {2} {3}',[mine.result.classBefore,mine.result.piBefore,mine.result.classAfter,mine.result.piAfter])}`:''}{mine.result.unknownPrices?` ${t('{0} 个部件价格未知，按 0 CR 记录。',[mine.result.unknownPrices])}`:''}</span></div><button className="text-btn" onClick={()=>unstage(car.id)}><Undo2 size={14}/>{t('撤销')}</button></div>:null}
    {problem?<div className="message error" role="alert"><CircleAlert size={17}/><span>{t(problem)}</span><button onClick={()=>setProblem('')} aria-label={t('关闭')}>×</button></div>:null}
    {note?<div className="message success" role="status"><Check size={17}/><span>{t(note)}</span></div>:null}
    {tab==='sheet'?<div className="bench-panel">
      {car.values?<>
        <div className="panel-actions"><p>{editing?t('拖动滑块微调；齿比请保持游戏内设置。'):next?t('朱色标记是待写入的新位置。'):t('数值按游戏滑块网格换算；带“滑块位置”的项目范围因车而异。')}</p>
          {editing?<><button className="text-btn" onClick={()=>{setEditing(false);setDraft({});}}>{t('放弃修改')}</button><button className="primary" disabled={working||!Object.keys(draft).length} onClick={async()=>{if(await stage({garageId:car.id,source:{kind:'manual'},values:draft},'手动微调')){setEditing(false);setDraft({});}}}><Check size={16}/>{t('加入待写入')}</button></>
          :<button className="small-btn" disabled={busy} onClick={()=>{setDraft(next&&mine?.request.source.kind==='manual'?{...mine.request.values}:{});setEditing(true);}}><Pencil size={15}/>{t('手动微调')}</button>}</div>
        <Sheet meta={meta} car={car} next={next} editing={editing} draft={draft} setDraft={setDraft} t={t}/>
      </>:<div className="bench-empty inset"><SlidersHorizontal size={28} strokeWidth={1.4}/><h3>{next?t('将写入新的调校'):t('这辆车还没有保存调校')}</h3><p>{next?t('切换到“套用与复制”可以撤销或更换来源。'):t('在游戏里打开这辆车的调校并保存一次，或从同车型车辆、调校库套用一套完整调校。')}</p>{!next?<button className="small-btn" onClick={()=>setTab('apply')}><Copy size={15}/>{t('去套用调校')}</button>:null}</div>}
    </div>:null}
    {tab==='calc'?<Calculator {...{car,meta,stage,working,libraryAction,api,t,cr,busy}}/>:null}
    {tab==='apply'?<ApplyPanel {...{car,stage,working,library,libraryAction,api,t,cr,busy,select}}/>:null}
    {tab==='build'?<BuildPanel {...{car,meta,t,cr}}/>:null}
    {tab==='community'?<Community {...{car,api,t,locale}}/>:null}
  </div>;
}
function Calculator({car,meta,stage,working,libraryAction,api,t,busy}){
  const guess=(car.stats.front||50)>=58?'FWD':'RWD';
  const [opts,setOpts]=useState({scenario:'road',drivetrain:guess,balance:0,stiffness:0}),[result,setResult]=useState(null),[error,setError]=useState('');
  const fields=useMemo(()=>new Map(meta.fields.map(f=>[f.key,f])),[meta]);
  useEffect(()=>{if(!car.values)return;let live=true;const timer=setTimeout(()=>api.tuningCalc(car.id,opts).then(r=>{if(live){setResult(r);setError('');}}).catch(e=>live&&setError(e.message)),120);return ()=>{live=false;clearTimeout(timer);};},[car.id,opts]);
  const set=(k,v)=>setOpts(o=>({...o,[k]:v}));
  const scenario=SCENARIOS.find(s=>s[0]===opts.scenario);
  if(!car.values)return <div className="bench-panel"><div className="bench-empty inset"><Gauge size={28} strokeWidth={1.4}/><h3>{t('需要一套已保存的调校作为基准')}</h3><p>{t('计算器会保留原有齿比，只重新计算悬挂、轮胎、空力、刹车和差速器。先在游戏里保存一次这辆车的调校，或从同车型套用。')}</p></div></div>;
  return <div className="bench-panel calc">
    <fieldset className="scenario-grid"><legend>{t('用在什么场合')}</legend>{SCENARIOS.map(([id,label,Icon,hint])=><label key={id} className={opts.scenario===id?'active':''}><input type="radio" name="scenario" value={id} checked={opts.scenario===id} onChange={()=>set('scenario',id)}/><Icon size={20} strokeWidth={1.6}/><b>{t(label)}</b><small>{t(hint)}</small></label>)}</fieldset>
    <div className="calc-controls">
      <div><span className="control-label">{t('驱动形式')}</span><div className="segmented">{['RWD','FWD','AWD'].map(d=><button key={d} aria-pressed={opts.drivetrain===d} className={opts.drivetrain===d?'active':''} onClick={()=>set('drivetrain',d)}>{t({RWD:'后驱',FWD:'前驱',AWD:'四驱'}[d])}</button>)}</div><small>{t('根据配重推测为{0}，请按实际驱动形式选择。',[t(guess==='FWD'?'前驱':'后驱')])}</small></div>
      <Stepper label={t('转向特性')} left={t('更稳定')} right={t('更灵活')} value={opts.balance} onChange={v=>set('balance',v)}/>
      <Stepper label={t('悬挂软硬')} left={t('更软')} right={t('更硬')} value={opts.stiffness} onChange={v=>set('stiffness',v)}/>
    </div>
    {error?<div className="message error" role="alert"><CircleAlert size={17}/><span>{t(error)}</span></div>:null}
    {result?<div className="calc-result">
      <div className="calc-result-head"><h3>{t('{0}调校：{1} 项变化',[t(scenario[1]),result.changed.length])}</h3><div><button className="small-btn" disabled={working||busy} onClick={()=>libraryAction(()=>api.librarySaveCalc(car.id,opts),r=>r.duplicate?'调校库里已有相同的调校。':'已存入调校库。')}><BookmarkPlus size={15}/>{t('存入调校库')}</button><button className="primary" disabled={working||busy||!result.changed.length} onClick={()=>stage({garageId:car.id,source:{kind:'calculator'},options:opts},scenario[1])}>{working?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}{t('加入待写入')}</button></div></div>
      <CompareList car={car} values={result.values} keys={result.changed} t={t} fields={fields}/>
      <ul className="calc-notes">{result.notes.map(n=><li key={n}><Info size={13}/>{t(n)}</li>)}</ul>
    </div>:<div className="calc-loading"><LoaderCircle className="spin" size={18}/>{t('正在计算…')}</div>}
  </div>;
}
function Stepper({label,left,right,value,onChange}){
  return <div className="stepper"><span className="control-label">{label}</span><div role="radiogroup" aria-label={label}>{[-2,-1,0,1,2].map(v=><button key={v} role="radio" aria-checked={value===v} aria-label={`${label} ${v>0?'+':''}${v}`} className={value===v?'active':''} onClick={()=>onChange(v)}><i/></button>)}</div><small><span>{left}</span><span>{right}</span></small></div>;
}
function CompareList({car,values,keys,t,fields}){
  return <div className="compare-list">{ROWS.flatMap(r=>(r.keys||[]).filter(k=>keys.includes(k)).map(k=>{const f=fields.get(k);return <div key={k}><span>{t(r.label)}{r.keys.length>1?<small>{t(r.keys.indexOf(k)?'后轴':'前轴')}</small>:null}</span><s>{fmt(f,car.values?.[k])}</s><b><Roll value={fmt(f,values[k])}/></b></div>;}))}</div>;
}
function ApplyPanel({car,stage,working,library,libraryAction,api,t,cr,busy,select}){
  const entries=library.filter(e=>e.carId===car.carId);
  const [withBuild,setWithBuild]=useState(false);
  const sources=car.siblings.filter(s=>tunedState(s.tune)||s.partsValue>0);
  return <div className="bench-panel apply">
    <section><div className="apply-head"><h3>{t('同车型的其他车辆')}</h3><p>{t('复制调校时需要相同的变速箱；连同改装一起复制会带上变速箱，并按来源车辆的实际购买价计算花费。')}</p></div>
      {sources.length?<div className="source-list">{sources.map(s=><div className="source-row" key={s.id}><ClassChip car={s}/><span><b>#{s.id}</b><small>{t(TUNE_STATES[s.tune])} · {s.partsValue?cr(s.partsValue):t('未改装')}</small></span><div>
        <button className="small-btn" disabled={busy||working||!tunedState(s.tune)} onClick={()=>stage({garageId:car.id,source:{kind:'garage',garageId:s.id},tune:true,build:false},['复制 #{0} 的调校',[s.id]])}>{t('复制调校')}</button>
        <button className="small-btn" disabled={busy||working||!s.partsValue&&!tunedState(s.tune)} onClick={()=>stage({garageId:car.id,source:{kind:'garage',garageId:s.id},tune:tunedState(s.tune),build:true},['复制 #{0} 的调校与改装',[s.id]])}>{t('连同改装')}</button>
        <button className="text-btn" onClick={()=>select(s.id)}>{t('查看')}</button></div></div>)}</div>
      :<p className="quiet-empty">{car.siblings.length?t('同车型的其他车辆还没有调校或改装。'):t('车库里只有这一辆同款车。')}</p>}
    </section>
    <section><div className="apply-head"><h3>{t('调校库中的同车型记录')}</h3><p>{t('调校库保存在本机，可导出分享给其他 Festival Toolkit 用户。')}</p></div>
      {entries.length?<div className="source-list">{entries.map(e=><div className="source-row" key={e.id}><Chip label={CLASS_LABELS[e.classId]} pi={e.pi}/><span><b>{e.name}</b><small>{originLabel(e,t)}{e.hasBuild?` · ${t('含改装 {0}',[cr(e.partsValue)])}`:''}</small></span><div>
        <button className="small-btn" disabled={busy||working||!e.hasTune} onClick={()=>stage({garageId:car.id,source:{kind:'library',id:e.id},tune:true,build:false},e.name)}>{t('套用调校')}</button>
        {e.hasBuild?<button className="small-btn" disabled={busy||working} onClick={()=>stage({garageId:car.id,source:{kind:'library',id:e.id},tune:e.hasTune,build:true},e.name)}>{t('连同改装')}</button>:null}</div></div>)}</div>
      :<p className="quiet-empty">{t('还没有这款车的记录。下面可以把当前调校存进去，或在“场景计算”里生成一套。')}</p>}
    </section>
    <section className="apply-own"><div className="apply-head"><h3>{t('这辆车自己的调校')}</h3></div>
      <div className="apply-actions">
        <label className="check-line"><input type="checkbox" checked={withBuild} onChange={e=>setWithBuild(e.target.checked)}/>{t('同时保存改装方案（{0}）',[cr(car.partsValue)])}</label>
        <button className="small-btn" disabled={busy||working||(!car.values&&!withBuild)} onClick={()=>libraryAction(()=>api.libraryCapture(car.id,{build:withBuild}),r=>r.duplicate?'调校库里已有相同的调校。':'已存入调校库。')}><BookmarkPlus size={15}/>{t('存入调校库')}</button>
        <button className="small-btn" disabled={busy||working||!car.values} onClick={()=>stage({garageId:car.id,source:{kind:'reset'}},'恢复原厂调校')}><RotateCcw size={15}/>{t('恢复原厂调校')}</button>
      </div>
    </section>
  </div>;
}
const originLabel=(e,t)=>e.origin==='calculator'?t('场景计算 · {0}',[t((SCENARIOS.find(s=>s[0]===e.scenario)||[])[1]||'')]):e.imported?t('导入'):t(TUNE_STATES[e.origin]||'本地调校');
function BuildPanel({car,meta,t,cr}){
  const groups=Object.keys(SLOT_GROUPS),upgraded=car.build.filter(s=>s.upgraded).length,unknownStock=car.build.every(s=>s.stock===null);
  return <div className="bench-panel build">
    <div className="build-summary"><div><span>{t('改装花费')}</span><b>{cr(car.partsValue)}</b></div><div><span>{t('已购部件')}</span><b>{car.purchases.length}</b></div><div><span>{t('已升级槽位')}</span><b>{unknownStock?'—':upgraded}</b></div><p>{t('花费等于存档里每个已购部件的实际成交价之和，换下的旧部件也算在内。部件以存档编号显示。')}</p></div>
    <div className="slot-groups">{groups.map(g=><section key={g}><h3>{t(SLOT_GROUPS[g])}</h3><ul>{car.build.filter(s=>s.group===g&&s.available).map(s=><li key={s.col} className={s.upgraded?'upgraded':''}><span>{t(SLOT_NAMES[s.col]||s.col)}</span><small>{s.upgraded?t('已升级'):s.stock===null?t('已安装'):t('原厂')}</small><code>{s.part}</code></li>)}</ul></section>)}</div>
    {car.purchases.length?<details className="purchase-log"><summary><Coins size={15}/>{t('已购部件记录（{0}）',[car.purchases.length])}</summary><table><thead><tr><th>{t('槽位')}</th><th>{t('部件编号')}</th><th>{t('成交价')}</th><th>{t('状态')}</th></tr></thead><tbody>{car.purchases.map((p,i)=><tr key={i}><td>{t(SLOT_NAMES[p.col]||`#${p.slot}`)}</td><td>{p.part}</td><td>{cr(p.price)}</td><td>{p.installed?t('已安装'):t('库存')}</td></tr>)}</tbody></table></details>:null}
  </div>;
}
function Community({car,api,t}){
  const [state,setState]=useState({loading:true}),[slug,setSlug]=useState(null),[tunes,setTunes]=useState(null),[copied,setCopied]=useState('');
  useEffect(()=>{let live=true;setState({loading:true});setTunes(null);setSlug(null);api.communitySearch({make:car.make,name:car.name,year:car.year}).then(r=>{if(!live)return;setState({candidates:r.candidates,maker:r.maker});if(r.candidates[0]?.score>=8)setSlug(r.candidates[0].slug);}).catch(e=>live&&setState({error:e.message}));return ()=>{live=false;};},[car.carId]);
  useEffect(()=>{if(!slug)return;let live=true;setTunes({loading:true});api.communityTunes(slug).then(r=>live&&setTunes(r)).catch(e=>live&&setTunes({error:e.message}));return ()=>{live=false;};},[slug]);
  const copy=async code=>{try{await api.copyShareCode(code);setCopied(code);setTimeout(()=>setCopied(c=>c===code?'':c),1800);}catch{setCopied('');}};
  return <div className="bench-panel community">
    <div className="community-howto"><Info size={17}/><p>{t('社区调校以分享码发布，完整参数只在游戏服务器上。在游戏的“升级与调校 → 寻找调校设置”输入分享码下载并装上，退出游戏后重新连接存档，就能在这里收藏它，或复制到同车型的其他车辆。')}</p></div>
    {state.loading?<div className="calc-loading"><LoaderCircle className="spin" size={18}/>{t('正在搜索 CODMunity…')}</div>:null}
    {state.error?<div className="message error" role="alert"><CircleAlert size={17}/><span>{t(state.error)}</span></div>:null}
    {state.candidates?<div className="community-match"><span>{t('匹配车型')}</span>{state.candidates.length?state.candidates.slice(0,5).map(c=><button key={c.slug} className={slug===c.slug?'active':''} aria-pressed={slug===c.slug} onClick={()=>setSlug(c.slug)}>{c.name}<small>{c.year}</small></button>):<em>{t('CODMunity 上没有找到这个品牌。')}</em>}</div>:null}
    {state.candidates&&!slug&&state.candidates.length?<p className="quiet-empty">{t('没有完全一致的车型，请从上面选择最接近的一款。')}</p>:null}
    {tunes?.loading?<div className="calc-loading"><LoaderCircle className="spin" size={18}/>{t('正在读取分享码…')}</div>:null}
    {tunes?.error?<div className="message error" role="alert"><CircleAlert size={17}/><span>{t(tunes.error)}</span></div>:null}
    {tunes?.tunes?<>
      <div className="community-head"><h3>{tunes.title}</h3><button className="text-btn" onClick={()=>api.openCommunity(tunes.url)}><ExternalLink size={14}/>{t('在 CODMunity 打开')}</button></div>
      {tunes.tunes.length?<div className="share-list">{tunes.tunes.map(x=><article key={x.shareCode} className="share-row">
        <div className="share-what"><b>{t(PLAYSTYLES[x.playstyle?.replace(/\s*\(.*\)$/,'')]||x.playstyle||'未分类')}{/\((\w+)\)/.test(x.playstyle||'')?<small>{/\((\w+)\)/.exec(x.playstyle)[1]}</small>:null}</b>{x.classLabel?<ClassChip car={{classLabel:x.classLabel,pi:x.pi??''}}/>:null}{x.author?<span>{t('作者 {0}',[x.author])}</span>:<span>{x.kind==='community'?t('社区提交'):''}</span>}</div>
        {x.stats?.top?<dl className="share-stats">{[['speed','速度'],['handling','操控'],['launch','起步'],['braking','刹车'],['offroad','越野']].filter(([k])=>x.stats[k]).map(([k,l])=><div key={k}><dt>{t(l)}</dt><dd>{x.stats[k]}</dd></div>)}</dl>:<span/>}
        <button className={`share-code ${copied===x.shareCode?'copied':''}`} onClick={()=>copy(x.shareCode)} aria-label={t('复制分享码 {0}',[x.shareCode])}><span>{x.shareCode.replace(/(\d{3})(?=\d)/g,'$1 ')}</span>{copied===x.shareCode?<Check size={15}/>:<Copy size={15}/>}</button>
      </article>)}</div>:<p className="quiet-empty">{t('这款车暂时没有公开的分享码。')}</p>}
      <p className="subtle-note">{t('数据来自 codmunity.gg 公开页面，仅在你打开此页时联网读取并缓存 6 小时。')}</p>
    </>:null}
  </div>;
}
function LibraryView({library,setLibrary,garage,api,busy,libraryAction,problem,note,t,locale,cr,open}){
  const [query,setQuery]=useState(''),[renaming,setRenaming]=useState(null),[name,setName]=useState(''),input=useRef(null);
  useEffect(()=>{if(renaming)input.current?.focus();},[renaming]);
  const q=query.trim().toLowerCase(),list=library.filter(e=>!q||`${e.name} ${e.make} ${e.car} ${e.year} ${e.carId}`.toLowerCase().includes(q));
  const owned=id=>garage?.cars.find(c=>c.carId===id);
  return <section className="library">
    <div className="library-tools"><label className="search-input"><Search size={17}/><input aria-label={t('搜索调校库')} placeholder={t('名称、车型或年份')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <button className="small-btn" disabled={busy} onClick={()=>libraryAction(()=>api.libraryImport(),r=>r?t('导入 {0} 条，跳过 {1} 条重复记录。',[r.added,r.skipped]):'')}><Upload size={15}/>{t('导入调校包')}</button>
      <button className="small-btn" disabled={busy||!library.length} onClick={()=>libraryAction(async()=>{const r=await api.libraryExport();return r;},r=>r?t('已导出 {0} 条到 {1}',[r.count,r.file]):'')}><Download size={15}/>{t('导出全部')}</button></div>
    {problem?<div className="message error" role="alert"><CircleAlert size={17}/><span>{t(problem)}</span></div>:null}
    {note?<div className="message success" role="status"><Check size={17}/><span>{t(note)}</span></div>:null}
    {list.length?<div className="library-list">{list.map(e=>{const car=owned(e.carId);return <article key={e.id} className="library-row">
      <Chip label={CLASS_LABELS[e.classId]} pi={e.pi}/>
      <div className="library-name">{renaming===e.id?<form onSubmit={ev=>{ev.preventDefault();libraryAction(()=>api.libraryUpdate(e.id,{name}));setRenaming(null);}}><input ref={input} value={name} maxLength={80} onChange={ev=>setName(ev.target.value)} aria-label={t('调校名称')} onKeyDown={ev=>ev.key==='Escape'&&setRenaming(null)}/><button className="small-btn" type="submit" disabled={!name.trim()}>{t('保存')}</button></form>:<b>{e.name}</b>}<small>{e.make} {e.car} {e.year??''}</small></div>
      <div className="library-tags"><span>{originLabel(e,t)}</span>{e.hasTune?<span>{t('调校')}</span>:null}{e.hasBuild?<span>{t('改装 {0}',[cr(e.partsValue)])}</span>:null}<time>{new Date(e.created).toLocaleDateString(locale==='zh'?'zh-CN':'en-US')}</time></div>
      <div className="library-actions"><button className="small-btn" disabled={!car} title={car?'':t('车库里没有这款车')} onClick={()=>open(car.id)}><CarFront size={15}/>{car?t('去套用'):t('车库无此车')}</button><button className="icon-btn" aria-label={t('重命名')} onClick={()=>{setRenaming(e.id);setName(e.name);}}><Pencil size={15}/></button><button className="icon-btn danger" aria-label={t('删除 {0}',[e.name])} disabled={busy} onClick={()=>libraryAction(()=>api.libraryRemove(e.id),'已从调校库删除。')}><Trash2 size={15}/></button></div>
    </article>;})}</div>
    :<div className="library-empty"><Library size={30} strokeWidth={1.4}/><h3>{library.length?t('没有匹配的记录'):t('调校库还是空的')}</h3><p>{library.length?t('换个关键词试试。'):t('在车辆的“套用与复制”里保存当前调校，或在“场景计算”里生成一套存进来。也可以导入别人分享的调校包。')}</p></div>}
  </section>;
}
