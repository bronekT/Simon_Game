// ============================================================================
// CLOSER — iPhone home-screen widget (Scriptable)
// ----------------------------------------------------------------------------
// 1) Install the free app "Scriptable" from the App Store.
// 2) Open Scriptable → tap + → paste this whole file → name it "CLOSER".
// 3) Long-press your home screen → + → Scriptable → add a medium widget.
// 4) Long-press the widget → Edit Widget → Script: CLOSER.
//    In "Parameter", paste your widget TOKEN (from the app: Settings →
//    Home-screen widget). That's it — it auto-refreshes through the day.
// ============================================================================

const BASE = "https://closer-plum.vercel.app/api/widget";
// Optional: hard-code your token here instead of using the widget Parameter.
const FALLBACK_TOKEN = "PASTE_YOUR_TOKEN_HERE";

const GOLD = new Color("#e9a23b");
const GOLD_LT = new Color("#ffd98a");
const GREEN = new Color("#3fd089");
const MUTED = new Color("#9b9ba4");
const WHITE = new Color("#f5f5f7");

function resolveUrl() {
  let p = (args.widgetParameter || "").trim();
  if (!p) p = FALLBACK_TOKEN;
  if (p.startsWith("http")) return p;
  return `${BASE}?token=${encodeURIComponent(p)}`;
}

async function getData() {
  const req = new Request(resolveUrl());
  req.timeoutInterval = 15;
  return req.loadJSON();
}

function money(n) {
  return "$" + (Number(n) || 0).toLocaleString("en-US");
}

function progressBar(pct, w) {
  const H = 12;
  const dc = new DrawContext();
  dc.size = new Size(w, H);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const bg = new Path();
  bg.addRoundedRect(new Rect(0, 0, w, H), 6, 6);
  dc.addPath(bg);
  dc.setFillColor(new Color("#ffffff", 0.12));
  dc.fillPath();
  const fw = Math.max(10, (w * Math.min(100, Math.max(0, pct))) / 100);
  const fg = new Path();
  fg.addRoundedRect(new Rect(0, 0, fw, H), 6, 6);
  dc.addPath(fg);
  dc.setFillColor(GOLD);
  dc.fillPath();
  return dc.getImage();
}

function buildWidget(data) {
  const w = new ListWidget();
  const grad = new LinearGradient();
  grad.colors = [new Color("#1a160c"), new Color("#0a0a0c")];
  grad.locations = [0, 1];
  w.backgroundGradient = grad;
  w.setPadding(16, 16, 16, 16);

  // Header
  const head = w.addStack();
  head.centerAlignContent();
  const brand = head.addText("◧ CLOSER");
  brand.font = Font.semiboldSystemFont(11);
  brand.textColor = GOLD;
  head.addSpacer();
  const month = head.addText(
    new Date().toLocaleString("en-US", { month: "long" }).toUpperCase(),
  );
  month.font = Font.mediumSystemFont(9);
  month.textColor = MUTED;

  w.addSpacer(8);

  const label = w.addText("Commission this month");
  label.font = Font.systemFont(11);
  label.textColor = MUTED;

  const amt = w.addText(money(data.commission_month));
  amt.font = Font.boldSystemFont(34);
  amt.textColor = GOLD_LT;

  w.addSpacer(8);

  const bar = w.addImage(progressBar(data.goal_pct, 320));
  bar.imageSize = new Size(320, 12);

  w.addSpacer(5);
  const sub = w.addText(`${data.goal_pct}% of ${money(data.goal)} goal`);
  sub.font = Font.systemFont(10);
  sub.textColor = MUTED;

  w.addSpacer();

  // Footer stats
  const foot = w.addStack();
  foot.centerAlignContent();

  const c1 = foot.addStack();
  c1.layoutVertically();
  const c1v = c1.addText(money(data.outstanding));
  c1v.font = Font.semiboldSystemFont(13);
  c1v.textColor = GREEN;
  const c1l = c1.addText("owed");
  c1l.font = Font.systemFont(9);
  c1l.textColor = MUTED;

  foot.addSpacer();

  const c2 = foot.addStack();
  c2.layoutVertically();
  const c2v = c2.addText(money(data.pipeline));
  c2v.font = Font.semiboldSystemFont(13);
  c2v.textColor = WHITE;
  const c2l = c2.addText(`pipeline · ${data.open_deals} open`);
  c2l.font = Font.systemFont(9);
  c2l.textColor = MUTED;

  // refresh roughly hourly
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  return w;
}

function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#0a0a0c");
  w.setPadding(16, 16, 16, 16);
  const t = w.addText("CLOSER");
  t.font = Font.semiboldSystemFont(12);
  t.textColor = GOLD;
  w.addSpacer(6);
  const e = w.addText(msg);
  e.font = Font.systemFont(11);
  e.textColor = MUTED;
  w.addSpacer(6);
  const h = w.addText("Set your token in Edit Widget → Parameter.");
  h.font = Font.systemFont(9);
  h.textColor = MUTED;
  return w;
}

let widget;
try {
  const data = await getData();
  widget = data && data.error ? errorWidget(data.error) : buildWidget(data);
} catch (e) {
  widget = errorWidget("Can't reach CLOSER.");
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
