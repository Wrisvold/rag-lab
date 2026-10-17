// Builds Word files for the LMS from the Markdown course files.
//
//   NODE_PATH="$(npm root -g)" node agents-course/tools/build-docx.cjs [--notes FILE] [output-folder]
//
// Needs pandoc (it parses the Markdown) and the npm package `docx`.
// The default output folder is agents-course/word/, which git ignores.
//
// Two editions:
//   student/     one file per module. "Instructor:" boxes and "Default:"
//                labels are removed.
//   instructor/  one combined file with everything. Made only with --notes.
//
// The instructor notes are not in this public repository. They are in the
// private repository wrisvold/agents-course-instructor, file
// instructor-notes.md. Each "## week-0N.md" section in that file goes at the
// end of that week, under the heading "Instructor notes", highlighted.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, LevelFormat, Footer, Header, PageNumber, PageBreak,
} = require('docx');

const COURSE = path.join(__dirname, '..');
const args = process.argv.slice(2);
const notesAt = args.indexOf('--notes');
const NOTES = notesAt >= 0 ? path.resolve(args.splice(notesAt, 2)[1]) : null;
const OUT = path.resolve(args[0] || path.join(COURSE, 'word'));

// RAG Lab palette (styles.css)
const C = {
  green: '245C4F', greenDark: '16362F', ice: 'EAF1EE', gold: 'E0A32E',
  goldSoft: 'FBF1DC', tealInk: '0F5C5C', ink: '1F2A27', inkSoft: '4B5854', line: 'CFD9D5',
};
const FONT = 'Calibri';
const MONO = 'Consolas';
const PAGE_W = 12240, MARGIN = 1440, TEXT_W = PAGE_W - 2 * MARGIN; // US Letter, 1 inch margins

// Each module: source file, Word file name, and the name students see for it
const MODULES = [
  { md: 'syllabus.md', file: 'Syllabus', title: 'Syllabus' },
  { md: 'case-fall-line.md', file: 'Case - Fall Line', title: 'The Fall Line Case' },
  { md: 'glossary.md', file: 'Glossary', title: 'Glossary' },
  { md: 'week-01.md', file: 'Week 1 - What an Agent Is' },
  { md: 'week-02.md', file: 'Week 2 - Tools and Function Calling' },
  { md: 'week-03.md', file: 'Week 3 - Agentic RAG' },
  { md: 'week-04.md', file: 'Week 4 - Planning and Metacognition' },
  { md: 'week-05.md', file: 'Week 5 - Multi-Agent Systems and Protocols' },
  { md: 'week-06.md', file: 'Week 6 - Context Engineering and Memory' },
  { md: 'week-07.md', file: 'Week 7 - Trust, Safety, and Security' },
  { md: 'week-08.md', file: 'Week 8 - Production' },
  { md: 'capstone.md', file: 'Capstone', title: 'Capstone' },
];
const DOC_NAMES = Object.fromEntries(MODULES.filter((m) => m.title).map((m) => [m.md, m.title]));
DOC_NAMES['README.md'] = 'About These Materials';

// ---------- pandoc AST helpers ----------

function parse(mdFile) {
  const json = execFileSync('pandoc', ['-f', 'markdown-auto_identifiers', '-t', 'json', mdFile], { encoding: 'utf8' });
  return JSON.parse(json).blocks;
}

function plainText(inlines) {
  return inlines.map((i) => {
    switch (i.t) {
      case 'Str': return i.c;
      case 'Space': case 'SoftBreak': case 'LineBreak': return ' ';
      case 'Code': return i.c[1];
      case 'Emph': case 'Strong': case 'Underline': case 'SmallCaps': case 'Strikeout': return plainText(i.c);
      case 'Link': return plainText(i.c[1]);
      case 'Quoted': return '“' + plainText(i.c[1]) + '”';
      default: return '';
    }
  }).join('');
}

function blocksText(blocks) {
  return blocks.map((b) => (b.t === 'Para' || b.t === 'Plain' ? plainText(b.c) : '')).join(' ');
}

const isInstructorBox = (b) => b.t === 'BlockQuote' && b.c[0] && ['Para', 'Plain'].includes(b.c[0].t) &&
  b.c[0].c[0] && b.c[0].c[0].t === 'Strong' && plainText(b.c[0].c[0].c).startsWith('Instructor');

// Removes instructor-only content for the student edition
function studentBlocks(blocks) {
  const out = [];
  let skipLevel = 0;
  for (const b of blocks) {
    if (b.t === 'Header') {
      const [level, , inl] = b.c;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && /^Instructor notes$/i.test(plainText(inl))) { skipLevel = level; continue; }
    }
    if (skipLevel) continue;
    if (isInstructorBox(b)) {
      // A box that asks the instructor to insert text becomes a highlighted
      // placeholder, so the gap is visible before the file goes to students
      const words = blocksText(b.c).replace(/^Instructor:\s*/, '');
      if (/^Insert\b/.test(words)) out.push({ t: 'Placeholder', c: '[' + words + ']' });
      continue;
    }
    // "Default:" labels are for the instructor. Students see only the rule.
    if (b.t === 'Para' && b.c[0] && b.c[0].t === 'Str' && b.c[0].c === 'Default:') {
      out.push({ t: 'Para', c: b.c.slice(2) });
      continue;
    }
    out.push(b);
  }
  return out;
}

// ---------- inline conversion ----------

function runs(inlines, fmt = {}) {
  const out = [];
  for (const i of inlines) {
    switch (i.t) {
      case 'Str': out.push(text(i.c, fmt)); break;
      case 'Space': case 'SoftBreak': out.push(text(' ', fmt)); break;
      case 'LineBreak': out.push(new TextRun({ break: 1 })); break;
      case 'Emph': out.push(...runs(i.c, { ...fmt, italics: true })); break;
      case 'Strong': out.push(...runs(i.c, { ...fmt, bold: true })); break;
      case 'Quoted': out.push(text('“', fmt), ...runs(i.c[1], fmt), text('”', fmt)); break;
      case 'Code': {
        const code = i.c[1];
        if (/^https?:\/\//.test(code)) out.push(link(code, [text(code, { ...fmt, style: 'Hyperlink' })]));
        else out.push(text(code, { ...fmt, font: MONO, size: 19, color: C.greenDark }));
        break;
      }
      case 'Link': {
        const [, label, [url]] = i.c;
        const internal = url.match(/^([a-z0-9-]+\.md|README\.md)$/i);
        if (internal) {
          // Other course files are separate Word documents, so name the document
          const name = DOC_NAMES[internal[1]] || internal[1];
          const shown = plainText(label);
          if (/\.md$/i.test(shown)) out.push(text('the document “' + name + '”', { ...fmt, italics: true }));
          else out.push(...runs(label, fmt));
        } else {
          out.push(link(url, runs(label, { ...fmt, style: 'Hyperlink' })));
        }
        break;
      }
      default: if (i.c && Array.isArray(i.c)) out.push(...runs(i.c, fmt));
    }
  }
  return out;
}

function text(t, fmt) {
  return new TextRun({ text: t, bold: fmt.bold, italics: fmt.italics, font: fmt.font, size: fmt.size, color: fmt.color, style: fmt.style });
}

function link(url, children) {
  return new ExternalHyperlink({ link: url, children });
}

// ---------- block conversion ----------

class Ctx {
  constructor() { this.listInstance = 0; this.notesMode = false; }
}

function convert(blocks, ctx, opts = {}) {
  const out = [];
  for (const b of blocks) out.push(...block(b, ctx, opts));
  return out;
}

function block(b, ctx, opts) {
  const shade = opts.shade;
  switch (b.t) {
    case 'Header': {
      const [level, , inl] = b.c;
      const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][Math.min(level, 4) - 1];
      const isNotes = /^Instructor notes$/i.test(plainText(inl));
      ctx.notesMode = isNotes ? level : (ctx.notesMode && level <= ctx.notesMode ? false : ctx.notesMode);
      return [new Paragraph({
        heading, children: runs(inl), keepNext: true,
        pageBreakBefore: level === 1 && opts.breakBeforeH1,
        ...(isNotes ? { shading: { type: ShadingType.CLEAR, fill: C.goldSoft, color: 'auto' } } : {}),
      })];
    }
    case 'Para': case 'Plain':
      return [new Paragraph({
        children: runs(b.c),
        indent: opts.indent ? { left: opts.indent } : undefined,
        shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : (ctx.notesMode ? { type: ShadingType.CLEAR, fill: C.goldSoft, color: 'auto' } : undefined),
        border: opts.quote ? { left: { style: BorderStyle.SINGLE, size: 18, color: opts.quoteColor || C.green, space: 8 } } : undefined,
      })];
    case 'BulletList':
      return list(b.c, 'bullets', ctx, opts);
    case 'OrderedList': {
      const [[start], items] = b.c;
      return list(items, 'numbers', ctx, opts, start);
    }
    case 'BlockQuote': {
      const instructor = isInstructorBox(b);
      return convert(b.c, ctx, { ...opts, quote: true, shade: instructor ? C.goldSoft : C.ice, quoteColor: instructor ? C.gold : C.green, indent: 0 });
    }
    case 'Table': return [table(b, ctx), new Paragraph({ spacing: { after: 60 }, children: [] })];
    case 'CodeBlock':
      return b.c[1].split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, font: MONO, size: 19 })], shading: { type: ShadingType.CLEAR, fill: C.ice, color: 'auto' }, spacing: { after: 0 } }));
    case 'Placeholder':
      return [new Paragraph({ children: [new TextRun({ text: b.c, bold: true, shading: { type: ShadingType.CLEAR, fill: 'FFF59D', color: 'auto' } })] })];
    case 'HorizontalRule':
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.line, space: 1 } }, children: [] })];
    default:
      return [];
  }
}

function list(items, kind, ctx, opts, start = 1, level = 0) {
  const instance = ++ctx.listInstance;
  const reference = kind === 'numbers' && start !== 1 ? `numbers-${start}` : kind;
  if (reference !== kind) ctx.extraStarts.add(start);
  const out = [];
  for (const item of items) {
    let first = true;
    for (const b of item) {
      if ((b.t === 'Para' || b.t === 'Plain') && first) {
        out.push(new Paragraph({
          children: runs(b.c),
          numbering: { reference, level, instance },
          spacing: { after: 60 },
          shading: ctx.notesMode ? { type: ShadingType.CLEAR, fill: C.goldSoft, color: 'auto' } : undefined,
        }));
        first = false;
      } else if (b.t === 'BulletList') {
        out.push(...list(b.c, 'bullets', ctx, opts, 1, level + 1));
      } else if (b.t === 'OrderedList') {
        out.push(...list(b.c[1], 'numbers', ctx, opts, b.c[0][0], level + 1));
      } else {
        out.push(...block(b, ctx, { ...opts, indent: 720 * (level + 1) }));
      }
    }
  }
  return out;
}

function table(b, ctx) {
  const [, , , head, bodies] = b.c;
  const headRows = head[1];
  const bodyRows = bodies.flatMap((body) => [...body[2], ...body[3]]);
  const all = [...headRows, ...bodyRows];
  const ncol = all[0][1].length;

  // Column widths: each column is at least as wide as its longest word,
  // then the rest of the page width goes by the length of the content
  const cellText = (r, j) => blocksText(r[1][j][4]);
  const minW = Array.from({ length: ncol }, (_, j) => {
    const longest = Math.max(...all.map((r) => Math.max(0, ...cellText(r, j).split(/\s+/).map((w) => w.length))));
    return Math.max(800, longest * 115 + 260);
  });
  const want = Array.from({ length: ncol }, (_, j) => {
    const lens = all.map((r) => cellText(r, j).length);
    return Math.min(70, Math.max(lens.reduce((a, x) => a + x, 0) / lens.length, ...lens.slice(0, headRows.length)));
  });
  let widths = minW.slice();
  let spare = TEXT_W - widths.reduce((a, x) => a + x, 0);
  if (spare > 0) {
    const extra = want.map((w, j) => Math.max(0, w * 115 - minW[j]) + 1);
    const sum = extra.reduce((a, x) => a + x, 0);
    widths = widths.map((w, j) => w + Math.floor((spare * extra[j]) / sum));
  } else {
    widths = widths.map((w) => Math.floor((w * TEXT_W) / (TEXT_W - spare)));
  }
  widths[widths.length - 1] += TEXT_W - widths.reduce((a, x) => a + x, 0);

  const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
  const borders = { top: border, bottom: border, left: border, right: border };
  const row = (r, isHead) => new TableRow({
    tableHeader: isHead,
    cantSplit: true,
    children: r[1].map((cell, j) => new TableCell({
      width: { size: widths[j], type: WidthType.DXA },
      borders,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: isHead ? { type: ShadingType.CLEAR, fill: C.ice, color: 'auto' } : (ctx.notesMode ? { type: ShadingType.CLEAR, fill: C.goldSoft, color: 'auto' } : undefined),
      children: cellParagraphs(cell[4], isHead, ctx),
    })),
  });
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [...headRows.map((r) => row(r, true)), ...bodyRows.map((r) => row(r, false))],
  });
}

function cellParagraphs(blocks, isHead, ctx) {
  if (!blocks.length) return [new Paragraph({ children: [] })];
  return blocks.flatMap((b) => {
    if (b.t === 'Para' || b.t === 'Plain') {
      return [new Paragraph({ spacing: { after: 0 }, children: runs(b.c, isHead ? { bold: true } : {}) })];
    }
    return block(b, ctx, {});
  });
}

// ---------- document ----------

function numberingConfig(extraStarts) {
  const bulletLevels = ['•', '◦', '▪'].map((sym, level) => ({
    level, format: LevelFormat.BULLET, text: sym, alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360 + 360 * level + 360, hanging: 360 } } },
  }));
  const numberLevels = (start) => [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN].map((format, level) => ({
    level, format, start: level === 0 ? start : 1, text: `%${level + 1}.`, alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360 + 360 * level + 360, hanging: 360 } } },
  }));
  return {
    config: [
      { reference: 'bullets', levels: bulletLevels },
      { reference: 'numbers', levels: numberLevels(1) },
      ...[...extraStarts].map((s) => ({ reference: `numbers-${s}`, levels: numberLevels(s) })),
    ],
  };
}

function styles() {
  const h = (id, size, color, before) => ({
    id, name: id.replace('Heading', 'Heading '), basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { font: FONT, size, bold: true, color },
    paragraph: { spacing: { before, after: 120 }, keepNext: true },
  });
  return {
    default: { document: { run: { font: FONT, size: 22, color: C.ink }, paragraph: { spacing: { after: 140, line: 276 } } } },
    paragraphStyles: [
      { ...h('Heading1', 40, C.green, 0), paragraph: { spacing: { before: 0, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.gold, space: 6 } } } },
      h('Heading2', 30, C.green, 320),
      h('Heading3', 25, C.greenDark, 240),
      h('Heading4', 22, C.greenDark, 200),
      { id: 'Footer', name: 'footer', basedOn: 'Normal', run: { font: FONT, size: 17, color: C.inkSoft }, paragraph: { spacing: { after: 0 } } },
      { id: 'Header', name: 'header', basedOn: 'Normal', run: { font: FONT, size: 17, color: C.inkSoft }, paragraph: { spacing: { after: 0 } } },
    ],
    characterStyles: [{ id: 'Hyperlink', name: 'Hyperlink', basedOn: 'DefaultParagraphFont', run: { color: C.tealInk, underline: { type: 'single' } } }],
  };
}

function section(children, footerTitle) {
  const small = { size: 17, color: C.inkSoft, font: FONT };
  return {
    properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ style: 'Header', alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'AI Agents for AI Strategy · MS in AI Strategy · Georgia College & State University', ...small })] })] }) },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          style: 'Footer',
          tabStops: [{ type: 'right', position: TEXT_W }],
          children: [
            new TextRun({ text: footerTitle, ...small }),
            new TextRun({ text: '\tPage ', ...small }),
            new TextRun({ children: [PageNumber.CURRENT], ...small }),
            new TextRun({ text: ' of ', ...small }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], ...small }),
          ],
        })],
      }),
    },
    children,
  };
}

async function write(file, children, ctx, title) {
  const doc = new Document({
    creator: 'Ward Risvold', title, description: 'AI Agents for AI Strategy course materials',
    styles: styles(), numbering: numberingConfig(ctx.extraStarts), sections: [section(children, title)],
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await Packer.toBuffer(doc));
  console.log('wrote', path.relative(process.cwd(), file));
}

function newCtx() { const c = new Ctx(); c.extraStarts = new Set(); return c; }

async function main() {
  // Student edition: one file per module
  for (const m of MODULES) {
    const ctx = newCtx();
    const blocks = studentBlocks(parse(path.join(COURSE, m.md)));
    const h1 = blocks.find((b) => b.t === 'Header' && b.c[0] === 1);
    const title = h1 ? plainText(h1.c[2]) : m.file;
    await write(path.join(OUT, 'student', m.file + '.docx'), convert(blocks, ctx), ctx, title);
  }

  if (!NOTES) {
    console.log('no --notes file: the Instructor Edition was not made');
    return;
  }

  // Instructor notes, by guide file name
  const notes = {};
  let current = null;
  for (const b of parse(NOTES)) {
    if (b.t === 'Header' && b.c[0] === 2) { current = plainText(b.c[2]).trim(); notes[current] = []; continue; }
    if (current) notes[current].push(b);
  }
  const notesHeading = { t: 'Header', c: [2, ['', [], []], [{ t: 'Str', c: 'Instructor' }, { t: 'Space' }, { t: 'Str', c: 'notes' }]] };

  // Instructor edition: everything in one file
  const ctx = newCtx();
  const title = 'AI Agents for AI Strategy: Instructor Edition';
  const cover = [
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: 'AI Agents for AI Strategy', font: FONT, size: 56, bold: true, color: C.green })] }),
    new Paragraph({ children: [new TextRun({ text: 'Instructor Edition', size: 32, color: C.greenDark })] }),
    new Paragraph({ children: [new TextRun({ text: 'MS in AI Strategy · Georgia College & State University', size: 24, color: C.inkSoft })] }),
    new Paragraph({
      spacing: { before: 480 },
      shading: { type: ShadingType.CLEAR, fill: C.goldSoft, color: 'auto' },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.gold, space: 8 } },
      children: [new TextRun({ text: 'This edition includes the instructor notes, highlighted in gold. Do not post it for students. Post the student files, which do not include the notes.', bold: true })],
    }),
    new Paragraph({ spacing: { before: 480 }, children: [new TextRun({ text: 'Contents', bold: true, size: 26, color: C.green })] }),
    ...['README.md', ...MODULES.map((m) => m.md)].map((md) => {
      const h1 = parse(path.join(COURSE, md)).find((b) => b.t === 'Header' && b.c[0] === 1);
      return new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: 9999 }, spacing: { after: 40 }, children: [new TextRun(plainText(h1.c[2]))] });
    }),
  ];
  const body = [];
  for (const md of ['README.md', ...MODULES.map((m) => m.md)]) {
    ctx.notesMode = false;
    const blocks = parse(path.join(COURSE, md));
    if (notes[md]) blocks.push(notesHeading, ...notes[md]);
    body.push(...convert(blocks, ctx, { breakBeforeH1: true }));
  }
  await write(path.join(OUT, 'instructor', 'Instructor Edition - AI Agents for AI Strategy.docx'), [...cover, ...body], ctx, title);
}

main().catch((e) => { console.error(e); process.exit(1); });
