// Writes a PowerPoint file of full-slide images, with videos and speaker notes, without an npm
// package. A file is a zip of the parts of ECMA-376, and pptxgenjs does not write the timing of a
// video, which is required for a video to start by itself. The file is written in the form that
// PowerPoint writes, and the schema order of each element is significant.
import { readFileSync } from 'node:fs';
import { crc32, deflateRawSync } from 'node:zlib';

const SLIDE = { width: 1920, height: 1080 };
// 13.333 by 7.5 in, the widescreen slide of PowerPoint
const EMU_PER_PX = 6350;

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NAMESPACES = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const CONTENT = 'application/vnd.openxmlformats-officedocument.presentationml';

const emu = (px) => Math.round(px * EMU_PER_PX);

// a control character other than a tab or a line break is not allowed in XML 1.0
const escape = (text) => String(text)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const relationships = (rels) => `${HEADER}<Relationships xmlns="${NS_PKG}">${rels.map(({ id, type, target }) => (
  `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`
)).join('')}</Relationships>`;

const officeRel = (name) => `${NS_R}/${name}`;

const GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
  + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

const COLOR_MAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" '
  + 'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

const placeholder = (id, name, locks, ph, body = '') => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/>`
  + `<p:cNvSpPr><a:spLocks ${locks}/></p:cNvSpPr><p:nvPr><p:ph ${ph}/></p:nvPr></p:nvSpPr><p:spPr/>${body}</p:sp>`;

const SLIDE_IMAGE = placeholder(2, 'Slide Image Placeholder 1', 'noGrp="1" noRot="1" noChangeAspect="1"', 'type="sldImg"');

const notesBody = (paragraphs) => placeholder(3, 'Notes Placeholder 2', 'noGrp="1"', 'type="body" idx="1"',
  `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs.map((text) => (
    `<a:p><a:r><a:rPr lang="en-US"/><a:t>${escape(text)}</a:t></a:r></a:p>`
  )).join('')}</p:txBody>`);

const fillLine = (n) => '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(n);

// the least that the schema allows, since every slide is covered by its image
const THEME = `${HEADER}<a:theme xmlns:a="${NS_A}" name="Beeson"><a:themeElements>`
  + '<a:clrScheme name="Beeson"><a:dk1><a:srgbClr val="050505"/></a:dk1><a:lt1><a:srgbClr val="FAF8F3"/></a:lt1>'
  + '<a:dk2><a:srgbClr val="232320"/></a:dk2><a:lt2><a:srgbClr val="E3E0D8"/></a:lt2>'
  + '<a:accent1><a:srgbClr val="F08050"/></a:accent1><a:accent2><a:srgbClr val="C94FE6"/></a:accent2>'
  + '<a:accent3><a:srgbClr val="A6A6A0"/></a:accent3><a:accent4><a:srgbClr val="7C7C76"/></a:accent4>'
  + '<a:accent5><a:srgbClr val="55554F"/></a:accent5><a:accent6><a:srgbClr val="8A8A84"/></a:accent6>'
  + '<a:hlink><a:srgbClr val="F08050"/></a:hlink><a:folHlink><a:srgbClr val="C94FE6"/></a:folHlink></a:clrScheme>'
  + '<a:fontScheme name="Beeson"><a:majorFont><a:latin typeface="Times New Roman"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
  + '<a:minorFont><a:latin typeface="Times New Roman"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>'
  + `<a:fmtScheme name="Beeson"><a:fillStyleLst>${fillLine(3)}</a:fillStyleLst>`
  + `<a:lnStyleLst>${`<a:ln w="9525">${fillLine(1)}</a:ln>`.repeat(3)}</a:lnStyleLst>`
  + `<a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst>`
  + `<a:bgFillStyleLst>${fillLine(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

const MASTER = `${HEADER}<p:sldMaster ${NAMESPACES}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>`
  + `<p:spTree>${GROUP}</p:spTree></p:cSld>${COLOR_MAP}`
  + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
  + '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>';

const LAYOUT = `${HEADER}<p:sldLayout ${NAMESPACES} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${GROUP}</p:spTree></p:cSld>`
  + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

const NOTES_MASTER = `${HEADER}<p:notesMaster ${NAMESPACES}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>`
  + `<p:spTree>${GROUP}`
  + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr>'
  + '<p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm>'
  + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>'
  + '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
  + '<p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm>'
  + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>'
  + `</p:spTree></p:cSld>${COLOR_MAP}</p:notesMaster>`;

const notesSlide = (paragraphs) => `${HEADER}<p:notes ${NAMESPACES}><p:cSld><p:spTree>${GROUP}${SLIDE_IMAGE}${notesBody(paragraphs)}</p:spTree></p:cSld>`
  + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';

const frame = ({ x, y, width, height }) => `<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm>`
  + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>';

const blip = (rel) => `<p:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`;

const stepPicture = (name, rel) => `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Step" descr="${escape(name)}"/>`
  + '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
  + `${blip(rel)}${frame({ x: 0, y: 0, ...SLIDE })}</p:pic>`;

// a:videoFile names the video for PowerPoint 2007, and p14:media embeds it in later versions. The
// picture is the poster frame, shown until the video plays
const videoPicture = (video, id, rels) => `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Video ${id - 2}">`
  + '<a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>'
  + `<p:nvPr><a:videoFile r:link="${rels.link}"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}">`
  + `<p14:media xmlns:p14="${NS_P14}" r:embed="${rels.media}"/></p:ext></p:extLst></p:nvPr></p:nvPicPr>`
  + `${blip(rels.poster)}${frame(video)}</p:pic>`;

// the videos are started by the main sequence when the slide is shown, each with the previous one.
// a click on a slide with a video is thus the next step, as on any other slide
function timing(videos) {
  let id = 3;
  const next = () => ++id;
  const inner = next();
  const start = videos.map((video, n) => {
    const node = n === 0 ? 'afterEffect' : 'withEffect';
    return `<p:par><p:cTn id="${next()}" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="${node}">`
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr>'
      + `<p:cTn id="${next()}" dur="${Math.max(1, Math.round(video.duration))}" fill="hold"/>`
      + `<p:tgtEl><p:spTgt spid="${video.shape}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>`;
  }).join('');
  const media = videos.map((video) => (
    `<p:video><p:cMediaNode vol="80000"${video.muted ? ' mute="1"' : ''}>`
    + `<p:cTn id="${next()}"${video.loop ? ' repeatCount="indefinite"' : ''} fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn>`
    + `<p:tgtEl><p:spTgt spid="${video.shape}"/></p:tgtEl></p:cMediaNode></p:video>`
  )).join('');
  return '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
    + '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
    + '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst>'
    + `<p:childTnLst><p:par><p:cTn id="${inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${start}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`
    + '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
    + '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
    + `${media}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

function slideXml(step, imageRel, videos) {
  return `${HEADER}<p:sld ${NAMESPACES}><p:cSld><p:spTree>${GROUP}${stepPicture(step.name, imageRel)}`
    + `${videos.map((video) => videoPicture(video, video.shape, video.rels)).join('')}</p:spTree></p:cSld>`
    + `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${videos.length ? timing(videos) : ''}</p:sld>`;
}

/** Packs parts, a list of [name, data], into a zip, with XML deflated and media stored. */
export function zip(parts) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of parts) {
    const data = Buffer.from(content);
    const packed = /\.(xml|rels)$/.test(name);
    const stored = packed ? deflateRawSync(data) : data;
    const nameBytes = Buffer.from(name);
    // the common fields of a local and a central header, from the version needed on
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0);
    common.writeUInt16LE(packed ? 8 : 0, 4);
    // the date is 1980-01-01, the first of a zip, hence an export does not depend on the time
    common.writeUInt16LE(0x21, 8);
    common.writeUInt32LE(crc32(data), 10);
    common.writeUInt32LE(stored.length, 14);
    common.writeUInt32LE(data.length, 18);
    common.writeUInt16LE(nameBytes.length, 22);
    const signature = (value) => { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; };
    local.push(signature(0x04034b50), common, nameBytes, stored);
    const tail = Buffer.alloc(14);
    tail.writeUInt32LE(offset, 10);
    central.push(signature(0x02014b50), Buffer.from([20, 0]), common, tail, nameBytes);
    offset += 30 + nameBytes.length + stored.length;
  }
  const directory = Buffer.concat(central);
  if (offset + directory.length >= 2 ** 32) throw new Error('the file is over the 4 GiB of a zip without ZIP64, hence use smaller videos');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

/**
 * Returns a PowerPoint file with one slide for each step.
 *
 * Each step has a name, used as the alternative text, an image, the PNG of the whole slide, and
 * notes, a list of paragraphs. Each of its videos has a path to an MP4 file, a poster, a PNG, the
 * box x, y, width, and height in px of a slide of 1920 by 1080, a duration in ms, loop, and muted.
 */
export function pptx(steps) {
  const parts = [];
  const media = new Map();
  let images = 0;
  const image = (data) => {
    parts.push([`ppt/media/image${++images}.png`, data]);
    return `../media/image${images}.png`;
  };
  const clip = (path) => {
    if (!media.has(path)) {
      media.set(path, `../media/video${media.size + 1}.mp4`);
      parts.push([`ppt/media/video${media.size}.mp4`, readFileSync(path)]);
    }
    return media.get(path);
  };

  const overrides = [];
  const presentationRels = [
    { id: 'rId1', type: officeRel('slideMaster'), target: 'slideMasters/slideMaster1.xml' },
    { id: 'rId2', type: officeRel('notesMaster'), target: 'notesMasters/notesMaster1.xml' },
    { id: 'rId3', type: officeRel('theme'), target: 'theme/theme1.xml' },
  ];
  const slideIds = [];

  steps.forEach((step, index) => {
    const n = index + 1;
    const slideName = `ppt/slides/slide${n}.xml`;
    const rels = [
      { id: 'rId1', type: officeRel('slideLayout'), target: '../slideLayouts/slideLayout1.xml' },
      { id: 'rId2', type: officeRel('image'), target: image(step.image) },
    ];
    const addRel = (type, target) => {
      const id = `rId${rels.length + 1}`;
      rels.push({ id, type, target });
      return id;
    };
    const videos = step.videos.map((video, v) => {
      const target = clip(video.path);
      return {
        ...video,
        shape: 3 + v,
        rels: {
          link: addRel(officeRel('video'), target),
          media: addRel('http://schemas.microsoft.com/office/2007/relationships/media', target),
          poster: addRel(officeRel('image'), image(video.poster)),
        },
      };
    });
    if (step.notes.length) {
      addRel(officeRel('notesSlide'), `../notesSlides/notesSlide${n}.xml`);
      parts.push([`ppt/notesSlides/notesSlide${n}.xml`, notesSlide(step.notes)]);
      parts.push([`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, relationships([
        { id: 'rId1', type: officeRel('notesMaster'), target: '../notesMasters/notesMaster1.xml' },
        { id: 'rId2', type: officeRel('slide'), target: `../slides/slide${n}.xml` },
      ])]);
      overrides.push([`/ppt/notesSlides/notesSlide${n}.xml`, `${CONTENT}.notesSlide+xml`]);
    }
    parts.push([slideName, slideXml(step, 'rId2', videos)]);
    parts.push([`ppt/slides/_rels/slide${n}.xml.rels`, relationships(rels)]);
    overrides.push([`/${slideName}`, `${CONTENT}.slide+xml`]);
    const id = `rId${presentationRels.length + 1}`;
    presentationRels.push({ id, type: officeRel('slide'), target: `slides/slide${n}.xml` });
    slideIds.push(`<p:sldId id="${255 + n}" r:id="${id}"/>`);
  });

  const presentation = `${HEADER}<p:presentation ${NAMESPACES}>`
    + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
    + '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>'
    + `<p:sldIdLst>${slideIds.join('')}</p:sldIdLst>`
    + `<p:sldSz cx="${emu(SLIDE.width)}" cy="${emu(SLIDE.height)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;

  const fixed = [
    ['/ppt/presentation.xml', `${CONTENT}.presentation.main+xml`],
    ['/ppt/slideMasters/slideMaster1.xml', `${CONTENT}.slideMaster+xml`],
    ['/ppt/slideLayouts/slideLayout1.xml', `${CONTENT}.slideLayout+xml`],
    ['/ppt/notesMasters/notesMaster1.xml', `${CONTENT}.notesMaster+xml`],
    ['/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml'],
    ['/ppt/theme/theme2.xml', 'application/vnd.openxmlformats-officedocument.theme+xml'],
  ];
  const types = `${HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
    + '<Default Extension="mp4" ContentType="video/mp4"/>'
    + `${[...fixed, ...overrides].map(([name, type]) => `<Override PartName="${name}" ContentType="${type}"/>`).join('')}</Types>`;

  return zip([
    ['[Content_Types].xml', types],
    ['_rels/.rels', relationships([{ id: 'rId1', type: officeRel('officeDocument'), target: 'ppt/presentation.xml' }])],
    ['ppt/presentation.xml', presentation],
    ['ppt/_rels/presentation.xml.rels', relationships(presentationRels)],
    ['ppt/slideMasters/slideMaster1.xml', MASTER],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', relationships([
      { id: 'rId1', type: officeRel('slideLayout'), target: '../slideLayouts/slideLayout1.xml' },
      { id: 'rId2', type: officeRel('theme'), target: '../theme/theme1.xml' },
    ])],
    ['ppt/slideLayouts/slideLayout1.xml', LAYOUT],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', relationships([
      { id: 'rId1', type: officeRel('slideMaster'), target: '../slideMasters/slideMaster1.xml' },
    ])],
    ['ppt/notesMasters/notesMaster1.xml', NOTES_MASTER],
    ['ppt/notesMasters/_rels/notesMaster1.xml.rels', relationships([
      { id: 'rId1', type: officeRel('theme'), target: '../theme/theme2.xml' },
    ])],
    ['ppt/theme/theme1.xml', THEME],
    ['ppt/theme/theme2.xml', THEME],
    ...parts,
  ]);
}
