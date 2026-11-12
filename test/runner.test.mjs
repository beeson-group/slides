// check of the test command of package.json and of its copy in the check workflow

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// the options of node in the test command, before the files
const command = JSON.parse(readFileSync('package.json', 'utf8')).scripts.test;
const options = command.split(' ').slice(1, -1);

// most test files close their server after their browser, and on Windows the close of the browser
// fails at times. The server was then left open, and the run waited for the file until the limit
// of its job
test('a test file with a failed cleanup and a server left open is ended', { timeout: 60000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'slides-runner-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, 'open.test.mjs'),
    `import { createServer } from 'node:http';
     import { after, before, test } from 'node:test';
     let server;
     before(() => new Promise((done) => (server = createServer(() => {})).listen(0, done)));
     // a file that is not ended by the test command ends by itself, after the wait of the test
     setTimeout(() => server.close(), 30000);
     after(() => {
       throw new Error('the browser is not closed');
       server.close();
     });
     test('a test', () => {});`,
  );
  // without NODE_TEST_CONTEXT, since node does not run the files of a test command inside a test
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const run = spawn(process.execPath, [...options, 'open.test.mjs'], { cwd: root, env, stdio: 'ignore' });
  t.after(() => run.kill());
  const ended = await Promise.race([new Promise((done) => run.once('exit', () => done(true))), new Promise((done) => setTimeout(() => done(false), 20000).unref())]);
  assert.ok(ended, `node ${options.join(' ')} is still running after 20 s`);
});

// on Windows, a test file was not ended after its last test, without an error, and the run waited
// for it until the limit of 45 minutes of its job. With a limit, the file fails by name. The limit
// is on each test and hook in node 26, and on a whole test file in node 22, hence it is a long one
test('a test file that does not end fails after 15 to 30 minutes', () => {
  const limit = Number(/^--test-timeout=(\d+)$/.exec(options.find((option) => option.startsWith('--test-timeout')) ?? '')?.[1]);
  assert.ok(limit >= 900000 && limit <= 1800000, `the limit of ${command} is ${limit} ms`);
});

test('the test step of the check workflow is the test command with the shard of its job', () => {
  const workflow = readFileSync('.github/workflows/check.yml', 'utf8');
  const step = /^ +- run: (node --test .*)$/m.exec(workflow)?.[1];
  assert.equal(step?.replace(' --test-shard=${{ matrix.shard }}/4', ''), command.replaceAll('\\"', '"'));
});
