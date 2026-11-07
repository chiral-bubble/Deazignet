const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') files = files.concat(walk(full));
    } else if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.css')) {
      files.push(full);
    }
  }
  return files;
}

const pattern = /\$\s*(\$|\{\s*format(USD|Money))/g;
for (const file of walk('src')) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    console.log(`${file}:${line} -> ${match[0]}`);
  }
}

