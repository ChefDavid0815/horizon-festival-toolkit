import {useEffect,useState} from 'react';
import {RefreshCw, FolderOpen, Download, Upload, Radio, CheckCircle2, Database, ArrowUpRight} from 'lucide-react';
import {useI18n} from './Language.jsx';
import ReleaseCenter from './ReleaseCenter.jsx';
export default function Updates({state,busy,api,action,accept,notice,releases,setReleases,showRelease}){
  const {t,locale}=useI18n(),[config,setConfig]=useState(state?.syncSettings||{gamePath:'',autoSync:false,allowOnline:false}),[saved,setSaved]=useState(false);
  useEffect(()=>{if(state?.syncSettings)setConfig(state.syncSettings);},[state?.syncSettings]);
  const update=(key,value)=>{setConfig(c=>({...c,[key]:value}));setSaved(false);};
  const content=state?.content;
  async function save(){const result=await api.contentSettings(config);setConfig(result);setSaved(true);return result;}
  return <div className="view-enter">
    <ReleaseCenter releases={releases} setReleases={setReleases} showRelease={showRelease} busy={busy} api={api} action={action}/>
    <section className="page-intro"><div><div className="eyebrow">KEEP THE FESTIVAL GOING.</div><h1>{t('新内容，不必等新版本')}<span>{t('。')}</span></h1><p>{t('从游戏资源读取新系列赛与新车，内容目录独立于客户端更新。')}</p></div><span className="edition-pill"><Radio size={14}/> CONTENT SYNC</span></section>
    <div className="update-overview"><div><span>{t('系列赛')}</span><b>{content?.series.length??0}</b><small>{content?.series.map(s=>`S${s}`).join(' · ')}</small></div><div><span>{t('季节赛周')}</span><b>{content?.weeks??0}</b><small>{t('随资源动态识别')}</small></div><div><span>{t('车辆目录')}</span><b>{content?.cars??0}</b><small>{t('原厂部件数据')}</small></div><div className="sync-status"><CheckCircle2 size={23}/><strong>{t(content?.source==='game'?'已从游戏同步':content?.source==='import'?'已导入数据包':'内置内容目录')}</strong><small>{content?.updatedAt?new Date(content.updatedAt).toLocaleString(locale==='zh'?'zh-CN':'en-US'):t('尚未同步')}</small></div></div>
    <div className="update-grid"><section className="update-panel"><div className="panel-heading"><span className="step-number">01</span><div><h2>{t('连接游戏资源')}</h2><p>{t('选择包含 media 文件夹的 FH6 安装目录。')}</p></div><Database size={22}/></div>
      <label className="field-label" htmlFor="game-folder">{t('游戏安装目录')}</label><div className="file-input"><input id="game-folder" value={config.gamePath} disabled={busy} onChange={e=>update('gamePath',e.target.value)} placeholder="E:\Steam\steamapps\common\ForzaHorizon6"/><button disabled={busy} onClick={()=>action(async()=>{const p=await api.chooseGame();if(p)update('gamePath',p);})}><FolderOpen size={17}/>{t('浏览')}</button></div>
      <label className="option-row"><input type="checkbox" checked={config.autoSync} disabled={busy} onChange={e=>update('autoSync',e.target.checked)}/><div><b>{t('自动同步内容')}</b><p>{t('启动时和应用运行期间每 30 分钟检查本地游戏资源。')}</p></div></label>
      <label className="option-row"><input type="checkbox" checked={config.allowOnline} disabled={busy} onChange={e=>update('allowOnline',e.target.checked)}/><div><b>{t('允许在线解密新车辆资源')}</b><p>{t('仅在车辆数据库变化时，将游戏资源 gamedbRC.slt 发送至 forzamods.dev；内容同步不读取或上传玩家存档。')}</p></div></label>
      <div className="update-actions"><button className="small-btn" disabled={busy} onClick={()=>action(save)}>{saved?<CheckCircle2 size={16}/>:null}{t(saved?'设置已保存':'保存设置')}</button><button className="primary" disabled={busy||!config.gamePath} onClick={()=>action(async()=>{await save();accept(await api.syncCatalog());})}><RefreshCw size={17}/>{t('立即同步')}<ArrowUpRight size={17}/></button></div>
      <p className="artwork-status"><CheckCircle2 size={14}/>{t('已读取 {0} 张游戏内系列赛封面',[state?.artwork?.count||0])}</p>
      {state?.artwork?.missing?.length ? <p className="subtle-note">{t('部分系列赛尚无可读取封面，将继续使用默认背景。')}</p> : null}
      <p className="subtle-note">{t('新系列赛必须已存在于游戏资源及所连接存档中。未知存档格式会停止对应编辑，仍需客户端适配。')}</p>
    </section><section className="update-panel"><div className="panel-heading"><span className="step-number pink">02</span><div><h2>{t('独立内容数据包')}</h2><p>{t('离线导入，或将当前目录导出留存。')}</p></div></div>
      <div className="pack-illustration"><Database size={46} strokeWidth={1}/><span>FESTIVAL<br/><b>CONTENT .JSON</b></span><span className="pack-tag">V2</span></div><p className="pack-description">{t('数据包包含季节活动编号、积分和车辆原厂配置。导入前检查结构与重复记录，已有历史目录会保留。')}</p>
      <button className="small-btn wide" disabled={busy} onClick={()=>action(async()=>{const r=await api.importCatalog();if(r)accept(r);})}><Download size={17}/>{t('导入内容数据包')}</button><button className="text-btn wide" disabled={busy} onClick={()=>action(async()=>{if(await api.exportCatalog())notice('内容数据包已导出。');})}><Upload size={15}/>{t('导出当前目录')}</button>
      <p className="subtle-note">{t('数据包不包含玩家存档。新车型需要完整的原厂部件数据；只有名称和 ID 的列表不能用于加车。')}</p>
    </section></div>
    <div className="sync-flow"><span><b>01</b>{t('游戏更新')}</span><i>→</i><span><b>02</b>{t('同步内容目录')}</span><i>→</i><span><b>03</b>{t('选择新系列赛或车辆')}</span><i>→</i><span><b>04</b>{t('备份并应用')}</span></div>
    {content?.warning?<div className="message error">{t(content.warning)}</div>:null}
  </div>;
}
