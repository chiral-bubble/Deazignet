const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') files = files.concat(walk(full));
    } else if (f.endsWith('.ts') || f.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

const hits = [];
for (const file of walk('src')) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const s = line.trim();
    if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) return;
    if (/escrow/i.test(line)) {
      const tagMatch = line.match(/>([^<]*escrow[^<]*)</i);
      if (tagMatch) {
        hits.push({ file, line: i + 1, text: tagMatch[1].trim() });
        return;
      }
      const strMatch = line.match(/['"`]([^'"`\n]*\bescrow\b[^'"`\n]*)['"`]/i);
      if (strMatch) {
        const val = strMatch[1];
        if (!/^(in_escrow|escrow_status|inEscrow|hasActiveProjectsOrEscrow|escrow_amount|bento|mini-ui|ledger-status|contract-badge|escrow_)/.test(val)) {
          hits.push({ file, line: i + 1, text: val.trim() });
        }
      }
    }
  });
}
console.log('Total hits:', hits.length);
hits.forEach(h => console.log(`${h.file}:${h.line} -> ${h.text}`));

