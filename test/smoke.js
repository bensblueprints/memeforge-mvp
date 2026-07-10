'use strict';

/**
 * Memeforge smoke test — pure Node, no Electron, no Canvas.
 *   1. Layout engine: auto-fit font sizing + word wrap (real overflowing/short strings).
 *   2. CSV batch parser: round-trip with quotes, embedded commas, CRLF/LF.
 *   3. Project store: save -> load round-trip, atomic write, corrupt-file recovery.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const layout = require('../src/layout');
const csv = require('../src/csv');
const store = require('../src/store');

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  console.log('  ✔ ' + msg);
}
function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, `${msg} (expected ${expected}, got ${actual})`);
  passed++;
  console.log('  ✔ ' + msg);
}

console.log('\n— Layout: word wrap —');
{
  const box = { width: 300, height: 200 };
  const short = layout.wrapText('HI', 48, box.width);
  eq(short.length, 1, 'wrapText: short text stays on one line');

  const longText = 'ONE DOES NOT SIMPLY WALK INTO MORDOR WITHOUT A LONG CAPTION';
  const wrapped = layout.wrapText(longText, 48, box.width);
  ok(wrapped.length > 1, 'wrapText: a long caption wraps across multiple lines');
  for (const line of wrapped) {
    ok(layout.estimateTextWidth(line, 48) <= box.width + 1e-6, `wrapText: line "${line}" fits within box width`);
  }
  const rejoined = wrapped.join(' ');
  eq(rejoined, longText, 'wrapText: rejoined wrapped lines equal the original text (no words dropped)');

  const unbreakable = 'SUPERCALIFRAGILISTICEXPIALIDOCIOUSANDTHENSOME';
  const hardWrapped = layout.wrapText(unbreakable, 48, 100);
  ok(hardWrapped.length > 1, 'wrapText: a single unbreakable word is hard-broken across lines');
  eq(hardWrapped.join(''), unbreakable, 'wrapText: hard-broken pieces reassemble to the original word');
}

console.log('\n— Layout: auto-fit font sizing —');
{
  const box = { width: 320, height: 140 };

  const shortFit = layout.autoFitText('LOL', box, { startFontSize: 60, minFontSize: 10 });
  eq(shortFit.fontSize, 60, 'autoFitText: short text keeps the starting (max) font size');
  eq(shortFit.lines.length, 1, 'autoFitText: short text stays on a single line');

  const longFit = layout.autoFitText(
    'WHEN THE CODE COMPILES ON THE FIRST TRY BUT YOU HAVE NO IDEA WHY IT WORKS AND YOU ARE TOO AFRAID TO TOUCH ANYTHING EVER AGAIN',
    box,
    { startFontSize: 60, minFontSize: 10 }
  );
  ok(longFit.fontSize < shortFit.fontSize, 'autoFitText: long text shrinks the font size below the short-text case');
  for (const line of longFit.lines) {
    ok(layout.estimateTextWidth(line, longFit.fontSize) <= box.width + 1e-6,
      `autoFitText: wrapped line fits box width at fontSize=${longFit.fontSize}`);
  }
  eq(longFit.lines.length <= 4, true, 'autoFitText: respects the default max-lines cap');

  // Monotonic sanity: strictly longer text should never end up with a *larger* font size.
  const mid = layout.autoFitText('A DECENT LENGTH CAPTION HERE', box, { startFontSize: 60, minFontSize: 10 });
  ok(mid.fontSize <= shortFit.fontSize, 'autoFitText: medium text is not larger than short text');
  ok(longFit.fontSize <= mid.fontSize, 'autoFitText: long text is not larger than medium text');
}

console.log('\n— Layout: stroke-safe band positioning —');
{
  const canvas = { width: 800, height: 600 };
  const top = layout.bandBox(canvas, 'top');
  const bottom = layout.bandBox(canvas, 'bottom');
  ok(top.y >= 0, 'bandBox: top band has a non-negative y (stroke stays on-canvas)');
  ok(bottom.y + bottom.height <= canvas.height, 'bandBox: bottom band bottom edge stays within canvas height');
  ok(top.x > 0 && top.x + top.width < canvas.width, 'bandBox: top band is inset from the left/right edges');
  eq(top.align, 'center', 'bandBox: bands default to center alignment');
}

console.log('\n— CSV: batch parser round-trip —');
{
  const raw = [
    'image,top,bottom',
    'C:\\memes\\drake.png,"Subscriptions, forever",Buy once own it',
    '"C:\\memes\\""quoted name"".jpg","He said ""never again""",Narrator: he did it again',
    'relative/path.png,,Bottom text only',
  ].join('\r\n') + '\r\n';

  const jobs = csv.parseJobs(raw);
  eq(jobs.length, 3, 'csv: header row detected and skipped, 3 job rows parsed');
  eq(jobs[0].image, 'C:\\memes\\drake.png', 'csv: plain image path parsed');
  eq(jobs[0].top, 'Subscriptions, forever', 'csv: field with an embedded comma parsed correctly (quoted)');
  eq(jobs[0].bottom, 'Buy once own it', 'csv: unquoted field parsed correctly');
  eq(jobs[1].image, 'C:\\memes\\"quoted name".jpg', 'csv: quoted field with embedded escaped quotes parsed correctly');
  eq(jobs[1].top, 'He said "never again"', 'csv: doubled-quote escaping (""...."") decodes to a literal quote');
  eq(jobs[2].top, '', 'csv: empty field parses to empty string, not undefined');
  eq(jobs[2].bottom, 'Bottom text only', 'csv: trailing field after an empty field parses correctly');

  // LF-only file (no header) should parse identically in shape.
  const lfOnly = 'a.png,Top A,Bottom A\nb.png,Top B,Bottom B\n';
  const lfJobs = csv.parseJobs(lfOnly);
  eq(lfJobs.length, 2, 'csv: LF-only line endings parse correctly (no header row)');
  eq(lfJobs[1].top, 'Top B', 'csv: second row of an LF-only file parses correctly');

  // Round-trip: serialize the original jobs back to CSV, re-parse, compare.
  const reserialized = csv.serializeJobs(jobs);
  const reparsed = csv.parseJobs(reserialized);
  assert.deepStrictEqual(reparsed, jobs);
  passed++; console.log('  ✔ csv: serialize -> parse round-trips exactly, including comma+quote fields');
}

console.log('\n— Store: project round-trip —');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memeforge-test-'));
  const file = path.join(dir, 'my-meme' + store.EXTENSION);

  const project = store.defaultProject();
  project.image = 'C:\\memes\\drake.png';
  project.canvas = { width: 1000, height: 750 };
  project.layers.push({
    id: 'l1', type: 'text', text: 'TOP TEXT, "quoted"', band: 'top',
    x: 40, y: 20, width: 920, height: 160, fontSize: 64,
    fontFamily: 'Impact, "Anton", sans-serif', fill: '#ffffff', stroke: '#000000',
    strokeWidth: 6, align: 'center', autoFit: true,
  });
  project.layers.push({
    id: 'l2', type: 'text', text: 'bottom text\nwith a newline', band: 'bottom',
    x: 40, y: 560, width: 920, height: 160, fontSize: 58,
    fontFamily: 'Impact, "Anton", sans-serif', fill: '#ffffff', stroke: '#000000',
    strokeWidth: 6, align: 'center', autoFit: false,
  });

  const { data: saved } = store.save(file, project);
  ok(fs.existsSync(file), 'store: save() writes the .meme project file');
  ok(!fs.existsSync(file + '.tmp-' + process.pid), 'store: temp file is renamed away, not left behind');

  const loaded = store.load(file);
  eq(loaded.image, saved.image, 'store: image reference survives save -> load');
  assert.deepStrictEqual(loaded.canvas, saved.canvas);
  passed++; console.log('  ✔ store: canvas dimensions survive save -> load');
  assert.deepStrictEqual(loaded.layers, saved.layers);
  passed++; console.log('  ✔ store: layers array (incl. quotes/newlines in text) survives save -> load byte-for-byte');
  eq(loaded.layers[0].text, 'TOP TEXT, "quoted"', 'store: quoted text in a layer is preserved exactly');

  // Corrupt file -> safe default + .corrupt backup, not a crash.
  fs.writeFileSync(file, '{not valid json', 'utf8');
  const recovered = store.load(file);
  eq(recovered.layers.length, 0, 'store: corrupt project file recovers to a safe empty default');
  ok(fs.readdirSync(dir).some((f) => f.includes('.corrupt-')), 'store: corrupt file is preserved as a .corrupt backup, not deleted');

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\nAll good — ${passed} assertions passed.\n`);
