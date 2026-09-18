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
} from "lucide-react";
import { LanguageContext, useI18n } from "./Language.jsx";
import { translate, browserLocale } from "./i18n.mjs";
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
      aria-label={t("\u9009\u62E9 S{0} \u7B2C{1}\u5468 {2}", [
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
                {t("\u5DF2\u5B8C\u6210")}
              </>
            ) : week.available === false ? (
              t("\u6B64\u5B58\u6863\u5C1A\u672A\u8BB0\u5F55")
            ) : (
              t("{0} / {1} \u9879\u6311\u6218", [
                week.completed ?? "—",
                week.events.length,
              ])
            )}
          </span>
          <span>
            {selected ? t("\u5DF2\u9009\u62E9") : t("\u9009\u62E9\u6B64\u5468")}
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
      [...root.current.querySelectorAll('button,input,[tabindex="0"]')].filter(
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
            {t("\u5173\u95ED")}
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
    [series, setSeries] = useState(4),
    [selected, setSelected] = useState([]),
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
    return api.onProgress(setProgress);
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
  const weeks = summary?.weeks || state?.catalog.weeks || [];
  const visibleWeeks = weeks.filter((w) => w.series === series);
  const selectedWeeks = weeks.filter((w) => selected.includes(w.key));
  const selectedPoints = selectedWeeks.reduce((n, w) => n + w.maxPoints, 0);
  async function action(fn) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
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
      });
      setSummary(result.summary);
      setBackups(await api.backups());
      setSelected([]);
      setNotice(
        result.unchanged
          ? "所选内容已完成，存档无需修改。"
          : "已写回所选季节赛进度，自动备份已保存。",
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
                {t("\u5730\u5E73\u7EBF \xB7 \u5B58\u6863\u5DE5\u574A")}
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
              WINDOWS EDITION <b>V{state?.version || "0.1.1"}</b>
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
                    ? t("\u5B58\u6863\u5DF2\u8FDE\u63A5")
                    : t(
                        "\u4F60\u7684\u65C5\u7A0B\uFF0C\u4ECE\u8FD9\u91CC\u5F00\u59CB",
                      )}
                </small>
                <strong>
                  {summary
                    ? t("\u73A9\u5BB6 {0}", [summary.xuid.slice(-6)])
                    : t("\u8FDE\u63A5\u672C\u5730\u5B58\u6863")}
                </strong>
              </div>
              <ChevronRight size={17} />
            </button>
          </div>
        </header>
        <nav className="main-nav" aria-label={t("\u529F\u80FD\u5BFC\u822A")}>
          <span className="nav-mark">H / 06</span>
          {[
            ["seasons", t("\u5B63\u8282\u8D5B"), Flag],
            ["backups", t("\u5907\u4EFD\u4E0E\u6062\u590D"), History],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={17} />
              {label}
              <span>{id === "seasons" ? "PLAYLIST" : "RECOVERY"}</span>
            </button>
          ))}
          <div className="nav-spacer" />
          <button className="about-btn" onClick={() => setInfo(true)}>
            <Info size={17} />
            {t("\u4F7F\u7528\u8BF4\u660E")}
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
          {tab === "seasons" ? (
            <>
              <section className="page-intro">
                <div>
                  <div className="eyebrow">YOUR FESTIVAL. YOUR WAY.</div>
                  <h1>
                    {t(
                      "\u6BCF\u4E00\u5468\uFF0C\u90FD\u503C\u5F97\u70B9\u4EAE",
                    )}
                    <span>{t("。")}</span>
                  </h1>
                  <p>
                    {t(
                      "\u6311\u9009\u4F60\u7684\u8D5B\u5B63\u4E0E\u5B63\u8282\uFF0C\u6279\u91CF\u7F16\u8F91\u6574\u5468\u7684\u5B8C\u6210\u8BB0\u5F55\u4E0E\u5B63\u8282\u79EF\u5206\u3002",
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
                    {t("\u5168\u9009\u6240\u6709\u8D5B\u5B63")}
                  </button>
                  <button
                    className="text-btn"
                    onClick={() => setSelected([])}
                    disabled={!selected.length || busy}
                  >
                    {t("\u6E05\u7A7A\u9009\u62E9")}
                  </button>
                </div>
              </section>
              <div
                className="series-tabs"
                role="tablist"
                aria-label={t("\u8D5B\u5B63")}
              >
                <span>SERIES</span>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    role="tab"
                    aria-selected={series === s}
                    key={s}
                    onClick={() => setSeries(s)}
                    className={series === s ? "active" : ""}
                  >
                    <b>S{s}</b>
                    <span>{t(seriesNames[s])}</span>
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
                <article className="series-poster">
                  <div className="poster-bg" />
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
                      {t(seriesNames[series])}
                    </span>
                  </div>
                  <div className="poster-bottom">
                    <div>
                      <small>{t("\u8D5B\u5B63\u79EF\u5206")}</small>
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
                        ? t("\u53D6\u6D88\u672C\u8D5B\u5B63")
                        : t("\u9009\u62E9\u6574\u4E2A\u8D5B\u5B63")}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </article>
                <div className="weeks-area">
                  <div className="section-label">
                    <span>SELECT YOUR SEASONS</span>
                    <span>
                      {t("4 \u5468 /")}{" "}
                      {visibleWeeks.reduce((n, w) => n + w.events.length, 0)}{" "}
                      {t("\u9879\u6311\u6218")}
                    </span>
                  </div>
                  <div className="weeks-grid">
                    {visibleWeeks.map((w) => (
                      <WeekCard
                        key={w.key}
                        week={w}
                        selected={selected.includes(w.key)}
                        toggle={() => toggle(w.key)}
                        disabled={busy}
                      />
                    ))}
                  </div>
                  <div className="included">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>
                        {t(
                          "\u6BCF\u6B21\u4FEE\u6539\uFF0C\u5148\u7559\u4E00\u4EFD\u9000\u8DEF\u3002",
                        )}
                      </strong>
                      <p>
                        {t(
                          "\u81EA\u52A8\u5907\u4EFD\u539F\u5B58\u6863\uFF0C\u5E76\u5728\u5199\u56DE\u524D\u5B8C\u6210\u52A0\u5BC6\u56DE\u8BFB\u6821\u9A8C\u3002",
                        )}
                      </p>
                    </div>
                    <span>BACKUP FIRST</span>
                  </div>
                </div>
              </section>
              <div className="detail-strip">
                <div>
                  <b>{t("\u6574\u5468\u6311\u6218")}</b>
                  <span>
                    {t(
                      "\u6BCF\u65E5 \xB7 \u6BCF\u5468 \xB7 \u9526\u6807\u8D5B \xB7 \u7279\u6280 \xB7 \u7167\u7247 \xB7 \u66F4\u591A",
                    )}
                  </span>
                </div>
                <div>
                  <b>{t("\u7CBE\u786E\u9009\u62E9")}</b>
                  <span>
                    {t(
                      "\u53EA\u4FEE\u6539\u6240\u9009\u5468\uFF0C\u4FDD\u7559\u5176\u4ED6\u5B63\u8282\u7684\u8FDB\u5EA6",
                    )}
                  </span>
                </div>
                <div>
                  <b>{t("\u5DF2\u77E5\u5185\u5BB9")}</b>
                  <span>
                    {t(
                      "\u5F53\u524D\u76EE\u5F55\u8986\u76D6 S1\u2013S5\uFF0C\u5171 20 \u5468",
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
                      "\u653E\u5FC3\u51FA\u53D1\uFF0C\u968F\u65F6\u56DE\u6765",
                    )}
                    <span>{t("。")}</span>
                  </h1>
                  <p>
                    {t(
                      "\u6BCF\u6B21\u5199\u5165\u4E0E\u6062\u590D\u4E4B\u524D\uFF0C\u81EA\u52A8\u4FDD\u5B58\u5B8C\u6574\u539F\u6587\u4EF6\u3002",
                    )}
                  </p>
                </div>
                <button className="small-btn" onClick={() => api.openBackups()}>
                  <FolderOpen size={17} />
                  {t("\u6253\u5F00\u5907\u4EFD\u76EE\u5F55")}
                </button>
              </section>
              <div className="backup-banner">
                <ShieldCheck size={38} />
                <div>
                  <h3>
                    {t(
                      "\u4F60\u7684\u6BCF\u4E00\u6B21\u4FEE\u6539\uFF0C\u90FD\u6709\u8BB0\u5F55\u3002",
                    )}
                  </h3>
                  <p>
                    {t(
                      "\u5907\u4EFD\u4E0E\u5E94\u7528\u5206\u5F00\u4FDD\u5B58\uFF0C\u5173\u95ED\u7A0B\u5E8F\u540E\u4ECD\u7136\u4FDD\u7559\u3002",
                    )}
                  </p>
                </div>
                <span>
                  {backups.length}
                  <small>{t("\u4EFD\u6062\u590D\u70B9")}</small>
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
                            ? t("\u6062\u590D\u524D\u5FEB\u7167")
                            : t("\u4FEE\u6539\u524D\u5907\u4EFD")}{" "}
                          <em>
                            {b.status === "complete"
                              ? t("\u5B8C\u6574")
                              : b.status === "rolled-back"
                                ? t("\u5DF2\u56DE\u6EDA")
                                : t("\u4E2D\u65AD\u53EF\u6062\u590D")}
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
                        {t("\u6062\u590D\u6B64\u7248\u672C")}
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
                      "\u7B2C\u4E00\u4EFD\u5907\u4EFD\uFF0C\u968F\u7B2C\u4E00\u6B21\u4FEE\u6539\u4E00\u8D77\u5230\u6765\u3002",
                    )}
                  </h3>
                  <p>
                    {t(
                      "\u5E94\u7528\u4F1A\u5728\u5199\u56DE\u524D\u81EA\u52A8\u4FDD\u5B58\uFF0C\u5C4A\u65F6\u53EF\u5728\u8FD9\u91CC\u6062\u590D\u3002",
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
                  ? t("\u672C\u5730\u5B58\u6863\u5DF2\u8FDE\u63A5")
                  : t("\u7B49\u5F85\u8FDE\u63A5\u5B58\u6863")}
              </strong>
              <small title={summary?.file}>
                {summary
                  ? summary.file
                  : t("\u9009\u62E9 C_ProfileData \u5F00\u59CB")}
              </small>
            </div>
          </div>
          <div className="selection-summary">
            <b>{selected.length.toString().padStart(2, "0")}</b>
            <span>
              {t("\u5468\u5DF2\u9009\u62E9")}
              <small>{selectedPoints} PTS</small>
            </span>
          </div>
          {summary ? (
            <button
              className="apply-button"
              onClick={apply}
              disabled={busy || !selected.length}
            >
              {busy ? (
                <LoaderCircle className="spin" size={20} />
              ) : (
                <CheckCheck size={20} />
              )}{" "}
              {busy
                ? t("\u6B63\u5728\u5904\u7406")
                : t("\u5907\u4EFD\u5E76\u5E94\u7528\u4FEE\u6539")}{" "}
              <ArrowUpRight size={20} />
            </button>
          ) : (
            <button
              className="apply-button"
              onClick={openConnect}
              disabled={busy}
            >
              <FolderOpen size={19} />
              {t("\u8FDE\u63A5\u5B58\u6863")}
              <ArrowUpRight size={20} />
            </button>
          )}
        </footer>
        {busy ? (
          <div className="working" role="status">
            <LoaderCircle className="spin" size={18} />
            <span>
              {t(progress.message || t("\u6B63\u5728\u5904\u7406\u2026"))}
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
            title={t("\u8FDE\u63A5\u4F60\u7684\u5B58\u6863")}
            close={() => {
              if (!busy) setConnect(false);
            }}
          >
            <p className="modal-lead">
              {t(
                "\u5DF2\u81EA\u52A8\u5BFB\u627E\u672C\u673A FH6 \u5B58\u6863\uFF0C\u4E5F\u53EF\u4EE5\u624B\u52A8\u9009\u62E9\u6587\u4EF6\u3002",
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
                      {t("\u73A9\u5BB6")}
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
              {t("\u5B58\u6863\u6587\u4EF6")}
            </label>
            <div className="file-input">
              <input
                id="save-file"
                value={file}
                onChange={(e) => setFile(e.target.value)}
                disabled={busy}
                placeholder={t("\u9009\u62E9 C_ProfileData")}
              />
              <button onClick={choose} disabled={busy}>
                <FolderOpen size={18} />
                {t("\u6D4F\u89C8")}
              </button>
            </div>
            <div className="service-note">
              <Info size={17} />
              <p>
                {t(
                  "\u52A0\u89E3\u5BC6\u4F7F\u7528 ForzaCryptoTool \u7684\u5728\u7EBF\u670D\u52A1\uFF0C\u4F1A\u5C06\u6240\u9009\u5B58\u6863\u53D1\u9001\u81F3",
                )}{" "}
                <b>forzamods.dev</b>
                {t(
                  "\u3002\u4FEE\u6539\u8BA1\u7B97\u548C\u5907\u4EFD\u5728\u672C\u673A\u5B8C\u6210\uFF1B\u8BF7\u5148\u9000\u51FA\u6E38\u620F\u3002",
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
              {t("\u8FDE\u63A5\u5E76\u89E3\u5BC6")}
            </button>
          </Modal>
        ) : null}
        {restoreTarget ? (
          <Modal
            title={t("\u6062\u590D\u8FD9\u4E2A\u7248\u672C")}
            close={() => setRestoreTarget(null)}
          >
            <p className="modal-lead">
              {t("\u5C06\u6062\u590D\u81F3")}
              {new Date(restoreTarget.created).toLocaleString(
                locale === "zh" ? "zh-CN" : "en-US",
              )}{" "}
              {t("\u4FEE\u6539\u524D\u7684\u5B58\u6863\u3002")}
            </p>
            <p className="restore-path">{restoreTarget.targets[0]}</p>
            <div className="service-note">
              <ShieldCheck size={20} />
              <p>
                {t(
                  "\u5F53\u524D\u7248\u672C\u4F1A\u5148\u4FDD\u5B58\u4E3A\u65B0\u7684\u5907\u4EFD\uFF0C\u4E4B\u540E\u4ECD\u53EF\u6062\u590D\u3002",
                )}
              </p>
            </div>
            <button className="primary wide" onClick={restore}>
              {t("\u6062\u590D\u5B58\u6863")}
            </button>
          </Modal>
        ) : null}
        {info ? (
          <Modal
            title={t("\u5173\u4E8E\u5B58\u6863\u5DE5\u574A")}
            close={() => setInfo(false)}
          >
            <p className="modal-lead">
              {t(
                "Horizon Festival Toolkit \xB7 \u975E\u5B98\u65B9\u672C\u5730\u5B58\u6863\u5DE5\u5177",
              )}
            </p>
            <ol className="help-steps">
              <li>
                <b>
                  {t(
                    "\u9000\u51FA\u6E38\u620F\u5E76\u8FDE\u63A5\u5B58\u6863\u3002",
                  )}
                </b>
                <p>
                  {t(
                    "\u52A0\u5BC6\u5B58\u6863\u901A\u8FC7 ForzaCryptoTool \u5728\u7EBF\u52A0\u89E3\u5BC6\u3002",
                  )}
                </p>
              </li>
              <li>
                <b>
                  {t("\u9009\u62E9\u8D5B\u5B63\u6216\u67D0\u51E0\u5468\u3002")}
                </b>
                <p>
                  {t(
                    "\u5B63\u8282\u8D5B\u76EE\u5F55\u8986\u76D6 S1\u2013S5\uFF0C\u5171 20 \u5468\uFF1B\u672C\u7248\u672C\u53EA\u63D0\u4F9B\u5B63\u8282\u8D5B\u7F16\u8F91\uFF0C\u4E0D\u5305\u542B\u52A0\u8F66\u529F\u80FD\u3002",
                  )}
                </p>
              </li>
              <li>
                <b>
                  {t(
                    "\u70B9\u51FB\u201C\u5907\u4EFD\u5E76\u5E94\u7528\u4FEE\u6539\u201D\u3002",
                  )}
                </b>
                <p>
                  {t(
                    "\u81EA\u52A8\u5907\u4EFD\uFF0C\u9A8C\u8BC1\u4FEE\u6539\u5E76\u52A0\u5BC6\u56DE\u8BFB\uFF0C\u7136\u540E\u5199\u56DE\u539F\u8DEF\u5F84\u3002",
                  )}
                </p>
              </li>
            </ol>
            <div className="service-note">
              <Info size={20} />
              <p>
                {t(
                  "\u672C\u5DE5\u5177\u9A8C\u8BC1\u5B58\u6863\u6570\u636E\u7ED3\u6784\u4E0E\u5B57\u6BB5\u3002\u5C1A\u672A\u9A8C\u8BC1\u6E38\u620F\u5B9E\u9645\u8BFB\u6863\u3001\u6240\u6709\u5361\u7247\u663E\u793A\u548C\u72EC\u7ACB\u6311\u6218\u5B50\u72B6\u6001\uFF1B\u4E0D\u4F1A\u989D\u5916\u53D1\u653E\u6311\u6218\u5956\u52B1\u3002\u4E0D\u540C\u7248\u672C\u6216\u7EBF\u4E0A\u670D\u52A1\u53EF\u80FD\u91CD\u65B0\u8BA1\u7B97\u8FDB\u5EA6\u3002",
                )}
              </p>
            </div>
            <p className="credits">
              {t(
                "\u89C6\u89C9\u53C2\u8003 FH6 \u83DC\u5355\uFF1B\u72EC\u7ACB\u5DE5\u5177\uFF0C\u4E0E Microsoft\u3001Xbox\u3001Playground Games \u65E0\u96B6\u5C5E\u5173\u7CFB\u3002",
              )}
            </p>
          </Modal>
        ) : null}
      </div>
    </LanguageContext.Provider>
  );
}
