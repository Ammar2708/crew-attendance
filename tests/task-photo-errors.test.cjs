const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/lib/task-photo-errors.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exported = {};
new Function('exports', compiled.outputText)(exported);
const { isMissingCaptureTimeColumn, photoSubmissionErrorMessage, photoCaptureTime } = exported;

test('only missing capture column errors allow the legacy insert retry', () => {
  for (const code of ['PGRST204', '42703']) {
    assert.equal(isMissingCaptureTimeColumn({ code, message: 'Column captured_at missing' }), true);
  }
  for (const error of [null, new Error('Network request failed'),
    { code: '42501', message: 'Permission denied for captured_at' },
    { code: 'PGRST204', message: 'Column source missing' }]) {
    assert.equal(isMissingCaptureTimeColumn(error), false);
  }
});

test('shows plain Supabase error messages as well as JavaScript errors', () => {
  assert.equal(photoSubmissionErrorMessage({ message: 'Row level security denied' }), 'Row level security denied');
  assert.equal(photoSubmissionErrorMessage(new Error('Network failed')), 'Network failed');
  assert.match(photoSubmissionErrorMessage(null), /Please try again/);
});

test('retains capture time on both current and legacy database schemas', () => {
  const captured = '2026-11-07T16:30:00.000Z';
  const uploaded = '2026-11-07T16:35:00.000Z';
  const photo = { photo_url: 'task/capture-' + Date.parse(captured) + '-abc.jpg', uploaded_at: uploaded };
  assert.equal(photoCaptureTime(photo), captured);
  assert.equal(photoCaptureTime({ ...photo, captured_at: captured }), captured);
  assert.equal(photoCaptureTime({ ...photo, captured_at: null }), captured);
  assert.equal(photoCaptureTime({ ...photo, photo_url: 'task/task-123-abc.jpg' }), uploaded);
});

const { withCaptureTimeFallback } = exported;

test('report retries the screenshot missing-column error without requesting captured_at', async () => {
  const calls = [];
  const photos = [{ photo_url: 'task/old.jpg', uploaded_at: '2026-11-07T16:35:00.000Z' }];
  const result = await withCaptureTimeFallback(async includeCaptureTime => {
    calls.push(includeCaptureTime);
    return includeCaptureTime
      ? { data: null, error: { code: '42703', message: 'column task_photos.captured_at does not exist' } }
      : { data: photos, error: null };
  });
  assert.deepEqual(calls, [true, false]);
  assert.equal(result.data, photos);
  assert.equal(photoCaptureTime(result.data[0]), photos[0].uploaded_at);
});

test('report uses capture column when available and does not retry unrelated errors', async () => {
  for (const result of [
    { data: [{ captured_at: '2026-11-07T16:30:00.000Z' }], error: null },
    { data: null, error: { code: '42501', message: 'Permission denied' } },
  ]) {
    const calls = [];
    assert.equal(await withCaptureTimeFallback(async includeCaptureTime => {
      calls.push(includeCaptureTime);
      return result;
    }), result);
    assert.deepEqual(calls, [true]);
  }
});
