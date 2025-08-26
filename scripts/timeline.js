/* ===== Config: load timeline.conf (key=value) ===== */
async function loadConfig(){
try{
  const res = await fetch('timeline.conf', {cache:'no-cache'});
  if(!res.ok) throw new Error('timeline.conf not found');
  const txt = await res.text();
  const cfg = {};
  for(const raw of txt.split(/\r?\n/)){
    const line = raw.trim();
    if(!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if(m){ cfg[m[1]] = m[2]; }
  }
  if(!cfg.VIEW_URL) throw new Error('VIEW_URL missing in timeline.conf');
  if(!cfg.EDITOR_URL) console.warn('EDITOR_URL missing; footer link will be disabled.');
  return cfg;
}catch(e){
  console.error('[Config]', e);
  throw e;
}
}

/* Build CSV export URL from VIEW_URL */
function csvUrlFromView(viewUrl){
try{
  const u = new URL(viewUrl);
  const gid = (u.hash.match(/gid=(\d+)/) || [null, "0"])[1];
  return viewUrl.replace(/\/edit.*$/, "/export?format=csv&gid=" + gid);
}catch(e){
  return viewUrl.replace(/\/edit.*$/, "/export?format=csv");
}
}

/* ===== Hamburger ===== */
const hamburger = document.getElementById("hamburger");
const menu      = document.getElementById("menu");

function setMenuTabIndices(disabled){
menu.querySelectorAll('a').forEach(a=>{
  if(disabled) a.setAttribute('tabindex','-1');
  else a.removeAttribute('tabindex');
});
}

function openMenu(){ menu.classList.add("open"); hamburger.setAttribute("aria-expanded","true"); menu.setAttribute("aria-hidden","false"); setMenuTabIndices(false); }
function closeMenu(){ menu.classList.remove("open"); hamburger.setAttribute("aria-expanded","false"); menu.setAttribute("aria-hidden","true"); setMenuTabIndices(true); }
hamburger.addEventListener("click", e=>{ e.stopPropagation(); menu.classList.contains("open") ? closeMenu() : openMenu(); });
document.addEventListener("click", e=>{ if(!menu.contains(e.target) && !hamburger.contains(e.target)) closeMenu(); });
window.addEventListener("keydown", e=>{ if(e.key==="Escape") closeMenu(); });
setMenuTabIndices(true);

/* ===== CSV ===== */
/* parseCSV is defined in parseCSV.js */
function kvFromTwoColumn(rows){
const kv={};
for(const r of rows){ const k=(r[0]||"").trim(); const v=(r[1]||"").trim(); if(k) kv[k]=v; }
return kv;
}
function ciGet(kv,label){
const want=label.toLowerCase();
for(const k of Object.keys(kv)) if(k.toLowerCase()===want) return kv[k];
return "";
}
function slugify(s,fallback){
const base=(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
return base||fallback;
}

/* ===== Markdown (links + bold/italic + blockquotes + newlines) ===== */
function escapeHTML(s){ return (s||"").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function renderMarkdown(text){
if(!text) return "";
const linkTokens=[]; let linkIdx=0;
let tmp = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(m,label,url)=>{
  const token=`__MDLINK_${linkIdx++}__`;
  linkTokens.push({token, html:`<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`});
  return token;
});
tmp = escapeHTML(tmp)
  .replace(/(https?:\/\/[^\s<)]+)([)\s.,;!?]*)/g,(m,url,trail)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`)
  .replace(/(^|[\s(])((?:www\.)[^\s<)]+)([)\s.,;!?]*)/g,(m,pre,url,trail)=>`${pre}<a href="https://${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`)
  .replace(/(\*\*\*)([\s\S]+?)\1/g, '<strong><em>$2</em></strong>')
  .replace(/(\*\*)([\s\S]+?)\1/g, '<strong>$2</strong>')
  .replace(/(\*)([\s\S]+?)\1/g, '<em>$2</em>');
{ // blockquotes grouped
  const lines = tmp.split('\n'); const out = []; let buf = [];
  const flush = () => { if (buf.length) { out.push('<blockquote>'+buf.join('<br>')+'</blockquote>'); buf=[]; } };
  for (const raw of lines) {
    const t = raw.replace(/^\s+/, '');
    if (t.startsWith('&gt;')) buf.push(t.replace(/^&gt;\s?/, '')); else { flush(); out.push(raw); }
  }
  flush(); tmp = out.join('\n');
}
tmp = tmp.replace(/\n/g,'<br>');
for(const L of linkTokens) tmp = tmp.replaceAll(L.token, L.html);
return tmp;
}

function stripHtml(html){
const div = document.createElement("div");
div.innerHTML = html;
return (div.textContent || "").trim();
}

/* ===== Build sections + entries ===== */
function buildSectionsAndEntries(rows){
const sections=[];
let cur = null;
function ensureCur(){ if(!cur){ cur = { title:"", img:"", cap:"", desc:"", id:"", entriesRaw:{img:[], cap:[], desc:[], date:[]} }; sections.push(cur); } }

for(const r of rows){
  const key = (r[0]||"").trim();
  const val = (r[1]||"").trim();
  if(!key) continue;
  const k = key.toLowerCase();

  if(k === "section heading"){
    cur = { title: val || "Section", img:"", cap:"", desc:"", id: slugify(val||`section-${sections.length+1}`, `section-${sections.length+1}`), entriesRaw:{img:[], cap:[], desc:[], date:[]} };
    sections.push(cur);
  } else if(k === "section image"){ ensureCur(); cur.img = val;
  } else if(k === "section caption"){ ensureCur(); cur.cap = val;
  } else if(k === "section description"){ ensureCur(); cur.desc = val;

  } else if(k === "entry image"){ ensureCur(); cur.entriesRaw.img.push(val);
  } else if(k === "entry caption"){ ensureCur(); cur.entriesRaw.cap.push(val);
  } else if(k === "entry description"){ ensureCur(); cur.entriesRaw.desc.push(val);
  } else if(k === "entry date"){ ensureCur(); cur.entriesRaw.date.push(val); }
}

for(const s of sections){
  const n = Math.max(s.entriesRaw.img.length, s.entriesRaw.cap.length, s.entriesRaw.desc.length, s.entriesRaw.date.length);
  const entries=[];
  for(let i=0;i<n;i++){
    entries.push({
      img: s.entriesRaw.img[i] || "",
      cap: s.entriesRaw.cap[i] || "",
      desc: s.entriesRaw.desc[i] || "",
      date: s.entriesRaw.date[i] || "",
      side: (i % 2 === 0) ? "left" : "right"
    });
  }
  s.entries = entries;
}
return sections;
}

/* ===== Date helpers ===== */
function parseDateLoose(s){
if(!s) return null;
const yOnly = /^\s*(\d{3,4})\s*$/.exec(s);
if(yOnly) return new Date(Number(yOnly[1]), 0, 1).getTime();
const d = new Date(s);
if(!isNaN(d.getTime())) return d.getTime();
return null;
}
function initialPositions(entries){
const PAD_TOP = 100, PAD_BOTTOM = 64;
const baseHeight = Math.max(600, entries.length * 160);
const times = entries.map(e => parseDateLoose(e.date));
const valids = times.filter(t => t !== null);
const minT = valids.length ? Math.min(...valids) : null;
const maxT = valids.length ? Math.max(...valids) : null;
const usable = minT !== null && maxT !== null && minT < maxT;

const Y = entries.map((e,i)=>{
  const range = baseHeight - (PAD_TOP + PAD_BOTTOM);
  if(usable && times[i]!==null){
    const pct = (times[i]-minT)/(maxT-minT);
    return Math.round(PAD_TOP + pct * range);
  } else {
    const pct = entries.length>1 ? (i/(entries.length-1)) : 0.5;
    return Math.round(PAD_TOP + pct * range);
  }
});
return {baseHeight, Y};
}

/* ===== Layout (baseline v1.4) ===== */
function layoutTimeline(tl){
const cards = Array.from(tl.querySelectorAll('.timeline-entry'));
const labels = Array.from(tl.querySelectorAll('.timeline-label'));
const labelByIndex = new Map();
labels.forEach(l => labelByIndex.set(l.dataset.i, l));

const SAME_GAP = 42;
const RESERVE_GAP = 32;
const LABEL_ANCHOR = 12;

const chronological = cards.slice().sort((a,b)=>
  parseFloat(a.dataset.seedTop||'0') - parseFloat(b.dataset.seedTop||'0')
);

const bottom = { left: -Infinity, right: -Infinity };

for (const el of chronological){
  const side = el.classList.contains('right') ? 'right' : 'left';
  const other = side === 'right' ? 'left' : 'right';
  let top = parseFloat(el.dataset.seedTop||'0');

  top = Math.max(top, bottom[side] + SAME_GAP);
  top = Math.max(top, bottom[other] + SAME_GAP);

  el.style.top = top + 'px';
  const h = el.offsetHeight;
  bottom[side] = top + h;

  const reservedBottom = top + h + RESERVE_GAP;
  if (bottom[other] < reservedBottom) bottom[other] = reservedBottom;

  const label = labelByIndex.get(el.dataset.i);
  if (label){
    label.style.top = (top + LABEL_ANCHOR) + 'px';
    label.classList.toggle('left',  side === 'left');
    label.classList.toggle('right', side === 'right');
  }
}

const maxBottom = Math.max(bottom.left, bottom.right);
tl.style.height = Math.ceil(maxBottom + 90) + 'px';
rebuildAnchorTargets();
}

/* ===== Renderers ===== */
function renderMenu(sections){
const ul = document.getElementById("menuList"); ul.innerHTML = "";

const liStart = document.createElement("li");
const aStart = document.createElement("a");
aStart.className = "menu-link current";
aStart.href = "#top";
aStart.textContent = "Start of timeline";
liStart.appendChild(aStart);
ul.appendChild(liStart);

sections.forEach((sec, idx) => {
  const li=document.createElement("li");
  const a=document.createElement("a");
  a.className="menu-link";
  a.href="#"+sec.id;
  a.textContent=sec.title || "Section";
  if (idx === sections.length - 1) a.classList.add("branch-last"); else a.classList.add("branch");
  li.appendChild(a); ul.appendChild(li);
});
setMenuTabIndices(true);
}

function renderSections(sections){
const container=document.getElementById("sections"); container.innerHTML="";
sections.forEach(sec=>{
  const wrapper = document.createElement("section");
  wrapper.className = "section";

  const h2=document.createElement("h2");
  h2.className="section-heading"; h2.id=sec.id || slugify(sec.title, "section");
  h2.textContent=sec.title || "Section";
  wrapper.appendChild(h2);

  const block=document.createElement("div"); block.className="section-block";
  if(sec.img){
    const img=document.createElement("img");
    img.className="section-image"; img.src=sec.img;
    const altText = stripHtml(renderMarkdown((sec.cap || "").trim())) || sec.title;
    img.alt = altText;
    img.tabIndex = 0;
    img.addEventListener('click', ()=>openLightbox(img.src, img.alt));
    img.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' ') openLightbox(img.src, img.alt); });
    img.addEventListener('load', rebuildAnchorTargets);
    block.appendChild(img);
  }
  const cap=document.createElement("div"); cap.className="section-caption";
  cap.innerHTML = DOMPurify.sanitize(renderMarkdown((sec.cap || "").trim())); block.appendChild(cap);
  const desc=document.createElement("div"); desc.className="section-description";
  desc.innerHTML = DOMPurify.sanitize(renderMarkdown((sec.desc || "").trim())); block.appendChild(desc);

  wrapper.appendChild(block);

  if(sec.entries && sec.entries.length){
    const tl = document.createElement("div"); tl.className="timeline";
    const line = document.createElement("div"); line.className="timeline-line"; tl.appendChild(line);

    const pos = initialPositions(sec.entries);

    sec.entries.forEach((e, idx)=>{
      const y = pos.Y[idx];

      const dateText = (e.date||"").trim();
      if (dateText.length > 0){
        const lab = document.createElement("div");
        const side = (e.side || (idx%2?'right':'left'));
        lab.className = "timeline-label " + side;
        lab.textContent = dateText;
        lab.style.top = y + "px";
        lab.dataset.i = String(idx);
        tl.appendChild(lab);
      }

      const wrap = document.createElement("div");
      wrap.className = "timeline-entry " + (e.side || (idx%2?'right':'left'));
      const seed = y - 10;
      wrap.style.top = seed + "px";
      wrap.dataset.i = String(idx);
      wrap.dataset.seedTop = String(seed);
      wrap.id = `${h2.id}-e${idx+1}`;

      const card = document.createElement("div"); card.className="entry-card";

      if(e.img){
        const im = document.createElement("img");
        im.className="entry-image"; im.src=e.img;
        const altText = stripHtml(renderMarkdown((e.cap || "").trim())) || `Entry ${idx+1}`;
        im.alt = altText;
        im.tabIndex = 0;
        im.addEventListener('click', ()=>openLightbox(im.src, im.alt));
        im.addEventListener('keydown', ev=>{ if(ev.key==='Enter' || ev.key===' ') openLightbox(im.src, im.alt); });
        im.addEventListener('load', ()=>layoutTimeline(tl));
        card.appendChild(im);
      }
      const c = document.createElement("div"); c.className="entry-caption";
      c.innerHTML = DOMPurify.sanitize(renderMarkdown((e.cap||"").trim())); card.appendChild(c);

      const d = document.createElement("div"); d.className="entry-description";
      d.innerHTML = DOMPurify.sanitize(renderMarkdown((e.desc||"").trim()));
      card.appendChild(d);

      wrap.appendChild(card);
      tl.appendChild(wrap);
    });

    requestAnimationFrame(()=>layoutTimeline(tl));
    window.addEventListener('resize', ()=>layoutTimeline(tl));

    wrapper.appendChild(tl);
  }

  container.appendChild(wrapper);
});

rebuildAnchorTargets();
}

/* ===== Lightbox ===== */
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
let lastFocus = null;
function openLightbox(src, alt){
lastFocus = document.activeElement;
lightboxImg.src = src; lightboxImg.alt = alt || '';
lightbox.classList.add('open'); document.body.classList.add('modal-open');
lightboxClose.focus();
}
function closeLightbox(){
lightbox.classList.remove('open'); document.body.classList.remove('modal-open');
lightboxImg.src = ''; if (lastFocus && lastFocus.focus) lastFocus.focus();
}
lightbox.addEventListener('click', (e)=>{ if (e.target.dataset.close !== undefined) closeLightbox(); });
lightboxClose.addEventListener('click', closeLightbox);
window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox(); });

/* ===== Anchors ===== */
let anchors = [];
function rebuildAnchorTargets(){
anchors = Array.from(document.querySelectorAll('h2.section-heading, .timeline-entry'));
anchors.sort((a,b)=> (a.getBoundingClientRect().top + window.scrollY) - (b.getBoundingClientRect().top + window.scrollY));
}

/* ===== Bootstrap with external config ===== */
async function loadFromCSVUrl(url){
const res = await fetch(url, {mode:"cors", cache:"no-cache"});
const text = await res.text();
if (!res.ok || /^\s*</.test(text)) throw new Error("CSV fetch failed or returned HTML.");
return text;
}
function showFallback(msg){
const fb = document.getElementById("fallback");
const note = document.getElementById("fallbackNote");
note.textContent = msg || "";
fb.classList.add("visible");
}

(async function main(){
try{
  // Load config
  const conf = await loadConfig();
  const VIEW_URL = conf.VIEW_URL;
  const CSV_URL  = csvUrlFromView(VIEW_URL);
  const EDITOR_URL = conf.EDITOR_URL || null;

  // Wire footer Editor Login if provided
  const editorLink = document.getElementById('editorLink');
  if(editorLink){
    if (EDITOR_URL){ editorLink.href = EDITOR_URL; }
    else { editorLink.removeAttribute('href'); editorLink.style.opacity = '0.6'; editorLink.style.pointerEvents = 'none'; }
  }

  // Fetch + render
  const csvText = await loadFromCSVUrl(CSV_URL);
  const rows = parseCSV(csvText);
  const kv = kvFromTwoColumn(rows);

  const hero = ciGet(kv,"Hero Image");
  const title = ciGet(kv,"Title") || "Untitled";
  const sub = ciGet(kv,"Sub-Title") || "";

  if(hero) document.getElementById("hero").style.backgroundImage = `url("${hero}")`;
  document.getElementById("title").textContent = title + "!";
  document.getElementById("subtitle").textContent = sub;

  const sections = buildSectionsAndEntries(rows);
  renderMenu(sections);
  renderSections(sections);

  rebuildAnchorTargets();
  window.addEventListener('resize', rebuildAnchorTargets);

}catch(err){
  console.error("[Boot] Error:", err);
  document.getElementById("title").textContent = "CSV not loaded";
  document.getElementById("subtitle").textContent = "Use the file picker below to load a CSV export.";
  showFallback(err.message || String(err));
}

const fileInput = document.getElementById("fileInput");
if(fileInput){
  fileInput.addEventListener("change", async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const txt = await f.text();
    const rows = parseCSV(txt);
    const kv = kvFromTwoColumn(rows);

    const hero = ciGet(kv,"Hero Image");
    const title = ciGet(kv,"Title") || "Untitled";
    const sub = ciGet(kv,"Sub-Title") || "";

    if(hero) document.getElementById("hero").style.backgroundImage = `url("${hero}")`;
    document.getElementById("title").textContent = title;
    document.getElementById("subtitle").textContent = sub;

    const sections = buildSectionsAndEntries(rows);
    renderMenu(sections);
    renderSections(sections);

    rebuildAnchorTargets();
    document.getElementById("fallback").classList.remove("visible");
  });
}
})();
