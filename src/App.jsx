import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  FolderOpen,
  Languages,
  CloudSun,
  Leaf,
  Snowflake,
  Flower2,
  ShieldCheck,
  History,
  HardDrive,
  LoaderCircle,
  ArrowLeft,
  Info,
  Flag,
  Layers,
  CheckCircle2,
  CarFront,
  RefreshCw,
} from "lucide-react";
import { LanguageContext, useI18n } from "./Language.jsx";
import { translate, browserLocale } from "./i18n.mjs";
import Garage from './Garage.jsx';
import Updates from './Updates.jsx';
const api = window.festival;
const seasonIcons = [CloudSun, Leaf, Snowflake, Flower2];
const seriesNames = [
  "",
  "欢迎来到日本",
  "跨越年代",
  "意式风情",
  "吉祥物派对",
  "英伦汽车",
];
function Key({ children }) {
  return <kbd>{children}</kbd>;
}
function WeekCard({ week, selected, toggle, disabled }) {
  const { locale, t } = useI18n();
  const Icon = seasonIcons[week.week];
  return (
    <button
      className={`week-card season-${week.week} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      aria-label={t("选择 S{0} 第{1}周 {2}", [
        week.series,
        week.week + 1,
        t(week.season),
      ])}
      onClick={toggle}
      disabled={disabled || week.available === false}
    >
      <div className="week-art">
        <span className="week-index">0{week.week + 1}</span>
        <Icon size={42} strokeWidth={1.5} />
        <span className="week-en">{week.seasonEn}</span>
        <span className="select-box">
          {selected ? <Check size={18} /> : null}
        </span>
      </div>
      <div className="week-info">
        <div className="week-title">
          <h3>{t(week.season)}</h3>
          <span>
            {week.points ?? "—"}
            <small> / {week.maxPoints} PTS</small>
          </span>
        </div>
        <div className="progress-line">
          <i
            style={{
              width: `${Math.min(100, ((week.points || 0) / week.maxPoints) * 100)}%`,
            }}
          />
        </div>
        <div className="week-status">
          <span>
            {week.complete ? (
              <>
                <CheckCircle2 size={13} />
                {t("已完成")}
              </>
            ) : week.available === false ? (
              t("此存档尚未记录")
            ) : (
              t("{0} / {1} 项挑战", [
                week.completed ?? "—",
                week.events.length,
              ])
            )}
          </span>
          <span>
            {selected ? t("已选择") : t("选择此周")}
          </span>
        </div>
      </div>
    </button>
  );
}
function Modal({ title, children, close }) {
  const { t } = useI18n();
  const root = useRef(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    const items = () =>
      [...root.current.querySelectorAll('button,input,select,[tabindex="0"]')].filter(
        (e) => !e.disabled && e.offsetParent !== null,
      );
    items()[0]?.focus();
    const fn = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const list = items();
        if (!list.length) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0].focus();
        }
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={root}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="small-btn" onClick={close}>
            {t("关闭")}
            <Key>Esc</Key>
          </button>
        </div>
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
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({
      percent: 0,
      message: "",
    }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connect, setConnect] = useState(false),
    [saves, setSaves] = useState([]),
    [file, setFile] = useState(""),
    [backups, setBackups] = useState([]),
    [restoreTarget, setRestoreTarget] = useState(null),
    [info, setInfo] = useState(false);
  useEffect(() => {
    if (!api) {
      setError("请从 Windows 桌面程序打开，以使用本地存档功能。");
      return;
    }
    api
      .state()
      .then((s) => {
        setState(s);
        setSummary(s.summary);
        setBackups(s.backups);
      })
      .catch((e) => setError(e.message));
    const progressOff=api.onProgress(setProgress);
    const contentOff=api.onContentUpdated(r=>{if(r.ok)acceptContent(r);else setError(r.error);});
    return ()=>{progressOff();contentOff();};
  }, []);
  const locale = state?.language?.locale || browserLocale();
  const t = (key, values) => translate(locale, key, values);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  async function changeLanguage(value) {
    setLanguageSaving(true);
    try {
      const language = await api.setLanguage(value);
      setState((s) => ({
        ...s,
        language,
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLanguageSaving(false);
    }
  }
  const weeks = summary && !summary.seasonError ? summary.weeks : state?.catalog.weeks || [];
  const seriesIds = [...new Set(weeks.map(w=>w.series))].sort((a,b)=>a-b);
  const seriesName = id => t(seriesNames[id] || weeks.find(w=>w.series===id)?.title || `SERIES ${id}`);
  const queuedCars = allCars ? (summary?.garage?.missing.length ?? state?.cars?.length ?? 0) : carQueue.reduce((n,c)=>n+c.quantity,0);
  const overCapacity = !!summary?.garage && summary.garage.total + queuedCars > summary.garage.capacity;
  const visibleWeeks = weeks.filter((w) => w.series === series);
  const selectedWeeks = weeks.filter((w) => selected.includes(w.key));
  const selectedPoints = selectedWeeks.reduce((n, w) => n + w.maxPoints, 0);
  async function action(fn) {
    setError("");
    setNotice("");
    setBusy(true);
    setProgress({percent:0,message:''});
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function acceptContent(result){
    if(result.unchanged){setNotice(result.carsPending?'季节目录已更新；新车辆资源待解密，请在更新中心启用在线解密或导入数据包。':'内容目录已是最新。');return;}
    setState(s=>({...s,...result}));setSummary(result.summary);setSelected([]);setCarQueue([]);setAllCars(false);
    setNotice(result.carsPending?'季节目录已更新；新车辆资源待解密，请在更新中心启用在线解密或导入数据包。':'内容目录已更新，已清空选择以使用最新数据。');
  }
  async function openConnect() {
    setConnect(true);
    await action(async () => {
      const s = await api.scan();
      setSaves(s);
      setFile(s[0]?.path || "");
    });
  }
  async function choose() {
    await action(async () => {
      const p = await api.choose();
      if (p) setFile(p);
    });
  }
  async function load() {
    await action(async () => {
      setProgress({
        percent: 0,
        message: "连接存档",
      });
      const s = await api.load(file);
      setSummary(s);
      setSelected([]);
      setCarQueue([]);setAllCars(false);
      setConnect(false);
      setNotice("");
    });
  }
  const toggle = (key) =>
    setSelected((v) =>
      v.includes(key) ? v.filter((k) => k !== key) : [...v, key],
    );
  function selectSeries() {
    const available = visibleWeeks
      .filter((w) => w.available !== false)
      .map((w) => w.key);
    setSelected((v) =>
      available.every((k) => v.includes(k))
        ? v.filter((k) => !available.includes(k))
        : [...new Set([...v, ...available])],
    );
  }
  async function apply() {
    await action(async () => {
      setProgress({
        percent: 0,
        message: "准备修改",
      });
      const result = await api.apply({
        weeks: selected,
        cars: carQueue,
        allCars,
      });
      setSummary(result.summary);
      setBackups(await api.backups());
      setSelected([]);
      setCarQueue([]);setAllCars(false);
      setNotice(
        result.unchanged
          ? "所选内容已完成，存档无需修改。"
          : "所选季节赛与车辆库存已写回，自动备份已保存。",
      );
    });
  }
  async function restore() {
    const id = restoreTarget.id;
    setRestoreTarget(null);
    await action(async () => {
      await api.restore(id);
      setSummary(null);
      setSelected([]);
      setCarQueue([]);setAllCars(false);
      setBackups(await api.backups());
      setNotice("原存档已恢复；恢复前的版本也已备份。重新连接可查看结果。");
    });
  }
  const activeSeriesPoints = visibleWeeks.reduce(
      (n, w) => n + (w.points || 0),
      0,
    ),
    activeSeriesMax = visibleWeeks.reduce((n, w) => n + w.maxPoints, 0);
  return (
    <LanguageContext.Provider value={locale}>
      <div className="app-shell">
        <header className="masthead">
          <div className="brand">
            <div className="brand-symbol">
              <Flag size={28} fill="currentColor" />
            </div>
            <div>
              <div className="brand-top">
                FESTIVAL <b>TOOLKIT</b>
                <span>6</span>
              </div>
              <div className="brand-sub">
                {t("地平线 · 存档工坊")}
                <i>UNOFFICIAL COMPANION</i>
              </div>
            </div>
          </div>
          <div className="header-right">
            <label className="language-control">
              <Languages size={17} />
              <select
                aria-label="Language / 语言"
                value={state?.language?.preference || "system"}
                onChange={(e) => changeLanguage(e.target.value)}
                disabled={!state || busy || languageSaving}
              >
                <option value="system">{t("跟随系统")}</option>
                <option value="zh">简体中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <span className="build-label">
              WINDOWS EDITION <b>V{state?.version || "0.2.0"}</b>
            </span>
            <button
              className="profile-button"
              onClick={openConnect}
              disabled={busy}
            >
              <HardDrive size={18} />
              <div>
                <small>
                  {summary
                    ? t("存档已连接")
                    : t(
                        "你的旅程，从这里开始",
                      )}
                </small>
                <strong>
                  {summary
                    ? t("玩家 {0}", [summary.xuid.slice(-6)])
                    : t("连接本地存档")}
                </strong>
              </div>
              <ChevronRight size={17} />
            </button>
          </div>
        </header>
        <nav className="main-nav" aria-label={t("功能导航")}>
          <span className="nav-mark">H / 06</span>
          {[
            ["seasons", t("季节赛"), Flag],
            ['garage',t('车辆收藏'),CarFront],
            ['updates',t('更新中心'),RefreshCw],
            ["backups", t("备份与恢复"), History],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={17} />
              {label}
              <span>{{seasons:'PLAYLIST',garage:'GARAGE',updates:'CONTENT',backups:'RECOVERY'}[id]}</span>
            </button>
          ))}
          <div className="nav-spacer" />
          <button className="about-btn" onClick={() => setInfo(true)}>
            <Info size={17} />
            {t("使用说明")}
          </button>
        </nav>
        <main>
          {error ? (
            <div className="message error" role="alert">
              <Info size={18} />
              <span>{t(error)}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          ) : null}
          {notice ? (
            <div className="message success" role="status">
              <CheckCircle2 size={18} />
              <span>{t(notice)}</span>
              <button onClick={() => setNotice("")}>×</button>
            </div>
          ) : null}
          {tab==='seasons' && summary?.seasonError ? <div className="message error" role="alert">{t(summary.seasonError)}</div> : null}
          {tab === 'garage' ? <Garage cars={state?.cars||[]} summary={summary} queue={carQueue} setQueue={setCarQueue} allCars={allCars} setAllCars={setAllCars} busy={busy}/> : null}
          {tab === 'updates' ? <Updates state={state} busy={busy} api={api} action={action} accept={acceptContent} notice={setNotice}/> : null}
          {tab === "seasons" ? (
            <>
              <section className="page-intro">
                <div>
                  <div className="eyebrow">YOUR FESTIVAL. YOUR WAY.</div>
                  <h1>
                    {t(
                      "每一周，都值得点亮",
                    )}
                    <span>{t("。")}</span>
                  </h1>
                  <p>
                    {t(
                      "挑选你的赛季与季节，批量编辑整周的完成记录与季节积分。",
                    )}
                  </p>
                </div>
                <div className="intro-actions">
                  <button
                    className="small-btn"
                    onClick={() =>
                      setSelected(
                        weeks
                          .filter((w) => w.available !== false)
                          .map((w) => w.key),
                      )
                    }
                    disabled={busy}
                  >
                    <CheckCheck size={16} />
                    {t("全选所有赛季")}
                  </button>
                  <button
                    className="text-btn"
                    onClick={() => setSelected([])}
                    disabled={!selected.length || busy}
                  >
                    {t("清空选择")}
                  </button>
                </div>
              </section>
              <div
                className="series-tabs"
                role="tablist"
                aria-label={t("赛季")}
              >
                <span>SERIES</span>
                {seriesIds.map((s) => (
                  <button
                    role="tab"
                    aria-selected={series === s}
                    key={s}
                    onClick={() => setSeries(s)}
                    className={series === s ? "active" : ""}
                  >
                    <b>S{s}</b>
                    <span>{seriesName(s)}</span>
                    {summary?.weeks.some((w) => w.series === s) &&
                    summary.weeks
                      .filter((w) => w.series === s)
                      .every((w) => w.complete) ? (
                      <Check size={14} />
                    ) : null}
                  </button>
                ))}
              </div>
              <section className="festival-layout">
                <article className={`series-poster ${state?.artwork?.series?.[series]?'has-game-art':''}`}>
                  {state?.artwork?.series?.[series] ? <img className="series-game-art" src={state.artwork.series[series].url} alt={t('S{0} 游戏内系列赛封面',[series])} title={state.artwork.series[series].source}/> : <div className="poster-bg" />}
                  <div className="poster-top">
                    <span className="label-pink">FESTIVAL PLAYLIST</span>
                    <span className="poster-number">S{series}</span>
                  </div>
                  <div className="poster-copy">
                    <p>HORIZON FESTIVAL / JAPAN</p>
                    <h2>
                      {visibleWeeks[0]?.title.split(" ").map((w, i) => (
                        <React.Fragment key={i}>
                          {w}
                          <br />
                        </React.Fragment>
                      ))}
                    </h2>
                    <span className="poster-chinese">
                      {seriesName(series)}
                    </span>
                  </div>
                  <div className="poster-bottom">
                    <div>
                      <small>{t("赛季积分")}</small>
                      <strong>
                        {summary ? activeSeriesPoints : "—"}
                        <span> / {activeSeriesMax}</span>
                      </strong>
                    </div>
                    <div className="poster-progress">
                      <i
                        style={{
                          width: `${activeSeriesMax ? (activeSeriesPoints / activeSeriesMax) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <button onClick={selectSeries} disabled={busy}>
                      <Layers size={17} />
                      {visibleWeeks.every((w) => selected.includes(w.key))
                        ? t("取消本赛季")
                        : t("选择整个赛季")}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </article>
                <div className="weeks-area">
                  <div className="section-label">
                    <span>SELECT YOUR SEASONS</span>
                    <span>
                      {t("4 周 /")}{" "}
                      {visibleWeeks.reduce((n, w) => n + w.events.length, 0)}{" "}
                      {t("项挑战")}
                    </span>
                  </div>
                  <div className="weeks-grid">
                    {visibleWeeks.map((w) => (
                      <WeekCard
                        key={w.key}
                        week={w}
                        selected={selected.includes(w.key)}
                        toggle={() => toggle(w.key)}
                        disabled={busy || !!summary?.seasonError}
                      />
                    ))}
                  </div>
                  <div className="included">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>
                        {t(
                          "每次修改，先留一份退路。",
                        )}
                      </strong>
                      <p>
                        {t(
                          "自动备份原存档，并在写回前完成加密回读校验。",
                        )}
                      </p>
                    </div>
                    <span>BACKUP FIRST</span>
                  </div>
                </div>
              </section>
              <div className="detail-strip">
                <div>
                  <b>{t("整周挑战")}</b>
                  <span>
                    {t(
                      "每日 · 每周 · 锦标赛 · 特技 · 照片 · 更多",
                    )}
                  </span>
                </div>
                <div>
                  <b>{t("精确选择")}</b>
                  <span>
                    {t(
                      "只修改所选周，保留其他季节的进度",
                    )}
                  </span>
                </div>
                <div>
                  <b>{t("已知内容")}</b>
                  <span>
                    {t(
                      '当前目录：{0} 个系列赛，共 {1} 周', [seriesIds.length,weeks.length],
                    )}
                  </span>
                </div>
              </div>
            </>
          ) : null}
          {tab === "backups" ? (
            <>
              <section className="page-intro">
                <div>
                  <div className="eyebrow">EVERY JOURNEY HAS A RETURN.</div>
                  <h1>
                    {t(
                      "放心出发，随时回来",
                    )}
                    <span>{t("。")}</span>
                  </h1>
                  <p>
                    {t(
                      "每次写入与恢复之前，自动保存完整原文件。",
                    )}
                  </p>
                </div>
                <button className="small-btn" onClick={() => api.openBackups()}>
                  <FolderOpen size={17} />
                  {t("打开备份目录")}
                </button>
              </section>
              <div className="backup-banner">
                <ShieldCheck size={38} />
                <div>
                  <h3>
                    {t(
                      "你的每一次修改，都有记录。",
                    )}
                  </h3>
                  <p>
                    {t(
                      "备份与应用分开保存，关闭程序后仍然保留。",
                    )}
                  </p>
                </div>
                <span>
                  {backups.length}
                  <small>{t("份恢复点")}</small>
                </span>
              </div>
              {backups.length ? (
                <div className="backup-list">
                  {backups.map((b) => (
                    <article key={b.id}>
                      <div className="backup-icon">
                        <History size={24} />
                      </div>
                      <div>
                        <h3>
                          {b.kind === "restore"
                            ? t("恢复前快照")
                            : t("修改前备份")}{" "}
                          <em>
                            {b.status === "complete"
                              ? t("完整")
                              : b.status === "rolled-back"
                                ? t("已回滚")
                                : t("中断可恢复")}
                          </em>
                        </h3>
                        <time>
                          {new Date(b.created).toLocaleString(
                            locale === "zh" ? "zh-CN" : "en-US",
                          )}
                        </time>
                        <p title={b.targets[0]}>{b.targets[0]}</p>
                      </div>
                      <button
                        className="small-btn"
                        disabled={busy}
                        onClick={() => setRestoreTarget(b)}
                      >
                        {t("恢复此版本")}
                        <ArrowLeft size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty backup-empty">
                  <History size={46} />
                  <h3>
                    {t(
                      "第一份备份，随第一次修改一起到来。",
                    )}
                  </h3>
                  <p>
                    {t(
                      "应用会在写回前自动保存，届时可在这里恢复。",
                    )}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </main>
        <footer className="action-dock">
          <div className="dock-status">
            <span className={summary ? "status-dot online" : "status-dot"} />
            <div>
              <strong>
                {summary
                  ? t("本地存档已连接")
                  : t("等待连接存档")}
              </strong>
              <small title={summary?.file}>
                {summary
                  ? summary.file
                  : t("选择 C_ProfileData 开始")}
              </small>
            </div>
          </div>
          <div className="selection-summary">
            <b>{(selected.length + queuedCars).toString().padStart(2, "0")}</b>
            <span>
              {t('已选择')}
              <small>{t('{0} 周 · {1} 辆',[selected.length,queuedCars])}</small>
            </span>
          </div>
          {summary ? (
            <button
              className="apply-button"
              onClick={apply}
              disabled={busy || (!selected.length && !queuedCars) || overCapacity || (!!selected.length && !!summary?.seasonError) || (!!queuedCars && !!summary?.garageError)}
            >
              {busy ? (
                <LoaderCircle className="spin" size={20} />
              ) : (
                <CheckCheck size={20} />
              )}{" "}
              {overCapacity ? t('超出车库容量') : busy
                ? t("正在处理")
                : t("备份并应用修改")}{" "}
              <ArrowUpRight size={20} />
            </button>
          ) : (
            <button
              className="apply-button"
              onClick={openConnect}
              disabled={busy}
            >
              <FolderOpen size={19} />
              {t("连接存档")}
              <ArrowUpRight size={20} />
            </button>
          )}
        </footer>
        {busy ? (
          <div className="working" role="status">
            <LoaderCircle className="spin" size={18} />
            <span>
              {t(progress.message || t("正在处理…"))}
            </span>
            <b>{progress.percent}%</b>
            <i
              style={{
                width: `${progress.percent}%`,
              }}
            />
          </div>
        ) : null}
        {connect ? (
          <Modal
            title={t("连接你的存档")}
            close={() => {
              if (!busy) setConnect(false);
            }}
          >
            <p className="modal-lead">
              {t(
                "已自动寻找本机 FH6 存档，也可以手动选择文件。",
              )}
            </p>
            {error ? (
              <div className="message error" role="alert">
                {t(error)}
              </div>
            ) : null}
            <div className="detected-list">
              {saves.slice(0, 5).map((s) => (
                <button
                  className={file === s.path ? "chosen" : ""}
                  key={s.path}
                  onClick={() => setFile(s.path)}
                  disabled={busy}
                >
                  <HardDrive size={20} />
                  <span>
                    <b>
                      {t("玩家")}
                      {s.account.slice(-6)}
                    </b>
                    <small>{s.path}</small>
                    <time>
                      {new Date(s.modified).toLocaleString(
                        locale === "zh" ? "zh-CN" : "en-US",
                      )}{" "}
                      · {(s.size / 1024).toFixed(0)} KB
                    </time>
                  </span>
                  {file === s.path ? <Check size={18} /> : null}
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="save-file">
              {t("存档文件")}
            </label>
            <div className="file-input">
              <input
                id="save-file"
                value={file}
                onChange={(e) => setFile(e.target.value)}
                disabled={busy}
                placeholder={t("选择 C_ProfileData")}
              />
              <button onClick={choose} disabled={busy}>
                <FolderOpen size={18} />
                {t("浏览")}
              </button>
            </div>
            <div className="service-note">
              <Info size={17} />
              <p>
                {t(
                  "加解密使用 ForzaCryptoTool 的在线服务，会将所选存档发送至",
                )}{" "}
                <b>forzamods.dev</b>
                {t(
                  "。修改计算和备份在本机完成；请先退出游戏。",
                )}
              </p>
            </div>
            <button
              className="primary wide"
              onClick={load}
              disabled={busy || !file}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <HardDrive size={18} />
              )}
              {t("连接并解密")}
            </button>
          </Modal>
        ) : null}
        {restoreTarget ? (
          <Modal
            title={t("恢复这个版本")}
            close={() => setRestoreTarget(null)}
          >
            <p className="modal-lead">
              {t("将恢复至")}
              {new Date(restoreTarget.created).toLocaleString(
                locale === "zh" ? "zh-CN" : "en-US",
              )}{" "}
              {t("修改前的存档。")}
            </p>
            <p className="restore-path">{restoreTarget.targets[0]}</p>
            <div className="service-note">
              <ShieldCheck size={20} />
              <p>
                {t(
                  "当前版本会先保存为新的备份，之后仍可恢复。",
                )}
              </p>
            </div>
            <button className="primary wide" onClick={restore}>
              {t("恢复存档")}
            </button>
          </Modal>
        ) : null}
        {info ? (
          <Modal
            title={t("关于存档工坊")}
            close={() => setInfo(false)}
          >
            <p className="modal-lead">
              {t(
                "Horizon Festival Toolkit · 非官方本地存档工具",
              )}
            </p>
            <ol className="help-steps">
              <li>
                <b>
                  {t(
                    "退出游戏并连接存档。",
                  )}
                </b>
                <p>
                  {t(
                    "加密存档通过 ForzaCryptoTool 在线加解密。",
                  )}
                </p>
              </li>
              <li>
                <b>
                  {t("选择赛季或某几周。")}
                </b>
                <p>
                  {t(
                    '搜索车辆并添加指定数量，或补齐全车。更新中心可读取游戏资源或导入独立内容包。',
                  )}
                </p>
              </li>
              <li>
                <b>
                  {t(
                    "点击“备份并应用修改”。",
                  )}
                </b>
                <p>
                  {t(
                    "自动备份，验证修改并加密回读，然后写回原路径。",
                  )}
                </p>
              </li>
            </ol>
            <div className="service-note">
              <Info size={20} />
              <p>
                {t(
                  "本工具验证存档数据结构与字段。尚未验证游戏实际读档、所有卡片显示和独立挑战子状态；不会额外发放挑战奖励。不同版本或线上服务可能重新计算进度。",
                )}
              </p>
            </div>
            <p className="credits">
              {t(
                "视觉参考 FH6 菜单；独立工具，与 Microsoft、Xbox、Playground Games 无隶属关系。",
              )}
            </p>
          </Modal>
        ) : null}
      </div>
    </LanguageContext.Provider>
  );
}
