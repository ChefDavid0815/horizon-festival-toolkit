import {useState,useMemo,useEffect} from 'react';
import {Compass,Check,CheckCheck,Search,ChevronRight,ChevronLeft,Sparkles,Award,MapPin,Flag,RotateCcw} from 'lucide-react';
import {useI18n} from './Language.jsx';
import {Seal,Roll,PageHead} from './ui.jsx';
const colors={1:'#e8c93a',5:'#ec8a3f',2:'#7fb04a',3:'#4f9cc4',6:'#8f6bc9',4:'#e0679f',7:'#b8974a'};
const order=[1,5,2,3,6,4,7];
export default function Journey({catalog,summary,queue,setQueue,wristQueue,setWristQueue,busy,diagnose}){
  const {t,locale}=useI18n(),[path,setPath]=useState('discovery'),[category,setCategory]=useState(null),[query,setQuery]=useState(''),[page,setPage]=useState(0),[filter,setFilter]=useState('all');
  const journey=summary?.journey,loaded=!!summary;
  const campaigns=journey?.campaigns.length?journey.campaigns:catalog?.campaigns||[];
  const categories=journey?.categories.length?journey.categories:(catalog?.categories||[]).map(c=>({...c,total:c.items.length,completed:0,items:c.items.map(id=>catalog.items.find(i=>i.id===id))}));
  const campaign=campaigns.find(c=>c.key===path),availableCategories=categories.filter(c=>campaign?.categories.includes(c.id));
  const current=availableCategories.find(c=>c.id===category)||availableCategories[0];
  const selected=new Set(queue),bands=new Set(wristQueue);
  const label=v=>v?.[locale]||v?.en||'';
  const canEdit=loaded&&!journey?.collectionError&&!busy;
  const matching=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return (current?.items||[]).filter(i=>(!q||[label(i.name),label(i.description),i.id].join(' ').toLocaleLowerCase().includes(q))&&(filter!=='remaining'||!i.complete)&&(filter!=='selected'||selected.has(i.id)));},[current,query,filter,queue,locale]);
  useEffect(()=>setPage(0),[query,filter,category,path,summary]);
  const pages=Math.max(1,Math.ceil(matching.length/36)),activePage=Math.min(page,pages-1),shown=matching.slice(activePage*36,(activePage+1)*36);
  const add=items=>setQueue(q=>[...new Set([...q,...items.filter(i=>i.available&&!i.complete).map(i=>i.id)])]);
  const toggle=id=>setQueue(q=>q.includes(id)?q.filter(x=>x!==id):[...q,id]);
  const pathItems=availableCategories.flatMap(c=>c.items),pending=pathItems.filter(i=>selected.has(i.id)).length;
  const percent=campaign?.total?Math.round(100*campaign.completed/campaign.total):0;
  return <div className="journey">
    <PageHead title={t('让旅途，完整绽放')} sub={t('探索日本、点亮嘉年华，把每一份热爱收入收藏手册。')}>
      <button className="small-btn" disabled={!canEdit||!!journey?.wristbandError} onClick={()=>{add(categories.flatMap(c=>c.items));setWristQueue((journey?.wristbands||[]).filter(w=>!w.owned).map(w=>w.id))}}><CheckCheck size={15}/>{t('拉满全部旅程')}</button>
    </PageHead>
    <div className="tabs" role="tablist" aria-label={t('旅程分类')}>
      {[['discovery','DISCOVER JAPAN',Compass],['festival',t('地平线嘉年华'),Flag],['wristbands',t('腕带收藏'),Award]].map(([key,name,Icon])=><button role="tab" aria-selected={path===key} key={key} className={path===key?'active':''} onClick={()=>{setPath(key);setQuery('');setFilter('all')}}><Icon size={16}/><span>{name}</span></button>)}
    </div>
    {path!=='wristbands'?<>
      <dl className="field-row">
        <div className="field"><dt className="field-tab">{t('收藏完成度')}</dt><dd><Roll value={loaded?percent:'—'}/><small>%</small></dd><div className="rule-meter" aria-hidden="true"><i style={{transform:`scaleX(${loaded?percent/100:0})`}}/></div></div>
        <div className="field"><dt className="field-tab">{label(campaign?.name)||t('项目')}</dt><dd><Roll value={loaded?(campaign?.completed??'—'):'—'}/><small> / {campaign?.total??pathItems.length}</small></dd><small>{t('{0} 个分类',[availableCategories.length])}</small></div>
        <div className="field"><dt className="field-tab">{t('积分')}</dt><dd><Roll value={loaded?(campaign?.points??0).toLocaleString():'—'}/></dd><small>/ {campaign?.max?.toLocaleString()} PTS</small></div>
        <div className={`field action-field ${pending?'staged':''}`}><dt className="field-tab">{t('本路线')}</dt><dd><Roll value={pending}/><small> {t('项待写入')}</small></dd><button className="small-btn" disabled={!canEdit} onClick={()=>add(pathItems)}><Sparkles size={15}/>{t('拉满整个进度')}</button></div>
      </dl>
      {journey?.collectionError?<div className="message error" role="alert"><span>{t(journey.collectionError)}</span><button className="text-btn" onClick={diagnose} disabled={busy}>{t('导出诊断信息')}</button></div>:null}
      {journey?.unknownItems?.count||journey?.unknownItems?.revised?<p className="assurance"><MapPin size={16}/><span>{journey.unknownItems.count?t('存档中有 {0} 个新收藏项目（来自游戏更新），已原样保留，不会被修改；其余项目可以正常编辑。',[journey.unknownItems.count]):''}{journey.unknownItems.revised?` ${t('另有 {0} 个项目被游戏更新修订过，仅显示，不可编辑。',[journey.unknownItems.revised])}`:''}</span></p>:null}
      {!loaded?<p className="assurance"><MapPin size={16}/><span>{t('连接存档后显示真实进度，并可选择要拉满的项目。')}</span></p>:null}
      <div className="journal-layout">
        <aside className="index-list" aria-label={t('进度分类')}><h2 className="panel-tab">{t('收藏目录')}<span>{availableCategories.length}</span></h2>
          {availableCategories.map(c=>{const queued=c.items.filter(i=>selected.has(i?.id)).length;return <button key={c.id} className={current?.id===c.id?'active':''} aria-current={current?.id===c.id?'true':undefined} onClick={()=>{setCategory(c.id);setQuery('')}}><span className="index-title">{label(c.name)}<small>{loaded?`${c.completed} / ${c.total}`:t('{0} 项',[c.total])}</small></span><span className="mini-meter" aria-hidden="true"><i style={{transform:`scaleX(${loaded&&c.total?c.completed/c.total:0})`}}/></span>{queued?<em>{queued}</em>:null}</button>;})}
        </aside>
        <section className="sheet journal-panel" key={current?.id}>
          <div className="sheet-head"><div><h2>{label(current?.name)}</h2><p>{loaded?`${current?.points?.toLocaleString()??'—'} / ${current?.max?.toLocaleString()} PTS`:t('等待连接存档')}</p></div><button className="small-btn" disabled={!canEdit} onClick={()=>add(current?.items||[])}><CheckCheck size={16}/>{t('拉满此分类')}</button></div>
          <div className="toolbar compact"><label className="search-input"><Search size={17}/><input aria-label={t('搜索进度项目')} placeholder={t('搜索项目、挑战或地点')} value={query} onChange={e=>setQuery(e.target.value)}/>{query?<button onClick={()=>setQuery('')} aria-label={t('清空搜索')}>×</button>:null}</label><select aria-label={t('进度筛选')} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t('全部项目')}</option><option value="remaining">{t('未完成')}</option><option value="selected">{t('已选择')}</option></select></div>
          <div className="list-caption"><span>{t('共 {0} 项',[matching.length])}</span><button className="text-btn" onClick={()=>add(matching)} disabled={!canEdit||!matching.length}>{t('选择筛选结果')}</button></div>
          <div className="journal-items">{shown.map((item,i)=><button style={{'--i':Math.min(i,12)}} key={item.id} className={`journal-item ${selected.has(item.id)?'selected':''} ${item.complete?'complete':''}`} aria-pressed={selected.has(item.id)} aria-label={`${t('选择项目')} ${label(item.description)||label(item.name)}`} disabled={!canEdit||!item.available||item.complete} onClick={()=>toggle(item.id)}>
            <span className="check-box" aria-hidden="true">{item.complete?<Check size={14}/>:selected.has(item.id)?<Seal glyph="改"/>:null}</span>
            <span className="journal-copy"><strong>{label(item.name)}</strong><small>{label(item.description)||item.id}</small></span>
            <span className="journal-score"><b>+{item.points}</b><small>{item.complete?t('已完成'):selected.has(item.id)?t('待应用'):loaded?t('未完成'):t('未连接')}</small></span>
          </button>)}</div>
          {!shown.length?<div className="empty"><Search size={26} strokeWidth={1.4}/><p>{t('没有匹配的进度项目')}</p></div>:null}
          <div className="pagination"><span/><button className="icon-btn" aria-label={t('上一页')} disabled={!activePage} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={15}/></button><b>{activePage+1} / {pages}</b><button className="icon-btn" aria-label={t('下一页')} disabled={activePage+1>=pages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={15}/></button></div>
        </section>
      </div>
    </>:<section className="wristbands">
      <div className="sheet-head plain"><div><h2>{t('七种色彩，一段传奇。')}</h2><p>{t('读取腕带持有记录，选择单条腕带或一次补齐全部颜色。')}</p></div><button className="small-btn" disabled={!loaded||busy||!!journey?.wristbandError} onClick={()=>setWristQueue((journey?.wristbands||[]).filter(w=>!w.owned).map(w=>w.id))}><Sparkles size={16}/>{t('补齐全部腕带')}</button></div>
      {journey?.wristbandError?<div className="message error">{t(journey.wristbandError)}</div>:null}
      <div className="wristband-grid">{order.map((id,i)=>{const band=journey?.wristbands.find(w=>w.id===id)||catalog?.wristbands.find(w=>w.id===id);return <button key={id} className={`wristband ${bands.has(id)?'selected':''} ${band?.owned?'owned':''}`} style={{'--band':colors[id],'--i':i}} disabled={!loaded||busy||!!journey?.wristbandError||band?.owned} onClick={()=>setWristQueue(q=>q.includes(id)?q.filter(x=>x!==id):[...q,id])} aria-pressed={bands.has(id)} aria-label={`${t('选择腕带')} ${t(band?.name||'')}`}>
        {bands.has(id)?<Seal glyph="改" className="card-seal"/>:null}
        <span className="band-strip" aria-hidden="true"><i/></span>
        <strong>{t(band?.name||'')}</strong>
        <small>{band?.owned?<><Check size={13}/>{t('已拥有')}</>:bands.has(id)?t('待应用'):loaded?t('未拥有'):t('未连接')}</small>
      </button>})}</div>
      <p className="subtle-note">{t('腕带持有记录与赛事资格、剧情解锁是不同记录；此处只修改腕带持有记录。')}</p>
    </section>}
    <div className="page-foot"><span>{t('编辑收藏记录与积分；游戏内奖励及解锁效果仍需验证。')}</span><button className="text-btn" disabled={busy||(!queue.length&&!wristQueue.length)} onClick={()=>{setQueue([]);setWristQueue([])}}><RotateCcw size={13}/>{t('清空进度选择')}</button></div>
  </div>;
}
