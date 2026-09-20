import {useDeferredValue, useMemo, useState} from 'react';
import {CarFront, Search, Plus, Minus, Check, ArrowUpRight, ChevronLeft, ChevronRight, Layers, X} from 'lucide-react';
import {useI18n} from './Language.jsx';
const makeAliases={Toyota:'丰田',Lexus:'雷克萨斯',Honda:'本田',Nissan:'日产',Mazda:'马自达',Subaru:'斯巴鲁',Mitsubishi:'三菱',Suzuki:'铃木',BMW:'宝马',Audi:'奥迪',Porsche:'保时捷',Ferrari:'法拉利',Lamborghini:'兰博基尼',McLaren:'迈凯伦',Bugatti:'布加迪',Ford:'福特',Chevrolet:'雪佛兰',Dodge:'道奇',Jeep:'吉普',Hyundai:'现代',Kia:'起亚',Volkswagen:'大众',Bentley:'宾利',MINI:'迷你',Mercedes:'奔驰',MercedesBenz:'奔驰',MercedesAMG:'奔驰',AstonMartin:'阿斯顿马丁',LandRover:'路虎',Lotus:'路特斯 莲花',Peugeot:'标致',Renault:'雷诺',Volvo:'沃尔沃',Koenigsegg:'科尼赛克'};
export default function Garage({cars,summary,queue,setQueue,allCars,setAllCars,busy}){
  const {t}=useI18n(),[query,setQuery]=useState(''),[make,setMake]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0);
  const search=useDeferredValue(query.trim().toLowerCase()),counts=summary?.garage?.counts||{};
  const makes=useMemo(()=>[...new Set(cars.map(c=>c.make))].sort(),[cars]);
  const filtered=useMemo(()=>cars.filter(c=>(!make||c.make===make)&&(!search||search.split(/\s+/).every(s=>`${c.make} ${makeAliases[c.make]||''} ${c.name} ${c.year} ${c.id} ${c.media}`.toLowerCase().includes(s)))&&(filter==='all'||(filter==='owned'?!!counts[c.id]:!counts[c.id]))),[cars,search,make,filter,counts]);
  const pages=Math.max(1,Math.ceil(filtered.length/16)),currentPage=Math.min(page,pages-1),visible=filtered.slice(currentPage*16,(currentPage+1)*16);
  const quantity=queue.reduce((n,c)=>n+c.quantity,0);
  function change(id,delta){setAllCars(false);setQueue(old=>{const n=old.find(c=>c.id===id)?.quantity||0;const next=Math.max(0,Math.min(20,n+delta));return next?old.some(c=>c.id===id)?old.map(c=>c.id===id?{id,quantity:next}:c):[...old,{id,quantity:next}]:old.filter(c=>c.id!==id);});}
  return <div className="view-enter">
    <section className="page-intro"><div><div className="eyebrow">THE NEXT CAR IS YOURS.</div><h1>{t('把梦想，开进车库')}<span>{t('。')}</span></h1><p>{t('搜索车型，添加单辆库存，或一次补齐尚未拥有的车辆。')}</p></div><span className="edition-pill">GARAGE / V0.2</span></section>
    <section className="garage-hero">
      <div className="garage-hero-copy"><span className="label-pink">CURATE YOUR COLLECTION</span><h2>{t('下一辆，心之所向。')}</h2><p>{t('目录仅收录已安装、可驾驶且具备原厂部件数据的车辆。')}</p><button className={`small-btn ${allCars?'chosen':''}`} disabled={busy||!!summary?.garageError} onClick={()=>{setAllCars(!allCars);setQueue([]);}}><Layers size={17}/>{allCars?t('已选择补齐全车'):t('一键补齐全车')}<ArrowUpRight size={17}/></button></div>
      <div className="collection-stats"><div><b>{cars.length}</b><span>{t('辆可用车型')}</span></div><div><b>{summary?.garage?.ownedCatalog??'—'}</b><span>{t('已收藏车型')}</span></div><div><b>{summary?.garage?.total??'—'}</b><span>{t('当前库存')}</span></div></div>
      <CarFront className="hero-car" size={164} strokeWidth={.8}/>
    </section>
    {summary?.garageError?<div className="message error" role="alert">{t(summary.garageError)}</div>:null}
    <div className="garage-toolbar"><label className="search-input"><Search size={19}/><input aria-label={t('搜索车辆')} placeholder={t('搜索车型、品牌、年份或车辆 ID…')} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>{query?<button aria-label={t('清空搜索')} onClick={()=>setQuery('')}><X size={16}/></button>:null}</label>
      <select aria-label={t('品牌')} value={make} onChange={e=>{setMake(e.target.value);setPage(0);}}><option value="">{t('所有品牌')}</option>{makes.map(m=><option key={m}>{m}</option>)}</select>
      <div className="segmented" aria-label={t('收藏筛选')}>{[['all','全部'],['missing','未拥有'],['owned','已拥有']].map(([id,label])=><button key={id} aria-pressed={filter===id} disabled={!summary&&id!=='all'} className={filter===id?'active':''} onClick={()=>{setFilter(id);setPage(0);}}>{t(label)}</button>)}</div>
    </div>
    <div className="section-label"><span>{t('找到 {0} 款车型',[filtered.length])}</span><span>{allCars?t('补齐模式会跳过已拥有车型'):t('已选 {0} 辆库存',[quantity])}</span><button className="text-btn" disabled={busy||(!queue.length&&!allCars)} onClick={()=>{setQueue([]);setAllCars(false);}}>{t('清空车辆选择')}</button></div>
    {visible.length?<div className="car-grid">{visible.map(c=>{const q=queue.find(x=>x.id===c.id)?.quantity||0,owned=counts[c.id]||0;return <article className={`car-card ${q?'selected':''}`} key={c.id}>
      <div className="car-mark"><span>{c.make.slice(0,3).toUpperCase()}</span><CarFront size={32} strokeWidth={1.3}/><small>{c.year}</small></div>
      <div className="car-copy"><div className="car-make">{c.make} <span>#{c.id}</span></div><h3 title={c.name}>{c.name}</h3><div className="car-meta"><span className="pi-badge">{['D','C','B','A','S1','S2','X'][c.classId]||'PI'} {Math.round(c.pi)}</span><span>{summary?(owned?t('已拥有 {0} 辆',[owned]):t('未拥有')):t('连接后查看库存')}</span></div></div>
      <div className="car-add">{q?<><button aria-label={t('减少 {0}',[c.name])} onClick={()=>change(c.id,-1)} disabled={busy}><Minus size={15}/></button><b aria-live="polite">{q}</b></>:null}<button className={q?'selected':''} aria-label={t('添加 {0}',[c.name])} disabled={busy||q>=20||!!summary?.garageError} onClick={()=>change(c.id,1)}>{q?<Plus size={15}/>:<><Plus size={16}/><span>{t('添加')}</span></>}</button></div>
    </article>;})}</div>:<div className="empty search-empty"><Search size={32}/><h3>{t('没有找到匹配车型')}</h3><p>{t('试试品牌、英文车型名或年份，也可以同步最新车辆目录。')}</p></div>}
    <div className="pagination"><span>{t('每款最多添加 20 辆；全车模式仅补齐缺失车型。')}</span><button className="small-btn" aria-label={t('上一页')} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={16}/></button><b>{currentPage+1} / {pages}</b><button className="small-btn" aria-label={t('下一页')} disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)}><ChevronRight size={16}/></button></div>
  </div>;
}
