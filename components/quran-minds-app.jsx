"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const nav = [
  ["dashboard", "/", "grid", "Overview"],
  ["teacher", "/teacher", "book", "Teacher log"],
  ["family", "/family", "chart", "Progress"],
  ["practice", "/practice", "repeat", "Review"],
  ["memorize", "/memorize", "spark", "Memorize"],
];

const roster = [
  { name: "Maryam Ahmed", initials: "MA", portion: "Al-Baqarah 2:6–10", status: "Ready", color: "plum" },
  { name: "Yusuf Khan", initials: "YK", portion: "Al-Baqarah 2:1–5", status: "Needs review", color: "amber" },
  { name: "Ibrahim Ali", initials: "IA", portion: "Al-Fatihah 1:1–7", status: "Ready", color: "blue" },
  { name: "Zaynab Omar", initials: "ZO", portion: "Al-Baqarah 2:11–15", status: "Absent", color: "green" },
];

const history = [
  ["Jul 10", "Sabaq", "Al-Baqarah 2:1–5", "green", "Passed"],
  ["Jul 9", "Sabqi", "Al-Fatihah 1:1–7", "yellow", "Review"],
  ["Jul 8", "Manzil", "Juz 30", "green", "Passed"],
  ["Jul 7", "Sabaq", "Al-Baqarah 2:1–5", "yellow", "Review"],
  ["Jul 6", "Attendance", "On time", "green", "Present"],
];

function Icon({ name, size = 20 }) {
  const paths = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z",
    chart: "M4 19V10m6 9V5m6 14v-7m5 7H2",
    repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3",
    spark: "m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
    check: "m5 12 4 4L19 6",
    alert: "M12 9v4m0 4h.01M10.3 3.4 2.7 17a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.4a2 2 0 0 0-3.4 0z",
    arrow: "m9 18 6-6-6-6",
    clock: "M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={name === "grid" || name === "book" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.grid} /></svg>;
}

function AppShell({ mode, children }) {
  const [mobileNav, setMobileNav] = useState(false);
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <Link href="/" className="brand" aria-label="Quran Minds home"><span className="brand-mark">ق</span><span>Quran<span>Minds</span></span></Link>
      <nav aria-label="Main navigation">
        {nav.map(([key, href, icon, label]) => <Link key={key} href={href} className={mode === key ? "active" : ""}><Icon name={icon} /><span>{label}</span></Link>)}
      </nav>
      <div className="sidebar-note"><span className="verified-dot">✓</span><div><strong>Verified Quran text</strong><small>Tanzil Uthmani · v1.1</small></div></div>
      <div className="user-card"><span className="avatar plum">FA</span><div><strong>Fatima Ahmed</strong><small>Teacher · Al-Noor Academy</small></div><button aria-label="Account menu">•••</button></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle menu">☰</button><div className="school"><span>AN</span><div><strong>Al-Noor Academy</strong><small>Summer term · Week 6</small></div></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">●</button><span className="date-chip">Sunday, July 12</span></div></header>
      <main className="workspace">{children}</main>
    </div>
  </div>;
}

function Dashboard() {
  return <>
    <section className="page-heading"><div><p className="eyebrow">Assalamu alaikum, Fatima</p><h1>Your class at a glance</h1><p>Four students are scheduled today. Two are ready to be heard.</p></div><Link className="primary-button" href="/teacher">Start today’s session <span>→</span></Link></section>
    <section className="metric-grid">
      <Metric label="Students today" value="4" detail="2 ready now" tone="plum" icon="book" />
      <Metric label="Weekly attendance" value="94%" detail="↑ 3% from last week" tone="green" icon="check" />
      <Metric label="Pass rate" value="82%" detail="Sabaq this week" tone="blue" icon="chart" />
      <Metric label="Reviews due" value="7" detail="3 high priority" tone="amber" icon="repeat" />
    </section>
    <div className="dashboard-grid">
      <section className="panel roster-panel"><div className="panel-head"><div><h2>Today’s students</h2><p>Sunday morning halaqah</p></div><Link href="/teacher">Open log →</Link></div>
        <div className="roster-list">{roster.map((s, i) => <div className="roster-row" key={s.name}><span className={`avatar ${s.color}`}>{s.initials}</span><div className="grow"><strong>{s.name}</strong><small>{s.portion}</small></div><span className={`status ${s.status.toLowerCase().replace(" ", "-")}`}>{s.status}</span><span className="time">{9 + i}:00</span></div>)}</div>
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Class momentum</h2><p>Pages memorized · 8 weeks</p></div><span className="tiny-badge">+12%</span></div><MiniChart /><div className="chart-legend"><div><strong>28.5</strong><small>pages this term</small></div><div><strong>3.6</strong><small>weekly average</small></div></div></section>
      <section className="panel activity-panel"><div className="panel-head"><div><h2>Needs your attention</h2><p>Based on grading rules</p></div></div><div className="attention"><span className="attention-icon amber"><Icon name="alert" /></span><div><strong>Yusuf has two yellow Sabaq grades</strong><p>New Sabaq is paused until the portion is passed.</p></div><Link href="/teacher">Review</Link></div><div className="attention"><span className="attention-icon plum"><Icon name="repeat" /></span><div><strong>3 mistakes are due for review</strong><p>Maryam’s personalized practice is ready.</p></div><Link href="/practice">Open</Link></div></section>
    </div>
  </>;
}

function Metric({ label, value, detail, tone, icon }) { return <div className="metric panel"><span className={`metric-icon ${tone}`}><Icon name={icon} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></div>; }
function MiniChart() { return <svg className="mini-chart" viewBox="0 0 500 170" role="img" aria-label="Pages memorized increased from 1.8 to 4.2 per week"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b415f" stopOpacity=".24"/><stop offset="1" stopColor="#6b415f" stopOpacity="0"/></linearGradient></defs><path d="M0 135 C45 125 65 142 105 112 S170 126 205 88 S275 105 310 68 S380 83 420 44 S470 49 500 24 L500 170 L0 170Z" fill="url(#fill)"/><path d="M0 135 C45 125 65 142 105 112 S170 126 205 88 S275 105 310 68 S380 83 420 44 S470 49 500 24" fill="none" stroke="#6b415f" strokeWidth="4" strokeLinecap="round"/><circle cx="500" cy="24" r="6" fill="#6b415f"/></svg>; }

function Teacher({ verses }) {
  const pageVerses = verses.filter((v) => v.surah === 1);
  const words = pageVerses.flatMap((v) => v.text.split(" ").map((word, index) => ({ word, id: `${v.ref}:${index}`, ref: v.ref })));
  const [selected, setSelected] = useState([]);
  const [mistakeType, setMistakeType] = useState("Harakah");
  const [grades, setGrades] = useState({ Sabaq: null, Sabqi: null, Manzil: null });
  const [saved, setSaved] = useState(false);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  return <>
    <section className="page-heading compact"><div><p className="eyebrow">Teacher session</p><h1>Listen & record</h1><p>Maryam Ahmed · Sabaq · Al-Fatihah 1:1–7</p></div><div className="session-tools"><button className="secondary-button">← Student list</button><button className="primary-button" onClick={() => setSaved(true)}>{saved ? "Session saved ✓" : "Save session"}</button></div></section>
    <div className="teacher-grid">
      <section className="panel mushaf-panel"><div className="mushaf-toolbar"><button>‹</button><div><small>Medina Mushaf</small><strong>Page 1 · Juz 1</strong></div><button>›</button></div><div className="mushaf-page" dir="rtl"><div className="surah-ornament"><span>سُورَةُ ٱلْفَاتِحَةِ</span></div><p className="bismillah uthmani">{pageVerses[0]?.text}</p><div className="quran-lines" aria-label="Selectable Quran words">{words.slice(pageVerses[0]?.text.split(" ").length).map((item) => <button key={item.id} className={selected.includes(item.id) ? "word-error" : ""} onClick={() => toggle(item.id)} title={`Mark ${item.ref}`}>{item.word}</button>)}</div><div className="page-number">١</div></div><p className="source-note"><span>✓</span> Quran text is rendered verbatim from the local Tanzil Uthmani source. Select a word to record a mistake.</p></section>
      <aside className="teacher-side">
        <section className="panel grading-card"><div className="panel-head"><div><h2>Today’s grades</h2><p>Traffic-light assessment</p></div></div>{Object.keys(grades).map((type) => <div className="grade-row" key={type}><div><strong>{type}</strong><small>{type === "Sabaq" ? "New lesson" : type === "Sabqi" ? "Recent review" : "Long-term review"}</small></div><div className="grade-pills">{["green","yellow","red"].map((color) => <button aria-label={`${type} ${color}`} className={`${color} ${grades[type] === color ? "chosen" : ""}`} onClick={() => setGrades({...grades,[type]:color})} key={color} />)}</div></div>)}<RuleNotice grades={grades} /></section>
        <section className="panel mistake-card"><div className="panel-head"><div><h2>Mistakes</h2><p>{selected.length} word{selected.length === 1 ? "" : "s"} selected</p></div></div><div className="mistake-types">{["Harakah","Letter","Mutashabihat","Prompted"].map((type) => <button className={mistakeType === type ? "active" : ""} onClick={() => setMistakeType(type)} key={type}>{type}</button>)}</div>{selected.length ? <div className="mistake-summary"><span className="mistake-count">{selected.length}</span><div><strong>{mistakeType} mistake</strong><small>Added to Maryam’s review queue</small></div><button onClick={() => setSelected([])}>Clear</button></div> : <div className="empty-note">Select the exact word on the Mushaf page when a mistake occurs.</div>}</section>
      </aside>
    </div>
  </>;
}

function RuleNotice({ grades }) {
  const blocked = grades.Sabaq === "red" || grades.Sabqi === "red";
  return <div className={`rule-notice ${blocked ? "blocked" : ""}`}><Icon name={blocked ? "alert" : "check"}/><div><strong>{blocked ? "New Sabaq paused" : "Progression rule active"}</strong><p>{blocked ? "A red portion must be prepared and passed before a new assignment." : "A red, or two consecutive yellows, pauses the next Sabaq."}</p></div></div>;
}

function Family() {
  return <>
    <section className="page-heading"><div><p className="eyebrow">Maryam’s progress</p><h1>Building consistency, one page at a time</h1><p>Last class: July 10 · 94% attendance this term</p></div><button className="student-switch"><span className="avatar plum">MA</span><span><small>Viewing student</small><strong>Maryam Ahmed</strong></span><Icon name="arrow"/></button></section>
    <section className="progress-hero panel"><div className="progress-copy"><span className="tiny-badge">On track</span><h2>Estimated completion</h2><strong>March 2029</strong><p>Based on Maryam’s 8-week average of <b>3.6 pages per week</b>. Improving consistency by one page weekly could move this to August 2028.</p><div className="confidence"><span>Projection confidence</span><div><i style={{width:"78%"}}/></div><b>78%</b></div></div><div className="ring"><span><strong>42</strong><small>pages<br/>memorized</small></span></div></section>
    <section className="metric-grid family-metrics"><Metric label="Current Sabaq" value="2:6–10" detail="Al-Baqarah" tone="plum" icon="book"/><Metric label="Weekly velocity" value="3.6" detail="pages per week" tone="blue" icon="chart"/><Metric label="Attendance" value="94%" detail="31 of 33 sessions" tone="green" icon="check"/><Metric label="Review streak" value="12" detail="days in a row" tone="amber" icon="spark"/></section>
    <div className="family-grid"><section className="panel"><div className="panel-head"><div><h2>Memorization velocity</h2><p>Pages completed each week</p></div><select aria-label="Chart range"><option>Last 8 weeks</option></select></div><MiniChart/><div className="axis-labels"><span>May 24</span><span>Jun 7</span><span>Jun 21</span><span>Jul 5</span></div></section><section className="panel grade-guide"><h2>How grades work</h2><div><span className="dot green"/><p><strong>Green · Passed</strong><small>Ready to move forward</small></p></div><div><span className="dot yellow"/><p><strong>Yellow · Review</strong><small>Two yellows pause new Sabaq</small></p></div><div><span className="dot red"/><p><strong>Red · Repeat</strong><small>Prepare and pass this portion first</small></p></div></section></div>
    <section className="panel history-panel"><div className="panel-head"><div><h2>Recent records</h2><p>Attendance, portions, and outcomes</p></div><button>View full history</button></div><div className="history-table">{history.map((row) => <div className="history-row" key={row.join("")}><span>{row[0]}</span><strong>{row[1]}</strong><span>{row[2]}</span><span className={`outcome ${row[3]}`}><i/>{row[4]}</span><button aria-label={`Open ${row[0]} record`}>›</button></div>)}</div></section>
  </>;
}

function Practice({ verses }) {
  const questions = useMemo(() => verses.slice(1, 5).map((verse, index) => { const words = verse.text.split(" "); return { ...verse, prompt: words.slice(0, Math.max(1, words.length - 2)).join(" "), answer: words.slice(-2).join(" "), type: index === 0 ? "Teacher-marked mistake" : "What comes next?" }; }), [verses]);
  const [index, setIndex] = useState(0); const [revealed, setRevealed] = useState(false); const [result, setResult] = useState(null); const q = questions[index];
  const advance = (value) => { setResult(value); setTimeout(() => { setIndex((index + 1) % questions.length); setRevealed(false); setResult(null); }, 450); };
  return <>
    <section className="page-heading compact"><div><p className="eyebrow">Personal review</p><h1>Strengthen your weak spots</h1><p>4 questions generated from your Sabqi and teacher-marked mistakes.</p></div><div className="streak"><Icon name="spark"/><span><strong>12 day streak</strong><small>Keep it going</small></span></div></section>
    <div className="practice-layout"><section className="practice-card panel"><div className="practice-top"><span className="tiny-badge">{q.type}</span><span>{index + 1} of {questions.length}</span></div><div className="progress-track"><i style={{width:`${((index+1)/questions.length)*100}%`}}/></div><div className="question-area"><small>Complete the ayah</small><div className="ayah-prompt uthmani" dir="rtl">{q.prompt} <span className={revealed ? "revealed" : "blank"}>{revealed ? q.answer : "••••••••"}</span></div><p>Surah Al-Fatihah · {q.ref}</p></div>{!revealed ? <button className="primary-button wide" onClick={() => setRevealed(true)}>Reveal answer</button> : <div className="recall-actions"><p>How did you do?</p><button className={result === "again" ? "selected" : ""} onClick={() => advance("again")}><span>↻</span><strong>Again</strong><small>Review soon</small></button><button className={result === "hard" ? "selected" : ""} onClick={() => advance("hard")}><span>◷</span><strong>Hard</strong><small>Review tomorrow</small></button><button className={result === "easy" ? "selected" : ""} onClick={() => advance("easy")}><span>✓</span><strong>Easy</strong><small>Review in 4 days</small></button></div>}</section><aside className="practice-side"><section className="panel"><h2>Today’s review</h2><div className="review-ring"><span><strong>{index}</strong><small>of {questions.length}</small></span></div><div className="review-stat"><span>Due now</span><b>{questions.length-index}</b></div><div className="review-stat"><span>Mistakes repaired</span><b>{index}</b></div></section><section className="panel tip"><Icon name="spark"/><div><strong>Review with intention</strong><p>Pause before revealing. Recite the continuation aloud, then compare every letter and harakah.</p></div></section></aside></div>
  </>;
}

const keyboard = ["ض","ص","ث","ق","ف","غ","ع","ه","خ","ح","ج","د","ش","س","ي","ب","ل","ا","ت","ن","م","ك","ط","ئ","ء","ؤ","ر","ى","ة","و","ز","ظ","ذ","َ","ُ","ِ","ْ","ّ","ً","ٌ","ٍ"];
function Memorize({ verses }) {
  const lesson = verses.filter((v) => v.surah === 1).slice(0, 3); const [ayahIndex, setAyahIndex] = useState(0); const [level, setLevel] = useState("Intermediate"); const [value, setValue] = useState(""); const [checked, setChecked] = useState(null); const [show, setShow] = useState(true); const ayah = lesson[ayahIndex];
  const words = ayah.text.split(" "); const chunkSize = level === "Beginner" ? 2 : level === "Intermediate" ? 3 : words.length; const chunks = Array.from({length:Math.ceil(words.length/chunkSize)},(_,i)=>words.slice(i*chunkSize,(i+1)*chunkSize).join(" "));
  const verify = () => { const correct = value.trim() === ayah.text.trim(); setChecked(correct); if (correct && ayahIndex < lesson.length-1) setTimeout(() => { setAyahIndex(ayahIndex+1); setValue(""); setChecked(null); setShow(true); }, 700); };
  return <>
    <section className="page-heading compact"><div><p className="eyebrow">Assigned Sabaq</p><h1>Memorize Al-Fatihah</h1><p>Learn in guided chunks, then reproduce the ayah exactly.</p></div><div className="lesson-progress"><span>Ayah {ayahIndex + 1} of {lesson.length}</span><div><i style={{width:`${((ayahIndex+1)/lesson.length)*100}%`}}/></div></div></section>
    <div className="memorize-layout"><section className="panel memorize-card"><div className="memorize-toolbar"><div className="level-tabs">{["Beginner","Intermediate","Advanced"].map((x)=><button key={x} onClick={()=>setLevel(x)} className={level===x?"active":""}>{x}</button>)}</div><button className="ghost-button" onClick={()=>setShow(!show)}>{show ? "Hide ayah" : "Show ayah"}</button></div><div className="chunk-area" dir="rtl">{show ? chunks.map((chunk,i)=><span className="uthmani" key={chunk}>{chunk}<small>{i+1}</small></span>) : <div className="hidden-ayah">Recite the ayah from memory</div>}</div><div className="type-area"><label htmlFor="ayah-input">Type the complete ayah exactly</label><textarea id="ayah-input" dir="rtl" className="uthmani" value={value} onChange={(e)=>{setValue(e.target.value);setChecked(null)}} placeholder="اكتب الآية هنا"/><div className="input-meta"><span>{value.length} characters</span><span>Every letter and harakah is checked</span></div></div><div className="arabic-keyboard" dir="rtl">{keyboard.map((key,i)=><button key={`${key}-${i}`} onClick={()=>setValue(value+key)}>{key}</button>)}<button className="key-wide" onClick={()=>setValue(value+" ")}>مسافة</button><button onClick={()=>setValue(value.slice(0,-1))}>⌫</button></div><button className={`primary-button wide ${checked === false ? "error" : ""}`} disabled={!value} onClick={verify}>{checked === true ? "Exact match ✓" : checked === false ? "Not exact — compare and try again" : "Check ayah"}</button></section><aside className="practice-side"><section className="panel lesson-card"><span className="tiny-badge">Today’s assignment</span><h2>Al-Fatihah 1:1–3</h2><p>3 ayat · Beginner track</p><div className="assignment-list">{lesson.map((v,i)=><div className={i<ayahIndex?"done":i===ayahIndex?"current":""} key={v.ref}><span>{i<ayahIndex?"✓":i+1}</span><div><strong>Ayah {v.ayah}</strong><small>{i<ayahIndex?"Completed":i===ayahIndex?"In progress":"Up next"}</small></div></div>)}</div></section><section className="panel tip"><Icon name="alert"/><div><strong>Precision mode</strong><p>Comparison is codepoint-exact. The app never autocorrects, normalizes, or rewrites Quran text.</p></div></section></aside></div>
  </>;
}

export default function QuranMindsApp({ mode = "dashboard", verses = [] }) {
  useEffect(() => { document.documentElement.dataset.ready = "true"; }, []);
  const screen = mode === "teacher" ? <Teacher verses={verses}/> : mode === "family" ? <Family/> : mode === "practice" ? <Practice verses={verses}/> : mode === "memorize" ? <Memorize verses={verses}/> : <Dashboard/>;
  return <AppShell mode={mode}>{screen}</AppShell>;
}
