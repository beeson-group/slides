// the poster of a video, i.e. a frame of it as a PNG at the size of the video, the first one or the
// one at the time chosen with the poster frame slider of the Video pane, as the poster frame
// of the Movie tab of Keynote and of the Playback tab of PowerPoint. the theme prints the poster in
// the PDF, and npm run check asks for one on every video

// the time in ms after which a video that does not load is given up
const TIMEOUT = 15000;

function loaded(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((done, fail) => {
    const timer = window.setTimeout(() => finish(new Error('the video did not load in time')), TIMEOUT);
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      video.removeEventListener(event, ok);
      video.removeEventListener('error', bad);
      if (error) fail(error);
      else done();
    };
    const ok = () => finish();
    const bad = () => finish(new Error('the browser cannot play this video'));
    video.addEventListener(event, ok);
    video.addEventListener('error', bad);
  });
}

// true when the video can be sought to time s, which a server without byte ranges does not allow
const seekable = (video: HTMLVideoElement, s: number): boolean =>
  [...Array(video.seekable.length).keys()].some((i) => video.seekable.start(i) <= s && s <= video.seekable.end(i));

// a frame is decoded once a seek ends, also in Safari, which does not paint at loadeddata. the
// frame is thus read only once the video is at time s and is not seeking, however long the seek
// takes on a slow machine. a browser may not end a seek to the time that the video is at, hence
// such a seek is waited for 500 ms at most
async function seekTo(video: HTMLVideoElement, s: number): Promise<void> {
  const there = () => !video.seeking && Math.abs(video.currentTime - s) < 0.25;
  const already = there();
  const seeked = loaded(video, 'seeked');
  video.currentTime = s;
  if (already) {
    await Promise.race([seeked.catch(() => {}), new Promise((done) => setTimeout(done, 500))]);
    return;
  }
  await seeked;
  while (!there()) await loaded(video, 'seeked');
}

// the frame of the video at url at time s, or its last frame for a time past its end. a video
// that cannot be sought there, e.g. from a server without byte ranges, is read again from a copy
// in memory. it fails for a video that the browser cannot play, and for a video of another origin,
// e.g. of a deck opened from a file, whose frames a page cannot read
export async function firstFrame(url: string, time = 0): Promise<Blob> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  let copy: string | null = null;
  try {
    await loaded(video, 'loadeddata');
    const at = Number.isFinite(video.duration) ? Math.max(0, Math.min(time, video.duration - 0.001)) : 0;
    if (at > 0 && !seekable(video, at) && !url.startsWith('blob:')) {
      copy = URL.createObjectURL(await (await fetch(url)).blob());
      video.src = copy;
      await loaded(video, 'loadeddata');
    }
    await seekTo(video, at);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) throw new Error('the video does not have a picture');
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    let blob: Blob | null;
    try {
      blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
    } catch {
      throw new Error('the frames of this video cannot be read by the page. Serve the deck from a web server to capture its poster');
    }
    if (!blob) throw new Error('the poster could not be made');
    return blob;
  } finally {
    video.removeAttribute('src');
    video.load();
    if (copy) URL.revokeObjectURL(copy);
  }
}
