'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const INPUT_PATH = path.posix.join(
  '/root',
  'cordata-extract',
  'cordata0.txt'
);

/**
 * Ruler string with position labels every 10 columns (0, 10, 20, ...), trimmed to length.
 * @param {number} length
 * @returns {string}
 */
function buildRuler(length) {
  if (length <= 0) return '';
  const parts = [];
  for (let i = 0; i < length; i += 10) {
    const label = String(i);
    const pad = Math.max(0, 10 - label.length);
    parts.push(label + ' '.repeat(pad));
  }
  return parts.join('').slice(0, length);
}

const SLICE_SPECS = [
  { start: 0, end: 12, label: 'document_number' },
  { start: 12, end: 112, label: 'name_first_100' },
  { start: 112, end: 204, label: 'name_last_92' },
  { start: 204, end: 220, label: 'around_204' },
  { start: 310, end: 340, label: 'around_320' },
  { start: 450, end: 480, label: 'around_460' },
  { start: 468, end: 490, label: 'around_468' },
];

const SEPARATOR = '-'.repeat(80);

(async function run() {
  let stream;
  let rl;

  try {
    await fs.promises.access(INPUT_PATH, fs.constants.R_OK);

    stream = fs.createReadStream(INPUT_PATH, { encoding: 'utf8' });
    rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    let lineNumber = 0;

    for await (const rawLine of rl) {
      if (rawLine.trim() === '') continue;

      lineNumber += 1;
      const line = rawLine;

      console.log(`LINE ${lineNumber} (of 10 non-empty lines)`);
      console.log(`LINE LENGTH: ${line.length}`);

      console.log('RULER:');
      console.log(buildRuler(line.length));
      console.log(line);

      console.log('SLICES:');
      for (const { start, end, label } of SLICE_SPECS) {
        const segment = line.slice(start, end);
        console.log(`  [${start}:${end}] ${label}: ${JSON.stringify(segment)}`);
      }

      console.log(`RAW: ${line}`);

      if (lineNumber < 10) {
        console.log(SEPARATOR);
      }

      if (lineNumber >= 10) {
        break;
      }
    }

    if (lineNumber === 0) {
      console.log('No non-empty lines found in file.');
    }

    console.log('=== DIAGNOSTIC COMPLETE ===');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.error(
        'Error: input file not found.\n' +
          `Attempted path: ${INPUT_PATH}`
      );
    } else {
      console.error('Error:', err.message || err);
    }
    process.exitCode = 1;
  } finally {
    if (rl) {
      rl.close();
    }
    if (stream && !stream.destroyed) {
      stream.destroy();
    }
  }
})();
