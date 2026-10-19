import React, { useState, useEffect, useRef } from "react";
import { Gift, ArrowUpRight, Check, CheckCheck, ChevronRight, FolderOpen, Languages, CloudSun, Leaf, Snowflake, Flower2, ShieldCheck, History, HardDrive, LoaderCircle, ArrowLeft, Info, Flag, Layers, CheckCircle2, CarFront, RefreshCw, Compass, Download, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { LanguageContext, useI18n } from "./Language.jsx";
import { translate, browserLocale } from "./i18n.mjs";
import Garage, { prettyName } from './Garage.jsx';
import Updates from './Updates.jsx';
import Journey from './Journey.jsx';
import Tuning from './Tuning.jsx';
import { Seal, Roll, PageHead } from './ui.jsx';
const api = window.festival;
const seasonIcons = [CloudSun, Leaf, Snowflake, Flower2];
const seriesNames = ["", "欢迎来到日本", "跨越年代", "意式风情", "吉祥物派对", "英伦汽车", "地平线车聚"];
const eventNames = { SeasonalEvent: '季节锦标赛', Trial: '试炼赛', PRStunt: 'PR 特技', ForzathonDaily: '每日挑战', ForzathonWeekly: '每周挑战', MonthlyRival: '月度对手', PhotoChallenge: '摄影挑战', TreasureChest: '宝箱', HorizonOpen: '地平线公开赛', Eliminator: '淘汰者', Collectibles: '收集品', StuntParty: '特技派对', HideSeek: '捉迷藏', SeasonalJob: '季节工作', HorizonLifeEvent: '地平线生活' };
// Point thresholds sit on the meter as notches; a reached notch fills in.
function RewardMeter({ points, max, rewards = [] }) {
  return <div className="reward-meter" aria-hidden="true"><div className="rule-meter"><i style={{ transform: `scaleX(${max ? Math.min(1, (points || 0) / max) : 0})` }} /></div>{rewards.map(r => <span key={r.points} className={`notch ${(points || 0) >= r.points ? 'reached' : ''}`} style={{ left: `${Math.min(100, r.points / max * 100)}%` }} />)}</div>;
}
function RewardLine({ reward, points, car, owned }) {
  const { t } = useI18n();
  return <span className={`reward-line ${points >= reward.points ? 'reached' : ''}`}><b>{reward.points}</b><span title={car || ''}>{car || t(reward.type)}</span>{owned ? <Check size={13} aria-label={t('已拥有')} /> : null}</span>;
}
function WeekCard({ week, selected, toggle, disabled, carLabel, owned }) {
  const { t } = useI18n();
  const Icon = seasonIcons[week.week];
  return (
    <button className={`week-card season-${week.week} ${selected ? "selected" : ""} ${week.complete ? "complete" : ""}`} aria-pressed={selected} aria-label={t("选择 S{0} 第{1}周 {2}", [week.series, week.week + 1, t(week.season)])} onClick={toggle} disabled={disabled || week.available === false}>
      <span className="field-tab">{t("第 {0} 周", [week.week + 1])}</span>
      {selected ? <Seal glyph="改" className="card-seal" /> : null}
      <div className="week-top"><Icon size={26} strokeWidth={1.5} /><h3>{t(week.season)}</h3></div>
      <div className="week-points"><Roll value={week.points ?? "—"} /><small>/ {week.maxPoints} PTS</small></div>
      <RewardMeter points={week.points} max={week.maxPoints} rewards={week.rewards} />
      {week.rewards?.length ? <span className="reward-lines">{week.rewards.map(r => <RewardLine key={r.points} reward={r} points={week.points || 0} car={r.car && carLabel(r.car)} owned={r.car && owned(r.car)} />)}</span> : null}
      <div className="week-status">
        <span>{week.complete ? <><CheckCircle2 size={13} />{t("已完成")}</> : week.available === false ? t("此存档尚未记录") : t("{0} / {1} 项挑战", [week.completed ?? "—", week.events.length])}</span>
        <span>{selected ? t("已选择") : t("选择此周")}</span>
      </div>
    </button>
  );
}
function Modal({ title, children, close }) {
  const { t } = useI18n();
  const root = useRef(null), closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    const items = () => [...root.current.querySelectorAll('button,input,select,[tabindex="0"]')].filter((e) => !e.disabled && e.offsetParent !== null);
    items()[0]?.focus();
    const fn = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); }
      if (e.key === "Tab") {
        const list = items();
        if (!list.length) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === list.at(-1)) { e.preventDefault(); list[0].focus(); }
      }
    };
    document.addEventListener("keydown", fn);
    return () => { document.removeEventListener("keydown", fn); previous?.focus(); };
  }, []);
  return (
    <div className="modal-backdrop">
      <section ref={root} className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={close} aria-label={t("关闭")}><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}
export default function App() {
  const [languageSaving, setLanguageSaving] = useState(false);
  const [state, setState] = useState(null),
    [summary, setSummary] = useState(null),
    [tab, setTab] = useState("seasons"),
    [series, setSeries] = useState(5),
    [selected, setSelected] = useState([]),
    [carQueue, setCarQueue] = useState([]),
    [allCars, setAllCars] = useState(false),
    [progressionQueue, setProgressionQueue] = useState([]),
    [wristQueue, setWristQueue] = useState([]),
    [tuneQueue, setTuneQueue] = useState([]),
    [library, setLibrary] = useState([]),
    [releaseInfo, setReleaseInfo] = useState(null),
    [releasePrompt, setReleasePrompt] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({ percent: 0, message: "" }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connect, setConnect] = useState(false),
    [saves, setSaves] = useState([]),
    [file, setFile] = useState(""),
    [backups, setBackups] = useState([]),
    [restoreTarget, setRestoreTarget] = useState(null),
    [info, setInfo] = useState(false),
    [sealed, setSealed] = useState(0);
  useEffect(() => {
    if (!api) { setError("请从 Windows 桌面程序打开，以使用本地存档功能。"); return; }
    api.state().then((s) => {
      setState(s); setSummary(s.summary); setBackups(s.backups); setReleaseInfo(s.releases); setLibrary(s.library || []);
    }).catch((e) => setError(e.message));
    const progressOff = api.onProgress(setProgress);
    const contentOff = api.onContentUpdated(r => { if (r.ok) acceptContent(r); else setError(r.error); });
    const releaseOff = api.onReleaseChecked(r => { setReleaseInfo(r); if (r.notify) setReleasePrompt(true); });
    return () => { progressOff(); contentOff(); releaseOff(); };
  }, []);
  const locale = state?.language?.locale || browserLocale();
  const t = (key, values) => translate(locale, key, values);
  useEffect(() => { document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"; }, [locale]);
  async function changeLanguage(value) {
    setLanguageSaving(true);
    try { const language = await api.setLanguage(value); setState((s) => ({ ...s, language })); }
    catch (e) { setError(e.message); }
    finally { setLanguageSaving(false); }
  }
  const weeks = summary && !summary.seasonError ? summary.weeks : state?.catalog.weeks || [];
  const seriesIds = [...new Set(weeks.map(w => w.series))].sort((a, b) => a - b);
  const seriesName = id => t(seriesNames[id] || weeks.find(w => w.series === id)?.title || `SERIES ${id}`);
  const queuedCars = allCars ? (summary?.garage?.missing.length ?? state?.cars?.length ?? 0) : carQueue.reduce((n, c) => n + c.quantity, 0);
  const overCapacity = !!summary?.garage && summary.garage.total + queuedCars > summary.garage.capacity;
  const visibleWeeks = weeks.filter((w) => w.series === series);
  const tuneCost = tuneQueue.reduce((n, q) => n + (q.result?.cost || 0), 0);
  const stagedTotal = selected.length + queuedCars + progressionQueue.length + wristQueue.length + tuneQueue.length;
  function clearQueues() { setSelected([]); setCarQueue([]); setAllCars(false); setProgressionQueue([]); setWristQueue([]); setTuneQueue([]); }
  async function action(fn) {
    setError(""); setNotice(""); setBusy(true); setProgress({ percent: 0, message: '' });
    try { return await fn(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function acceptContent(result) {
    if (result.syncSettings) setState(s => s && ({ ...s, syncSettings: result.syncSettings }));
    if (result.detected && result.unchanged) { setNotice('已自动找到游戏目录，游戏更新后会自动读取新的季节赛与奖励。'); return; }
    if (result.unchanged) { setNotice(result.carsPending ? '季节目录已更新；新车辆资源待解密，请在更新中心启用在线解密或导入数据包。' : '内容目录已是最新。'); return; }
    setState(s => ({ ...s, ...result })); setSummary(result.summary); clearQueues();
    setNotice(result.carsPending ? '季节目录已更新；新车辆资源待解密，请在更新中心启用在线解密或导入数据包。' : '内容目录已更新，已清空选择以使用最新数据。');
  }
  async function openConnect() {
    setConnect(true);
    await action(async () => { const s = await api.scan(); setSaves(s); setFile(s[0]?.path || ""); });
  }
  async function choose() { await action(async () => { const p = await api.choose(); if (p) setFile(p); }); }
  async function load() {
    await action(async () => {
      setProgress({ percent: 0, message: "连接存档" });
      const s = await api.load(file);
      setSummary(s); clearQueues(); setConnect(false); setNotice("");
    });
  }
  const toggle = (key) => setSelected((v) => v.includes(key) ? v.filter((k) => k !== key) : [...v, key]);
  function selectSeries() {
    const available = visibleWeeks.filter((w) => w.available !== false).map((w) => w.key);
    setSelected((v) => available.every((k) => v.includes(k)) ? v.filter((k) => !available.includes(k)) : [...new Set([...v, ...available])]);
  }
  async function apply() {
    setSealed(n => n + 1);
    await action(async () => {
      setProgress({ percent: 0, message: "准备修改" });
      const result = await api.apply({ weeks: selected, cars: carQueue, allCars, progressionItems: progressionQueue, wristbands: wristQueue, tunes: tuneQueue.map(q => q.request) });
      const hadTunes = tuneQueue.length, hadProgress = progressionQueue.length || wristQueue.length;
      setSummary(result.summary); setBackups(await api.backups()); clearQueues();
      setNotice(result.unchanged ? "所选内容已完成，存档无需修改。" : hadTunes ? "调校与改装已写回，自动备份已保存。" : hadProgress ? "所选进度已写回，自动备份已保存。" : "所选季节赛与车辆库存已写回，自动备份已保存。");
    });
  }
  async function exportDiagnostics() {
    await action(async () => { const file = await api.exportDiagnostics(); if (file) setNotice('诊断信息已导出。它只包含季节赛、收藏手册与腕带的结构数据，不含玩家编号、车库或文件路径，可以直接发给开发者。'); });
  }
  async function restore() {
    const id = restoreTarget.id;
    setRestoreTarget(null);
    await action(async () => {
      await api.restore(id);
      setSummary(null); clearQueues(); setBackups(await api.backups());
      setNotice("原存档已恢复；恢复前的版本也已备份。重新连接可查看结果。");
    });
  }
  const carIndex = new Map((state?.cars || []).map(c => [c.id, c]));
  const carLabel = id => { const c = carIndex.get(id); return c ? `${c.year} ${c.make} ${prettyName(c.name)}` : t("目录外车辆 #{0}", [id]); };
  const owned = id => !!summary?.garage?.counts?.[id];
  const seriesRewards = state?.catalog?.seriesRewards?.[series] || [];
  const rewardCars = [...new Set([...visibleWeeks.flatMap(w => [...(w.rewards || []), ...w.events.map(e => e.reward).filter(Boolean)]), ...seriesRewards].map(r => r.car).filter(Boolean))];
  const missingRewards = rewardCars.filter(id => carIndex.has(id) && !owned(id) && !carQueue.some(q => q.id === id));
  function queueRewards() { setAllCars(false); setCarQueue(q => [...q, ...missingRewards.map(id => ({ id, quantity: 1 }))]); setNotice('未拥有的奖励车辆已加入“车辆收藏”的待写入列表。'); }
  const seriesWeeks = visibleWeeks, seriesPoints = seriesWeeks.reduce((n, w) => n + (w.points || 0), 0), seriesMax = seriesWeeks.reduce((n, w) => n + w.maxPoints, 0);
  const applyBlocked = busy || !stagedTotal || overCapacity || (!!selected.length && !!summary?.seasonError) || (!!queuedCars && !!summary?.garageError) || (!!progressionQueue.length && !!summary?.journey?.collectionError) || (!!wristQueue.length && !!summary?.journey?.wristbandError) || (!!tuneQueue.length && !!summary?.tuningError);
  const nav = [
    ["seasons", "季节赛", Flag, selected.length],
    ['garage', '车辆收藏', CarFront, queuedCars],
    ['tuning', '调校工坊', SlidersHorizontal, tuneQueue.length],
    ['journey', '旅程进度', Compass, progressionQueue.length + wristQueue.length],
    ['updates', '更新中心', RefreshCw, releaseInfo?.available ? '!' : 0],
    ["backups", "备份与恢复", History, 0],
  ];
  const slip = [["季节赛周", selected.length], ["加车", queuedCars], ["进度", progressionQueue.length + wristQueue.length], ["调校", tuneQueue.length]];
  return (
    <LanguageContext.Provider value={locale}>
      <div className="app">
        <aside className="rail">
          <div className="rail-brand">
            <span className="brand-seal" aria-hidden="true"><span>存档</span><span>工坊</span></span>
            <div><strong>Festival Toolkit</strong><small>{t("地平线 · 存档工坊")}</small></div>
          </div>
          <nav className="rail-nav" aria-label={t("功能导航")}>
            {nav.map(([id, label, Icon, count]) => (
              <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
                <Icon size={18} strokeWidth={1.7} /><span>{t(label)}</span>{count ? <em aria-label={t("待写入 {0}", [count])}>{count}</em> : null}
              </button>
            ))}
          </nav>
          <div className="rail-foot">
            <button className={`save-card ${summary ? "online" : ""}`} onClick={openConnect} disabled={busy}>
              <HardDrive size={18} />
              <span><small>{summary ? t("存档已连接") : t("你的旅程，从这里开始")}</small><b>{summary ? t("玩家 {0}", [summary.xuid.slice(-6)]) : t("连接本地存档")}</b></span>
              <ChevronRight size={16} />
            </button>
            <label className="rail-language"><Languages size={16} /><select aria-label="Language / 语言" value={state?.language?.preference || "system"} onChange={(e) => changeLanguage(e.target.value)} disabled={!state || busy || languageSaving}><option value="system">{t("跟随系统")}</option><option value="zh">简体中文</option><option value="en">English</option></select></label>
            <div className="rail-meta"><span>Windows · V{state?.version || "0.4.2"}</span><button onClick={() => setInfo(true)}><Info size={14} />{t("使用说明")}</button></div>
          </div>
        </aside>
        <div className="workspace">
          <main key={tab} className="page">
            {error ? <div className="message error" role="alert"><Info size={18} /><span>{t(error)}</span><button onClick={() => setError("")} aria-label={t("关闭")}>×</button></div> : null}
            {notice ? <div className="message success" role="status"><CheckCircle2 size={18} /><span>{t(notice)}</span><button onClick={() => setNotice("")} aria-label={t("关闭")}>×</button></div> : null}
            {tab === 'seasons' && summary?.seasonError ? <div className="message error" role="alert"><Info size={18} /><span>{t(summary.seasonError)}</span><button className="text-btn" onClick={exportDiagnostics} disabled={busy}>{t('导出诊断信息')}</button></div> : null}
            {tab === 'garage' ? <Garage cars={state?.cars || []} summary={summary} queue={carQueue} setQueue={setCarQueue} allCars={allCars} setAllCars={setAllCars} busy={busy} /> : null}
            {tab === 'tuning' && state?.tuningMeta ? <Tuning meta={state.tuningMeta} summary={summary} library={library} setLibrary={setLibrary} queue={tuneQueue} setQueue={setTuneQueue} busy={busy} api={api} connect={openConnect} /> : null}
            {tab === 'journey' ? <Journey catalog={state?.progressionCatalog} summary={summary} queue={progressionQueue} setQueue={setProgressionQueue} wristQueue={wristQueue} setWristQueue={setWristQueue} busy={busy} diagnose={exportDiagnostics} /> : null}
            {tab === 'updates' ? <Updates state={state} busy={busy} api={api} action={action} accept={acceptContent} notice={setNotice} releases={releaseInfo} setReleases={setReleaseInfo} showRelease={() => setReleasePrompt(true)} /> : null}
            {tab === "seasons" ? <>
              <PageHead title={t("每一周，都值得点亮")} sub={t("挑选你的赛季与季节，批量编辑整周的完成记录与季节积分。")}>
                <button className="small-btn" onClick={() => setSelected(weeks.filter((w) => w.available !== false).map((w) => w.key))} disabled={busy}><CheckCheck size={16} />{t("全选所有赛季")}</button>
                <button className="text-btn" onClick={() => setSelected([])} disabled={!selected.length || busy}>{t("清空选择")}</button>
              </PageHead>
              <div className="tabs series-tabs" role="tablist" aria-label={t("赛季")}>
                {seriesIds.map((s) => {
                  const done = summary?.weeks.some((w) => w.series === s) && summary.weeks.filter((w) => w.series === s).every((w) => w.complete);
                  const picked = weeks.filter(w => w.series === s && selected.includes(w.key)).length;
                  return <button role="tab" aria-selected={series === s} key={s} onClick={() => setSeries(s)} className={series === s ? "active" : ""}><b>S{s}</b><span>{seriesName(s)}</span>{done ? <Check size={14} /> : null}{picked ? <em>{picked}</em> : null}</button>;
                })}
              </div>
              <section className="festival-layout">
                <article className={`series-plate ${state?.artwork?.series?.[series] ? 'has-art' : ''}`}>
                  <figure>{state?.artwork?.series?.[series] ? <img src={state.artwork.series[series].url} alt={t('S{0} 游戏内系列赛封面', [series])} title={state.artwork.series[series].source} /> : <div className="plate-pattern" aria-hidden="true"><span>S{series}</span></div>}</figure>
                  <div className="plate-fields">
                    <div className="field"><span className="field-tab">{t("赛季")}</span><strong>S{series}</strong><p>{seriesName(series)}</p><small>{visibleWeeks[0]?.title}</small></div>
                    <div className="field"><span className="field-tab">{t("赛季积分")}</span><strong><Roll value={summary ? seriesPoints : "—"} /><small> / {seriesMax}</small></strong><RewardMeter points={summary ? seriesPoints : 0} max={seriesMax} rewards={seriesRewards} />{seriesRewards.length ? <span className="reward-lines">{seriesRewards.map(r => <RewardLine key={r.points} reward={r} points={summary ? seriesPoints : 0} car={r.car && carLabel(r.car)} owned={r.car && owned(r.car)} />)}</span> : null}</div>
                    <button className="small-btn wide" onClick={selectSeries} disabled={busy}><Layers size={16} />{visibleWeeks.every((w) => selected.includes(w.key)) ? t("取消本赛季") : t("选择整个赛季")}</button>
                  </div>
                </article>
                <div className="weeks-area">
                  <div className="weeks-grid">
                    {visibleWeeks.map((w) => <WeekCard key={w.key} week={w} selected={selected.includes(w.key)} toggle={() => toggle(w.key)} disabled={busy || !!summary?.seasonError} carLabel={carLabel} owned={owned} />)}
                  </div>
                  <p className="assurance"><ShieldCheck size={16} /><span><b>{t("每次修改，先留一份退路。")}</b>{t("自动备份原存档，并在写回前完成加密回读校验。")}</span></p>
                </div>
              </section>
              {rewardCars.length ? <section className="sheet reward-sheet" aria-label={t('本赛季奖励车辆')}>
                <h2 className="panel-tab"><Gift size={14} />{t('本赛季奖励车辆')}<span>{rewardCars.length}</span></h2>
                <div className="reward-head"><p>{summary ? t('共 {0} 辆奖励车，已拥有 {1} 辆。补满积分只修改季节赛记录；奖励车辆可以直接加入车库。', [rewardCars.length, rewardCars.filter(owned).length]) : t('积分奖励与赛事奖励来自游戏资源；连接存档后显示是否已拥有。')}</p><button className="small-btn" disabled={busy || !summary || !!summary?.garageError || !missingRewards.length} onClick={queueRewards}><CarFront size={15} />{missingRewards.length ? t('加入未拥有的 {0} 辆', [missingRewards.length]) : t('奖励车辆均已拥有或已加入')}</button></div>
                <div className="reward-table">
                  {visibleWeeks.map(w => { const events = w.events.filter(e => e.reward); return <div className="reward-row" key={w.key}><span className="reward-week">{t('第 {0} 周', [w.week + 1])}<small>{t(w.season)}</small></span><div className="reward-chips">{(w.rewards || []).filter(r => r.car).map(r => <span key={'p' + r.points} className={`reward-chip ${owned(r.car) ? 'owned' : ''}`}><em>{r.points} PTS</em>{carLabel(r.car)}{owned(r.car) ? <Check size={13} /> : null}</span>)}{events.map(e => <span key={e.type + e.id} className={`reward-chip event ${owned(e.reward.car) ? 'owned' : ''}`}><em>{t(eventNames[e.name] || e.name)}</em>{carLabel(e.reward.car)}{owned(e.reward.car) ? <Check size={13} /> : null}</span>)}</div></div>; })}
                  {seriesRewards.some(r => r.car) ? <div className="reward-row"><span className="reward-week">{t('整个赛季')}<small>{t('赛季积分')}</small></span><div className="reward-chips">{seriesRewards.filter(r => r.car).map(r => <span key={r.points} className={`reward-chip ${owned(r.car) ? 'owned' : ''}`}><em>{r.points} PTS</em>{carLabel(r.car)}{owned(r.car) ? <Check size={13} /> : null}</span>)}</div></div> : null}
                </div>
              </section> : null}
              <dl className="fact-row">
                <div><dt>{t("整周挑战")}</dt><dd>{t("每日 · 每周 · 锦标赛 · 特技 · 照片 · 更多")}</dd></div>
                <div><dt>{t("精确选择")}</dt><dd>{t("只修改所选周，保留其他季节的进度")}</dd></div>
                <div><dt>{t("已知内容")}</dt><dd>{t('当前目录：{0} 个系列赛，共 {1} 周', [seriesIds.length, weeks.length])}</dd></div>
              </dl>
            </> : null}
            {tab === "backups" ? <>
              <PageHead title={t("放心出发，随时回来")} sub={t("每次写入与恢复之前，自动保存完整原文件。")}>
                <button className="small-btn" onClick={() => api.openBackups()}><FolderOpen size={17} />{t("打开备份目录")}</button>
              </PageHead>
              <div className="backup-summary"><ShieldCheck size={22} /><p><b>{t("你的每一次修改，都有记录。")}</b>{t("备份与应用分开保存，关闭程序后仍然保留。")}</p><span><Roll value={backups.length} /><small>{t("份恢复点")}</small></span></div>
              {backups.length ? <ol className="backup-list">
                {backups.map((b, i) => (
                  <li key={b.id} style={{ '--i': Math.min(i, 10) }}>
                    <Seal glyph={b.kind === "restore" ? "返" : "控"} dry className="row-seal" />
                    <div className="backup-copy">
                      <h3>{b.kind === "restore" ? t("恢复前快照") : t("修改前备份")} <em className={`status ${b.status}`}>{b.status === "complete" ? t("完整") : b.status === "rolled-back" ? t("已回滚") : t("中断可恢复")}</em></h3>
                      <time>{new Date(b.created).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</time>
                      <p title={b.targets[0]}>{b.targets[0]}</p>
                      {(b.audit || []).length ? <small>{(Array.isArray(b.audit) ? b.audit : [b.audit]).map(a => a?.kind).filter(Boolean).map(k => t({ seasons: '季节赛', garage: '车辆收藏', progression: '旅程进度', tuning: '调校工坊' }[k] || k)).join(' / ')}</small> : null}
                    </div>
                    <button className="small-btn" disabled={busy} onClick={() => setRestoreTarget(b)}><ArrowLeft size={16} />{t("恢复此版本")}</button>
                  </li>
                ))}
              </ol> : <div className="empty"><History size={34} strokeWidth={1.4} /><h3>{t("第一份备份，随第一次修改一起到来。")}</h3><p>{t("应用会在写回前自动保存，届时可在这里恢复。")}</p></div>}
            </> : null}
          </main>
          <footer className={`dock ${stagedTotal ? "loaded" : ""}`}>
            <div className="dock-status">
              <span className={summary ? "status-dot online" : "status-dot"} />
              <div><strong>{summary ? t("本地存档已连接") : t("等待连接存档")}</strong><small title={summary?.file}>{summary ? summary.file : t("选择 C_ProfileData 开始")}</small></div>
            </div>
            <dl className="dock-slip" aria-label={t("待写入的修改")}>
              {slip.map(([label, n]) => <div key={label} className={n ? "has" : ""}><dt>{t(label)}</dt><dd><Roll value={n} /></dd></div>)}
              {tuneCost ? <div className="has cost"><dt>{t("改装花费")}</dt><dd><Roll value={tuneCost.toLocaleString()} /> CR</dd></div> : null}
            </dl>
            {summary ? (
              <button key={sealed} className={`seal-button ${busy ? "pressing" : ""}`} onClick={apply} disabled={applyBlocked}>
                <span className="seal-ring" aria-hidden="true">{busy ? <LoaderCircle className="spin" size={20} /> : "印"}</span>
                <span>{overCapacity ? t('超出车库容量') : busy ? t("正在处理") : t("备份并应用修改")}<small>{stagedTotal ? t("共 {0} 项待写入", [stagedTotal]) : t("还没有待写入的修改")}</small></span>
              </button>
            ) : (
              <button className="primary dock-connect" onClick={openConnect} disabled={busy}><FolderOpen size={18} />{t("连接存档")}<ArrowUpRight size={18} /></button>
            )}
          </footer>
        </div>
        {busy ? <div className="working" role="status"><LoaderCircle className="spin" size={17} /><span>{t(progress.message || "正在处理…")}</span><b>{progress.percent}%</b><i style={{ transform: `scaleX(${progress.percent / 100})` }} /></div> : null}
        {releasePrompt && releaseInfo?.available && !busy && !connect && !restoreTarget && !info ? <Modal title={t('新版本，已抵达')} close={() => setReleasePrompt(false)}>
          <div className="release-hero"><Sparkles size={26} /><h3>Festival Toolkit {releaseInfo.release.version}</h3><p>{t('为你的下一段旅途，准备好了。')}</p><div className="release-version"><span>{releaseInfo.currentVersion}</span><ArrowUpRight size={16} /><b>{releaseInfo.release.version}</b></div></div>
          <div className="release-notes"><strong>{releaseInfo.release.name}</strong><p>{releaseInfo.release.notes || t('完整更新说明与安装包可在 GitHub 查看。')}</p></div>
          <div className="modal-actions"><button className="text-btn" onClick={() => setReleasePrompt(false)}>{t('稍后再说')}</button><button className="primary" onClick={() => action(async () => { await api.openRelease(); setReleasePrompt(false) })}><Download size={17} />{t('前往 GitHub 下载')}<ArrowUpRight size={17} /></button></div>
          <p className="subtle-note">{t('每天首次打开时自动检查已发布版本。下载和安装由你决定。')}</p>
        </Modal> : null}
        {connect ? (
          <Modal title={t("连接你的存档")} close={() => { if (!busy) setConnect(false); }}>
            <p className="modal-lead">{t("已自动寻找本机 FH6 存档，也可以手动选择文件。")}</p>
            {error ? <div className="message error" role="alert">{t(error)}</div> : null}
            {saves.length ? <div className="detected-list">
              {saves.slice(0, 5).map((s) => (
                <button className={file === s.path ? "chosen" : ""} key={s.path} onClick={() => setFile(s.path)} disabled={busy} aria-pressed={file === s.path}>
                  <HardDrive size={19} />
                  <span><b>{t("玩家")} {s.account.slice(-6)}</b><small>{s.path}</small><time>{new Date(s.modified).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} · {(s.size / 1024).toFixed(0)} KB</time></span>
                  {file === s.path ? <Check size={18} /> : null}
                </button>
              ))}
            </div> : null}
            <label className="field-label" htmlFor="save-file">{t("存档文件")}</label>
            <div className="file-input"><input id="save-file" value={file} onChange={(e) => setFile(e.target.value)} disabled={busy} placeholder={t("选择 C_ProfileData")} /><button onClick={choose} disabled={busy}><FolderOpen size={17} />{t("浏览")}</button></div>
            <div className="service-note"><Info size={17} /><p>{t("加解密使用 ForzaCryptoTool 的在线服务，会将所选存档发送至")} <b>forzamods.dev</b>{t("。修改计算和备份在本机完成；请先退出游戏。")}</p></div>
            <button className="primary wide" onClick={load} disabled={busy || !file}>{busy ? <LoaderCircle className="spin" size={18} /> : <HardDrive size={18} />}{t("连接并解密")}</button>
          </Modal>
        ) : null}
        {restoreTarget ? (
          <Modal title={t("恢复这个版本")} close={() => setRestoreTarget(null)}>
            <p className="modal-lead">{t("将恢复至")}{new Date(restoreTarget.created).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} {t("修改前的存档。")}</p>
            <p className="restore-path">{restoreTarget.targets[0]}</p>
            <div className="service-note"><ShieldCheck size={18} /><p>{t("当前版本会先保存为新的备份，之后仍可恢复。")}</p></div>
            <button className="primary wide" onClick={restore}>{t("恢复存档")}</button>
          </Modal>
        ) : null}
        {info ? (
          <Modal title={t("关于存档工坊")} close={() => setInfo(false)}>
            <p className="modal-lead">{t("Horizon Festival Toolkit · 非官方本地存档工具")}</p>
            <ol className="help-steps">
              <li><b>{t("退出游戏并连接存档。")}</b><p>{t("加密存档通过 ForzaCryptoTool 在线加解密。")}</p></li>
              <li><b>{t("选择赛季或某几周。")}</b><p>{t('搜索车辆并添加指定数量，或补齐全车。更新中心可读取游戏资源或导入独立内容包。')}</p></li>
              <li><b>{t("在调校工坊查看每辆车的调校与改装花费。")}</b><p>{t("按场景生成调校、从同车型复制，或搜索社区分享码。")}</p></li>
              <li><b>{t("点击“备份并应用修改”。")}</b><p>{t("自动备份，验证修改并加密回读，然后写回原路径。")}</p></li>
            </ol>
            <div className="service-note"><Info size={18} /><p>{t("本工具验证存档数据结构与字段。尚未验证游戏实际读档、所有卡片显示和独立挑战子状态；不会额外发放挑战奖励。不同版本或线上服务可能重新计算进度。")}</p></div>
            {summary ? <div className="modal-actions"><button className="small-btn" onClick={() => { setInfo(false); exportDiagnostics(); }} disabled={busy}><Download size={16} />{t('导出诊断信息')}</button></div> : null}
            <p className="credits">{t("独立的非官方工具，与 Microsoft、Xbox、Playground Games 无隶属关系。")}</p>
          </Modal>
        ) : null}
      </div>
    </LanguageContext.Provider>
  );
}
