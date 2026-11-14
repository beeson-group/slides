// a module preloaded with node --import, which makes the Chrome of scripts/chrome.mjs a browser
// without an H.264 encoder: each page of it is given a VideoEncoder.isConfigSupported that refuses
// every configuration, as in test/record.test.mjs. Chrome does not have a flag that removes the
// encoder, hence the script is added from the pipe of the DevTools protocol, after the Page.enable
// of each page. Its answer has an id that scripts/chrome.mjs does not wait for, and it is dropped
// there. the named exports of a builtin module, e.g. spawn in scripts/chrome.mjs, are updated from
// its default export by syncBuiltinESMExports

import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const source = 'if (window.VideoEncoder) VideoEncoder.isConfigSupported = async (config) => ({ supported: false, config })';
const spawn = childProcess.spawn;
let id = 1e9;

childProcess.spawn = (...args) => {
  const child = spawn(...args);
  const pipe = child.stdio[3];
  if (!pipe) return child;
  const write = pipe.write.bind(pipe);
  pipe.write = (data, ...rest) => {
    const done = write(data, ...rest);
    for (const message of String(data).split('\0').filter(Boolean)) {
      const { method, sessionId } = JSON.parse(message);
      if (method === 'Page.enable') {
        write(`${JSON.stringify({ id: ++id, method: 'Page.addScriptToEvaluateOnNewDocument', params: { source }, sessionId })}\0`);
      }
    }
    return done;
  };
  return child;
};
syncBuiltinESMExports();
