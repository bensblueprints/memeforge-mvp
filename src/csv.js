/**
 * Memeforge — batch CSV parser/serializer. Pure Node, zero dependencies.
 *
 * Format: three columns — image path, top text, bottom text.
 * An optional header row ("image,top,bottom" — case-insensitive on the
 * first cell being "image") is auto-detected and skipped.
 *
 * Handles: quoted fields, commas inside quotes, doubled-quote escaping
 * ("" inside a quoted field means a literal "), and both CRLF and LF
 * line endings (mixed within the same file is fine too).
 */

'use strict';

/** Parse raw CSV text into an array of row arrays (array of string cells). */
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text == null ? '' : text);
  let i = 0;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { pushField(); i += 1; continue; }
    if (ch === '\r') {
      // Treat \r\n and lone \r as one line break.
      if (src[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') { pushRow(); i += 1; continue; }

    field += ch;
    i += 1;
  }

  // Trailing field/row (file may or may not end with a newline).
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop fully-empty trailing rows produced by a trailing newline.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function looksLikeHeader(row) {
  return !!row[0] && row[0].trim().toLowerCase() === 'image';
}

/** Parse a batch CSV string into job rows: [{ image, top, bottom }]. */
function parseJobs(text) {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const start = looksLikeHeader(rows[0]) ? 1 : 0;
  const jobs = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || (r.length === 1 && r[0].trim() === '')) continue;
    jobs.push({
      image: (r[0] || '').trim(),
      top: r[1] || '',
      bottom: r[2] || '',
    });
  }
  return jobs;
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Serialize job rows back into a CSV string (with header, CRLF line endings). */
function serializeJobs(jobs) {
  const rows = [['image', 'top', 'bottom']];
  for (const job of jobs || []) {
    rows.push([job.image || '', job.top || '', job.bottom || '']);
  }
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

module.exports = { parseRows, parseJobs, serializeJobs, csvEscape };
