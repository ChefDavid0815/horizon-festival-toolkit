import {useState} from 'react';
import {ArrowUpRight,RefreshCw,CheckCircle2,Download,ChevronDown,CircleAlert} from 'lucide-react';
import {useI18n} from './Language.jsx';
const history=[
  {version:'0.4.2',date:'2026.10.19',title:'只玩过几季，也能读。',en:'Reads saves that skipped a series.',items:['修复只参加过部分系列赛的存档提示“未能在存档中定位季节赛数据”。','没有参加过的系列赛显示为“此存档尚未记录”，不可写入；已参加的系列赛照常编辑。']},
  {version:'0.4.1',date:'2026.10.18',title:'进度少的存档，也能读。',en:'Newer saves read too.',items:['修复季节赛在活动记录较少的存档上提示“无法唯一识别季节赛布局”。','修复收藏手册在缺少分类积分记录或含有游戏更新新增项目时停止编辑；新项目原样保留，修订项目只读。','完成缺少积分记录的分类时自动补建记录，并逐项回读核对。','内置第 6 季 Horizon Meets（地平线车聚）的季节赛与奖励。','新增“导出诊断信息”，只含季节赛、收藏手册与腕带结构，不含玩家编号与车库。']},
  {version:'0.4.0',date:'2026.10.16',title:'每一套调校，都有出处。',en:'Every tune has a source.',items:['调校工坊：读取存档中每辆车的完整调校，换算胎压、齿比、定位、防倾杆、阻尼、刹车与差速器。','按公路、泥地、越野、漂移、直线加速、雪地等场景生成调校，并保留原有齿比。','同车型之间复制调校与改装，按实际成交价计算 CR 花费；车库改装账本按等级汇总。','本机调校库，支持导入导出；搜索 CODMunity 社区分享码。','季节赛随游戏更新自动读取新内容，并显示积分与赛事奖励车辆。','全新车检证风格界面：侧边导航、待写入印章与数字滚动。']},
  {version:'0.3.0',date:'2026.09.22',title:'每一段旅程，都值得收藏。',en:'Every journey deserves a place.',items:['每日 GitHub 已发布版本检查与下载提醒。','Discover Japan 与嘉年华收藏手册：38 个分类、2,833 个子项目。','单项、分类或整个进度选择；积分同步写回，自动备份。','七色腕带持有记录读取与补齐。','统一交互动效、旅程界面与双语版本历史。']},
  {version:'0.2.0',date:'2026.09.20',title:'把梦想，开进车库。',en:'Bring your dream garage home.',items:['647 款车辆搜索、单车加库存与补齐缺失车型。','本地游戏资源同步、独立内容数据包。','游戏内系列赛封面、收藏工作区与细腻动效。']},
  {version:'0.1.1',date:'2026.09.18',title:'你的嘉年华，从这里开始。',en:'Your festival starts here.',items:['S1–S5 季节赛进度与积分编辑。','写入前备份、SCopy 同步与恢复。','简体中文、English 与系统语言偏好。']},
];
export default function ReleaseCenter({releases,setReleases,showRelease,busy,api,action}){
  const {t,locale}=useI18n(),[checking,setChecking]=useState(false),[expanded,setExpanded]=useState(history[0].version);
  const check=async()=>{setChecking(true);try{await action(async()=>{const r=await api.checkRelease();setReleases(r);if(r.available)showRelease()})}finally{setChecking(false)}};
  const offline=releases?.status==='offline';
  return <section className="sheet release-center">
    <h2 className="panel-tab">{t('客户端版本')}</h2>
    <div className="release-status-row">
      <div className="field"><span className="field-tab">{t('当前版本')}</span><strong>V{releases?.currentVersion||'0.4.2'}</strong></div>
      <p className={`release-status ${offline?'offline':''}`} role="status">{offline?<CircleAlert size={15}/>:<CheckCircle2 size={15}/>}{t(checking?'正在检查更新…':offline?'暂时无法连接 GitHub，请稍后重试。':releases?.available?'发现新版本':releases?.status==='ok'?'你已是最新版本':'等待首次检查')}{releases?.checkedAt&&!checking?<small>{new Date(releases.checkedAt).toLocaleString(locale==='zh'?'zh-CN':'en-US')}</small>:null}</p>
      <div className="release-actions"><button className="text-btn" onClick={()=>action(()=>api.openRelease())} disabled={busy}>{t('GitHub 发布页面')}<ArrowUpRight size={13}/></button><button className="primary" disabled={busy||checking} onClick={releases?.available?showRelease:check}>{releases?.available?<Download size={16}/>:<RefreshCw size={16} className={checking?'spin':''}/>}{t(releases?.available?'查看新版本':'检查更新')}</button></div>
    </div>
    <ol className="history">{history.map((r,i)=><li key={r.version} className={expanded===r.version?'open':''}>
      <button className="history-toggle" aria-expanded={expanded===r.version} aria-controls={`history-${r.version}`} onClick={()=>setExpanded(v=>v===r.version?'':r.version)}><b>V{r.version}</b><time>{r.date}</time><strong>{locale==='zh'?r.title:r.en}</strong>{r.version===(releases?.currentVersion||history[0].version)?<em>{t('当前版本')}</em>:null}<ChevronDown size={16}/></button>
      <div className="history-detail" id={`history-${r.version}`} hidden={expanded!==r.version}><ul>{r.items.map(item=><li key={item}>{t(item)}</li>)}</ul>{!i?<p>{t('存档层校验；游戏内驾驶、奖励及解锁效果仍需验证。')}</p>:null}</div>
    </li>)}</ol>
  </section>;
}
