import {useDeferredValue, useMemo, useState} from 'react';
import {CarFront, Search, Plus, Minus, ChevronLeft, ChevronRight, Layers, X} from 'lucide-react';
import {useI18n} from './Language.jsx';
import {Seal, Roll, PageHead} from './ui.jsx';
export const makeAliases={Toyota:'丰田',Lexus:'雷克萨斯',Honda:'本田',Nissan:'日产',Mazda:'马自达',Subaru:'斯巴鲁',Mitsubishi:'三菱',Suzuki:'铃木',BMW:'宝马',Audi:'奥迪',Porsche:'保时捷',Ferrari:'法拉利',Lamborghini:'兰博基尼',McLaren:'迈凯伦',Bugatti:'布加迪',Ford:'福特',Chevrolet:'雪佛兰',Dodge:'道奇',Jeep:'吉普',Hyundai:'现代',Kia:'起亚',Volkswagen:'大众',Bentley:'宾利',MINI:'迷你',Mercedes:'奔驰',MercedesBenz:'奔驰',MercedesAMG:'奔驰',AstonMartin:'阿斯顿马丁',LandRover:'路虎',Lotus:'路特斯 莲花',Peugeot:'标致',Renault:'雷诺',Volvo:'沃尔沃',Koenigsegg:'科尼赛克'};
// Catalog names come from compact media names ("TacomaTRDProFE"); space them for reading, search still uses the raw name.
export const prettyName=n=>String(n).replace(/([a-z])([A-Z0-9])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2');
export const CLASS_LABELS=['D','C','B','A','S1','S2','R','X'];
export const CLASS_COLORS={D:'#4fb6dc',C:'#e9c22c',B:'#f08a3c',A:'#e0434b',S1:'#9c55cf',S2:'#3a66dc',R:'#169d93',X:'#38b85c'};
export function ClassChip({label,pi}){return <span className="class-chip" style={{'--class':CLASS_COLORS[label]||'#9aa58f'}}><b>{label||'—'}</b>{pi??'—'}</span>;}
const PAGE=18;
export default function Garage({cars,summary,queue,setQueue,allCars,setAllCars,busy}){
  const {t}=useI18n(),[query,setQuery]=useState(''),[make,setMake]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0);
  const search=useDeferredValue(query.trim().toLowerCase()),counts=summary?.garage?.counts||{};
  const makes=useMemo(()=>[...new Set(cars.map(c=>c.make))].sort(),[cars]);
  const filtered=useMemo(()=>cars.filter(c=>(!make||c.make===make)&&(!search||search.split(/\s+/).every(s=>`${c.make} ${makeAliases[c.make]||''} ${c.name} ${c.year} ${c.id} ${c.media}`.toLowerCase().includes(s)))&&(filter==='all'||(filter==='owned'?!!counts[c.id]:!counts[c.id]))),[cars,search,make,filter,counts]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE)),currentPage=Math.min(page,pages-1),visible=filtered.slice(currentPage*PAGE,(currentPage+1)*PAGE);
  const quantity=queue.reduce((n,c)=>n+c.quantity,0),garage=summary?.garage;
  function change(id,delta){setAllCars(false);setQueue(old=>{const n=old.find(c=>c.id===id)?.quantity||0;const next=Math.max(0,Math.min(20,n+delta));return next?old.some(c=>c.id===id)?old.map(c=>c.id===id?{id,quantity:next}:c):[...old,{id,quantity:next}]:old.filter(c=>c.id!==id);});}
  return <div className="garage">
    <PageHead title={t('把梦想，开进车库')} sub={t('搜索车型，添加单辆库存，或一次补齐尚未拥有的车辆。')}>
      <button className={`small-btn ${allCars?'staged':''}`} disabled={busy||!!summary?.garageError} aria-pressed={allCars} onClick={()=>{setAllCars(!allCars);setQueue([]);}}><Layers size={16}/>{allCars?t('已选择补齐全车'):t('一键补齐全车')}</button>
    </PageHead>
    <dl className="field-row">
      <div className="field"><dt className="field-tab">{t('可用车型')}</dt><dd><Roll value={cars.length}/></dd><small>{t('目录仅收录已安装、可驾驶且具备原厂部件数据的车辆。')}</small></div>
      <div className="field"><dt className="field-tab">{t('已收藏车型')}</dt><dd><Roll value={garage?.ownedCatalog??'—'}/></dd><small>{garage?t('还差 {0} 款',[garage.missing.length]):t('连接后查看库存')}</small></div>
      <div className="field"><dt className="field-tab">{t('当前库存')}</dt><dd><Roll value={garage?.total??'—'}/><small> / {garage?.capacity??2000}</small></dd><div className="rule-meter" aria-hidden="true"><i style={{transform:`scaleX(${garage?garage.total/garage.capacity:0})`}}/></div></div>
      <div className={`field ${quantity||allCars?'staged':''}`}><dt className="field-tab">{t('待添加')}</dt><dd><Roll value={allCars?(garage?.missing.length??'—'):quantity}/></dd><small>{allCars?t('补齐模式会跳过已拥有车型'):t('每款最多添加 20 辆')}</small></div>
    </dl>
    {summary?.garageError?<div className="message error" role="alert">{t(summary.garageError)}</div>:null}
    <div className="toolbar">
      <label className="search-input"><Search size={18}/><input aria-label={t('搜索车辆')} placeholder={t('搜索车型、品牌、年份或车辆 ID…')} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>{query?<button aria-label={t('清空搜索')} onClick={()=>setQuery('')}><X size={16}/></button>:null}</label>
      <select aria-label={t('品牌')} value={make} onChange={e=>{setMake(e.target.value);setPage(0);}}><option value="">{t('所有品牌')}</option>{makes.map(m=><option key={m}>{m}</option>)}</select>
      <div className="segmented" role="group" aria-label={t('收藏筛选')}>{[['all','全部'],['missing','未拥有'],['owned','已拥有']].map(([id,label])=><button key={id} aria-pressed={filter===id} disabled={!summary&&id!=='all'} className={filter===id?'active':''} onClick={()=>{setFilter(id);setPage(0);}}>{t(label)}</button>)}</div>
    </div>
    <div className="list-caption"><span>{t('找到 {0} 款车型',[filtered.length])}</span><button className="text-btn" disabled={busy||(!queue.length&&!allCars)} onClick={()=>{setQueue([]);setAllCars(false);}}>{t('清空车辆选择')}</button></div>
    {visible.length?<div className="car-grid">{visible.map((c,i)=>{const q=queue.find(x=>x.id===c.id)?.quantity||0,owned=counts[c.id]||0,label=CLASS_LABELS[c.classId];return <article className={`car-card ${q?'selected':''}`} key={c.id} style={{'--i':i}}>
      {q?<Seal glyph="改" className="card-seal"/>:null}
      <div className="car-mark" aria-hidden="true"><b>{c.make.slice(0,3).toUpperCase()}</b><small>{c.year}</small></div>
      <div className="car-copy"><span className="car-make">{c.make} <i>#{c.id}</i></span><h3 title={c.name}>{prettyName(c.name)}</h3><div className="car-meta"><ClassChip label={label} pi={Math.round(c.pi)}/><span>{summary?(owned?t('已拥有 {0} 辆',[owned]):t('未拥有')):t('连接后查看库存')}</span></div></div>
      <div className="stepper-inline">{q?<><button aria-label={t('减少 {0}',[c.name])} onClick={()=>change(c.id,-1)} disabled={busy}><Minus size={15}/></button><b aria-live="polite"><Roll value={q}/></b></>:null}<button className={q?'more':'add'} aria-label={t('添加 {0}',[c.name])} disabled={busy||q>=20||!!summary?.garageError} onClick={()=>change(c.id,1)}><Plus size={15}/>{q?null:<span>{t('添加')}</span>}</button></div>
    </article>;})}</div>:<div className="empty"><Search size={30} strokeWidth={1.4}/><h3>{t('没有找到匹配车型')}</h3><p>{t('试试品牌、英文车型名或年份，也可以同步最新车辆目录。')}</p></div>}
    <div className="pagination"><span>{t('每款最多添加 20 辆；全车模式仅补齐缺失车型。')}</span><button className="icon-btn" aria-label={t('上一页')} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={16}/></button><b>{currentPage+1} / {pages}</b><button className="icon-btn" aria-label={t('下一页')} disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)}><ChevronRight size={16}/></button></div>
  </div>;
}
