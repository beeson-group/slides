// Firefox and Safari driven over W3C WebDriver with fetch, used in scripts/check.mjs. The object
// returned by launch() has the shape of the one in scripts/chrome.mjs, hence an npm package is not
// required. WebDriver has no access to the console in Safari, thus page.errors stays empty here, and
// the check of a deck is made in the page itself. geckodriver and safaridriver are preinstalled on
// the runners of GitHub. On a Mac, safaridriver has to be enabled once with `sudo safaridriver --enable`.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

/**
 * Serves the files of a folder on a local port, and returns its origin and close(). The answer for
 * a file is held back by delay(path) ms. A Range request is answered with the bytes it names, as a
 * static server does, since Chrome otherwise holds a connection for each video it reads in part,
 * and a second tab of a deck with two videos then waits about 15 s for its files. With writable, a
 * PUT writes its body into the file, as the stand-in of a file handle does in
 * test/editor-follow.test.mjs.
 */
export async function serve(folder, { delay = () => 0, writable = false } = {}) {
  const root = resolve(folder);
  const server = createHttpServer(async (request, response) => {
    const path = join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    try {
      if (!path.startsWith(root + sep)) throw new Error(`${path} is outside ${root}`);
      if (writable && request.method === 'PUT') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        await writeFile(path, Buffer.concat(chunks));
        response.writeHead(204).end();
        return;
      }
      const body = await readFile(path);
      await sleep(delay(path));
      const type = { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' };
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        if (start > end || start >= body.length) {
          response.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end();
          return;
        }
        response.writeHead(206, { ...type, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1 });
        response.end(body.subarray(start, end + 1));
        return;
      }
      response.writeHead(200, { ...type, 'Content-Length': body.length });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close() {
      server.close();
      server.closeAllConnections();
    },
  };
}

function freePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

export function driverOf(browser, env) {
  if (browser === 'safari') return { command: '/usr/bin/safaridriver', capabilities: { browserName: 'safari' } };
  if (browser !== 'firefox') throw new Error(`unknown browser ${browser}, use chrome, firefox, or safari`);
  // with a display, as under xvfb-run on a runner, since WebGL in software needs a window on Linux
  const options = { args: env.DISPLAY ? [] : ['-headless'], ...(env.FIREFOX_PATH ? { binary: env.FIREFOX_PATH } : {}) };
  return {
    command: env.GECKOWEBDRIVER ? join(env.GECKOWEBDRIVER, 'geckodriver') : 'geckodriver',
    capabilities: { browserName: 'firefox', 'moz:firefoxOptions': options },
  };
}

// the expression is evaluated in the global scope of the page, and a promise is awaited
const evaluator = `const done = arguments[arguments.length - 1];
Promise.resolve().then(() => (0, eval)(arguments[0])).then(
  (value) => done({ value }),
  (error) => done({ error: String(error?.stack ?? error) }),
);`;

/** Starts the driver and a session, and returns an object with newPage() and close(). */
export async function launch(browser, { env = process.env, timeout = 120000 } = {}) {
  const { command, capabilities } = driverOf(browser, env);
  const port = await freePort();
  const child = spawn(command, ['--port', String(port)], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-2000);
  });
  const exited = new Promise((done) => {
    child.once('exit', done);
    child.once('error', done);
  });

  async function request(method, path, body) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const { value } = await response.json();
    if (!response.ok) throw new Error(`${browser}: ${value.error}: ${value.message}\n${stderr}`);
    return value;
  }

  let id;
  try {
    for (let attempt = 0; ; attempt++) {
      const ready = await request('GET', '/status').then((status) => status.ready, () => false);
      if (ready) break;
      if (attempt === 100 || child.exitCode !== null) throw new Error(`${command} did not start\n${stderr}`);
      await sleep(100);
    }
    ({ sessionId: id } = await request('POST', '/session', { capabilities: { alwaysMatch: capabilities } }));
    await request('POST', `/session/${id}/timeouts`, { script: timeout, pageLoad: timeout });
    await request('POST', `/session/${id}/window/rect`, { width: 1920, height: 1080 });
  } catch (error) {
    child.kill();
    await exited;
    throw error;
  }

  async function evaluate(expression) {
    const result = await request('POST', `/session/${id}/execute/async`, { script: evaluator, args: [expression] });
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  // all pages are shown in one window, which is kept at the size given to launch()
  function newPage() {
    return {
      errors: [],
      evaluate,
      goto: (url) => request('POST', `/session/${id}/url`, { url }),
      async waitFor(expression, wait = 15000) {
        const start = Date.now();
        while (!(await evaluate(expression))) {
          if (Date.now() - start > wait) throw new Error(`timed out waiting for ${expression}`);
          await sleep(50);
        }
      },
      screenshot: async () => Buffer.from(await request('GET', `/session/${id}/screenshot`), 'base64'),
      // the next goto() is thus a load of the deck, and not only a change of its hash
      close: () => request('POST', `/session/${id}/url`, { url: 'about:blank' }),
    };
  }

  async function close() {
    try {
      await request('DELETE', `/session/${id}`);
    } finally {
      child.kill();
      await exited;
    }
  }

  // a command of the session, e.g. session('POST', '/actions', { actions }) for trusted input
  const session = (method, path, body) => request(method, `/session/${id}${path}`, body);

  return { newPage, close, session };
}
