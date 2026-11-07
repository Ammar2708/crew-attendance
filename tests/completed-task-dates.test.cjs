const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/lib/completed-task-dates.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exported = {};
new Function('exports', compiled.outputText)(exported);
const { groupCompletedTasksByDate } = exported;
const task = (id, completedAt) => ({ id, title: id, completedAt, photos: [] });

test('groups by completion day, newest first, with unknown dates last', () => {
  const tasks = [task('old', '2026-11-06T10:00:00Z'), task('unknown', null),
    task('new', '2026-11-07T17:00:00Z'), task('same-day', '2026-11-07T12:00:00Z')];
  const groups = groupCompletedTasksByDate(tasks, 'Europe/London');
  assert.deepEqual(groups.map(group => group.date), ['2026-11-07', '2026-11-06', 'unknown']);
  assert.deepEqual(groups[0].tasks.map(task => task.id), ['new', 'same-day']);
  assert.equal(tasks[0].id, 'old');
});

test('uses the business timezone at midnight and during daylight savings', () => {
  const groups = groupCompletedTasksByDate([task('summer', '2026-07-01T23:30:00Z')], 'Europe/London');
  assert.equal(groups[0].date, '2026-07-02');
  assert.deepEqual(groupCompletedTasksByDate([], 'Europe/London'), []);
});
