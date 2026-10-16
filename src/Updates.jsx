import {useEffect,useState} from 'react';
import {RefreshCw, FolderOpen, Download, Upload, CheckCircle2, Database, ArrowUpRight, Package} from 'lucide-react';
import {useI18n} from './Language.jsx';
import ReleaseCenter from './ReleaseCenter.jsx';
import {Roll,PageHead} from './ui.jsx';
export default function Updates({state,busy,api,action,accept,notice,releases,setReleases,showRelease}){
  const {t,locale}=useI18n(),[config,setConfig]=useState(state?.syncSettings||{gamePath:'',autoSync:false,allowOnline:false}),[saved,setSaved]=useState(false);
  useEffect(()=>{if(state?.syncSettings)setConfig(state.syncSettings);},[state?.syncSettings]);
  const update=(key,value)=>{setConfig(c=>({...c,[key]:value}));setSaved(false);};
  const content=state?.content;
  async function save(){const result=await api.contentSettings(config);setConfig(result);setSaved(true);return result;}
  return <div className="updates">
    <PageHead title={t('新内容，不必等新版本')} sub={t('从游戏资源读取新系列赛与新车，内容目录独立于客户端更新。')}/>
    <dl className="field-row">
      <div className="field"><dt className="field-tab">{t('系列赛')}</dt><dd><Roll value={content?.series.length??0}/></dd><small>{content?.series.map(s=>`S${s}`).join(' ')}</small></div>
      <div className="field"><dt className="field-tab">{t('季节赛周')}</dt><dd><Roll value={content?.weeks??0}/></dd><small>{t('随资源动态识别')}</small></div>
      <div className="field"><dt className="field-tab">{t('车辆目录')}</dt><dd><Roll value={content?.cars??0}/></dd><small>{t('原厂部件数据')}</small></div>
      <div className="field"><dt className="field-tab">{t('内容来源')}</dt><dd className="text-value"><CheckCircle2 size={17}/>{t(content?.source==='game'?'已从游戏同步':content?.source==='import'?'已导入数据包':'内置内容目录')}</dd><small>{content?.updatedAt?new Date(content.updatedAt).toLocaleString(locale==='zh'?'zh-CN':'en-US'):t('尚未同步')}</small></div>
    </dl>
    <div className="update-grid">
      <section className="sheet"><h2 className="panel-tab"><Database size={14}/>{t('连接游戏资源')}</h2>
        <p className="sheet-lead">{t('选择包含 media 文件夹的 FH6 安装目录。')}</p>
        <label className="field-label" htmlFor="game-folder">{t('游戏安装目录')}</label>
        {state?.syncSettings?.autoDetected ? <p className="subtle-note"><CheckCircle2 size={13}/>{t('已自动找到 Steam / Xbox 安装目录。')}</p> : !config.gamePath ? <p className="subtle-note">{t('留空时会自动寻找 Steam 与 Xbox 安装目录；游戏下载完成后自动开始同步。')}</p> : null}
        <div className="file-input"><input id="game-folder" value={config.gamePath} disabled={busy} onChange={e=>update('gamePath',e.target.value)} placeholder="E:\Steam\steamapps\common\ForzaHorizon6"/><button disabled={busy} onClick={()=>action(async()=>{const p=await api.chooseGame();if(p)update('gamePath',p);})}><FolderOpen size={17}/>{t('浏览')}</button></div>
        <label className="option-row"><input type="checkbox" checked={config.autoSync} disabled={busy} onChange={e=>update('autoSync',e.target.checked)}/><span><b>{t('自动同步内容')}</b><small>{t('游戏更新后自动读取新的季节赛与奖励：启动时检查，运行期间每分钟比对游戏文件。')}</small></span></label>
        <label className="option-row"><input type="checkbox" checked={config.allowOnline} disabled={busy} onChange={e=>update('allowOnline',e.target.checked)}/><span><b>{t('允许在线解密新车辆资源')}</b><small>{t('仅在车辆数据库变化时，将游戏资源 gamedbRC.slt 发送至 forzamods.dev；内容同步不读取或上传玩家存档。')}</small></span></label>
        <div className="sheet-actions"><button className="small-btn" disabled={busy} onClick={()=>action(save)}>{saved?<CheckCircle2 size={16}/>:null}{t(saved?'设置已保存':'保存设置')}</button><button className="primary" disabled={busy||!config.gamePath} onClick={()=>action(async()=>{await save();accept(await api.syncCatalog());})}><RefreshCw size={17}/>{t('立即同步')}<ArrowUpRight size={16}/></button></div>
        <p className="subtle-note"><CheckCircle2 size={13}/>{t('已读取 {0} 张游戏内系列赛封面',[state?.artwork?.count||0])}{state?.artwork?.missing?.length?` ${t('部分系列赛尚无可读取封面，将继续使用默认背景。')}`:''}</p>
        <p className="subtle-note">{t('新系列赛必须已存在于游戏资源及所连接存档中。未知存档格式会停止对应编辑，仍需客户端适配。')}</p>
      </section>
      <section className="sheet"><h2 className="panel-tab"><Package size={14}/>{t('独立内容数据包')}</h2>
        <p className="sheet-lead">{t('离线导入，或将当前目录导出留存。')}</p>
        <p>{t('数据包包含季节活动编号、积分和车辆原厂配置。导入前检查结构与重复记录，已有历史目录会保留。')}</p>
        <div className="sheet-actions stack"><button className="small-btn" disabled={busy} onClick={()=>action(async()=>{const r=await api.importCatalog();if(r)accept(r);})}><Download size={17}/>{t('导入内容数据包')}</button><button className="text-btn" disabled={busy} onClick={()=>action(async()=>{if(await api.exportCatalog())notice('内容数据包已导出。');})}><Upload size={15}/>{t('导出当前目录')}</button></div>
        <p className="subtle-note">{t('数据包不包含玩家存档。新车型需要完整的原厂部件数据；只有名称和 ID 的列表不能用于加车。')}</p>
      </section>
    </div>
    <ol className="sync-flow" aria-label={t('内容更新步骤')}>{['游戏更新','同步内容目录','选择新系列赛或车辆','备份并应用'].map((s,i)=><li key={s}><b>{i+1}</b>{t(s)}</li>)}</ol>
    {content?.warning?<div className="message error">{t(content.warning)}</div>:null}
    <ReleaseCenter releases={releases} setReleases={setReleases} showRelease={showRelease} busy={busy} api={api} action={action}/>
  </div>;
}
