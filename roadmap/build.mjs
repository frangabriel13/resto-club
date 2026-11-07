// Genera roadmap/index.html a partir de ROADMAP.md.
// Lo corre solo un hook de Claude Code cada vez que se edita ROADMAP.md. A mano: node roadmap/build.mjs
// Para pruebas: node roadmap/build.mjs <roadmap.md> <salida.html>
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] ? resolve(process.argv[2]) : join(here, '..', 'ROADMAP.md');
const out = process.argv[3] ? resolve(process.argv[3]) : join(here, 'index.html');
const md = readFileSync(input, 'utf8');
const template = readFileSync(join(here, 'template.html'), 'utf8');

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const data = {
  title: 'Roadmap', meta: null, delivery: null, pendingTitle: 'Pendientes', pending: [],
  stages: [], closed: [], generatedAt: new Date().toISOString(),
};

const h1 = md.match(/^# (.+)$/m);
if (h1) data.title = h1[1].replace(/^Roadmap\s*[—–-]\s*/, '').trim() || 'Roadmap';
const meta = md.match(/^Meta:\s*(.+)$/m);
if (meta) data.meta = meta[1].trim();

// Opcional: "Entrega: **15 de diciembre de 2026**". Sin esa línea, el tablero funciona sin fechas.
const delivery = md.match(/(?:Entrega|Lanzamiento):\s*\*\*(\d{1,2}) de (\w+) de (\d{4})\*\*/);
const year = delivery ? Number(delivery[3]) : new Date().getFullYear();
if (delivery && MESES[delivery[2].toLowerCase()]) {
  data.delivery = iso(year, MESES[delivery[2].toLowerCase()], delivery[1]);
}

function parseDeps(depText) {
  const pend = [...depText.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const rest = depText.replace(/"[^"]*"/g, '');
  const stageDeps = [...rest.matchAll(/\betapas? (\d+)/gi)].map((m) => Number(m[1]));
  const deps = [...rest.replace(/\betapas? \d+/gi, '').matchAll(/\b\d+\.\d+\b/g)].map((m) => m[0]);
  return { deps, stageDeps, pendDeps: pend };
}

let section = null;
for (const line of md.split('\n')) {
  if (line.startsWith('## ')) {
    // "## Etapa 2 — Título" o, con fechas, "## Etapa 2 (20/10 – 31/10) — Título"
    const stage = line.match(/^## Etapa (\d+)(?: \((\d{1,2})\/(\d{1,2}) [–-] (\d{1,2})\/(\d{1,2})\))?\s*[—–:-]\s*(.+)$/);
    if (stage) {
      const [, n, d1, m1, d2, m2, title] = stage;
      section = {
        n: Number(n), title: title.trim(), hito: null, tasks: [],
        start: d1 ? iso(year, m1, d1) : null, end: d2 ? iso(year, m2, d2) : null,
      };
      data.stages.push(section);
    } else if (line.startsWith('## Pendientes')) {
      section = 'pending';
      data.pendingTitle = line.slice(3).replace(/\s*\(.*\)\s*$/, '').trim();
    } else if (line.startsWith('## Etapas terminadas')) {
      section = 'closed';
    } else {
      section = null;
    }
    continue;
  }
  if (!section) continue;

  if (section === 'closed') {
    // "- Etapa 1 — Base técnica (12 tareas)"
    const c = line.match(/^- (?:\*\*)?Etapa (\d+)(?:\*\*)?\s*[—–:-]\s*(.+?)\s*(?:\((\d+) tareas?\))?\s*✓?\s*$/);
    if (c) data.closed.push({ n: Number(c[1]), title: c[2].trim(), count: c[3] ? Number(c[3]) : 0 });
    continue;
  }

  if (typeof section === 'object' && !section.tasks.length) {
    const hito = line.match(/^Hito:\s*(.+)$/);
    if (hito) { section.hito = hito[1].trim(); continue; }
  }

  const item = line.match(/^- \[([ xX~])\] (.+)$/);
  if (!item) continue;
  const state = item[1] === '~' ? 'doing' : item[1] === ' ' ? 'todo' : 'done';

  if (section === 'pending') {
    // "- [ ] **Nombre** — detalle"
    const p = item[2].match(/^\*\*(.+?)\*\*\s*(?:[—–-]\s*(.*))?$/);
    if (p) data.pending.push({ done: state === 'done', name: p[1].trim(), detail: (p[2] ?? '').trim() });
    else data.pending.push({ done: state === 'done', name: item[2].trim(), detail: '' });
    continue;
  }

  // "- [ ] 1.6 [api] Texto — depende de 1.4, etapa 2, pendiente "Dominio"" (el número puede ir en negrita)
  const task = item[2].match(/^(?:\*\*)?(\d+\.\d+)(?:\*\*)? \[(\w+)\] (.+)$/);
  if (!task) continue;
  let text = task[3];
  let parsed = { deps: [], stageDeps: [], pendDeps: [] };
  const at = text.lastIndexOf(' — depende de ');
  if (at !== -1) {
    parsed = parseDeps(text.slice(at + ' — depende de '.length));
    text = text.slice(0, at);
  }
  section.tasks.push({ id: task[1], state, tag: task[2].toLowerCase(), text, ...parsed });
}

const json = JSON.stringify(data).replace(/</g, '\\u003c');
writeFileSync(`${out}.tmp`, template.replace('/*DATA*/null', () => json));
renameSync(`${out}.tmp`, out);
