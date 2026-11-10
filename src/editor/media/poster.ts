// the poster of a video, i.e. its first frame as a PNG at the size of the video, as the poster frame
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

// the first frame of the video at url. it fails for a video that the browser cannot play, and for
// a video of another origin, e.g. of a deck opened from a file, whose frames a page cannot read
export async function firstFrame(url: string): Promise<Blob> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await loaded(video, 'loadeddata');
    // a frame is decoded once a seek ends, also in Safari, which does not paint at loadeddata. a
    // browser that does not end a seek to the time it is at is waited for 500 ms
    const seeked = loaded(video, 'seeked').catch(() => {});
    video.currentTime = 0;
    await Promise.race([seeked, new Promise((done) => setTimeout(done, 500))]);
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
  }
}
