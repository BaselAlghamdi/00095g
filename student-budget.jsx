import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const CURRENCY   = "ر.س";
const CYCLE_DAYS = 30;  // ALWAYS 30 days, no exceptions
const SALARY_DAY = 27;  // cycle starts on the 27th
const MONTHS_AR  = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const EXPENSE_CATS = [
  { id:"food",          label:"طعام",      emoji:"🍽️", color:"#F97316" },
  { id:"fuel",          label:"بنزين",     emoji:"⛽",  color:"#3B82F6" },
  { id:"internet",      label:"نت",        emoji:"📶",  color:"#06B6D4" },
  { id:"installments",  label:"أقساط",     emoji:"💳",  color:"#A855F7" },
  { id:"investment",    label:"استثمار",   emoji:"📈",  color:"#10B981" },
  { id:"education",     label:"دراسة",     emoji:"📚",  color:"#8B5CF6" },
  { id:"health",        label:"صحة",       emoji:"💊",  color:"#EF4444" },
  { id:"entertainment", label:"ترفيه",     emoji:"🎮",  color:"#EC4899" },
  { id:"shopping",      label:"تسوق",      emoji:"🛍️",  color:"#F59E0B" },
  { id:"other",         label:"أخرى",      emoji:"📦",  color:"#6B7280" },
];

const INCOME_TYPES = [
  { id:"scholarship", label:"مكافأة",       emoji:"🎓", color:"#6366F1" },
  { id:"investment",  label:"عائد استثمار", emoji:"📈", color:"#10B981" },
  { id:"cashback",    label:"كاش باك",      emoji:"💳", color:"#F97316" },
  { id:"gift",        label:"عيدية / هدية", emoji:"🎁", color:"#EC4899" },
  { id:"freelance",   label:"عمل حر",       emoji:"💼", color:"#8B5CF6" },
  { id:"other",       label:"أخرى",         emoji:"💰", color:"#6B7280" },
];

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// Cycle: always exactly 30 days starting on the 27th
// start = most recent 27th ≤ today
// end   = start + 29 days
// ─────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function dStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function cycleStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (d.getDate() >= SALARY_DAY) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(SALARY_DAY).padStart(2,"0")}`;
  }
  const prev = new Date(d.getFullYear(), d.getMonth()-1, SALARY_DAY);
  return dStr(prev);
}

function cycleEnd(startStr) {
  const d   = new Date(startStr + "T00:00:00");
  const end = new Date(d.getTime() + (CYCLE_DAYS - 1) * 86400000);
  return dStr(end);
}

function daysElapsed(dateStr) {
  const start = new Date(cycleStart(dateStr) + "T00:00:00");
  const now   = new Date(dateStr + "T00:00:00");
  return Math.min(CYCLE_DAYS, Math.floor((now - start) / 86400000) + 1);
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]}`;
}

const fmt = (n) => Number(n||0).toLocaleString("ar-SA", { minimumFractionDigits:0, maximumFractionDigits:0 });

// ─────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────
async function dbLoad(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function dbSave(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ─────────────────────────────────────────────────────────────
// DEFAULT SETTINGS
// ─────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  salary:           0,
  allocations:      {},   // { food: 300, fuel: 200, ... }
  foodEnabled:      true,
  foodDailyAmount:  10,   // user sets this — how much per day
};

// ─────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab,      setTab]    = useState("dashboard");
  const [expenses, setExp]    = useState([]);
  const [income,   setInc]    = useState([]);
  const [settings, setSett]   = useState(DEFAULT_SETTINGS);
  const [loaded,   setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [e, i, s] = await Promise.all([
        dbLoad("sb5_exp"), dbLoad("sb5_inc"), dbLoad("sb5_set")
      ]);
      if (e) setExp(e);
      if (i) setInc(i);
      if (s) setSett({ ...DEFAULT_SETTINGS, ...s });
      setLoaded(true);
    })();
  }, []);

  const saveExp  = async (d) => { setExp(d);  await dbSave("sb5_exp", d); };
  const saveInc  = async (d) => { setInc(d);  await dbSave("sb5_inc", d); };
  const saveSett = async (d) => { setSett(d); await dbSave("sb5_set", d); };

  if (!loaded) return <Splash />;

  const today   = todayStr();
  const cs      = cycleStart(today);
  const ce      = cycleEnd(cs);
  const elapsed = daysElapsed(today);
  const left    = CYCLE_DAYS - elapsed;

  // Food balance
  const foodAccum = settings.foodEnabled ? settings.foodDailyAmount * elapsed : 0;
  const foodSpent = expenses
    .filter(e => e.category === "food" && e.date >= cs && e.date <= today)
    .reduce((s,e) => s + e.amount, 0);
  const foodBal = foodAccum - foodSpent;

  const TABS = [
    { id:"dashboard", label:"الرئيسية", emoji:"🏠" },
    { id:"expenses",  label:"مصاريف",   emoji:"💸" },
    { id:"income",    label:"دخل",      emoji:"💰" },
    { id:"reports",   label:"تقارير",   emoji:"📊" },
    { id:"settings",  label:"إعدادات",  emoji:"⚙️" },
  ];

  const ctx = { expenses, income, settings, today, cs, ce, elapsed, left, foodAccum, foodSpent, foodBal };

  return (
    <div style={S.root}>
      <GStyles />
      <Mesh />
      <div style={S.wrap}>
        {tab==="dashboard" && <Dashboard {...ctx} />}
        {tab==="expenses"  && <ExpensesView  expenses={expenses} saveExp={saveExp}  today={today} cs={cs} />}
        {tab==="income"    && <IncomeView    income={income}     saveInc={saveInc}  today={today} cs={cs} />}
        {tab==="reports"   && <ReportsView   expenses={expenses} income={income}    settings={settings} today={today} />}
        {tab==="settings"  && <SettingsView  settings={settings} saveSett={saveSett} />}
      </div>
      <nav style={S.nav}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{...S.navBtn,...(tab===t.id?S.navOn:{})}}>
            <span style={{fontSize:20}}>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
function Dashboard({ expenses, income, settings, today, cs, ce, elapsed, left, foodAccum, foodSpent, foodBal }) {
  const incCycle = income.filter(i=>i.date>=cs&&i.date<=today).reduce((s,i)=>s+i.amount,0);
  const expCycle = expenses.filter(e=>e.date>=cs&&e.date<=today).reduce((s,e)=>s+e.amount,0);
  const net  = incCycle - expCycle;
  const pct  = Math.round((elapsed / CYCLE_DAYS) * 100);

  return (
    <div style={S.page}>
      {/* Cycle header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,color:"#6B7280",letterSpacing:2,marginBottom:4}}>
          الدورة: {fmtDate(cs)} — {fmtDate(ce)} · {CYCLE_DAYS} يوم
        </div>
        <h1 style={{fontSize:26,fontWeight:900,margin:0}}>لوحة التحكم</h1>
        <div style={{marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6B7280",marginBottom:4}}>
            <span>يوم {elapsed} من {CYCLE_DAYS}</span>
            <span>{left} يوم متبقي</span>
          </div>
          <div style={{background:"#1F2937",borderRadius:50,height:4}}>
            <div style={{height:"100%",borderRadius:50,width:`${pct}%`,
              background:"linear-gradient(90deg,#6366F1,#A855F7)",transition:"width .6s"}}/>
          </div>
        </div>
      </div>

      {/* Net balance */}
      <div style={{...S.hero,borderColor:net>=0?"#10B98140":"#EF444440",
        background:net>=0?"#05201540":"#20050540",marginBottom:12}}>
        <div style={{fontSize:11,color:"#9CA3AF",letterSpacing:2,marginBottom:6}}>الرصيد الصافي للدورة</div>
        <div style={{fontSize:40,fontWeight:900,color:net>=0?"#34D399":"#F87171",lineHeight:1}}>
          {net>=0?"+":""}{fmt(net)}
          <span style={{fontSize:16,color:"#6B7280",marginRight:4}}>{CURRENCY}</span>
        </div>
        <div style={{display:"flex",gap:20,marginTop:10,fontSize:12,flexWrap:"wrap"}}>
          <span><span style={{color:"#34D399"}}>↑ </span>{fmt(incCycle)} دخل</span>
          <span><span style={{color:"#F87171"}}>↓ </span>{fmt(expCycle)} مصاريف</span>
          {settings.salary>0 && <span><span style={{color:"#9CA3AF"}}>💼 </span>{fmt(settings.salary)} راتب</span>}
        </div>
      </div>

      {/* Food balance */}
      {settings.foodEnabled && (
        <div style={{...S.card,borderColor:foodBal>=0?"#F9731640":"#EF444440",
          background:foodBal>=0?"#1C100740":"#20050540",marginBottom:12}}>
          <div style={{fontSize:11,color:"#F97316",fontWeight:700,marginBottom:8}}>
            🍽️ رصيد الطعام المتراكم
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:26,fontWeight:900,color:foodBal>=0?"#FB923C":"#F87171"}}>
                {foodBal>=0?"+":""}{fmt(foodBal)} {CURRENCY}
              </div>
              <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>
                {elapsed} يوم × {settings.foodDailyAmount} {CURRENCY} = {fmt(foodAccum)} − صُرف {fmt(foodSpent)}
              </div>
            </div>
            <div style={{background:"#F9731618",borderRadius:12,padding:"10px 16px",textAlign:"center",flexShrink:0}}>
              <div style={{fontSize:10,color:"#F97316",marginBottom:2}}>متاح الآن</div>
              <div style={{fontSize:22,fontWeight:800}}>{fmt(Math.max(0,foodBal))}</div>
              <div style={{fontSize:9,color:"#6B7280"}}>{CURRENCY}</div>
            </div>
          </div>
        </div>
      )}

      {/* Budget bars */}
      {Object.entries(settings.allocations).filter(([,v])=>v>0).length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {Object.entries(settings.allocations).filter(([,v])=>v>0).map(([id,budget])=>{
            const cat  = EXPENSE_CATS.find(c=>c.id===id); if (!cat) return null;
            const spent= expenses.filter(e=>e.category===id&&e.date>=cs&&e.date<=today).reduce((s,e)=>s+e.amount,0);
            const p    = Math.min(100,(spent/budget)*100);
            const over = spent > budget;
            return (
              <div key={id} style={{...S.card,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
                  <span>{cat.emoji} {cat.label}</span>
                  <span style={{color:over?"#F87171":"#9CA3AF",fontSize:11}}>{fmt(spent)}/{fmt(budget)}</span>
                </div>
                <div style={{background:"#1F2937",borderRadius:50,height:5}}>
                  <div style={{height:"100%",borderRadius:50,width:`${p}%`,
                    background:over?"#EF4444":cat.color,transition:"width .6s"}}/>
                </div>
                <div style={{fontSize:10,color:over?"#F87171":"#6B7280",marginTop:4}}>
                  {over?`تجاوز ${fmt(spent-budget)}`:`متبقي ${fmt(budget-spent)}`} {CURRENCY}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent transactions */}
      <div style={S.card}>
        <div style={{fontSize:12,color:"#9CA3AF",marginBottom:10}}>⏱️ آخر المعاملات</div>
        {[...expenses].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(e=>{
          const cat = EXPENSE_CATS.find(c=>c.id===e.category)||EXPENSE_CATS[9];
          return (
            <div key={e.id} style={{display:"flex",gap:10,alignItems:"center",
              paddingBottom:8,marginBottom:8,borderBottom:"1px solid #1F2937"}}>
              <span style={{fontSize:18}}>{cat.emoji}</span>
              <span style={{flex:1,fontSize:13}}>{e.note||cat.label}</span>
              <span style={{fontSize:11,color:"#6B7280"}}>{fmtDate(e.date)}</span>
              <span style={{fontWeight:700,color:cat.color,fontSize:14}}>{fmt(e.amount)}</span>
            </div>
          );
        })}
        {expenses.length===0 && <div style={{color:"#4B5563",fontSize:13}}>لا توجد معاملات بعد</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────────────────────
function ExpensesView({ expenses, saveExp, today, cs }) {
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState({amount:"",category:"food",note:"",date:today});
  const [filterCat, setFilterCat] = useState("all");
  const [showCycle, setShowCycle] = useState(true);

  const list  = expenses
    .filter(e=>(filterCat==="all"||e.category===filterCat)&&(!showCycle||e.date>=cs))
    .sort((a,b)=>b.date.localeCompare(a.date));
  const total = list.reduce((s,e)=>s+e.amount,0);

  async function add() {
    if (!form.amount||+form.amount<=0) return;
    await saveExp([{id:Date.now(),...form,amount:+form.amount},...expenses]);
    setForm({amount:"",category:"food",note:"",date:today});
    setAdding(false);
  }

  return (
    <div style={S.page}>
      <PH title="المصاريف" action={<AB onClick={()=>setAdding(!adding)}>{adding?"✕ إغلاق":"+ إضافة"}</AB>} />

      {adding && (
        <div style={{...S.card,marginBottom:16,animation:"fadeUp .2s ease"}}>
          <Row>
            <F label={`المبلغ (${CURRENCY})`}>
              <input autoFocus type="number" value={form.amount}
                onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
                placeholder="0" style={{...S.input,fontSize:24,fontWeight:800,textAlign:"center"}}/>
            </F>
            <F label="التاريخ">
              <input type="date" value={form.date}
                onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={S.input}/>
            </F>
          </Row>
          <F label="الفئة">
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {EXPENSE_CATS.map(c=>(
                <button key={c.id} onClick={()=>setForm(f=>({...f,category:c.id}))}
                  style={{...S.chip,...(form.category===c.id?{background:c.color+"33",borderColor:c.color,color:c.color}:{})}}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </F>
          <F label="ملاحظة">
            <input type="text" value={form.note}
              onChange={e=>setForm(f=>({...f,note:e.target.value}))}
              placeholder="وصف..." style={S.input}
              onKeyDown={e=>e.key==="Enter"&&add()}/>
          </F>
          <button onClick={add} style={S.primaryBtn}>✓ حفظ المصروف</button>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
        <button onClick={()=>setShowCycle(!showCycle)}
          style={{...S.chip,...(showCycle?{background:"#6366F133",borderColor:"#6366F1",color:"#A5B4FC"}:{})}}>
          {showCycle?"هذه الدورة":"الكل"}
        </button>
        <button onClick={()=>setFilterCat("all")}
          style={{...S.chip,...(filterCat==="all"?S.chipOn:{})}}>الكل</button>
        {EXPENSE_CATS.map(c=>(
          <button key={c.id} onClick={()=>setFilterCat(c.id)}
            style={{...S.chip,...(filterCat===c.id?{background:c.color+"33",borderColor:c.color,color:c.color}:{})}}>
            {c.emoji}
          </button>
        ))}
      </div>

      <div style={{fontSize:12,color:"#9CA3AF",marginBottom:10}}>
        {list.length} معاملة · <strong style={{color:"#F9FAFB"}}>{fmt(total)} {CURRENCY}</strong>
      </div>

      {list.length===0 ? <Empty emoji="💸" text="لا توجد مصاريف"/> : list.map(e=>{
        const cat = EXPENSE_CATS.find(c=>c.id===e.category)||EXPENSE_CATS[9];
        return (
          <div key={e.id} style={S.item}>
            <div style={{...S.dot,background:cat.color+"22",border:`1px solid ${cat.color}44`}}>{cat.emoji}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14}}>{e.note||cat.label}</div>
              <div style={{fontSize:11,color:"#6B7280"}}>{fmtDate(e.date)} · {cat.label}</div>
            </div>
            <div style={{fontWeight:800,color:cat.color}}>
              {fmt(e.amount)} <span style={{fontSize:10,color:"#6B7280"}}>{CURRENCY}</span>
            </div>
            <button onClick={()=>saveExp(expenses.filter(x=>x.id!==e.id))} style={S.del}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INCOME
// ─────────────────────────────────────────────────────────────
function IncomeView({ income, saveInc, today, cs }) {
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState({amount:"",type:"scholarship",note:"",date:today});
  const [showCycle, setShowCycle] = useState(true);

  const list  = income.filter(i=>!showCycle||i.date>=cs).sort((a,b)=>b.date.localeCompare(a.date));
  const total = list.reduce((s,i)=>s+i.amount,0);

  async function add() {
    if (!form.amount||+form.amount<=0) return;
    await saveInc([{id:Date.now(),...form,amount:+form.amount},...income]);
    setForm({amount:"",type:"scholarship",note:"",date:today});
    setAdding(false);
  }

  return (
    <div style={S.page}>
      <PH title="الدخل" action={<AB onClick={()=>setAdding(!adding)}>{adding?"✕ إغلاق":"+ إضافة"}</AB>} />

      {adding && (
        <div style={{...S.card,marginBottom:16,animation:"fadeUp .2s ease"}}>
          <Row>
            <F label={`المبلغ (${CURRENCY})`}>
              <input autoFocus type="number" value={form.amount}
                onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
                placeholder="0" style={{...S.input,fontSize:24,fontWeight:800,textAlign:"center"}}/>
            </F>
            <F label="التاريخ">
              <input type="date" value={form.date}
                onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={S.input}/>
            </F>
          </Row>
          <F label="النوع">
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {INCOME_TYPES.map(t=>(
                <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id}))}
                  style={{...S.chip,...(form.type===t.id?{background:t.color+"33",borderColor:t.color,color:t.color}:{})}}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </F>
          <F label="ملاحظة">
            <input type="text" value={form.note}
              onChange={e=>setForm(f=>({...f,note:e.target.value}))}
              placeholder="مثل: مكافأة الترم، كاش باك..." style={S.input}
              onKeyDown={e=>e.key==="Enter"&&add()}/>
          </F>
          <button onClick={add} style={{...S.primaryBtn,background:"linear-gradient(135deg,#059669,#10B981)"}}>✓ حفظ</button>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <button onClick={()=>setShowCycle(!showCycle)}
          style={{...S.chip,...(showCycle?{background:"#6366F133",borderColor:"#6366F1",color:"#A5B4FC"}:{})}}>
          {showCycle?"هذه الدورة":"الكل"}
        </button>
      </div>

      <div style={{...S.card,background:"#05201540",borderColor:"#10B98140",marginBottom:14}}>
        <div style={{fontSize:11,color:"#9CA3AF"}}>إجمالي الدخل</div>
        <div style={{fontSize:32,fontWeight:900,color:"#34D399"}}>
          {fmt(total)} <span style={{fontSize:14,color:"#6B7280"}}>{CURRENCY}</span>
        </div>
      </div>

      {list.length===0 ? <Empty emoji="💰" text="لا يوجد دخل مسجل"/> : list.map(i=>{
        const t = INCOME_TYPES.find(x=>x.id===i.type)||INCOME_TYPES[5];
        return (
          <div key={i.id} style={S.item}>
            <div style={{...S.dot,background:t.color+"22",border:`1px solid ${t.color}44`}}>{t.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{i.note||t.label}</div>
              <div style={{fontSize:11,color:"#6B7280"}}>{fmtDate(i.date)} · {t.label}</div>
            </div>
            <div style={{fontWeight:800,color:"#34D399"}}>
              +{fmt(i.amount)} <span style={{fontSize:10,color:"#6B7280"}}>{CURRENCY}</span>
            </div>
            <button onClick={()=>saveInc(income.filter(x=>x.id!==i.id))} style={S.del}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────
function ReportsView({ expenses, income, settings, today }) {
  const [n, setN] = useState(6);

  // Build N past cycles
  const cycles = [];
  for (let i=n-1; i>=0; i--) {
    const ref = new Date(today+"T00:00:00");
    ref.setMonth(ref.getMonth()-i);
    const refStr = `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,"0")}-${String(SALARY_DAY).padStart(2,"0")}`;
    const cs = cycleStart(refStr), ce = cycleEnd(cs);
    const label = MONTHS_AR[new Date(cs+"T00:00:00").getMonth()].slice(0,3);
    const exp  = expenses.filter(e=>e.date>=cs&&e.date<=ce).reduce((s,e)=>s+e.amount,0);
    const inc  = income.filter(i=>i.date>=cs&&i.date<=ce).reduce((s,i)=>s+i.amount,0);
    const food = expenses.filter(e=>e.category==="food"&&e.date>=cs&&e.date<=ce).reduce((s,e)=>s+e.amount,0);
    const fuel = expenses.filter(e=>e.category==="fuel"&&e.date>=cs&&e.date<=ce).reduce((s,e)=>s+e.amount,0);
    cycles.push({label,cs,ce,exp,inc,net:inc-exp,food,fuel});
  }

  const curr   = cycles[cycles.length-1];
  const prev   = cycles[cycles.length-2];
  const change = prev&&prev.exp>0?((curr.exp-prev.exp)/prev.exp*100).toFixed(1):null;

  const cs0    = cycleStart(today), ce0 = cycleEnd(cs0);
  const catData= EXPENSE_CATS.map(c=>({
    name:c.label, color:c.color,
    value:expenses.filter(e=>e.category===c.id&&e.date>=cs0&&e.date<=ce0).reduce((s,e)=>s+e.amount,0),
  })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);

  const compCats = EXPENSE_CATS.map(c=>({
    ...c,
    curr:expenses.filter(e=>e.category===c.id&&e.date>=cs0&&e.date<=ce0).reduce((s,e)=>s+e.amount,0),
    prev:prev?expenses.filter(e=>e.category===c.id&&e.date>=prev.cs&&e.date<=prev.ce).reduce((s,e)=>s+e.amount,0):0,
  })).filter(c=>c.curr>0||c.prev>0);

  const TT = ({active,payload,label}) => {
    if (!active||!payload?.length) return null;
    return (
      <div style={{background:"#111827",border:"1px solid #374151",borderRadius:10,padding:"10px 14px",fontSize:12}}>
        <div style={{color:"#9CA3AF",marginBottom:6}}>{label}</div>
        {payload.map((p,i)=><div key={i} style={{color:p.color}}>{p.name}: <strong>{fmt(p.value)}</strong> {CURRENCY}</div>)}
      </div>
    );
  };

  return (
    <div style={S.page}>
      <PH title="التقارير" />

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[[3,"3 دورات"],[6,"6 دورات"],[12,"سنة"]].map(([v,l])=>(
          <button key={v} onClick={()=>setN(+v)}
            style={{...S.chip,...(n===+v?S.chipOn:{}),flex:1}}>{l}</button>
        ))}
      </div>

      {/* MOM comparison */}
      {change!==null && (
        <div style={{...S.card,background:+change>0?"#20050540":"#05201540",
          borderColor:+change>0?"#EF444440":"#10B98140",marginBottom:14}}>
          <div style={{fontSize:11,color:"#9CA3AF",marginBottom:4}}>مقارنة بالدورة الماضية</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:28,fontWeight:900,color:+change>0?"#F87171":"#34D399"}}>
              {+change>0?"+":""}{change}%
              <span style={{fontSize:12,color:"#9CA3AF",marginRight:8,fontWeight:400}}>
                {+change>0?"زيادة ⚠️":"انخفاض ✅"}
              </span>
            </div>
            <div style={{fontSize:12}}>
              <div style={{color:"#9CA3AF"}}>هذه: <strong style={{color:"#F9FAFB"}}>{fmt(curr?.exp)} {CURRENCY}</strong></div>
              <div style={{color:"#9CA3AF"}}>الماضية: <strong style={{color:"#F9FAFB"}}>{fmt(prev?.exp)} {CURRENCY}</strong></div>
            </div>
          </div>
        </div>
      )}

      <div style={{...S.card,marginBottom:14}}>
        <div style={{fontSize:12,color:"#9CA3AF",marginBottom:12}}>📈 الدخل مقابل المصاريف</div>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={cycles} margin={{top:4,right:8,left:0,bottom:0}}>
            <XAxis dataKey="label" tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#6B7280",fontSize:10}} axisLine={false} tickLine={false} width={38}
              tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
            <Tooltip content={<TT/>}/>
            <Line type="monotone" dataKey="inc"  name="دخل"    stroke="#34D399" strokeWidth={2.5} dot={{fill:"#34D399",r:4}}/>
            <Line type="monotone" dataKey="exp"  name="مصاريف" stroke="#F87171" strokeWidth={2.5} dot={{fill:"#F87171",r:4}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{...S.card,marginBottom:14}}>
        <div style={{fontSize:12,color:"#9CA3AF",marginBottom:12}}>🍽️ ⛽ طعام وبنزين لكل دورة</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={cycles} margin={{top:4,right:8,left:0,bottom:0}} barGap={3}>
            <XAxis dataKey="label" tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#6B7280",fontSize:10}} axisLine={false} tickLine={false} width={35}/>
            <Tooltip content={<TT/>}/>
            <Bar dataKey="food" name="طعام"  fill="#F97316" radius={[4,4,0,0]}/>
            <Bar dataKey="fuel" name="بنزين" fill="#3B82F6" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {catData.length>0 && (
        <div style={{...S.card,marginBottom:14}}>
          <div style={{fontSize:12,color:"#9CA3AF",marginBottom:12}}>🎯 توزيع الدورة الحالية</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={35}>
                {catData.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip formatter={(v,name)=>[`${fmt(v)} ${CURRENCY}`,name]}
                contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:8,fontSize:12}}/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12,color:"#9CA3AF"}}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {compCats.length>0 && (
        <div style={S.card}>
          <div style={{fontSize:12,color:"#9CA3AF",marginBottom:14}}>📊 مقارنة تفصيلية بالدورة الماضية</div>
          {compCats.map(c=>{
            const diff=c.curr-c.prev, mx=Math.max(c.curr,c.prev,1);
            return (
              <div key={c.id} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                  <span>{c.emoji} {c.label}</span>
                  <span style={{color:diff>0?"#F87171":diff<0?"#34D399":"#9CA3AF",fontSize:12}}>
                    {diff>0?"+":""}{fmt(diff)} {CURRENCY}
                  </span>
                </div>
                {[["الدورة الماضية",c.prev,"#4B5563"],["هذه الدورة",c.curr,c.color]].map(([lbl,val,clr])=>(
                  <div key={lbl} style={{marginBottom:4}}>
                    <div style={{fontSize:10,color:"#6B7280",marginBottom:2}}>{lbl}: {fmt(val)}</div>
                    <div style={{background:"#1F2937",borderRadius:3,height:5}}>
                      <div style={{height:"100%",borderRadius:3,background:clr,width:`${(val/mx)*100}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {cycles.every(c=>c.exp===0&&c.inc===0) && <Empty emoji="📊" text="سجّل مصاريف ودخلاً لتظهر التقارير"/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────
function SettingsView({ settings, saveSett }) {
  const [s,  setS]  = useState(settings);
  const [ok, setOk] = useState(false);

  const totalAlloc = Object.values(s.allocations).reduce((sum,v)=>sum+(+v||0),0);
  const remaining  = (s.salary||0) - totalAlloc;

  function setAlloc(id, val) {
    setS(p=>({...p,allocations:{...p.allocations,[id]:+val||0}}));
  }

  async function doSave() {
    await saveSett(s);
    setOk(true);
    setTimeout(()=>setOk(false),2000);
  }

  return (
    <div style={S.page}>
      <PH title="الإعدادات" />

      {/* Salary */}
      <div style={{...S.card,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:14,color:"#A5B4FC"}}>💼 الراتب / المكافأة</div>
        <F label={`المكافأة الشهرية (${CURRENCY})`}>
          <input type="number" value={s.salary||""}
            onChange={e=>setS(p=>({...p,salary:+e.target.value||0}))}
            placeholder="990" style={{...S.input,fontSize:24,fontWeight:800,textAlign:"center"}}/>
        </F>
        <div style={{fontSize:11,color:"#6B7280",marginTop:4,padding:"10px 12px",
          background:"#6366F110",borderRadius:10,border:"1px solid #6366F120"}}>
          📅 الدورة: دايماً <strong style={{color:"#A5B4FC"}}>30 يوم</strong> بالضبط، تبدأ يوم 27 وتنتهي يوم {/* dynamic */}
          <strong style={{color:"#A5B4FC"}}> 26 من الشهر التالي*</strong>
          <div style={{color:"#4B5563",marginTop:4,fontSize:10}}>
            *قد يختلف اليوم الأخير حسب الشهر لضمان ثبات 30 يوم
          </div>
        </div>
      </div>

      {/* Allocations */}
      <div style={{...S.card,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:6,color:"#A5B4FC"}}>🎯 تقسيم الميزانية</div>
        {s.salary>0 && (
          <div style={{fontSize:12,marginBottom:14,padding:"8px 12px",borderRadius:10,
            background:remaining>=0?"#05201540":"#20050540",
            color:remaining>=0?"#34D399":"#F87171"}}>
            موزّع: {fmt(totalAlloc)} {CURRENCY}
            {remaining>=0
              ? ` — حر ومتاح: ${fmt(remaining)} ${CURRENCY}`
              : ` — تجاوزت بـ: ${fmt(Math.abs(remaining))} ${CURRENCY}`}
          </div>
        )}
        {EXPENSE_CATS.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:20,width:28,textAlign:"center"}}>{c.emoji}</span>
            <span style={{flex:1,fontSize:13}}>{c.label}</span>
            <input type="number" value={s.allocations[c.id]||""}
              onChange={e=>setAlloc(c.id,e.target.value)}
              placeholder="0" style={{...S.input,width:85,padding:"8px",textAlign:"center",fontSize:14}}/>
            <span style={{fontSize:11,color:"#6B7280",width:24}}>{CURRENCY}</span>
          </div>
        ))}
      </div>

      {/* Food daily */}
      <div style={{...S.card,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:14,color:"#F97316"}}>🍽️ مخصص الطعام اليومي</div>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:13,fontWeight:600}}>تفعيل الرصيد المتراكم</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>
              المبلغ غير المصروف يُضاف لليوم التالي تلقائياً
            </div>
          </div>
          <button onClick={()=>setS(p=>({...p,foodEnabled:!p.foodEnabled}))}
            style={{width:52,height:28,borderRadius:50,border:"none",cursor:"pointer",flexShrink:0,
              background:s.foodEnabled?"#F97316":"#374151",position:"relative"}}>
            <div style={{position:"absolute",top:3,width:22,height:22,borderRadius:"50%",background:"#fff",
              transition:"left .2s",left:s.foodEnabled?"calc(100% - 25px)":"3px"}}/>
          </button>
        </div>

        <F label={`المخصص اليومي (${CURRENCY})`}>
          <input type="number" value={s.foodDailyAmount||""}
            onChange={e=>setS(p=>({...p,foodDailyAmount:+e.target.value||0}))}
            placeholder="10" style={{...S.input,fontSize:22,fontWeight:700,textAlign:"center"}}/>
        </F>

        {s.foodEnabled && s.foodDailyAmount>0 && (
          <div style={{background:"#1C100730",border:"1px dashed #F9731640",
            borderRadius:10,padding:12,fontSize:12,color:"#9CA3AF",marginTop:8,lineHeight:1.8}}>
            💡 بناءً على هذا المبلغ:<br/>
            · الدورة كاملة (30 يوم): <strong style={{color:"#F9FAFB"}}>{fmt(s.foodDailyAmount*30)} {CURRENCY}</strong><br/>
            · إذا ما صرفت اليوم، بكرة يصبح رصيدك: <strong style={{color:"#F9FAFB"}}>{fmt(s.foodDailyAmount*2)} {CURRENCY}</strong><br/>
            · الحساب يبدأ من يوم 27 كل شهر
          </div>
        )}
      </div>

      <button onClick={doSave}
        style={{...S.primaryBtn,
          background:ok?"linear-gradient(135deg,#059669,#10B981)":"linear-gradient(135deg,#4F46E5,#6366F1)"}}>
        {ok ? "✓ تم الحفظ!" : "💾 حفظ الإعدادات"}
      </button>

      {/* Deploy guide */}
      <div style={{...S.card,marginTop:14,background:"#0A0F1A",borderColor:"#1E2D45"}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:14,color:"#58A6FF"}}>
          🚀 كيف تنشر التطبيق وتضيف تسجيل دخول؟
        </div>

        {[
          {
            step:"1", title:"أنشئ مشروع React",
            color:"#6366F1",
            code:`npm create vite@latest budget -- --template react\ncd budget\nnpm install recharts`,
            note:"ضع كود التطبيق في src/App.jsx"
          },
          {
            step:"2", title:"ارفعه على GitHub",
            color:"#6B7280",
            code:`git init && git add .\ngit commit -m "init"\ngit remote add origin https://github.com/USERNAME/budget.git\ngit push -u origin main`,
          },
          {
            step:"3", title:"انشره على Vercel",
            color:"#F9FAFB",
            note:"روح vercel.com → New Project → اختار الـ repo → Deploy. خلاص، رابط جاهز. كل push ينشر تلقائياً.",
          },
          {
            step:"4", title:"أضف Supabase للحفظ الدائم",
            color:"#3ECF8E",
            code:`npm install @supabase/supabase-js`,
            note:"روح supabase.com → New Project (مجاني) → انسخ الـ URL والـ ANON KEY وضعهم في .env"
          },
          {
            step:"5", title:"تسجيل دخول بـ GitHub",
            color:"#F97316",
            note:"في Supabase: Authentication → Providers → GitHub → فعّله. ضع Client ID وSecret من GitHub OAuth App. كل مستخدم يحفظ بياناته منفصلة.",
          },
        ].map(item=>(
          <div key={item.step} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid #1E2D45"}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:6}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:item.color+"30",
                border:`1px solid ${item.color}60`,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:800,color:item.color,flexShrink:0}}>{item.step}</div>
              <div style={{fontWeight:700,fontSize:13,color:"#E2E8F0"}}>{item.title}</div>
            </div>
            {item.code && (
              <div style={{background:"#0D1117",borderRadius:8,padding:"10px 12px",
                fontFamily:"monospace",fontSize:11,color:"#7DD3FC",marginBottom:6,
                whiteSpace:"pre",overflowX:"auto"}}>
                {item.code}
              </div>
            )}
            {item.note && <div style={{fontSize:12,color:"#6B7280",paddingRight:34}}>{item.note}</div>}
          </div>
        ))}

        <div style={{fontSize:12,color:"#F97316",paddingTop:4}}>
          💬 قولي "ابنيه بـ Supabase" وأسوي لك النسخة الكاملة جاهزة للنسخ واللصق
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <GStyles/>
      <div style={{fontSize:48,animation:"spin 1.5s linear infinite"}}>🎓</div>
      <div style={{color:"#6B7280",fontSize:14}}>جاري التحميل...</div>
    </div>
  );
}
function Mesh() {
  return (
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}>
      <div style={{position:"absolute",top:"-15%",right:"-10%",width:350,height:350,borderRadius:"50%",
        background:"radial-gradient(circle,#6366F118 0%,transparent 70%)",filter:"blur(40px)"}}/>
      <div style={{position:"absolute",bottom:"-5%",left:"-10%",width:280,height:280,borderRadius:"50%",
        background:"radial-gradient(circle,#F9731612 0%,transparent 70%)",filter:"blur(40px)"}}/>
    </div>
  );
}
function GStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      ::-webkit-scrollbar{width:0;}
      input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      button,input,select{font-family:inherit;}
      input:focus{border-color:#6366F1!important;outline:none;}
    `}</style>
  );
}
function PH({title,action}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{fontSize:22,fontWeight:900,color:"#F9FAFB",margin:0}}>{title}</h2>
      {action}
    </div>
  );
}
function AB({onClick,children}) {
  return <button onClick={onClick} style={{...S.primaryBtn,width:"auto",padding:"9px 16px",fontSize:13}}>{children}</button>;
}
function F({label,children}) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,color:"#9CA3AF",marginBottom:5,letterSpacing:1}}>{label}</div>
      {children}
    </div>
  );
}
function Row({children}) {
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{children}</div>;
}
function Empty({emoji,text}) {
  return (
    <div style={{textAlign:"center",padding:"48px 20px",color:"#4B5563"}}>
      <div style={{fontSize:44,marginBottom:10}}>{emoji}</div>
      <div style={{fontSize:14}}>{text}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const S = {
  root:    {minHeight:"100vh",background:"#030712",color:"#F9FAFB",
             fontFamily:"'IBM Plex Sans Arabic','Cairo',sans-serif",direction:"rtl",position:"relative"},
  wrap:    {position:"relative",zIndex:1,maxWidth:460,margin:"0 auto",paddingBottom:90},
  page:    {padding:"26px 16px 16px",animation:"fadeUp .25s ease"},
  card:    {background:"#111827",border:"1px solid #1F2937",borderRadius:16,padding:16},
  hero:    {border:"1px solid",borderRadius:20,padding:20},
  nav:     {position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:460,
             background:"#030712ee",backdropFilter:"blur(20px)",borderTop:"1px solid #1F2937",
             padding:"8px 4px 18px",display:"flex",alignItems:"center",justifyContent:"space-around",zIndex:100},
  navBtn:  {display:"flex",flexDirection:"column",alignItems:"center",background:"none",border:"none",
             cursor:"pointer",padding:"7px 8px",borderRadius:12,color:"#4B5563",fontSize:10,
             transition:"all .2s",fontFamily:"'IBM Plex Sans Arabic','Cairo',sans-serif",gap:2},
  navOn:   {color:"#F9FAFB",background:"#1F2937"},
  input:   {width:"100%",background:"#030712",border:"1.5px solid #374151",borderRadius:12,
             padding:"10px 14px",color:"#F9FAFB",fontSize:15,textAlign:"right",transition:"border-color .2s"},
  chip:    {padding:"7px 12px",borderRadius:50,border:"1.5px solid #374151",background:"transparent",
             cursor:"pointer",fontSize:12,color:"#9CA3AF",transition:"all .2s",whiteSpace:"nowrap"},
  chipOn:  {background:"#F9FAFB22",borderColor:"#F9FAFB",color:"#F9FAFB"},
  primaryBtn:{width:"100%",padding:"13px",borderRadius:14,
               background:"linear-gradient(135deg,#4F46E5,#6366F1)",
               color:"#fff",fontSize:14,fontWeight:700,border:"none",cursor:"pointer",
               boxShadow:"0 6px 20px #6366F130",transition:"all .2s"},
  item:    {display:"flex",alignItems:"center",gap:10,padding:"11px 8px",
             borderBottom:"1px solid #1F2937",borderRadius:10},
  dot:     {width:42,height:42,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",
             fontSize:18,flexShrink:0},
  del:     {background:"#1F0D0D",border:"1px solid #3F1A1A",color:"#F87171",borderRadius:8,
             padding:"5px 9px",fontSize:12,cursor:"pointer",flexShrink:0},
};
