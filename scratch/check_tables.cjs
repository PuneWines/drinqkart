const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const client = createClient(env.VITE_PURCHASE_SUPABASE_URL, env.VITE_PURCHASE_SUPABASE_KEY);

function findFroms(dir) {
  let results = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      results = results.concat(findFroms(full));
    } else if (f.name.endsWith('.js') || f.name.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      const re = /\.from\(['"]([^'"]+)['"]\)/g;
      let m;
      while ((m = re.exec(content)) !== null) {
        results.push(m[1]);
      }
    }
  }
  return results;
}

const tableNames = Array.from(new Set(findFroms('src')));
async function checkAll() {
  const existing = [];
  for (const t of tableNames) {
    const { data, error } = await client.from(t).select('*').limit(1);
    if (!error) existing.push(t);
  }
  console.log('Existing tables in PURCHASE supabase:', existing);
}
checkAll();
