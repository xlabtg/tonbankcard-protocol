// Генерирует audit/check-501/findings/*.md и (с --create) создаёт issues через gh.
const fs = require('fs'); const { execFileSync } = require('child_process');
const F = JSON.parse(fs.readFileSync(__dirname + '/check-501-findings.json', 'utf8'));
const create = process.argv.includes('--create');
const out = [];
for (const f of F) {
  const id = `CHECK501-${f.id}`;
  const file = `audit/check-501/findings/${id}-${f.slug}.md`;
  const body = (issue) => [
    `# [${id}] ${f.title}`, '', '## Кратко', '', f.summary, '',
    '## Severity', '', `${f.sev} — ${f.why}`, '',
    '## Затронутый код', '', ...f.code.map(c => `- ${c}`), '',
    '## Воспроизведение', '', f.repro, '',
    '## Рекомендуемое исправление', '', f.fix, '',
    '## Acceptance criteria', '', ...f.ac.map(a => `- [ ] ${a}`), '',
    '## Этап', '', `\`stage:${f.stage}\` — найдено в раунде аудита #501 (PR #502).`,
    ...(issue ? ['', `Tracking issue: ${issue}`] : []), ''].join('\n');
  let url = '';
  if (create) {
    fs.writeFileSync('/tmp/issue-body.md', body(''));
    const labels = ['bug', 'audit', `priority:${f.sev === 'Critical' ? 'critical' : f.sev.toLowerCase()}`, `stage:${f.stage}`, ...f.labels];
    url = execFileSync('gh', ['issue', 'create', '--repo', 'xlabtg/tonbankcard-protocol', '--title', `[${id}] ${f.title}`,
      '--body-file', '/tmp/issue-body.md', ...labels.flatMap(l => ['--label', l])]).toString().trim();
    console.log(id, url);
  }
  fs.writeFileSync(file, body(url));
  out.push({ id, sev: f.sev, stage: f.stage, area: f.area, title: f.title, file, url });
}
fs.writeFileSync(__dirname + '/check-501-issues.json', JSON.stringify(out, null, 2));
