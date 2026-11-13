/*! TyCHO runtime 0.2.0, Apache-2.0, https://github.com/beeson-group/tycho
 * This bundle contains:
 * mp4-muxer 5.2.2, MIT, Copyright 2023 Vanilagy, https://github.com/Vanilagy/mp4-muxer
 * three 0.187.0, MIT, Copyright 2010-2026 three.js authors, https://github.com/mrdoob/three.js
 * Full license texts: https://github.com/beeson-group/tycho/blob/main/THIRD_PARTY_NOTICES.md */
"use strict";var tycho=(()=>{var Rh=Object.defineProperty;var K0=Object.getOwnPropertyDescriptor;var Z0=Object.getOwnPropertyNames;var Q0=Object.prototype.hasOwnProperty;var ey=(n,e)=>{for(var t in e)Rh(n,t,{get:e[t],enumerable:!0})},ty=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of Z0(e))!Q0.call(n,s)&&s!==t&&Rh(n,s,{get:()=>e[s],enumerable:!(i=K0(e,s))||i.enumerable});return n};var ny=n=>ty(Rh({},"__esModule",{value:!0}),n);var lT={};ey(lT,{Container:()=>Ys,DATA_VERSION:()=>Xs,EXPORT_LIMITS:()=>wu,SCENE_MAJOR:()=>ys,SCENE_MINOR:()=>Zr,TychoError:()=>Qt,TychoViewerElement:()=>go,colormap:()=>ws,colormapCss:()=>Kf,decodeEmbedded:()=>vo,define:()=>Th,evaluate:()=>Jf,exportVideo:()=>oT,formatNumber:()=>Yi,sizePreset:()=>va,validate:()=>zo});var Qt=class extends Error{rule;constructor(e,t){super(`[${e}] ${t}`),this.name="TychoError",this.rule=e}};function T(n,e){throw new Qt(n,e)}var Xs=1,iy=[84,89,67,68],Jr=12,Cf={raw:new Set(["dtype","shape","encoding","offset","length"]),"shuffle-delta-deflate":new Set(["dtype","shape","encoding","chunk_rows","chunks"])},js={int8:Int8Array,uint8:Uint8Array,int16:Int16Array,uint16:Uint16Array,int32:Int32Array,uint32:Uint32Array,float32:Float32Array,float64:Float64Array},Rf=new Uint8Array(new Uint16Array([1]).buffer)[0]===1;function sy(n){return typeof n=="string"&&Object.hasOwn(js,n)}function qs(n){return js[n].BYTES_PER_ELEMENT}var Kr=n=>Number.isSafeInteger(n)&&n>=0,Ph=n=>n!==null&&typeof n=="object"&&!Array.isArray(n);function ry(n,e,t,i){let s=new js[i](t),r=qs(i),a={int8:o=>n.getInt8(o),uint8:o=>n.getUint8(o),int16:o=>n.getInt16(o,!0),uint16:o=>n.getUint16(o,!0),int32:o=>n.getInt32(o,!0),uint32:o=>n.getUint32(o,!0),float32:o=>n.getFloat32(o,!0),float64:o=>n.getFloat64(o,!0)}[i];for(let o=0;o<t;o++)s[o]=a(e+o*r);return s}async function ay(n,e,t){let i=e.length,s=new DecompressionStream("deflate"),r=s.writable.getWriter();r.write(n).catch(()=>{}),r.close().catch(()=>{});let a=s.readable.getReader(),o=0;try{for(;;){let{done:l,value:c}=await a.read();if(l)break;o+c.length>i&&(a.cancel().catch(()=>{}),T("D5",`${t} inflates to more than the ${i} bytes of its rows`)),e.set(c,o),o+=c.length}}catch(l){if(l instanceof Qt)throw l;let c=l.message;T("D5",`${t} does not inflate${c?`: ${c}`:""}`)}o!==i&&T("D5",`${t} inflates to ${o} bytes, not the ${i} of its rows`)}function oy(n,e,t,i,s,r){let a=e*t;if(i===1){let o=new Uint8Array(s,r,a);o.set(n.subarray(0,Math.min(t,a)));for(let l=t;l<a;l++)o[l]=n[l]+o[l-t]}else if(i===2){let o=new Uint16Array(s,r,a);for(let l=0;l<a;l++){let c=n[l]|n[a+l]<<8;o[l]=l<t?c:c+o[l-t]}}else if(i===4){let o=new Uint32Array(s,r,a),l=2*a,c=3*a;for(let h=0;h<a;h++){let u=(n[h]|n[a+h]<<8|n[l+h]<<16|n[c+h]<<24)>>>0;o[h]=h<t?u:u+o[h-t]}}else{let o=new Uint32Array(s,r,2*a),l=Rf?0:1,c=1-l;for(let h=0;h<a;h++){let u=(n[h]|n[a+h]<<8|n[2*a+h]<<16|n[3*a+h]<<24)>>>0,f=(n[4*a+h]|n[5*a+h]<<8|n[6*a+h]<<16|n[7*a+h]<<24)>>>0;if(h>=t){let d=2*(h-t);u+=o[d+l],f+=o[d+c]+(u>4294967295?1:0)}o[2*h+l]=u,o[2*h+c]=f}}}function ly(n){return Math.min(n.chunk_rows,n.shape[0])*n.shape.slice(1).reduce((e,t)=>e*t,1)*qs(n.dtype)}async function cy(n,e,t,i){let s=qs(e.dtype),r=e.shape[0],a=e.shape.slice(1).reduce((l,c)=>l*c,1),o=new ArrayBuffer(r*a*s);for(let[l,[c,h]]of e.chunks.entries()){let u=l*e.chunk_rows,f=Math.min(e.chunk_rows,r-u),d=i.subarray(0,f*a*s);await ay(t.subarray(c,c+h),d,`chunk ${l} of view ${n}`),oy(d,f,a,s,o,u*a*s)}return new js[e.dtype](o,0,r*a)}function hy(n,e,t){Ph(e)||T("1",`view ${n} is not an object`);let i=typeof e.encoding=="string"&&Object.hasOwn(Cf,e.encoding)?Cf[e.encoding]:null;i===null&&T("D2",`view ${n} has encoding ${JSON.stringify(e.encoding)}, which this reader does not know`);let s=Object.keys(e).filter(h=>!i.has(h));s.length>0&&T("D2",`view ${n} has keys ${s.sort().join(", ")} that this reader does not know`);let r=[...i].filter(h=>!Object.hasOwn(e,h));r.length>0&&T("D2",`view ${n} lacks the keys ${r.join(", ")}`),sy(e.dtype)||T("D1",`view ${n} has dtype ${JSON.stringify(e.dtype)}, not one of ${Object.keys(js).join(", ")}`);let a=e.shape;(!Array.isArray(a)||a.length===0||!a.every(Kr))&&T("D2",`view ${n} has shape ${JSON.stringify(a)}, not a nonempty list of counts`);let o=a.reduce((h,u)=>h*u,1)*qs(e.dtype);if(Number.isSafeInteger(o)||T("D2",`view ${n} has shape [${a.join(", ")}], which is too large`),e.encoding==="raw"){(!Kr(e.offset)||!Kr(e.length))&&T("D2",`view ${n} has an offset or a length that is not a count`),e.offset%8!==0&&T("D2",`view ${n} starts at byte ${e.offset}, which is not a multiple of 8`),e.length!==o&&T("D2",`view ${n} has length ${e.length}, while shape [${a.join(", ")}] of ${e.dtype} takes ${o} bytes`),e.offset+e.length>t&&T("D2",`view ${n} runs past the end of the file, at bytes ${e.offset} to ${e.offset+e.length} of the payload`);return}let l=e.chunk_rows;(!Kr(l)||l<1)&&T("D5",`view ${n} has chunk_rows ${JSON.stringify(l)}, not a positive integer`),Array.isArray(e.chunks)||T("D5",`the chunks of view ${n} are not a list`);let c=Math.ceil(a[0]/l);e.chunks.length!==c&&T("D5",`view ${n} has ${e.chunks.length} chunks, while ${a[0]} rows in chunks of ${l} take ${c}`),e.chunks.forEach((h,u)=>{(!Array.isArray(h)||h.length!==2||!h.every(Kr))&&T("D5",`chunk ${u} of view ${n} is not an [offset, length] pair of counts`),h[0]+h[1]>t&&T("D5",`chunk ${u} of view ${n} runs past the end of the file`)})}var Ys=class n{header;bytes;payloadStart;cache=new Map;constructor(e,t,i){this.header=e,this.bytes=t,this.payloadStart=i}static async parse(e){let t=ArrayBuffer.isView(e)?new DataView(e.buffer,e.byteOffset,e.byteLength):new DataView(e),i=t.byteLength;(i<Jr||iy.some((u,f)=>t.getUint8(f)!==u))&&T("1",'the bytes are not a TyCHO data container, since they lack the 12-byte preamble that starts with the magic "TYCD"');let s=t.getUint32(4,!0);s!==Xs&&T("D3",`data container version ${s} is not supported, since this reader reads only version ${Xs}`);let r=t.getUint32(8,!0);Jr+r>i&&T("1",`the header length ${r} runs past the end of the file`);let a;try{let u=new TextDecoder("utf-8",{fatal:!0,ignoreBOM:!0}).decode(new Uint8Array(t.buffer,t.byteOffset+Jr,r));a=JSON.parse(u)}catch(u){T("1",`the header is not JSON: ${u.message}`)}(a===null||typeof a!="object")&&T("1","the header is not a JSON object"),a.format!=="tycho-data"&&T("1",`header format is ${JSON.stringify(a.format)}, not "tycho-data"`),a.version!==Xs&&T("D3",`header version ${JSON.stringify(a.version)} is not supported, since this reader reads only version ${Xs}`),a.generator!==void 0&&typeof a.generator!="string"&&T("1","the header generator is not a string"),a.meta!==void 0&&!Ph(a.meta)&&T("1","the header meta is not an object"),Ph(a.views)||T("1",'the header lacks a "views" object');let o=Jr+r+(8-(Jr+r)%8)%8,l=Math.max(0,i-o);for(let[u,f]of Object.entries(a.views))hy(u,f,l);let c=new n(a,t,o),h=Object.entries(a.views).filter(u=>u[1].encoding==="shuffle-delta-deflate");if(h.length>0){typeof DecompressionStream>"u"&&T("D5","this runtime lacks DecompressionStream, which encoded views need");let u=new Uint8Array(t.buffer,t.byteOffset+o,l),f=new Uint8Array(Math.max(...h.map(([,d])=>ly(d))));for(let[d,p]of h){let y=await cy(d,p,u,f);c.cache.set(d,{name:d,dtype:p.dtype,shape:[...p.shape],data:y})}}return c}has(e){return Object.hasOwn(this.header.views,e)}names(){return Object.keys(this.header.views)}view(e){let t=this.cache.get(e);if(t)return t;this.has(e)||T("2.1",`the data container lacks view ${JSON.stringify(e)}`);let i=this.header.views[e],s=i.length/qs(i.dtype),r=this.bytes.byteOffset+this.payloadStart+i.offset,a=Rf&&r%qs(i.dtype)===0?new js[i.dtype](this.bytes.buffer,r,s):ry(this.bytes,this.payloadStart+i.offset,s,i.dtype),o={name:e,dtype:i.dtype,shape:[...i.shape],data:a};return this.cache.set(e,o),o}};function uy(n){let e=atob(n.replace(/\s+/g,"")),t=new Uint8Array(new ArrayBuffer(e.length));for(let i=0;i<e.length;i++)t[i]=e.charCodeAt(i);return t}function vo(n,e="base64"){return e!=="base64"&&T("1",`data encoding ${e} is not base64`),uy(n)}var ys=0,Zr=4,Pf=new Set(["frames.origin_channel","layers.arrows","layers.driver_context","layers.outline","clock.keys","layers.clock","camera.keys","layers.label","layers.points"]),Lf=new Set(["format","version","requires","generator","title","theme","frames","bodies","track_sets","variables","clock","views","controls","readouts","initial","stages","overlays"]),xo=/^[A-Za-z0-9_.-]+$/,rt="@index";var Qr=8,Lh=["linear","smooth","in","out","in-out","hold"];function Rt(n){return n.seconds??Qr*(n.laps??1)}function zn(n,e){return e*Rt(n)}function If(n,e){switch(n??"linear"){case"linear":return e;case"smooth":return e*e*(3-2*e);case"in":return e*e*e;case"out":{let t=1-e;return 1-t*t*t}case"in-out":{if(e<.5)return 4*e*e*e;let t=2-2*e;return 1-t*t*t/2}case"hold":return 0;default:return T("K2",`the ease ${JSON.stringify(n)} is not one of ${Lh.join(", ")}`)}}function li(n,e,t=i=>typeof i=="number"&&Number.isFinite(i)){(!Array.isArray(n)||n.length===0)&&T("K1",`${e} has keys ${JSON.stringify(n)}, not a list of at least one key`);let i=-1/0;for(let s of n){(!Array.isArray(s)||s.length<2||s.length>3)&&T("K1",`${e} has a key ${JSON.stringify(s)}, not [t, v] or [t, v, ease]`);let r=s[0];(typeof r!="number"||!Number.isFinite(r))&&T("K1",`${e} has a key at ${JSON.stringify(r)}, not a finite time`),r<i&&T("K1",`${e} has keys whose times decrease, from ${i} to ${r}`),i=r,t(s[1])||T("K1",`${e} has a key whose value is ${JSON.stringify(s[1])}`),s.length===3&&(typeof s[2]!="string"||!Lh.includes(s[2]))&&T("K2",`${e} has a key whose ease is ${JSON.stringify(s[2])}, not one of ${Lh.join(", ")}`)}return n}function kf(n,e,t,i){let s=-1,r=0,a=e-1;for(;r<=a;){let l=r+a>>1;n(l)<=t?(s=l,r=l+1):a=l-1}if(s<0)return{i:0,e:null};if(s===e-1)return{i:s,e:null};let o=(t-n(s))/(n(s+1)-n(s));return{i:s,e:If(i(s+1),o)}}function Js(n,e){let{i:t,e:i}=kf(r=>n[r][0],n.length,e,r=>n[r][2]),s=n[t][1];return i===null?s:s+i*(n[t+1][1]-s)}function ea(n,e,t){return n===void 0?t:typeof n=="number"?n:Js(n.keys,e)}function rn(n,e,t=1){return Math.min(1,Math.max(0,ea(n,e,t)))}function ta(n,e,t){return Math.max(0,ea(n,e,t))}function bn(n,e,t,i="2.7"){if(n!==void 0){if(typeof n=="number"){t(n)||T(i,`${e} is ${n}`);return}(n===null||typeof n!="object"||!("keys"in n))&&T(i,`${e} is ${JSON.stringify(n)}, not a number or a tween`),li(n.keys,e,t)}}var Hn=n=>typeof n=="number"&&n>=0&&n<=1,_o=n=>typeof n=="number"&&n>=0&&n<=1,zi=n=>typeof n=="number"&&Number.isFinite(n)&&n>0;function So(n,e){if(n.keys!==void 0)return n.range!==void 0&&T("K3","the clock has both a range and keys"),Js(n.keys,zn(n,e));n.range===void 0&&T("C2","the clock is in value mode but does not have a range of two numbers or keys");let[t,i]=n.range;return t+e*(i-t)}function Ks(n){return n.plane==="xz"?[0,2]:n.plane==="yz"?[1,2]:[0,1]}function Df(n,e,t){let{i,e:s}=kf(h=>n[h].at,n.length,e,h=>n[h].ease),r=n[i],a=t(i);if(a===null)return null;if(s===null)return{center:a,width:r.width,height:r.height??null};let o=n[i+1],l=t(i+1);if(l===null)return null;let c=(h,u)=>Math.exp((1-s)*Math.log(h)+s*Math.log(u));return{center:[(1-s)*a[0]+s*l[0],(1-s)*a[1]+s*l[1]],width:c(r.width,o.width),height:r.height!==void 0&&o.height!==void 0?c(r.height,o.height):null}}function wo(n,e,t){(!Array.isArray(n)||n.length===0)&&T("K5",`${t} has keys ${JSON.stringify(n)}, not a list of at least one camera key`);let i=-1/0,s=0;for(let r of n){(r===null||typeof r!="object")&&T("K5",`${t} has a key ${JSON.stringify(r)}, not an object`),(typeof r.at!="number"||!Number.isFinite(r.at))&&T("K5",`${t} has a key at ${JSON.stringify(r.at)}, not a finite time`),r.at<i&&T("K5",`${t} has keys whose times decrease, from ${i} to ${r.at}`),i=r.at,zi(r.width)||T("K5",`${t} has a key of width ${JSON.stringify(r.width)}, not a positive number`),r.height!==void 0&&(e||T("K5",`${t} has a key with a height, which only a camera of free aspect takes`),zi(r.height)||T("K5",`${t} has a key of height ${JSON.stringify(r.height)}, not a positive number`),s++);for(let a of[r.center,r.offset])a!==void 0&&!(Array.isArray(a)&&a.length===2&&a.every(o=>typeof o=="number"&&Number.isFinite(o)))&&T("K5",`${t} has a key whose center or offset is ${JSON.stringify(a)}, not two finite numbers`);if(r.follow===void 0&&r.center===void 0&&T("K5",`${t} has a key with neither a center nor follow targets`),r.follow!==void 0){(!Array.isArray(r.follow)||r.follow.length===0)&&T("K5",`${t} has a key whose follow is not a list of targets`);for(let a of r.follow)(a===null||typeof a!="object"||!Number.isInteger(a.layer)||a.layer<0||!Number.isInteger(a.member)||a.member<0)&&T("K5",`${t} has a follow target ${JSON.stringify(a)}, not {layer, member} of two nonnegative integers`)}r.ease!==void 0&&If(r.ease,0)}s!==0&&s!==n.length&&T("K5",`${t} gives a height in some keys but not in all`)}function Of(n,e){return Number.isInteger(e)||T("2.6",`the frame index ${String(e)} is not an integer`),(!Number.isInteger(n)||n<1)&&T("2.6",`the clock has steps ${String(n)}, not a count of at least one`),(e%n+n)%n/n}var ci=class{m;c0;c1;u;constructor(e,t,i){let s=e.count(t);if(this.m=s,this.u=new Float64Array(s),i===rt){this.c0=0,this.c1=s-1;for(let l=0;l<s;l++)this.u[l]=l/(s-1);return}let r=e.channel(i,"C5"),a=e.start(t);this.c0=r[a],this.c1=r[a+s-1];let o=Math.sign(r[a+1]-r[a]);for(let l=0;l<s;l++)(!Number.isFinite(r[a+l])||l>0&&!((r[a+l]-r[a+l-1])*o>0))&&T("T3",`clock channel ${i} of track set ${e.id} is not both finite and strictly monotone along track ${t}`);Number.isFinite(this.c1-this.c0)||T("T3",`clock channel ${i} of track set ${e.id} has an infinite span along track ${t}`);for(let l=0;l<s;l++)this.u[l]=(r[a+l]-this.c0)/(this.c1-this.c0)}at(e){return this.u[e]}reading(e,t){return e.mode==="fraction"?t:(So(e,t)-this.c0)/(this.c1-this.c0)}locate(e){let t=0,i=this.m-2;for(;t<i;){let r=t+i+1>>1;this.u[r]<=e?t=r:i=r-1}let s=t;return{k:s,w:(e-this.u[s])/(this.u[s+1]-this.u[s])}}};function Pt(n){return n.laps===void 0?1:(n.mode==="value"&&T("C6","the clock is in value mode but has laps"),(!Number.isInteger(n.laps)||n.laps<1)&&T("C6",`the clock has laps ${String(n.laps)}, not an integer of at least one`),n.laps)}function an(n,e){let t=Math.min(Math.floor(n),e-1);return{lap:t,u:n-t}}function qn(n,e="clamp",t="clamp"){return n<0?e==="hidden"?null:0:n>1?t==="hidden"?null:1:n}var Nf=new WeakMap;function na(n,e){let t=e!==null&&typeof e=="object"?Nf.get(e):void 0;if(t!==void 0&&t.steps===n.steps&&t.seconds===Rt(n))return t;(e===null||typeof e!="object"||typeof e.channel!="string")&&T("K4",`a layer's clock is ${JSON.stringify(e)}, not {channel, range} or {channel, keys}`);let i=e.range!==void 0,s=e.keys!==void 0;i===s&&T("K4",`the clock of a layer on channel ${e.channel} has ${i?"both a range and keys":"neither a range nor keys"}`),i&&!(Array.isArray(e.range)&&e.range.length===2&&e.range.every(a=>typeof a=="number"&&Number.isFinite(a)))&&T("K4",`the clock of a layer on channel ${e.channel} has range ${JSON.stringify(e.range)}, not two finite numbers`),s&&li(e.keys,`the clock of a layer on channel ${e.channel}`);let r={mode:"value",channels:[e.channel],steps:n.steps,seconds:Rt(n)};return i?r.range=[e.range[0],e.range[1]]:r.keys=e.keys,Nf.set(e,r),r}function Hi(n,e){return typeof n=="number"?(Number.isFinite(n)||T("S4",`a scalar is ${n}, not finite`),n):((n===null||typeof n!="object")&&T("2.2",`${JSON.stringify(n)} is not a scalar`),"attr"in n?(n.factor??1)*e.set.attr(n.attr)+(n.offset??0):(n.channel===rt&&T("2.2",`${rt} is not allowed in a frame edge`),e.set.channelAt(n.channel,e.track,e.sample,e.shifted,e.lap??0)))}function Ih(n,e,t=!1){if((!Array.isArray(n)||n.length!==3)&&T("F2",`${e} is three scalars, not ${JSON.stringify(n)}`),!t)for(let i of n)i!==null&&typeof i=="object"&&"channel"in i&&T("F2",`${e} takes a number or an attribute, not a channel`);return n}function Ff(n,e,t,i){let s=Math.cos(t),r=i?-Math.sin(t):Math.sin(t),[a,o,l]=n;return e==="z"?[s*a-r*o,r*a+s*o,l]:e==="x"?[a,s*o-r*l,r*o+s*l]:[s*a+r*l,o,-r*a+s*l]}var kh=class{frames;depth=new Map;paths=new Map;root;constructor(e){this.frames=e;let t=Object.keys(e),i=t.filter(r=>e[r].parent===void 0);i.length!==1&&T("2.3",`the frames have ${i.length} roots, not one: ${JSON.stringify(i)}`),this.root=i[0];let s=e[this.root];(s.origin!==void 0||s.rotation!==void 0||s.scale!==void 0)&&T("2.3",`the root frame ${this.root} has an origin, a rotation, or a scale`);for(let r of t){let a=e[r].scale;(a===0||a!==void 0&&typeof a=="object"&&"attr"in a&&(a.factor??1)===0&&(a.offset??0)===0)&&T("F2",`the scale of frame ${r} is zero`)}for(let r of t){let a=0;for(let o=r;o!==this.root;a++){let l=e[o].parent;(l===void 0||!Object.hasOwn(e,l))&&T("2.3",`the parent ${l} of frame ${o} is not declared`),a>t.length&&T("2.3",`the parents of frame ${r} form a cycle`),o=l}this.depth.set(r,a)}}has(e){return this.depth.has(e)}frame(e){return this.has(e)||T("2.3",`frame ${JSON.stringify(e)} is not declared`),this.frames[e]}inSubtree(e,t){for(let i=e;i!==void 0;i=this.frames[i].parent)if(i===t)return!0;return!1}path(e,t){let i=this.paths.get(e),s=i?.get(t);if(s!==void 0)return s;this.frame(e),this.frame(t);let r=[],a=[],o=e,l=t;for(;this.depth.get(o)>this.depth.get(l);)r.push(o),o=this.frames[o].parent;for(;this.depth.get(l)>this.depth.get(o);)a.push(l),l=this.frames[l].parent;for(;o!==l;)r.push(o),a.push(l),o=this.frames[o].parent,l=this.frames[l].parent;let c={up:r,down:a.reverse()};return i===void 0&&this.paths.set(e,i=new Map),i.set(t,c),c}},Mo=(n,e)=>{n===void 0||typeof n=="number"||("attr"in n?e.attrs.add(n.attr):e.channels.add(n.channel))},Vi=class{tree;scene;active=new Set;edges=new Map;bodies=new Map;constructor(e){this.scene=e,this.tree=new kh(e.frames);for(let t of Object.keys(e.frames))this.requirements(t,this.tree.root)}body(e){let t=this.bodies.get(e);if(t!==void 0)return t;let i=this.scene.bodies??{};Object.hasOwn(i,e)||T("2.4",`body ${JSON.stringify(e)} is not declared`);let s=i[e];return Object.hasOwn(this.scene.frames,s.frame)||T("2.4",`body ${e} is in frame ${JSON.stringify(s.frame)}, which is not declared`),Ih(s.position,`the position of body ${e}`),this.bodies.set(e,s),s}edgeOf(e){let t=this.edges.get(e);if(t===void 0){let i=this.tree.frame(e),s=Array.isArray(i.origin)?Ih(i.origin,`the origin of frame ${e}`,!0):i.origin;t={parent:i.parent,origin:s,rotation:i.rotation,scale:i.scale},this.edges.set(e,t)}return t}transform(e,t,i,s){let{up:r,down:a}=this.tree.path(t,i),o=e;for(let l of r)o=this.edge(l,o,s,!0);for(let l of a)o=this.edge(l,o,s,!1);return o}bodyPosition(e,t,i){let s=this.body(e),r=s.position.map(a=>Hi(a,i));return this.transform(r,s.frame,t,i)}edge(e,t,i,s){let r=this.edgeOf(e),a=[0,0,0];if(Array.isArray(r.origin))a=[Hi(r.origin[0],i),Hi(r.origin[1],i),Hi(r.origin[2],i)];else if(r.origin!==void 0){this.active.has(e)&&T("F6",`the origin of frame ${e} depends on itself`),this.active.add(e);try{a=this.bodyPosition(r.origin.body,r.parent,i)}finally{this.active.delete(e)}}let o=r.scale===void 0?1:Hi(r.scale,i);o===0&&T("F2",`the scale of frame ${e} is zero`);let l=r.rotation,c=l===void 0?0:Hi(l.angle,i);if(!s){let u=[t[0]-a[0],t[1]-a[1],t[2]-a[2]];return l!==void 0&&(u=Ff(u,l.axis,c,!1)),[o*u[0],o*u[1],o*u[2]]}let h=[t[0]/o,t[1]/o,t[2]/o];return l!==void 0&&(h=Ff(h,l.axis,c,!0)),[a[0]+h[0],a[1]+h[1],a[2]+h[2]]}requirements(e,t,i={channels:new Set,attrs:new Set}){let{up:s,down:r}=this.tree.path(e,t);for(let a of[...s,...r]){this.active.has(a)&&T("F6",`the origin of frame ${a} depends on itself`),this.active.add(a);try{let o=this.tree.frame(a);Array.isArray(o.origin)?Ih(o.origin,`the origin of frame ${a}`,!0).forEach(l=>Mo(l,i)):o.origin!==void 0&&this.bodyRequirements(o.origin.body,o.parent,i),Mo(o.rotation?.angle,i),Mo(o.scale,i)}finally{this.active.delete(a)}}return i}bodyRequirements(e,t,i={channels:new Set,attrs:new Set}){let s=this.body(e);return s.position.forEach(r=>Mo(r,i)),this.requirements(s.frame,t,i)}};function at(n,e){return n.variables!==void 0&&Object.hasOwn(n.variables,e)?n.variables[e]:void 0}function Gi(n,e){let t=at(n.scene,e);t===void 0&&T("2.5",`variable ${JSON.stringify(e)} is not declared`);let i=t.scope==="panel"?n.panel.variables:n.state.variables,s=i!==void 0&&Object.hasOwn(i,e)?i[e]:void 0;return s===void 0?t.default:s}function Eo(n,e){return n.kind==="selector"?typeof e=="number"&&Number.isFinite(e):n.kind==="toggle"?typeof e=="boolean":typeof e=="string"&&n.values.includes(e)}function Zs(n,e){n.clock.channels.includes(e.clock.channel)||T("2.6",`the state's clock channel ${JSON.stringify(e.clock.channel)} is not one of the scene's clock channels`);let t=(r,a)=>{for(let[o,l]of Object.entries(r??{})){let c=at(n,o);c!==void 0&&!Eo(c,l)&&T("2.5",`${a}: ${c.kind} ${o} cannot hold ${JSON.stringify(l)}`)}};t(e.variables,"the state");let i=Object.keys(e.panels);i.length===0&&T("2.8","the state does not have a panel");for(let[r,a]of Object.entries(e.panels))Object.hasOwn(n.views,a.view)||T("2.8",`panel ${r} shows ${JSON.stringify(a.view)}, which is not a view`),t(a.variables,`panel ${r}`);let s=bs(e.layout).sort();(s.length!==i.length||s.some((r,a)=>r!==i.slice().sort()[a]))&&T("2.8",`the layout shows the panels ${s.join(", ")}, while the state has the panels ${i.slice().sort().join(", ")}`)}function bs(n,e=[]){return n.kind==="panel"?e.push(n.id):(bs(n.a,e),bs(n.b,e)),e}function dy(n,e){return typeof e=="string"?e:Gi(n,e.var)}function ia(n,e){if("set"in e)return Object.hasOwn(n.scene.track_sets,e.set)||T("V2",`the set query names ${JSON.stringify(e.set)}, which is not a track set`),[e.set];(e.tags===null||typeof e.tags!="object")&&T("V2",`a tags query has tags ${JSON.stringify(e.tags)}, not an object`);let t=Object.entries(e.tags).map(([i,s])=>[i,dy(n,s)]);return Object.entries(n.scene.track_sets).filter(([,i])=>t.every(([s,r])=>Object.hasOwn(i.tags??{},s)&&i.tags[s]===r)).map(([i])=>i)}function Et(n,e){let t=ia(n,e);return t.length>1&&T("V2",`the set query ${JSON.stringify(e)} matches the ${t.length} track sets ${t.join(", ")}, where one is needed`),t[0]??null}function To(n,e,t){let i=at(n.scene,e.var);(i===void 0||i.kind!=="selector")&&T("V3",`variable ${e.var} is not a selector`);let s=Gi(n,e.var);if((typeof s!="number"||!Number.isFinite(s))&&T("2.5",`selector ${e.var} holds ${JSON.stringify(s)}, not a finite number`),(i.by??"nearest")==="index")return Math.min(Math.max(Math.floor(s+.5),0),t.tracks-1);let a=i.parameter;a===void 0&&T("2.5",`selector ${e.var} is by nearest but does not name a parameter`);let o=t.parameter(a,"V3"),l=0;for(let c=1;c<t.tracks;c++)Math.abs(o[c]-s)<Math.abs(o[l]-s)&&(l=c);return l}function Uf(n,e){return(!Number.isInteger(n)||n<0)&&T("V3",`member index ${JSON.stringify(n)} is not a track index`),n>=e.tracks&&T("V3",`member index ${n} is not below the track count ${e.tracks} of track set ${e.id}`),n}function fy(n,e){(!Number.isInteger(e)||e<1)&&T("V3",`member count ${JSON.stringify(e)} is not an integer of at least one`);let t=e>=n?1:Math.floor(n/e+.5),i=[];for(let s=0;s<n;s+=t)i.push(s);return i[i.length-1]!==n-1&&i.push(n-1),i}function Qs(n,e,t){return e==="all"?Array.from({length:t.tracks},(i,s)=>s):((e===null||typeof e!="object")&&T("V3",`a member reference is "all", {index}, {count}, or {var}, not ${JSON.stringify(e)}`),"index"in e?[Uf(e.index,t)]:"count"in e?fy(t.tracks,e.count):[To(n,e,t)])}function er(n,e,t){return e==="all"&&T("V3",`the driver's member is "all", but a driver resolves to one track`),(e===null||typeof e!="object")&&T("V3",`the driver's member is {index} or {var}, not ${JSON.stringify(e)}`),"count"in e&&T("V3","the driver's member is a count, but a driver resolves to one track"),"index"in e?Uf(e.index,t):To(n,e,t)}function Ao(n,e){let{scene:t,state:i}=n,s=bs(i.layout).find(r=>i.panels[r]?.view===e);return s===void 0?null:{panel:s,frame:vs({scene:t,state:i,panel:i.panels[s]},t.views[e])}}function vs(n,e){let t=typeof e.frame=="string"?e.frame:Gi(n,e.frame.var);return(typeof t!="string"||!Object.hasOwn(n.scene.frames,t))&&T("2.7",`the view displays ${JSON.stringify(t)}, which is not a frame`),t}function tr(n,e){if(e.visible===void 0)return!0;let t=at(n.scene,e.visible.var);(t===void 0||t.kind!=="toggle")&&T("L5",`a layer's visible names ${e.visible.var}, which is not a toggle`);let i=Gi(n,e.visible.var);return typeof i!="boolean"&&T("L5",`toggle ${e.visible.var} holds ${JSON.stringify(i)}, not a boolean`),i}function Lt(n,e,t,i=0){let{k:s,w:r}=n.locate(e);return{k:s,w:r,shifted:t,lap:i}}function Co(n,e,t,i=0){if(e===t)return[Lt(n,e,!1,i)];let s=[Lt(n,e,!1,i)];for(let r=0;r<n.m;r++){let a=n.at(r);e<a&&a<t&&s.push({sample:r,shifted:!1,lap:i})}return s.push(Lt(n,t,!1,i)),s}function Ro(n,e,t,i){let s=an(e,i),r=an(t,i);if(s.lap===r.lap)return Co(n,s.u,r.u,s.lap);let a=Co(n,s.u,1,s.lap).slice(0,-1);for(let o=s.lap+1;o<r.lap;o++)a.push(...Co(n,0,1,o).slice(0,-1));return a.push(...Co(n,0,r.u,r.lap)),a}function Nh(n,e,t){let i=t?e:1,s=[];for(let r=0;r<i;r++)for(let a=0;a<(r===i-1?n:n-1);a++)s.push({sample:a,shifted:!1,lap:r});return s}function Po(n,e,t,i,s){let r=e-t*i;return r<0&&!s&&(r=0),Ro(n,r,e,t)}function Wi(n){return n.head===!0||typeof n.head=="object"&&n.head!==null}function xs(n,e,t,i){let s=n.lap??0;if("sample"in n)return i({set:e,track:t,sample:n.sample,shifted:n.shifted,lap:s});let r=i({set:e,track:t,sample:n.k,shifted:n.shifted,lap:s}),a=i({set:e,track:t,sample:n.k+1,shifted:n.shifted,lap:s}),o=n.w;return[(1-o)*r[0]+o*a[0],(1-o)*r[1]+o*a[1],(1-o)*r[2]+o*a[2]]}function _i(n,e){if(e.clock===void 0)return n;let t=n.base??n,i=na(t.clock,e.clock);return{...t,clock:i,channel:i.channels[0],base:t}}function _s(n,e,t){n=n.base??n,t??=new ci(e.set,e.track,n.channel);let i=Pt(n.clock),s=i*qn(t.reading(n.clock,n.q)),r=an(s,i);return{tc:t,loopReading:s,at:Lt(t,r.u,!1,r.lap)}}function nr(n,e){let t=e.lap??0,{set:i,track:s}=n;return{a:{set:i,track:s,sample:e.k,shifted:!1,lap:t},b:{set:i,track:s,sample:e.k+1,shifted:!1,lap:t},w:e.w}}function Bf(n,e,t,i=null){if(t===null)return{kind:"track",set:null,members:[]};let s=e.reveal??"none";["none","grow","trail"].includes(s)||T("2.7",`a track layer's reveal is ${JSON.stringify(s)}, not none, grow, or trail`);for(let d of["before","after"])e[d]!==void 0&&e[d]!=="clamp"&&e[d]!=="hidden"&&T("C3",`a track layer's ${d} is ${JSON.stringify(e[d])}, not clamp or hidden`);s==="trail"&&Dh(e);let r=e.context??"own";r!=="own"&&r!=="driver"&&T("L6",`a track layer's context is ${JSON.stringify(r)}, not own or driver`);let a=Pt(n.clock),o=t.def.frame,l=d=>n.frames.transform(t.position(d.track,d.sample),o,n.display,d),c=r==="driver"&&i!==null?nr(i,_s(n,i).at):null;if(c!==null){let{a:d,b:p,w:y}=c;l=m=>{let g=t.position(m.track,m.sample),b=n.frames.transform(g,o,n.display,d),_=n.frames.transform(g,o,n.display,p);return[(1-y)*b[0]+y*_[0],(1-y)*b[1]+y*_[1],(1-y)*b[2]+y*_[2]]}}let h=Wi(e),u=s!=="none"||h||n.clock.mode==="value"&&(e.before==="hidden"||e.after==="hidden");u&&a>1&&!t.periodic&&T("C6",`a reading is taken on track set ${t.id}, which is not periodic, and the clock has ${a} laps`);let f=[];for(let d of Qs(n.scope,e.members,t)){let p=[],y=null,m=null;u&&(m=new ci(t,d,n.channel),y=qn(m.reading(n.clock,n.q),e.before,e.after));let g=u&&y===null||r==="driver"&&c===null,b=a*(y??0);g||(s==="none"?p.push(...Nh(t.count(d),a,t.periodic)):s==="grow"?p.push(...Ro(m,0,b,a)):p.push(...Po(m,b,a,Dh(e),t.periodic)));let _={index:d,line:p.map(v=>xs(v,t,d,l))};if(h){let v=an(b,a);_.head=g?null:xs(Lt(m,v.u,!1,v.lap),t,d,l)}f.push(_)}return{kind:"track",set:t.id,members:f}}function Oh(n){let e=n.vector;(!Array.isArray(e)||e.length<2||e.length>3||!e.every(i=>typeof i=="string"))&&T("L7",`an arrow layer's vector is ${JSON.stringify(e)}, not two or three channel names`),e.includes(rt)&&T("L7",`${rt} is not allowed in the vector of an arrow layer`);let t=n.scale??1;return typeof t=="object"&&t!==null&&"channel"in t&&T("L7","the scale of an arrow layer takes a number or an attribute, not a channel"),{vector:e,scale:t}}function Lo(n,e,t,i){let{vector:s,scale:r}=Oh(e);for(let h of["before","after"])e[h]!==void 0&&e[h]!=="clamp"&&e[h]!=="hidden"&&T("C3",`an arrow layer's ${h} is ${JSON.stringify(e[h])}, not clamp or hidden`);if(t===null)return{kind:"arrow",set:null,members:[]};for(let h of s)t.hasChannel(h)||T("L7",`track set ${t.id} lacks channel ${JSON.stringify(h)} of an arrow layer's vector`);let a=Pt(n.clock);a>1&&!t.periodic&&T("C6",`a reading is taken on track set ${t.id}, which is not periodic, and the clock has ${a} laps`);let o=t.def.frame,l=s.map(h=>t.channel(h)),c=[];for(let h of Qs(n.scope,e.members,t)){let u=i?i(h):new ci(t,h,n.channel),f=qn(u.reading(n.clock,n.q),e.before,e.after);if(f===null){c.push({index:h,base:null,tip:null});continue}let d=Hi(r,{set:t,track:h,sample:0,shifted:!1,lap:0}),p=t.start(h),y=_=>n.frames.transform(t.position(_.track,_.sample),o,n.display,_),m=_=>{let v=t.position(_.track,_.sample);for(let w=0;w<l.length;w++)v[w]+=d*l[w][p+_.sample];return n.frames.transform(v,o,n.display,_)},g=an(a*f,a),b=Lt(u,g.u,!1,g.lap);c.push({index:h,base:xs(b,t,h,y),tip:xs(b,t,h,m)})}return{kind:"arrow",set:t.id,members:c}}function Fh(n,e,t){let i=t.view;(typeof i!="string"||!Object.hasOwn(n.views,i))&&T("L8",`an outline layer names ${JSON.stringify(i)}, which is not a view`),i===e&&T("L8",`an outline layer of view ${e} names its own view`),(n.views[i].camera?.kind??"plane")!=="plane"&&T("L8",`an outline layer names view ${i}, whose camera is not a plane camera`)}function Io(n,e,t){Fh(n.scope.scene,n.scope.panel.view,e);let i={kind:"outline",view:e.view,panel:null,frame:null,origin:null,axes:null},s=Ao(n.scope,e.view);if(s===null||(i.panel=s.panel,i.frame=s.frame,t===null))return i;let{a:r,b:a,w:o}=nr(t,_s(n,t).at),l=u=>{let f=n.frames.transform(u,s.frame,n.display,r),d=n.frames.transform(u,s.frame,n.display,a);return[(1-o)*f[0]+o*d[0],(1-o)*f[1]+o*d[1],(1-o)*f[2]+o*d[2]]},c=l([0,0,0]),h=u=>{let f=l(u);return[f[0]-c[0],f[1]-c[1],f[2]-c[2]]};return i.origin=c,i.axes=[h([1,0,0]),h([0,1,0]),h([0,0,1])],i}function Dh(n){n.trail===void 0&&T("2.7","a layer draws a trail but lacks a trail fraction");let e=n.trail.fraction;return(typeof e!="number"||!(e>0&&e<=1))&&T("2.7",`the trail fraction ${String(e)} is not in (0, 1]`),e}function zf(n,e,t){let i={kind:"body",body:e.body,position:null};if(t===null)return e.trail!==void 0&&(i.trail=[]),i;let{set:s,track:r}=t,a=Pt(n.clock),{tc:o,loopReading:l,at:c}=_s(n,t),h=u=>n.frames.bodyPosition(e.body,n.display,u);return i.position=xs(c,s,r,h),e.trail!==void 0&&(i.trail=Po(o,l,a,Dh(e),s.periodic).map(u=>xs(u,s,r,h))),i}function py(n,e,t,i){let s=t.def.frame,r=c=>n.frames.transform(t.position(c.track,c.sample),s,n.display,c);if((e.context??"own")!=="driver")return{f:r,hidden:!1};if(i===null)return{f:r,hidden:!0};let{a,b:o,w:l}=nr(i,_s(n,i).at);return{hidden:!1,f:c=>{let h=t.position(c.track,c.sample),u=n.frames.transform(h,s,n.display,a),f=n.frames.transform(h,s,n.display,o);return[(1-l)*u[0]+l*f[0],(1-l)*u[1]+l*f[1],(1-l)*u[2]+l*f[2]]}}}function Hf(n,e,t,i){(!Number.isInteger(e)||e<0||e>=n.tracks)&&T(t,`${i} names member ${String(e)}, which is not a track of track set ${n.id} of ${n.tracks}`)}function Vf(n,e,t,i){let s=Pt(n.clock);s>1&&!e.periodic&&T("C6",`a reading is taken on track set ${e.id}, which is not periodic, and the clock has ${s} laps`);let r=new ci(e,t,n.channel),a=an(s*qn(r.reading(n.clock,n.q)),s);return xs(Lt(r,a.u,!1,a.lap),e,t,i)}function Gf(n,e,t,i,s){if(t===null)return null;Hf(t,i,"K5","a camera key");let r=_i(n,e),{f:a,hidden:o}=py(r,e,t,s);return o?null:Vf(r,t,i,a)}function ko(n,e,t,i){let s=e.at;if((s===null||typeof s!="object")&&T("K6",`a label's anchor is ${JSON.stringify(s)}, not an object`),"screen"in s)return{kind:"label",position:null};if("point"in s){let c=s.point;(!Array.isArray(c)||c.length!==3||!c.every(m=>typeof m=="number"&&Number.isFinite(m)))&&T("K6",`a label's point is ${JSON.stringify(c)}, not three finite numbers`);let h=[c[0],c[1],c[2]];if(s.frame===void 0)return{kind:"label",position:h};if(i===null)return{kind:"label",position:null};let{a:u,b:f,w:d}=nr(i,_s(n,i).at),p=n.frames.transform(h,s.frame,n.display,u),y=n.frames.transform(h,s.frame,n.display,f);return{kind:"label",position:[(1-d)*p[0]+d*y[0],(1-d)*p[1]+d*y[1],(1-d)*p[2]+d*y[2]]}}if((!("sets"in s)||!("member"in s))&&T("K6",`a label's anchor is ${JSON.stringify(s)}, not a point, a member, or a place on the screen`),t===null)return{kind:"label",position:null};let r=s.member;Hf(t,r,"K6","a label");let a=_i(n,e),o=t.def.frame;return{kind:"label",position:Vf(a,t,r,c=>a.frames.transform(t.position(c.track,c.sample),o,a.display,c))}}function Do(n,e,t){let i=e.reveal??"none";i!=="none"&&i!=="grow"&&T("K8",`a points layer's reveal is ${JSON.stringify(i)}, not none or grow`);for(let h of["before","after"])e[h]!==void 0&&e[h]!=="clamp"&&e[h]!=="hidden"&&T("C3",`a points layer's ${h} is ${JSON.stringify(e[h])}, not clamp or hidden`);if(t===null)return{kind:"points",set:null,members:[]};let s=_i(n,e),r=s.clock.mode==="value"&&(e.before==="hidden"||e.after==="hidden"),a=i==="grow"||r,o=Pt(s.clock);a&&o>1&&!t.periodic&&T("C6",`a reading is taken on track set ${t.id}, which is not periodic, and the clock has ${o} laps`);let l=t.def.frame,c=[];for(let h of Qs(n.scope,e.members,t)){let u=t.count(h),f=u-1;if(a){let p=new ci(t,h,s.channel),y=p.reading(s.clock,s.q);if(qn(y,e.before,e.after)===null)f=-1;else if(i==="grow")for(f=-1;f+1<u&&p.at(f+1)<=y;)f++}let d=[];for(let p=0;p<=f;p++)d.push(s.frames.transform(t.position(h,p),l,s.display,{set:t,track:h,sample:p,shifted:!1,lap:0}));c.push({index:h,points:d})}return{kind:"points",set:t.id,members:c}}var Uh=class{id;def;tracks;samples;dim;data;offsets;positions;channels=new Map;parameters=new Map;constructor(e,t,i){this.id=e,this.def=t,this.data=i,this.tracks=t.tracks;let s=i.view(t.offsets);(s.dtype!=="uint32"||s.shape.length!==1||s.shape[0]!==t.tracks+1)&&T("2.1",`track set ${e}: offsets view ${t.offsets} is ${s.dtype} of shape (${s.shape.join(", ")}), not uint32 of shape (${t.tracks+1},)`),this.offsets=s.data,this.offsets[0]!==0&&T("2.1",`track set ${e}: offsets[0] is ${this.offsets[0]}, not 0`);for(let l=0;l<t.tracks;l++){let c=this.offsets[l+1]-this.offsets[l];c<2&&T("T1",`track set ${e}: the sample count of track ${l} is ${c}, fewer than two`)}this.samples=this.offsets[t.tracks];let r=i.view(t.positions),[a,o]=r.shape;(r.shape.length!==2||a!==this.samples||o!==2&&o!==3)&&T("2.1",`track set ${e}: positions view ${t.positions} has shape (${r.shape.join(", ")}), not (${this.samples}, 2) or (${this.samples}, 3)`),this.positions=r.data,this.dim=o}get periodic(){return this.def.periodic===!0}start(e){return this.offsets[e]}count(e){return this.offsets[e+1]-this.offsets[e]}position(e,t){let i=(this.offsets[e]+t)*this.dim,s=this.positions;return[s[i],s[i+1],this.dim===3?s[i+2]:0]}hasChannel(e){return e===rt||Object.hasOwn(this.def.channels??{},e)}channel(e,t="F5"){let i=this.channels.get(e);if(i)return i;let s=this.def.channels?.[e];(s===void 0||!Object.hasOwn(this.def.channels??{},e))&&T(t,`track set ${this.id} lacks channel ${JSON.stringify(e)}`);let r=this.data.view(s.view);return(r.shape.length!==1||r.shape[0]!==this.samples)&&T("2.1",`track set ${this.id}: channel ${e} has shape (${r.shape.join(", ")}), not (${this.samples},)`),this.channels.set(e,r.data),r.data}channelAt(e,t,i,s,r=0){let a=this.count(t),o=r-(s?1:0);if(e===rt)return o===0?i:i+o*(a-1);let l=this.channel(e),c=this.offsets[t],h=l[c+i];return o===0?h:h+o*(l[c+a-1]-l[c])}parameter(e,t="2.5"){let i=this.parameters.get(e);if(i)return i;let s=this.def.parameters?.[e];(s===void 0||!Object.hasOwn(this.def.parameters??{},e))&&T(t,`track set ${this.id} lacks parameter ${JSON.stringify(e)}`);let r=this.data.view(s.view);return(r.shape.length!==1||r.shape[0]!==this.tracks)&&T("2.1",`track set ${this.id}: parameter ${e} has shape (${r.shape.join(", ")}), not (${this.tracks},)`),this.parameters.set(e,r.data),r.data}hasAttr(e){return Object.hasOwn(this.def.attrs??{},e)}attr(e){let t=this.def.attrs?.[e];return(t===void 0||!this.hasAttr(e))&&T("F5",`track set ${this.id} lacks attribute ${JSON.stringify(e)}`),t}},$i=class{scene;data;sets=new Map;constructor(e,t){this.scene=e,this.data=t}get(e){let t=this.sets.get(e);if(!t){let i=this.scene.track_sets[e];(i===void 0||!Object.hasOwn(this.scene.track_sets,e))&&T("2.1",`track set ${JSON.stringify(e)} is not declared`),t=new Uh(e,i,this.data),this.sets.set(e,t)}return t}};var my=["track","arrow","outline","body","axes","grid","label","points"],Wf=["disc","ring","square","diamond","triangle","star","cross","plus"],gy=["slider","tabs","toggle","transport"],No=["viridis","plasma","cividis","blues","reds"],Bh=(n,e)=>{xo.test(n)||T("S3",`${e} ${JSON.stringify(n)} does not match [A-Za-z0-9_.-]+`)},wt=n=>typeof n=="number"&&Number.isFinite(n),vn=/^#[0-9a-fA-F]{6}$/;function Xi(n,e,t,i){if(!(n===null||typeof n!="object"||Array.isArray(n)))for(let s of Object.keys(n))e.includes(s)||i.push(`${t} has a key ${JSON.stringify(s)} that this reader does not know`)}var yy=["label","axes","unit","parent","origin","rotation","scale"],by=["label","frame","position","color","image"],vy=["label","frame","tags","attrs","tracks","offsets","positions","channels","parameters","periodic"],xy=["label","frame","camera","driver","layers","opacity","margin"],_y=["kind","plane","aspect","keys"],Sy=["kind","projection","up","stretch","turn"],wy=["align","baseline","size","color","weight","linespacing","box","opacity"],$f={track:["kind","sets","members","reveal","trail","head","before","after","context","fit","color","opacity","width","highlight","visible","clock","line","flat","dash","fill"],arrow:["kind","sets","members","vector","scale","before","after","color","opacity","width","head","visible","clock"],outline:["kind","view","color","opacity","width","dash","min_size","visible"],body:["kind","body","trail","size","visible","opacity"],axes:["kind","span","visible","ticks","size","opacity","titles"],grid:["kind","labels","visible","opacity"],label:["kind","text","at","offset","leader","clock","visible",...wy],points:["kind","sets","members","marker","reveal","before","after","clock","fit","opacity","visible"]},My=["mode","channels","labels","steps","range","laps","seconds","keys","end"],Ey=["background","foreground","grid","font","gutter"];function Ty(n){n.format!=="tycho-scene"&&T("2",`the format is ${JSON.stringify(n.format)}, not "tycho-scene"`);let e=[],t=/^([0-9]+)\.([0-9]+)$/.exec(String(n.version));t===null?e.push(`version ${JSON.stringify(n.version)} is not "major.minor"`):Number(t[1])!==0?e.push(`major version ${t[1]} is unknown to this reader, which reads ${0}.x`):Number(t[2])>4&&e.push(`version ${t[1]}.${t[2]} is newer than this reader's ${0}.${4}, and the format is unstable until 1.0`);let i=(n.requires??[]).filter(s=>!Pf.has(s));i.length>0&&e.push(`the required features ${i.join(", ")} are not implemented`),e.length>0&&T("S1",e.join(", and "))}function Yn(n,e,t,i){let s=at(n,e);s===void 0&&T(i,`variable ${JSON.stringify(e)} is not declared`),t!==null&&s.kind!==t&&T(i,`variable ${e} is a ${s.kind}, not a ${t}`)}function Oo(n,e,t){if(n!==void 0){if(typeof n=="number"){Number.isFinite(n)||T("S4",`${e} is ${String(n)}, not finite`);return}if("attr"in n){(!wt(n.factor??1)||!wt(n.offset??0))&&T("S4",`${e} has a factor or offset that is not finite`);return}t&&T("F2",`${e} takes a number or an attribute, not a channel`),n.channel===rt&&T("2.2",`${e} reads channel ${rt}, which is not allowed in a frame edge`)}}function Uo(n,e){if("set"in e)Object.hasOwn(n.track_sets,e.set)||T("V2",`the set query names ${JSON.stringify(e.set)}, which is not a track set`);else for(let t of Object.values(e.tags))typeof t=="object"&&t!==null&&Yn(n,t.var,"choice","V2")}var Ss=n=>typeof n=="number"&&n>=0&&n<=1;function Xf(n,e){e.fraction>0&&e.fraction<=1||T("2.7",`view ${n}: a trail fraction is ${e.fraction}, not in (0, 1]`),e.taper!==void 0&&!(Ss(e.taper.width??0)&&Ss(e.taper.opacity??0))&&T("2.7",`view ${n}: a trail taper is not in [0, 1]`)}function zh(n,e,t){e.shape!==void 0&&!Wf.includes(e.shape)&&T(t,`view ${n}: a marker's shape is ${JSON.stringify(e.shape)}, not one of ${Wf.join(", ")}`);for(let i of["color","edge"])e[i]!==void 0&&!vn.test(e[i])&&T(t,`view ${n}: a marker's ${i} is ${JSON.stringify(e[i])}, not a #rrggbb color`);bn(e.size,`view ${n}: a marker's size`,zi,t),bn(e.opacity,`view ${n}: a marker's opacity`,Hn,t),bn(e.edge_width,`view ${n}: a marker's edge_width`,i=>typeof i=="number"&&Number.isFinite(i)&&i>=0,t)}function Bo(n,e){e!==void 0&&((e===null||typeof e!="object"||typeof e.channel!="string")&&T("K4",`view ${n}: a layer's clock is ${JSON.stringify(e)}, not {channel, range} or {channel, keys}`),e.range===void 0==(e.keys===void 0)&&T("K4",`view ${n}: a layer's clock on ${e.channel} has ${e.range===void 0?"neither a range nor keys":"both a range and keys"}`),e.range!==void 0&&!(Array.isArray(e.range)&&e.range.length===2&&e.range.every(wt))&&T("K4",`view ${n}: a layer's clock on ${e.channel} has range ${JSON.stringify(e.range)}, not two finite numbers`),e.keys!==void 0&&li(e.keys,`view ${n}: the clock of a layer on ${e.channel}`))}function Fo(n,e,t){if(typeof e!="string"){Array.isArray(e)||T("2.9",`${t} has text ${JSON.stringify(e)}, not a string or a list of parts`);for(let i of e){if(typeof i=="string")continue;if((i===null||typeof i!="object")&&T("2.9",`${t} has a part ${JSON.stringify(i)}`),"var"in i&&Yn(n,i.var,null,"2.9"),"channel"in i&&i.channel===rt&&T("2.9",`${t} has a channel part naming ${rt}, which is not allowed in a readout`),"steps"in i){Array.isArray(i.steps)||T("K7",`${t} has steps ${JSON.stringify(i.steps)}, not a list of [t, text] pairs`);let a=-1/0;for(let o of i.steps)(!Array.isArray(o)||o.length!==2||!wt(o[0])||typeof o[1]!="string")&&T("K7",`${t} has a step ${JSON.stringify(o)}, not [t, text]`),o[0]<a&&T("K7",`${t} has steps whose times decrease`),a=o[0];continue}"keys"in i&&li(i.keys,t),"clock"in i&&!["index","steps","value","time"].includes(i.clock)&&T("2.9",`${t} has a clock part ${JSON.stringify(i.clock)}`);let s=i;(!wt(s.factor??1)||!wt(s.offset??0))&&T("S4",`${t} has a part whose factor or offset is not finite`),s.digits!==void 0&&!(Number.isInteger(s.digits)&&s.digits>=1&&s.digits<=17)&&T("2.9",`${t} has digits ${String(s.digits)}, not in 1 to 17`),s.decimals!==void 0&&!(Number.isInteger(s.decimals)&&s.decimals>=0&&s.decimals<=17)&&T("K7",`${t} has decimals ${String(s.decimals)}, not in 0 to 17`),s.digits!==void 0&&s.decimals!==void 0&&T("K7",`${t} has a part with both digits and decimals`);let r=i.width;r!==void 0&&!(Number.isInteger(r)&&r>=0&&r<=40)&&T("K7",`${t} has width ${String(r)}, not in 0 to 40`)}}}function qf(n,e){e.align!==void 0&&!["start","center","end"].includes(e.align)&&T("K6",`${n}: an align is ${JSON.stringify(e.align)}`),e.baseline!==void 0&&!["top","middle","bottom","alphabetic"].includes(e.baseline)&&T("K6",`${n}: a baseline is ${JSON.stringify(e.baseline)}`),e.size!==void 0&&!zi(e.size)&&T("K6",`${n}: a text size is ${JSON.stringify(e.size)}, not positive`),e.color!==void 0&&!vn.test(e.color)&&T("K6",`${n}: a text color is ${JSON.stringify(e.color)}, not #rrggbb`),e.weight!==void 0&&e.weight!=="normal"&&e.weight!=="bold"&&T("K6",`${n}: a weight is ${JSON.stringify(e.weight)}, not normal or bold`),e.linespacing!==void 0&&!zi(e.linespacing)&&T("K6",`${n}: a linespacing is ${JSON.stringify(e.linespacing)}, not positive`),bn(e.opacity,`${n}: an opacity`,Hn,"K6");let t=e.box;if(t!==void 0){for(let i of["fill","edge"])t[i]!==void 0&&!vn.test(t[i])&&T("K6",`${n}: a box ${i} is not #rrggbb`);t.opacity!==void 0&&!Ss(t.opacity)&&T("K6",`${n}: a box opacity is not in [0, 1]`)}}function Ay(n,e,t){Fo(n,t.text,`view ${e}: a label`),qf(`view ${e}`,t),Bo(e,t.clock);let i=t.at;if((i===null||typeof i!="object")&&T("K6",`view ${e}: a label's anchor is ${JSON.stringify(i)}`),"point"in i){let a=i.point;(!Array.isArray(a)||a.length!==3||!a.every(wt))&&T("K6",`view ${e}: a label's point is ${JSON.stringify(a)}, not three finite numbers`),i.frame!==void 0&&!Object.hasOwn(n.frames,i.frame)&&T("K6",`view ${e}: a label's point is in frame ${JSON.stringify(i.frame)}, which is not declared`)}else if("sets"in i)Uo(n,i.sets),(!Number.isInteger(i.member)||i.member<0)&&T("K6",`view ${e}: a label's member is ${JSON.stringify(i.member)}, not a track index`);else if("screen"in i){let a=i.screen;(!Array.isArray(a)||a.length!==2||!a.every(wt))&&T("K6",`view ${e}: a label's screen place is ${JSON.stringify(a)}, not two fractions`)}else T("K6",`view ${e}: a label's anchor is ${JSON.stringify(i)}, not a point, a member, or a place on the screen`);let s=t.offset;s!==void 0&&!(Array.isArray(s)&&s.length===2&&s.every(wt))&&T("K6",`view ${e}: a label's offset is ${JSON.stringify(s)}, not two lengths`);let r=t.leader;r!==void 0&&typeof r=="object"&&r.color!==void 0&&!vn.test(r.color)&&T("K6",`view ${e}: a leader's color is not #rrggbb`)}function Cy(n,e,t){Hh(n,e,t);let i=t.reveal??"none";i!=="none"&&i!=="grow"&&T("K8",`view ${e}: a points layer's reveal is ${JSON.stringify(i)}, not none or grow`);for(let s of["before","after"])t[s]!==void 0&&t[s]!=="clamp"&&t[s]!=="hidden"&&T("C3",`view ${e}: a points layer's ${s} is ${JSON.stringify(t[s])}, not clamp or hidden`);t.marker!==void 0&&zh(e,t.marker,"K8"),bn(t.opacity,`view ${e}: a points layer's opacity`,Hn),Bo(e,t.clock)}function Hh(n,e,t){Uo(n,t.sets),typeof t.members=="object"&&"var"in t.members&&Yn(n,t.members.var,"selector","V3"),typeof t.members=="object"&&"count"in t.members&&!(Number.isInteger(t.members.count)&&t.members.count>=1)&&T("V3",`view ${e}: member count ${JSON.stringify(t.members.count)} is not an integer of at least one`)}function Ry(n,e,t){Hh(n,e,t),Oh(t);for(let i of["before","after"])t[i]!==void 0&&t[i]!=="clamp"&&t[i]!=="hidden"&&T("C3",`view ${e}: an arrow layer's ${i} is ${JSON.stringify(t[i])}, not clamp or hidden`);t.color!==void 0&&!vn.test(t.color)&&T("L7",`view ${e}: an arrow layer's color is ${JSON.stringify(t.color)}, not a #rrggbb color`),t.head?.size!==void 0&&!(t.head.size>0)&&T("L7",`view ${e}: an arrowhead size is ${t.head.size}, not positive`),bn(t.opacity,`view ${e}: an arrow layer's opacity`,Hn),t.width!==void 0&&!(t.width>0)&&T("2.7",`view ${e}: an arrow layer's width is ${t.width}, not positive`),Bo(e,t.clock)}function Py(n,e,t){Fh(n,e,t),t.color!==void 0&&!vn.test(t.color)&&T("L8",`view ${e}: an outline layer's color is ${JSON.stringify(t.color)}, not a #rrggbb color`),bn(t.opacity,`view ${e}: an outline layer's opacity`,Hn),t.width!==void 0&&!(t.width>0)&&T("2.7",`view ${e}: an outline layer's width is ${t.width}, not positive`);let i=t.dash;i!==void 0&&!(Array.isArray(i)&&i.length===2&&i.every(s=>wt(s)&&s>0))&&T("L8",`view ${e}: an outline layer's dash is ${JSON.stringify(i)}, not two positive lengths`),t.min_size!==void 0&&!(wt(t.min_size)&&t.min_size>=0)&&T("L8",`view ${e}: an outline layer's min_size is ${t.min_size}, not a nonnegative length`)}function Ly(n,e,t){Hh(n,e,t),t.fit!==void 0&&typeof t.fit!="boolean"&&T("2.7",`view ${e}: a track layer's fit is ${JSON.stringify(t.fit)}, not a boolean`);let i=t.highlight;if(i!==void 0&&(Yn(n,i.var,"selector","2.7"),i.width!==void 0&&!(i.width>0)&&T("2.7",`view ${e}: a highlight width is ${i.width}, not positive`),i.opacity!==void 0&&!Ss(i.opacity)&&T("2.7",`view ${e}: a highlight opacity is ${i.opacity}, not in [0, 1]`),i.kernel!==void 0)){i.kernel.width>0&&i.kernel.width<=1||T("2.7",`view ${e}: a highlight kernel's width is ${i.kernel.width}, not in (0, 1]`),Ss(i.kernel.opacity)||T("2.7",`view ${e}: a highlight kernel's opacity is ${i.kernel.opacity}, not in [0, 1]`);let a=at(n,i.var);a?.kind==="selector"&&a.by==="index"&&T("2.7",`view ${e}: a highlight kernel needs a selector by nearest, and ${i.var} is by index`)}let s=t.reveal??"none";if(["none","grow","trail"].includes(s)||T("2.7",`view ${e}: a track layer's reveal is ${JSON.stringify(s)}, not none, grow, or trail`),s==="trail"&&t.trail===void 0&&T("2.7",`view ${e}: a track layer has reveal "trail" but lacks a trail`),t.trail!==void 0&&Xf(e,t.trail),t.head!==void 0&&typeof t.head!="boolean"){(typeof t.head!="object"||t.head===null)&&T("L3",`view ${e}: a track layer's head is ${JSON.stringify(t.head)}, not a boolean or an object`),t.head.color!==void 0&&!vn.test(t.head.color)&&T("L3",`view ${e}: a head color is ${JSON.stringify(t.head.color)}, not a #rrggbb color`),zh(e,t.head,"L3");let a=t.head.glow;a!==void 0&&((typeof a.channel!="string"||a.channel===rt)&&T("2.7",`view ${e}: a glow names channel ${JSON.stringify(a.channel)}`),a.color!==void 0&&!vn.test(a.color)&&T("2.7",`view ${e}: a glow's color is not #rrggbb`),a.size!==void 0&&!zi(a.size)&&T("2.7",`view ${e}: a glow's size is not positive`),a.opacity!==void 0&&!Ss(a.opacity)&&T("2.7",`view ${e}: a glow's opacity is not in [0, 1]`))}t.line!==void 0&&typeof t.line!="boolean"&&T("2.7",`view ${e}: a track layer's line is ${JSON.stringify(t.line)}, not a boolean`),t.flat!==void 0&&typeof t.flat!="boolean"&&T("2.7",`view ${e}: a track layer's flat is ${JSON.stringify(t.flat)}, not a boolean`);let r=t.dash;r!==void 0&&!(Array.isArray(r)&&r.length===2&&r.every(a=>wt(a)&&a>0))&&T("2.7",`view ${e}: a track layer's dash is ${JSON.stringify(r)}, not two positive lengths`),t.fill!==void 0&&(t.fill.base!==void 0&&!wt(t.fill.base)&&T("S4",`view ${e}: a fill's base is not finite`),t.fill.color!==void 0&&!vn.test(t.fill.color)&&T("2.7",`view ${e}: a fill's color is not #rrggbb`),t.fill.opacity!==void 0&&!Ss(t.fill.opacity)&&T("2.7",`view ${e}: a fill's opacity is not in [0, 1]`)),Bo(e,t.clock);for(let a of["before","after"])t[a]!==void 0&&t[a]!=="clamp"&&t[a]!=="hidden"&&T("C3",`view ${e}: a track layer's ${a} is ${JSON.stringify(t[a])}, not clamp or hidden`);if(t.context!==void 0&&t.context!=="own"&&t.context!=="driver"&&T("L6",`view ${e}: a track layer's context is ${JSON.stringify(t.context)}, not own or driver`),bn(t.opacity,`view ${e}: a track layer's opacity`,Hn),t.width!==void 0&&!(t.width>0)&&T("2.7",`view ${e}: a track layer's width is ${t.width}, not positive`),t.color!==void 0&&typeof t.color=="object"&&"steps"in t.color){let a=t.color;(!Array.isArray(a.steps)||a.steps.length===0||!a.steps.every(wt)||a.steps.some((o,l)=>l>0&&!(o>a.steps[l-1])))&&T("2.7",`view ${e}: a stepped color's steps are ${JSON.stringify(a.steps)}, not increasing finite numbers`),(!Array.isArray(a.colors)||a.colors.length!==a.steps.length+1||!a.colors.every(o=>vn.test(o)))&&T("2.7",`view ${e}: a stepped color has ${JSON.stringify(a.colors)} for ${a.steps.length} steps, not one #rrggbb color more than steps`)}else if(t.color!==void 0&&typeof t.color=="object"){let a=t.color.colormap;if(typeof a=="object"&&a!==null){Yn(n,a.var,"choice","2.7");let o=at(n,a.var).values,l=Object.keys(a.map??{}),c=o.filter(u=>!Object.hasOwn(a.map,u)),h=l.filter(u=>!o.includes(u));c.length>0&&T("2.7",`view ${e}: a colormap keyed on ${a.var} does not name a colormap for ${JSON.stringify(c)}`),h.length>0&&T("2.7",`view ${e}: a colormap keyed on ${a.var} maps ${JSON.stringify(h)}, which are not its values`);for(let u of l)No.includes(a.map[u])||T("2.7",`view ${e}: the colormap ${JSON.stringify(a.map[u])} is not one of ${No.join(", ")}`)}else No.includes(a)||T("2.7",`view ${e}: the colormap ${JSON.stringify(a)} is not one of ${No.join(", ")}`);"parameter"in t.color=="channel"in t.color&&T("2.7",`view ${e}: a colormap color names both or neither of parameter and channel`)}}function zo(n,e,t){let i=[];Ty(n);for(let h of Object.keys(n))Lf.has(h)||i.push(`the scene has a top-level key ${JSON.stringify(h)} that this reader does not know`);Xi(n.theme,Ey,"the theme",i);for(let[h,u]of Object.entries(n.theme??{}))h==="font"?typeof u!="string"&&T("2",`theme font is ${JSON.stringify(u)}, not a CSS font family`):(typeof u!="string"||!vn.test(u))&&T("2",`theme ${h} is ${JSON.stringify(u)}, not a #rrggbb color`);Xi(n.clock,My,"the clock",i);for(let[h,u]of Object.entries(n.frames))Xi(u,yy,`frame ${h}`,i);for(let[h,u]of Object.entries(n.bodies??{}))Xi(u,by,`body ${h}`,i),u.color!==void 0&&!vn.test(u.color)&&T("2.4",`body ${h} has color ${JSON.stringify(u.color)}, not #rrggbb`);for(let[h,u]of Object.entries(n.track_sets))Xi(u,vy,`track set ${h}`,i);for(let[h,u]of Object.entries(n.views)){Xi(u,xy,`view ${h}`,i),u.camera!==void 0&&Xi(u.camera,u.camera.kind==="orbit"?Sy:_y,`the camera of view ${h}`,i);for(let f of u.layers)Object.hasOwn($f,f.kind)&&Xi(f,$f[f.kind],`a ${f.kind} layer of view ${h}`,i)}for(let[h,u]of[["frame",n.frames],["body",n.bodies],["track set",n.track_sets],["variable",n.variables],["view",n.views]])for(let f of Object.keys(u??{}))Bh(f,h);let s=new Vi(n),r=h=>s.tree.has(h);for(let[h,u]of Object.entries(n.frames))Array.isArray(u.origin)&&u.origin.forEach(f=>Oo(f,`the origin of frame ${h}`,!1)),Oo(u.rotation?.angle,`the rotation of frame ${h}`,!1),Oo(u.scale,`the scale of frame ${h}`,!1),u.axes!==void 0&&u.axes.length!==3&&T("2.3",`frame ${h} has ${u.axes.length} axis labels, not three`);for(let[h,u]of Object.entries(n.bodies??{}))r(u.frame)||T("2.4",`body ${h} is in frame ${u.frame}, which is not declared`),u.position.forEach(f=>Oo(f,`the position of body ${h}`,!0));Object.keys(n.track_sets).length===0&&T("2.1","the scene does not have a track set");for(let[h,u]of Object.entries(n.track_sets)){r(u.frame)||T("2.1",`track set ${h} is in frame ${u.frame}, which is not declared`),(!Number.isInteger(u.tracks)||u.tracks<1)&&T("2.1",`track set ${h} has tracks ${String(u.tracks)}, not a count of at least one`),Object.hasOwn(u.channels??{},rt)&&T("S3",`track set ${h} declares a channel named ${rt}, which is reserved`);for(let[f,d]of Object.entries(u.attrs??{}))wt(d)||T("S4",`attribute ${f} of track set ${h} is not finite`)}for(let[h,u]of Object.entries(n.variables??{}))if(u.kind==="selector")u.by!=="index"&&u.parameter===void 0&&T("2.5",`selector ${h} is by nearest but does not name a parameter`),wt(u.default)||T("2.5",`selector ${h} defaults to ${String(u.default)}, not a finite number`);else if(u.kind==="choice")u.values.includes(u.default)||T("2.5",`choice ${h} defaults to ${JSON.stringify(u.default)}, which is not one of its values`),u.labels!==void 0&&u.labels.length!==u.values.length&&T("2.5",`choice ${h} has ${u.labels.length} labels for ${u.values.length} values`);else if(u.kind==="toggle"){let f=u.default;typeof f!="boolean"&&T("2.5",`toggle ${h} defaults to ${JSON.stringify(f)}, not a boolean`)}else T("2.5",`variable ${h} has kind ${JSON.stringify(u.kind)}, not selector, choice, or toggle`);let a=n.clock;a.mode!=="fraction"&&a.mode!=="value"&&T("2.6",`the clock mode is ${JSON.stringify(a.mode)}, not fraction or value`),(!Number.isInteger(a.steps)||a.steps<1)&&T("2.6",`the clock has steps ${String(a.steps)}, not a count of at least one`),a.mode==="value"?(a.range!==void 0&&a.keys!==void 0&&T("K3","the clock in value mode has both a range and keys"),a.range===void 0&&a.keys===void 0&&T("C2","the clock is in value mode but does not have a range of two numbers or keys"),a.range!==void 0&&!a.range.every(wt)&&T("S4","the clock range is not finite"),a.keys!==void 0&&li(a.keys,"the clock")):a.keys!==void 0&&T("K3","the clock in fraction mode has keys, which only a clock in value mode takes"),a.end!==void 0&&a.end!=="loop"&&a.end!=="stop"&&T("K9",`the clock's end is ${JSON.stringify(a.end)}, not loop or stop`);let o=Rt(a),l=-1/0,c=new Set;for(let h of n.stages??[])Bh(h.id,"stage"),c.has(h.id)&&T("K9",`stage ${h.id} is declared twice`),c.add(h.id),(!wt(h.at)||h.at<0||h.at>o)&&T("K9",`stage ${h.id} is at ${String(h.at)}, not a time in [0, ${o}]`),h.at<l&&T("K9",`the stages are not in order of time at ${h.id}`),l=h.at;for(let[h,u]of(n.overlays??[]).entries()){let f=`overlay ${h}`;if((!Array.isArray(u.at)||u.at.length!==2||!u.at.every(wt))&&T("2.11",`${f} is at ${JSON.stringify(u.at)}, not two fractions`),u.kind==="text")Fo(n,u.text,f),qf(f,u);else if(u.kind==="legend"){bn(u.opacity,`${f}: the opacity`,Hn,"2.11");for(let d of u.entries){let p=d.label,y=m=>typeof m=="string"||m!==null&&typeof m=="object"&&Object.keys(m).length===1&&(typeof m.sub=="string"||typeof m.sup=="string");typeof p=="string"||Array.isArray(p)&&p.every(y)||T("2.11",`${f} has an entry whose label is not a string or a list of strings and sub and sup parts`),d.marker!==void 0&&zh(f,d.marker,"2.11"),d.line?.color!==void 0&&!vn.test(d.line.color)&&T("2.11",`${f} has a line color that is not #rrggbb`);for(let m of d.colors??[])vn.test(m)||T("2.11",`${f} has a color ${JSON.stringify(m)} that is not #rrggbb`)}}else T("S1",`overlay kind ${JSON.stringify(u.kind)} is not implemented`)}a.labels!==void 0&&a.labels.length!==a.channels.length&&T("2.6",`the clock has ${a.labels.length} labels for ${a.channels.length} channels`),a.seconds!==void 0&&!(wt(a.seconds)&&a.seconds>0)&&T("2.6",`the clock seconds are ${JSON.stringify(a.seconds)}, not a positive finite number`),Pt(a);for(let[h,u]of Object.entries(n.views)){if(typeof u.frame=="string")r(u.frame)||T("2.7",`view ${h} displays ${u.frame}, which is not a frame`);else{Yn(n,u.frame.var,"choice","2.7");let p=at(n,u.frame.var);if(p.kind==="choice")for(let y of p.values)r(y)||T("2.7",`the frame of view ${h} can be ${y}, which is not a frame`)}Uo(n,u.driver.sets),u.driver.member==="all"&&T("V3",`view ${h}: the driver's member is "all", but a driver resolves to one track`),"count"in u.driver.member&&T("V3",`view ${h}: the driver's member is a count, but a driver resolves to one track`),"var"in u.driver.member&&Yn(n,u.driver.member.var,"selector","V3"),u.camera!==void 0&&u.camera.kind!=="plane"&&u.camera.kind!=="orbit"&&T("2.7",`view ${h}: a camera kind is ${JSON.stringify(u.camera.kind)}, not plane or orbit`);let f=u.camera?.aspect;if(u.camera?.kind==="plane"&&f!==void 0&&f!=="equal"&&f!=="free"&&T("2.7",`view ${h}: a plane camera's aspect is ${JSON.stringify(f)}, not equal or free`),u.camera?.kind==="plane"&&u.camera.keys!==void 0){wo(u.camera.keys,f==="free",`the camera of view ${h}`);for(let p of u.camera.keys)for(let y of p.follow??[])u.layers[y.layer]?.kind!=="track"&&T("K5",`view ${h}: a camera key follows layer ${y.layer}, which is not a track layer of the view`)}bn(u.opacity,`view ${h}: the opacity`,Hn);let d=u.margin;if(d!==void 0){for(let p of["top","right","bottom","left"]){let y=d[p];y!==void 0&&!(wt(y)&&y>=0&&y<1)&&T("2.11",`view ${h}: the ${p} margin is ${String(y)}, not a fraction in [0, 1)`)}((d.top??0)+(d.bottom??0)>=1||(d.left??0)+(d.right??0)>=1)&&T("2.11",`view ${h}: the margins leave nothing to draw in`)}if(u.camera?.kind==="orbit"){let{stretch:p,turn:y}=u.camera;p!==void 0&&!(Array.isArray(p)&&p.length===3&&p.every(m=>wt(m)&&m>0))&&T("2.7",`view ${h}: an orbit camera's stretch is ${JSON.stringify(p)}, not three positive finite factors`),y!==void 0&&!wt(y)&&T("2.7",`view ${h}: an orbit camera's turn is ${JSON.stringify(y)}, not a finite number of degrees`)}for(let p of u.layers)if(my.includes(p.kind)||T("S1",`view ${h}: layer kind ${JSON.stringify(p.kind)} is not implemented`),p.visible!==void 0&&Yn(n,p.visible.var,"toggle","L5"),p.kind==="track")Ly(n,h,p);else if(p.kind==="arrow")Ry(n,h,p);else if(p.kind==="outline")Py(n,h,p);else if(p.kind==="label")Ay(n,h,p);else if(p.kind==="points")Cy(n,h,p);else if(p.kind==="body")Object.hasOwn(n.bodies??{},p.body)||T("L4",`view ${h} draws ${p.body}, which is not a body`),p.trail!==void 0&&Xf(h,p.trail),p.size!==void 0&&!(p.size>0)&&T("2.7",`view ${h}: a body layer's size is ${p.size}, not positive`),bn(p.opacity,`view ${h}: a body layer's opacity`,Hn);else if(p.kind==="axes"){p.span!==void 0&&p.span!=="full"&&p.span!=="positive"&&p.span!=="box"&&T("2.7",`view ${h}: an axes layer's span is ${JSON.stringify(p.span)}, not full, positive, or box`),p.ticks!==void 0&&!(Array.isArray(p.ticks)&&p.ticks.every(m=>m==="x"||m==="y"))&&T("2.11",`view ${h}: an axes layer's ticks are ${JSON.stringify(p.ticks)}, not a list of x and y`),p.size!==void 0&&!zi(p.size)&&T("2.11",`view ${h}: an axes layer's size is not positive`);let y=p.titles;if(y!==void 0){(!Array.isArray(y)||y.length!==2)&&T("2.11",`view ${h}: an axes layer's titles are ${JSON.stringify(y)}, not two texts`);for(let m of y)Fo(n,m,`view ${h}: an axes title`)}bn(p.opacity,`view ${h}: an axes layer's opacity`,Hn)}else p.kind==="grid"&&(p.labels!==void 0&&typeof p.labels!="boolean"&&T("2.7",`view ${h}: a grid layer's labels is ${JSON.stringify(p.labels)}, not a boolean`),bn(p.opacity,`view ${h}: a grid layer's opacity`,Hn))}for(let h of n.controls??[])if(gy.includes(h.kind)||T("S1",`control kind ${JSON.stringify(h.kind)} is not implemented`),h.kind==="slider"){Yn(n,h.variable,"selector","2.9");let u=at(n,h.variable);u?.kind==="selector"&&u.by==="index"&&T("2.9",`the slider over ${h.variable} needs a selector by nearest, and the selector is by index`),Uo(n,h.domain)}else h.kind==="tabs"?Yn(n,h.variable,"choice","2.9"):h.kind==="toggle"&&Yn(n,h.variable,"toggle","2.9");for(let h of n.readouts??[])h.place!=="caption"&&h.place!=="panel"&&T("2.9",`readout place ${JSON.stringify(h.place)} is not caption or panel`),Fo(n,h.parts,"a readout");if(e!==void 0){for(let[f,d]of Object.entries(n.bodies??{}))d.image!==void 0&&(e.has(d.image)||T("2.4",`body ${f} has image ${JSON.stringify(d.image)}, which the data container does not hold`),e.view(d.image).dtype!=="uint8"&&T("2.4",`body ${f} has image ${d.image}, which is not a view of uint8 bytes`));let h=new $i(n,e),u=new Set;for(let f of Object.values(n.views))for(let d of f.layers)"clock"in d&&d.clock!==void 0&&d.clock.channel!==rt&&u.add(d.clock.channel);for(let f of Object.keys(n.track_sets)){let d=h.get(f);for(let p of Object.keys(d.def.channels??{}))d.channel(p);for(let p of Object.keys(d.def.parameters??{})){let y=d.parameter(p);for(let m=0;m<d.tracks;m++)Number.isFinite(y[m])||T("2.1",`parameter ${p} of track set ${f} is not finite at track ${m}`)}for(let p of new Set([...n.clock.channels,...u])){if(p===rt||!d.hasChannel(p))continue;let y=d.channel(p);for(let m=0;m<d.tracks;m++){let g=d.start(m),b=d.count(m),_=Math.sign(y[g+1]-y[g]);for(let v=0;v<b;v++)Number.isFinite(y[g+v])||T("T3",`clock channel ${p} of track set ${f} is not finite along track ${m} at sample ${v}`),v+1<b&&!((y[g+v+1]-y[g+v])*_>0)&&T("T3",`clock channel ${p} of track set ${f} is not strictly monotone along track ${m} at sample ${v}`);Number.isFinite(y[g+b-1]-y[g])||T("T3",`clock channel ${p} of track set ${f} has an infinite span along track ${m}`)}}}}for(let h of t===void 0?[n.initial]:[n.initial,t])Iy(n,s,h,i);return i}function Iy(n,e,t,i){Zs(n,t);for(let l of bs(t.layout))Bh(l,"panel");let s=l=>{l.kind!=="panel"&&(l.ratio>0&&l.ratio<1||T("2.8",`a split ratio is ${String(l.ratio)}, not in (0, 1)`),l.keys!==void 0&&li(l.keys,"a split",_o),s(l.a),s(l.b))};s(t.layout);let r=Pt(n.clock),a=(n.readouts??[]).map(l=>({place:l.place,parts:l.parts.filter(c=>typeof c!="string"&&("member"in c||"attr"in c||"channel"in c))})).filter(l=>l.parts.length>0),o=bs(t.layout)[0];for(let[l,c]of Object.entries(t.panels)){for(let b of Object.keys(c.variables??{})){let _=at(n,b);_!==void 0&&_.scope!=="panel"&&i.push(`panel ${l} sets ${b}, which is scene-scoped and never read there`)}let h=n.views[c.view],u={scene:n,state:t,panel:c},f=vs(u,h),d=(b,_,v,w=e.requirements(_,f))=>{let E=n.track_sets[b],x=[...w.channels].filter(I=>I!==rt&&!Object.hasOwn(E.channels??{},I)),A=[...w.attrs].filter(I=>!Object.hasOwn(E.attrs??{},I));x.length+A.length>0&&T("F5",`panel ${l}: track set ${b} lacks ${[...x.map(I=>`channel ${I}`),...A.map(I=>`attribute ${I}`)].join(", ")} for ${v} in frame ${f}`);for(let I of Yf(e,n,_,f)){let R=n.frames[I].scale;R!==void 0&&typeof R=="object"&&"attr"in R&&(R.factor??1)*(E.attrs?.[R.attr]??NaN)+(R.offset??0)===0&&T("F2",`panel ${l}: the scale of frame ${I} is zero for track set ${b}`)}},p=(b,_,v)=>{let w=n.track_sets[b],x=(v===void 0?n.clock.channels:[v.channel]).filter(A=>A!==rt&&!Object.hasOwn(w.channels??{},A));x.length>0&&T("C5",`panel ${l}: track set ${b}, ${_}, lacks clock channels ${x.join(", ")}`),v===void 0&&r>1&&w.periodic!==!0&&T("C6",`panel ${l}: track set ${b}, ${_}, is not periodic, and the clock has ${r} laps`)},y=(b,_)=>{let v=n.track_sets[b];if(_==="all"||"count"in _)return;if("index"in _){_.index>=v.tracks&&T("V3",`panel ${l}: member index ${_.index} is not below the track count ${v.tracks} of track set ${b}`);return}let w=at(n,_.var);w?.kind==="selector"&&w.by!=="index"&&w.parameter!==void 0&&!Object.hasOwn(v.parameters??{},w.parameter)&&T("V3",`panel ${l}: track set ${b} lacks parameter ${w.parameter} for selector ${_.var}`)},m=Et(u,h.driver.sets);if(m!==null){d(m,n.track_sets[m].frame,"the driver"),p(m,"the driver"),y(m,h.driver.member);let b=n.track_sets[m];for(let _ of a)if(_.place==="panel"||l===o)for(let v of _.parts)"member"in v&&!Object.hasOwn(b.parameters??{},v.member)&&T("2.9",`the ${_.place} readout through panel ${l} names parameter ${v.member}, which track set ${m} lacks`),"attr"in v&&!Object.hasOwn(b.attrs??{},v.attr)&&T("2.9",`the ${_.place} readout through panel ${l} names attribute ${v.attr}, which track set ${m} lacks`),"channel"in v&&!Object.hasOwn(b.channels??{},v.channel)&&T("2.9",`the ${_.place} readout through panel ${l} names channel ${v.channel}, which track set ${m} lacks`)}for(let b of h.layers)if(tr(u,b))if(b.kind==="track"){let _=Et(u,b.sets);if(_===null)continue;b.context!=="driver"?d(_,n.track_sets[_].frame,"its tracks"):m!==null&&d(m,n.track_sets[_].frame,`a layer of track set ${_} in the driver's context`),y(_,b.members),b.highlight!==void 0&&y(_,{var:b.highlight.var});let v=n.track_sets[_];b.color!==void 0&&typeof b.color=="object"&&("channel"in b.color&&!Object.hasOwn(v.channels??{},b.color.channel)&&T("2.7",`panel ${l}: track set ${_} lacks channel ${b.color.channel} for a layer's color`),"parameter"in b.color&&!Object.hasOwn(v.parameters??{},b.color.parameter)&&T("2.7",`panel ${l}: track set ${_} lacks parameter ${b.color.parameter} for a layer's color`)),typeof b.color=="object"&&"steps"in b.color&&!Object.hasOwn(v.channels??{},b.color.channel)&&T("2.7",`panel ${l}: track set ${_} lacks channel ${b.color.channel} for a layer's color`);let w=typeof b.head=="object"?b.head.glow:void 0;w!==void 0&&!Object.hasOwn(v.channels??{},w.channel)&&T("2.7",`panel ${l}: track set ${_} lacks channel ${w.channel} for a head's glow`);let E=(b.clock!==void 0||n.clock.mode==="value")&&(b.before==="hidden"||b.after==="hidden");((b.reveal??"none")!=="none"||Wi(b)||E)&&p(_,"on which a reading is taken",b.clock)}else if(b.kind==="arrow"){let _=Et(u,b.sets);if(_===null)continue;d(_,n.track_sets[_].frame,"its arrows"),y(_,b.members);let v=n.track_sets[_];for(let E of b.vector)E!==rt&&!Object.hasOwn(v.channels??{},E)&&T("L7",`panel ${l}: track set ${_} lacks channel ${E} of an arrow layer's vector`);let w=b.scale;typeof w=="object"&&"attr"in w&&!Object.hasOwn(v.attrs??{},w.attr)&&T("F5",`panel ${l}: track set ${_} lacks attribute ${w.attr} for an arrow layer's scale`),p(_,"on which a reading is taken",b.clock)}else if(b.kind==="points"){let _=Et(u,b.sets);if(_===null)continue;d(_,n.track_sets[_].frame,"its points"),y(_,b.members);let v=(b.clock!==void 0||n.clock.mode==="value")&&(b.before==="hidden"||b.after==="hidden");((b.reveal??"none")==="grow"||v)&&p(_,"on which a reading is taken",b.clock)}else if(b.kind==="label"){let _=b.at;if(_.sets!==void 0){let v=Et(u,_.sets);if(v===null)continue;d(v,n.track_sets[v].frame,"a label"),_.member>=n.track_sets[v].tracks&&T("K6",`panel ${l}: a label names member ${_.member}, which is not a track of track set ${v}`),p(v,"on which a label reads",b.clock)}else _.frame!==void 0&&m!==null&&d(m,_.frame,"a label in another frame")}else if(b.kind==="outline"&&m!==null){let _=Ao(u,b.view);_!==null&&d(m,_.frame,`the outline of view ${b.view}`)}else b.kind==="body"&&m!==null&&d(m,n.track_sets[m].frame,`body ${b.body}`,e.bodyRequirements(b.body,f));let g=h.camera;if(g?.kind==="plane"&&g.keys!==void 0)for(let b of g.keys)for(let _ of b.follow??[]){let v=h.layers[_.layer];if(v?.kind!=="track")continue;let w=Et(u,v.sets);w!==null&&(_.member>=n.track_sets[w].tracks&&T("K5",`panel ${l}: a camera key follows member ${_.member}, which is not a track of track set ${w}`),p(w,"which a camera follows",v.clock))}if(l===o)for(let b of n.controls??[]){if(b.kind!=="slider")continue;let _=at(n,b.variable);if(!(_?.kind!=="selector"||_.parameter===void 0))for(let v of ia(u,b.domain))Object.hasOwn(n.track_sets[v].parameters??{},_.parameter)||T("2.9",`the slider over ${b.variable} has track set ${v} in its domain, which lacks parameter ${_.parameter}`)}}}function Yf(n,e,t,i,s=[]){let{up:r,down:a}=n.tree.path(t,i),o=new Set;for(let l of[...r,...a]){if(s.includes(l))continue;o.add(l);let c=e.frames[l].origin;if(c!==void 0&&!Array.isArray(c)){let h=e.bodies[c.body];for(let u of Yf(n,e,h.frame,e.frames[l].parent,[...s,l]))o.add(u)}}return o}function Jf(n,e,t,i){let s=new $i(n,e),r=new Vi(n);Zs(n,t);let a=Pt(n.clock),o=t.clock.channel,l=Of(n.clock.steps,i),c=Object.create(null);for(let[h,u]of Object.entries(t.panels)){let f=n.views[u.view],d={scene:n,state:t,panel:u},p=vs(d,f),y=Et(d,f.driver.sets),m=y===null?null:{set:s.get(y),track:0};if(m){m.track=er(d,f.driver.member,m.set);let v=n.clock.channels.filter(w=>w!==rt&&!m.set.hasChannel(w));v.length>0&&T("C5",`the driver's track set ${m.set.id} lacks clock channels ${v.join(", ")}`),a>1&&!m.set.periodic&&T("C6",`the driver's track set ${m.set.id} is not periodic, and the clock has ${a} laps`)}let g={scope:d,frames:r,clock:n.clock,channel:o,q:l,display:p},b=[];for(let v of f.layers)if(ky.includes(v.kind)||T("S1",`layer kind ${JSON.stringify(v.kind)} is not implemented`),!!tr(d,v))if(v.kind==="track"){let w=Et(d,v.sets);b.push(Bf(_i(g,v),v,w===null?null:s.get(w),m))}else if(v.kind==="arrow"){let w=Et(d,v.sets);b.push(Lo(_i(g,v),v,w===null?null:s.get(w)))}else if(v.kind==="outline")b.push(Io(g,v,m));else if(v.kind==="body")b.push(zf(g,v,m));else if(v.kind==="points"){let w=Et(d,v.sets);b.push(Do(g,v,w===null?null:s.get(w)))}else if(v.kind==="label"){let w=v.at,E=w!==null&&typeof w=="object"&&"sets"in w?Et(d,w.sets):null;b.push(ko(g,v,E===null?null:s.get(E),m))}else b.push({kind:v.kind});let _={frame:p,layers:b};f.camera?.kind==="plane"&&f.camera.keys!==void 0&&(_.camera=Vh(g,f,s,m)),c[h]=_}return{panels:c}}var ky=["track","arrow","outline","body","axes","grid","label","points"],jf=new WeakMap;function Vh(n,e,t,i){let s=e.camera,r=s.aspect==="free";(typeof s.keys!="object"||s.keys===null||jf.get(s.keys)!==r)&&(wo(s.keys,r,"the camera"),jf.set(s.keys,r));let a=s.keys,[o,l]=Ks(s),c=zn(n.clock,n.q);return Df(a,c,u=>{let f=a[u];if(f.follow===void 0)return f.center??null;let d=0,p=0,y=0;for(let g of f.follow){let b=e.layers[g.layer];(b===void 0||b.kind!=="track")&&T("K5",`a camera key follows layer ${g.layer}, which is not a track layer of the view`);let _=Et(n.scope,b.sets),v=Gf(n,b,_===null?null:t.get(_),g.member,i);v!==null&&(p+=v[o],y+=v[l],d++)}if(d===0)return f.center??null;let m=f.offset??[0,0];return[p/d+m[0],y/d+m[1]]})}var Dy={viridis:[[.267,.005,.329],[.283,.141,.458],[.254,.265,.53],[.207,.372,.553],[.164,.471,.558],[.128,.567,.551],[.135,.659,.518],[.267,.749,.441],[.478,.821,.318],[.741,.873,.15],[.993,.906,.144]],plasma:[[.05,.03,.528],[.294,.012,.615],[.492,.012,.658],[.665,.139,.586],[.798,.28,.47],[.902,.418,.36],[.973,.585,.252],[.993,.771,.155],[.94,.975,.131]],cividis:[[0,.135,.304],[.086,.218,.396],[.243,.301,.42],[.365,.383,.432],[.478,.466,.448],[.588,.55,.437],[.702,.638,.402],[.822,.73,.343],[.945,.827,.244],[.996,.91,.149]],blues:[[.19,.42,.71],[.33,.6,.8],[.53,.76,.87],[.7,.85,.92],[.85,.93,.98]],reds:[[.72,.1,.1],[.89,.27,.2],[.98,.5,.36],[.99,.7,.58],[1,.86,.78]]};function ws(n,e,t=[0,0,0]){let i=Dy[n],s=Math.max(0,Math.min(1,e))*(i.length-1),r=Math.min(i.length-2,Math.floor(s)),a=s-r;for(let o=0;o<3;o++)t[o]=i[r][o]+(i[r+1][o]-i[r][o])*a;return t}function Kf(n,e){let[t,i,s]=ws(n,e);return`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(s*255)})`}function $t(n,e){let t=n.toLowerCase();return e.sceneForeground!==void 0&&t===e.sceneForeground.toLowerCase()?e.foreground:e.sceneBackground!==void 0&&t===e.sceneBackground.toLowerCase()?e.background:n}function Qf(n,e){return n===void 0?n:typeof n=="string"?$t(n,e):ra(n)?{...n,colors:n.colors.map(t=>$t(t,e))}:n}function sa(n,e){return{...n,...n.color!==void 0?{color:$t(n.color,e)}:{},...n.edge!==void 0?{edge:$t(n.edge,e)}:{}}}var Ny={background:"#000000",foreground:"#d8d8d8",grid:"#262626"};function Ho(n){return{...Ny,...n.theme??{}}}var Oy={dark:{background:"#050505",foreground:"#f2f2ef",grid:"#232320"},light:{background:"#faf8f3",foreground:"#141413",grid:"#e3e0d8"}};function Gh(n){let e=n.trim();if(/^#[0-9a-fA-F]{6}$/.test(e))return e.toLowerCase();if(/^#[0-9a-fA-F]{3}$/.test(e))return`#${[...e.slice(1)].map(o=>o+o).join("")}`.toLowerCase();if(e==="")return null;let t=document.createElement("canvas").getContext?.("2d",{willReadFrequently:!0});if(t==null)return null;let i=o=>(t.fillStyle=o,t.fillStyle=e,t.fillStyle);if(i("#000000")!==i("#ffffff"))return null;t.fillRect(0,0,1,1);let[s,r,a]=t.getImageData(0,0,1,1).data;return`#${[s,r,a].map(o=>o.toString(16).padStart(2,"0")).join("")}`}function ep(n,e,t){let i=e==="dark"||e==="light",s=i?Oy[e]:n,r={background:Gh(t("--tycho-background"))??s.background,foreground:Gh(t("--tycho-foreground"))??s.foreground,grid:Gh(t("--tycho-grid"))??s.grid},a=t("--tycho-font")||n.font;return a&&(r.font=a),r.sceneForeground=n.foreground,r.sceneBackground=n.background,n.gutter!==void 0&&(r.gutter=i&&n.gutter.toLowerCase()===n.background.toLowerCase()?r.background:n.gutter),r}var Ms={accent:"#f0a050",hover:"#ffb366",press:"#d98a3a",violet:"#c050f0",violetText:"#d98cff",error:"#ff7a7a"};function tp(n){let e=_n(n.background,n.background,0),t=_n(n.foreground,n.foreground,0),i=_n(t,e,.95),s=Mt(e).reduce((r,a)=>r+a,0)<1.5;return{"--bg":e,"--fg":t,"--surface":i,"--raised":_n(t,e,.82),"--line":_n(t,e,.8),"--dim":_n(t,e,.287),"--track":_n(t,e,.574),"--gutter":n.gutter??_n(t,e,.9),"--head":`${i}cc`,"--accent":Ms.accent,"--accent-hover":Ms.hover,"--accent-press":Ms.press,"--accent-tint":_n(Ms.accent,i,.84),"--accent-2":Ms.violet,"--accent-2-text":Ms.violetText,"--accent-2-tint":"rgba(192, 80, 240, 0.16)","--error":Ms.error,"--highlight":s?"#ffffff":"#000000"}}function Mt(n){let e=/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(n);return e===null?[1,1,1]:[parseInt(e[1],16)/255,parseInt(e[2],16)/255,parseInt(e[3],16)/255]}function _n(n,e,t){let i=Mt(n),s=Mt(e),r=a=>Math.round(255*((1-t)*i[a]+t*s[a])).toString(16).padStart(2,"0");return`#${r(0)}${r(1)}${r(2)}`}function Zf(n,e,t=[0,1]){let[i,s]=e,r=s===i?.5:Math.min(1,Math.max(0,(n-i)/(s-i)));return t[0]+r*(t[1]-t[0])}function Fy(n){let e=1/0,t=-1/0;for(let i=0;i<n.length;i++){let s=n[i];s<e&&(e=s),s>t&&(t=s)}return e<=t?[e,t]:[0,1]}function Uy(n,e){if(typeof n=="string")return n;let t=e?.(n.var);return(t!==void 0&&Object.hasOwn(n.map,t)?n.map[t]:void 0)??Object.values(n.map).find(s=>s!==void 0)??"viridis"}var ra=n=>typeof n=="object"&&n!==null&&"steps"in n;function By(n,e){let t=0;for(;t<n.length&&n[t]<e;)t++;return t}function Wh(n,e,t){let i="parameter"in n,s="parameter"in n?n.parameter:n.channel,r="parameter"in n?e.parameter(n.parameter,"2.7"):e.channel(n.channel,"2.7");return{id:Uy(n.colormap,t),name:s,perTrack:i,values:r,range:n.range??Fy(r),clip:n.clip??[0,1]}}function np(n,e,t,i){if(n===void 0)return{kind:"constant",rgb:t};if(typeof n=="string")return{kind:"constant",rgb:Mt(n)};if(ra(n)){let o=e.channel(n.channel,"2.7"),l=n.colors.map(Mt),c=new Float32Array(3*e.samples);for(let h=0;h<e.samples;h++)c.set(l[By(n.steps,o[h])],3*h);return{kind:"sample",rgb:c}}let s=Wh(n,e,i),r=new Float32Array(3*e.samples),a=[0,0,0];if(s.perTrack)for(let o=0;o<e.tracks;o++){ws(s.id,Zf(s.values[o],s.range,s.clip),a);for(let l=e.start(o);l<e.start(o)+e.count(o);l++)r.set(a,3*l)}else for(let o=0;o<e.samples;o++)r.set(ws(s.id,Zf(s.values[o],s.range,s.clip),a),3*o);return{kind:"sample",rgb:r}}function $h(n,e=12){let t=[],i=[0,0,0];for(let s=0;s<e;s++){let r=s/(e-1);ws(n.id,n.clip[0]+r*(n.clip[1]-n.clip[0]),i),t.push([r,`rgb(${i.map(a=>Math.round(255*a)).join(",")})`])}return t}function ip(n,e=12){return`linear-gradient(to top, ${$h(n,e).map(([t,i])=>`${i} ${(100*t).toFixed(1)}%`).join(", ")})`}var nu=(n,e,t)=>{if(!e.has(n))throw TypeError("Cannot "+t)},N=(n,e,t)=>(nu(n,e,"read from private field"),t?t.call(n):e.get(n)),$e=(n,e,t)=>{if(e.has(n))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(n):e.set(n,t)},qt=(n,e,t,i)=>(nu(n,e,"write to private field"),i?i.call(n,t):e.set(n,t),t),zy=(n,e,t,i)=>({set _(s){qt(n,e,s,t)},get _(){return N(n,e,i)}}),Qe=(n,e,t)=>(nu(n,e,"access private method"),t),et=new Uint8Array(8),fi=new DataView(et.buffer),Ft=n=>[(n%256+256)%256],it=n=>(fi.setUint16(0,n,!1),[et[0],et[1]]),Hy=n=>(fi.setInt16(0,n,!1),[et[0],et[1]]),rp=n=>(fi.setUint32(0,n,!1),[et[1],et[2],et[3]]),_e=n=>(fi.setUint32(0,n,!1),[et[0],et[1],et[2],et[3]]),Vy=n=>(fi.setInt32(0,n,!1),[et[0],et[1],et[2],et[3]]),Ps=n=>(fi.setUint32(0,Math.floor(n/2**32),!1),fi.setUint32(4,n,!1),[et[0],et[1],et[2],et[3],et[4],et[5],et[6],et[7]]),iu=n=>(fi.setInt16(0,2**8*n,!1),[et[0],et[1]]),ui=n=>(fi.setInt32(0,2**16*n,!1),[et[0],et[1],et[2],et[3]]),Xh=n=>(fi.setInt32(0,2**30*n,!1),[et[0],et[1],et[2],et[3]]),Vn=(n,e=!1)=>{let t=Array(n.length).fill(null).map((i,s)=>n.charCodeAt(s));return e&&t.push(0),t},qo=n=>n&&n[n.length-1],su=n=>{let e;for(let t of n)(!e||t.presentationTimestamp>e.presentationTimestamp)&&(e=t);return e},di=(n,e,t=!0)=>{let i=n*e;return t?Math.round(i):i},ap=n=>{let e=n*(Math.PI/180),t=Math.cos(e),i=Math.sin(e);return[t,i,0,-i,t,0,0,0,1]},op=ap(0),lp=n=>[ui(n[0]),ui(n[1]),Xh(n[2]),ui(n[3]),ui(n[4]),Xh(n[5]),ui(n[6]),ui(n[7]),Xh(n[8])],la=n=>!n||typeof n!="object"?n:Array.isArray(n)?n.map(la):Object.fromEntries(Object.entries(n).map(([e,t])=>[e,la(t)])),ar=n=>n>=0&&n<2**32,It=(n,e,t)=>({type:n,contents:e&&new Uint8Array(e.flat(10)),children:t}),mt=(n,e,t,i,s)=>It(n,[Ft(e),rp(t),i??[]],s),Gy=n=>{let e=512;return n.fragmented?It("ftyp",[Vn("iso5"),_e(e),Vn("iso5"),Vn("iso6"),Vn("mp41")]):It("ftyp",[Vn("isom"),_e(e),Vn("isom"),n.holdsAvc?Vn("avc1"):[],Vn("mp41")])},qh=n=>({type:"mdat",largeSize:n}),Wy=n=>({type:"free",size:n}),Vo=(n,e,t=!1)=>It("moov",null,[$y(e,n),...n.map(i=>Xy(i,e)),t?wb(n):null]),$y=(n,e)=>{let t=di(Math.max(0,...e.filter(a=>a.samples.length>0).map(a=>{let o=su(a.samples);return o.presentationTimestamp+o.duration})),Jh),i=Math.max(...e.map(a=>a.id))+1,s=!ar(n)||!ar(t),r=s?Ps:_e;return mt("mvhd",+s,0,[r(n),r(n),_e(Jh),r(t),ui(1),iu(1),Array(10).fill(0),lp(op),Array(24).fill(0),_e(i)])},Xy=(n,e)=>It("trak",null,[qy(n,e),Yy(n,e)]),qy=(n,e)=>{let t=su(n.samples),i=di(t?t.presentationTimestamp+t.duration:0,Jh),s=!ar(e)||!ar(i),r=s?Ps:_e,a;return n.info.type==="video"?a=typeof n.info.rotation=="number"?ap(n.info.rotation):n.info.rotation:a=op,mt("tkhd",+s,3,[r(e),r(e),_e(n.id),_e(0),r(i),Array(8).fill(0),it(0),it(0),iu(n.info.type==="audio"?1:0),it(0),lp(a),ui(n.info.type==="video"?n.info.width:0),ui(n.info.type==="video"?n.info.height:0)])},Yy=(n,e)=>It("mdia",null,[jy(n,e),Jy(n.info.type==="video"?"vide":"soun"),Ky(n)]),jy=(n,e)=>{let t=su(n.samples),i=di(t?t.presentationTimestamp+t.duration:0,n.timescale),s=!ar(e)||!ar(i),r=s?Ps:_e;return mt("mdhd",+s,0,[r(e),r(e),_e(n.timescale),r(i),it(21956),it(0)])},Jy=n=>mt("hdlr",0,0,[Vn("mhlr"),Vn(n),_e(0),_e(0),_e(0),Vn("mp4-muxer-hdlr",!0)]),Ky=n=>It("minf",null,[n.info.type==="video"?Zy():Qy(),eb(),ib(n)]),Zy=()=>mt("vmhd",0,1,[it(0),it(0),it(0),it(0)]),Qy=()=>mt("smhd",0,0,[it(0),it(0)]),eb=()=>It("dinf",null,[tb()]),tb=()=>mt("dref",0,0,[_e(1)],[nb()]),nb=()=>mt("url ",0,1),ib=n=>{let e=n.compositionTimeOffsetTable.length>1||n.compositionTimeOffsetTable.some(t=>t.sampleCompositionTimeOffset!==0);return It("stbl",null,[sb(n),yb(n),bb(n),vb(n),xb(n),_b(n),e?Sb(n):null])},sb=n=>mt("stsd",0,0,[_e(1)],[n.info.type==="video"?rb(kb[n.info.codec],n):pb(Nb[n.info.codec],n)]),rb=(n,e)=>It(n,[Array(6).fill(0),it(1),it(0),it(0),Array(12).fill(0),it(e.info.width),it(e.info.height),_e(4718592),_e(4718592),_e(0),it(1),Array(32).fill(0),it(24),Hy(65535)],[Db[e.info.codec](e),e.info.decoderConfig.colorSpace?cb(e):null]),ab={bt709:1,bt470bg:5,smpte170m:6},ob={bt709:1,smpte170m:6,"iec61966-2-1":13},lb={rgb:0,bt709:1,bt470bg:5,smpte170m:6},cb=n=>It("colr",[Vn("nclx"),it(ab[n.info.decoderConfig.colorSpace.primaries]),it(ob[n.info.decoderConfig.colorSpace.transfer]),it(lb[n.info.decoderConfig.colorSpace.matrix]),Ft((n.info.decoderConfig.colorSpace.fullRange?1:0)<<7)]),hb=n=>n.info.decoderConfig&&It("avcC",[...new Uint8Array(n.info.decoderConfig.description)]),ub=n=>n.info.decoderConfig&&It("hvcC",[...new Uint8Array(n.info.decoderConfig.description)]),db=n=>{if(!n.info.decoderConfig)return null;let e=n.info.decoderConfig;if(!e.colorSpace)throw new Error("'colorSpace' is required in the decoder config for VP9.");let t=e.codec.split("."),i=Number(t[1]),s=Number(t[2]),o=(Number(t[3])<<4)+(0<<1)+Number(e.colorSpace.fullRange);return mt("vpcC",1,0,[Ft(i),Ft(s),Ft(o),Ft(2),Ft(2),Ft(2),it(0)])},fb=()=>{let t=(1<<7)+1;return It("av1C",[t,0,0,0])},pb=(n,e)=>It(n,[Array(6).fill(0),it(1),it(0),it(0),_e(0),it(e.info.numberOfChannels),it(16),it(0),it(0),ui(e.info.sampleRate)],[Ob[e.info.codec](e)]),mb=n=>{let e=new Uint8Array(n.info.decoderConfig.description);return mt("esds",0,0,[_e(58753152),Ft(32+e.byteLength),it(1),Ft(0),_e(75530368),Ft(18+e.byteLength),Ft(64),Ft(21),rp(0),_e(130071),_e(130071),_e(92307584),Ft(e.byteLength),...e,_e(109084800),Ft(1),Ft(2)])},gb=n=>{let e=3840,t=0,i=n.info.decoderConfig?.description;if(i){if(i.byteLength<18)throw new TypeError("Invalid decoder description provided for Opus; must be at least 18 bytes long.");let s=ArrayBuffer.isView(i)?new DataView(i.buffer,i.byteOffset,i.byteLength):new DataView(i);e=s.getUint16(10,!0),t=s.getInt16(14,!0)}return It("dOps",[Ft(0),Ft(n.info.numberOfChannels),it(e),_e(n.info.sampleRate),iu(t),Ft(0)])},yb=n=>mt("stts",0,0,[_e(n.timeToSampleTable.length),n.timeToSampleTable.map(e=>[_e(e.sampleCount),_e(e.sampleDelta)])]),bb=n=>{if(n.samples.every(t=>t.type==="key"))return null;let e=[...n.samples.entries()].filter(([,t])=>t.type==="key");return mt("stss",0,0,[_e(e.length),e.map(([t])=>_e(t+1))])},vb=n=>mt("stsc",0,0,[_e(n.compactlyCodedChunkTable.length),n.compactlyCodedChunkTable.map(e=>[_e(e.firstChunk),_e(e.samplesPerChunk),_e(1)])]),xb=n=>mt("stsz",0,0,[_e(0),_e(n.samples.length),n.samples.map(e=>_e(e.size))]),_b=n=>n.finalizedChunks.length>0&&qo(n.finalizedChunks).offset>=2**32?mt("co64",0,0,[_e(n.finalizedChunks.length),n.finalizedChunks.map(e=>Ps(e.offset))]):mt("stco",0,0,[_e(n.finalizedChunks.length),n.finalizedChunks.map(e=>_e(e.offset))]),Sb=n=>mt("ctts",0,0,[_e(n.compositionTimeOffsetTable.length),n.compositionTimeOffsetTable.map(e=>[_e(e.sampleCount),_e(e.sampleCompositionTimeOffset)])]),wb=n=>It("mvex",null,n.map(Mb)),Mb=n=>mt("trex",0,0,[_e(n.id),_e(1),_e(0),_e(0),_e(0)]),sp=(n,e)=>It("moof",null,[Eb(n),...e.map(Tb)]),Eb=n=>mt("mfhd",0,0,[_e(n)]),cp=n=>{let e=0,t=0,i=0,s=0,r=n.type==="delta";return t|=+r,r?e|=1:e|=2,e<<24|t<<16|i<<8|s},Tb=n=>It("traf",null,[Ab(n),Cb(n),Rb(n)]),Ab=n=>{let e=0;e|=8,e|=16,e|=32,e|=131072;let t=n.currentChunk.samples[1]??n.currentChunk.samples[0],i={duration:t.timescaleUnitsToNextSample,size:t.size,flags:cp(t)};return mt("tfhd",0,e,[_e(n.id),_e(i.duration),_e(i.size),_e(i.flags)])},Cb=n=>mt("tfdt",1,0,[Ps(di(n.currentChunk.startTimestamp,n.timescale))]),Rb=n=>{let e=n.currentChunk.samples.map(y=>y.timescaleUnitsToNextSample),t=n.currentChunk.samples.map(y=>y.size),i=n.currentChunk.samples.map(cp),s=n.currentChunk.samples.map(y=>di(y.presentationTimestamp-y.decodeTimestamp,n.timescale)),r=new Set(e),a=new Set(t),o=new Set(i),l=new Set(s),c=o.size===2&&i[0]!==i[1],h=r.size>1,u=a.size>1,f=!c&&o.size>1,d=l.size>1||[...l].some(y=>y!==0),p=0;return p|=1,p|=4*+c,p|=256*+h,p|=512*+u,p|=1024*+f,p|=2048*+d,mt("trun",1,p,[_e(n.currentChunk.samples.length),_e(n.currentChunk.offset-n.currentChunk.moofOffset||0),c?_e(i[0]):[],n.currentChunk.samples.map((y,m)=>[h?_e(e[m]):[],u?_e(t[m]):[],f?_e(i[m]):[],d?Vy(s[m]):[]])])},Pb=n=>It("mfra",null,[...n.map(Lb),Ib()]),Lb=(n,e)=>mt("tfra",1,0,[_e(n.id),_e(63),_e(n.finalizedChunks.length),n.finalizedChunks.map(i=>[Ps(di(i.startTimestamp,n.timescale)),Ps(i.moofOffset),_e(e+1),_e(1),_e(1)])]),Ib=()=>mt("mfro",0,0,[_e(0)]),kb={avc:"avc1",hevc:"hvc1",vp9:"vp09",av1:"av01"},Db={avc:hb,hevc:ub,vp9:db,av1:fb},Nb={aac:"mp4a",opus:"Opus"},Ob={aac:mb,opus:gb};var Qo=class{},ru=class extends Qo{constructor(){super(...arguments),this.buffer=null}},hp=class extends Qo{constructor(n){if(super(),this.options=n,typeof n!="object")throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");if(n.onData){if(typeof n.onData!="function")throw new TypeError("options.onData, when provided, must be a function.");if(n.onData.length<2)throw new TypeError("options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs.")}if(n.chunked!==void 0&&typeof n.chunked!="boolean")throw new TypeError("options.chunked, when provided, must be a boolean.");if(n.chunkSize!==void 0&&(!Number.isInteger(n.chunkSize)||n.chunkSize<1024))throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.")}},Fb=class extends Qo{constructor(n,e){if(super(),this.stream=n,this.options=e,!(n instanceof FileSystemWritableFileStream))throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");if(e!==void 0&&typeof e!="object")throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");if(e&&e.chunkSize!==void 0&&(!Number.isInteger(e.chunkSize)||e.chunkSize<=0))throw new TypeError("options.chunkSize, when provided, must be a positive integer")}},Es,ir,up=class{constructor(){this.pos=0,$e(this,Es,new Uint8Array(8)),$e(this,ir,new DataView(N(this,Es).buffer)),this.offsets=new WeakMap}seek(n){this.pos=n}writeU32(n){N(this,ir).setUint32(0,n,!1),this.write(N(this,Es).subarray(0,4))}writeU64(n){N(this,ir).setUint32(0,Math.floor(n/2**32),!1),N(this,ir).setUint32(4,n,!1),this.write(N(this,Es).subarray(0,8))}writeAscii(n){for(let e=0;e<n.length;e++)N(this,ir).setUint8(e%8,n.charCodeAt(e)),e%8===7&&this.write(N(this,Es));n.length%8!==0&&this.write(N(this,Es).subarray(0,n.length%8))}writeBox(n){if(this.offsets.set(n,this.pos),n.contents&&!n.children)this.writeBoxHeader(n,n.size??n.contents.byteLength+8),this.write(n.contents);else{let e=this.pos;if(this.writeBoxHeader(n,0),n.contents&&this.write(n.contents),n.children)for(let s of n.children)s&&this.writeBox(s);let t=this.pos,i=n.size??t-e;this.seek(e),this.writeBoxHeader(n,i),this.seek(t)}}writeBoxHeader(n,e){this.writeU32(n.largeSize?1:e),this.writeAscii(n.type),n.largeSize&&this.writeU64(e)}measureBoxHeader(n){return 8+(n.largeSize?8:0)}patchBox(n){let e=this.pos;this.seek(this.offsets.get(n)),this.writeBox(n),this.seek(e)}measureBox(n){if(n.contents&&!n.children)return this.measureBoxHeader(n)+n.contents.byteLength;{let e=this.measureBoxHeader(n);if(n.contents&&(e+=n.contents.byteLength),n.children)for(let t of n.children)t&&(e+=this.measureBox(t));return e}}};Es=new WeakMap;ir=new WeakMap;var Go,Rs,fa,aa,Wo,Yh,Ub=class extends up{constructor(n){super(),$e(this,Wo),$e(this,Go,void 0),$e(this,Rs,new ArrayBuffer(2**16)),$e(this,fa,new Uint8Array(N(this,Rs))),$e(this,aa,0),qt(this,Go,n)}write(n){Qe(this,Wo,Yh).call(this,this.pos+n.byteLength),N(this,fa).set(n,this.pos),this.pos+=n.byteLength,qt(this,aa,Math.max(N(this,aa),this.pos))}finalize(){Qe(this,Wo,Yh).call(this,this.pos),N(this,Go).buffer=N(this,Rs).slice(0,Math.max(N(this,aa),this.pos))}};Go=new WeakMap;Rs=new WeakMap;fa=new WeakMap;aa=new WeakMap;Wo=new WeakSet;Yh=function(n){let e=N(this,Rs).byteLength;for(;e<n;)e*=2;if(e===N(this,Rs).byteLength)return;let t=new ArrayBuffer(e),i=new Uint8Array(t);i.set(N(this,fa),0),qt(this,Rs,t),qt(this,fa,i)};var Bb=2**24,zb=2,ca,Ts,oa,wi,wn,Yo,jh,au,dp,ou,fp,ha,jo,lu=class extends up{constructor(n){super(),$e(this,Yo),$e(this,au),$e(this,ou),$e(this,ha),$e(this,ca,void 0),$e(this,Ts,[]),$e(this,oa,void 0),$e(this,wi,void 0),$e(this,wn,[]),qt(this,ca,n),qt(this,oa,n.options?.chunked??!1),qt(this,wi,n.options?.chunkSize??Bb)}write(n){N(this,Ts).push({data:n.slice(),start:this.pos}),this.pos+=n.byteLength}flush(){if(N(this,Ts).length===0)return;let n=[],e=[...N(this,Ts)].sort((t,i)=>t.start-i.start);n.push({start:e[0].start,size:e[0].data.byteLength});for(let t=1;t<e.length;t++){let i=n[n.length-1],s=e[t];s.start<=i.start+i.size?i.size=Math.max(i.size,s.start+s.data.byteLength-i.start):n.push({start:s.start,size:s.data.byteLength})}for(let t of n){t.data=new Uint8Array(t.size);for(let i of N(this,Ts))t.start<=i.start&&i.start<t.start+t.size&&t.data.set(i.data,i.start-t.start);N(this,oa)?(Qe(this,Yo,jh).call(this,t.data,t.start),Qe(this,ha,jo).call(this)):N(this,ca).options.onData?.(t.data,t.start)}N(this,Ts).length=0}finalize(){N(this,oa)&&Qe(this,ha,jo).call(this,!0)}};ca=new WeakMap;Ts=new WeakMap;oa=new WeakMap;wi=new WeakMap;wn=new WeakMap;Yo=new WeakSet;jh=function(n,e){let t=N(this,wn).findIndex(o=>o.start<=e&&e<o.start+N(this,wi));t===-1&&(t=Qe(this,ou,fp).call(this,e));let i=N(this,wn)[t],s=e-i.start,r=n.subarray(0,Math.min(N(this,wi)-s,n.byteLength));i.data.set(r,s);let a={start:s,end:s+r.byteLength};if(Qe(this,au,dp).call(this,i,a),i.written[0].start===0&&i.written[0].end===N(this,wi)&&(i.shouldFlush=!0),N(this,wn).length>zb){for(let o=0;o<N(this,wn).length-1;o++)N(this,wn)[o].shouldFlush=!0;Qe(this,ha,jo).call(this)}r.byteLength<n.byteLength&&Qe(this,Yo,jh).call(this,n.subarray(r.byteLength),e+r.byteLength)};au=new WeakSet;dp=function(n,e){let t=0,i=n.written.length-1,s=-1;for(;t<=i;){let r=Math.floor(t+(i-t+1)/2);n.written[r].start<=e.start?(t=r+1,s=r):i=r-1}for(n.written.splice(s+1,0,e),(s===-1||n.written[s].end<e.start)&&s++;s<n.written.length-1&&n.written[s].end>=n.written[s+1].start;)n.written[s].end=Math.max(n.written[s].end,n.written[s+1].end),n.written.splice(s+1,1)};ou=new WeakSet;fp=function(n){let t={start:Math.floor(n/N(this,wi))*N(this,wi),data:new Uint8Array(N(this,wi)),written:[],shouldFlush:!1};return N(this,wn).push(t),N(this,wn).sort((i,s)=>i.start-s.start),N(this,wn).indexOf(t)};ha=new WeakSet;jo=function(n=!1){for(let e=0;e<N(this,wn).length;e++){let t=N(this,wn)[e];if(!(!t.shouldFlush&&!n)){for(let i of t.written)N(this,ca).options.onData?.(t.data.subarray(i.start,i.end),t.start+i.start);N(this,wn).splice(e--,1)}}};var Hb=class extends lu{constructor(n){super(new hp({onData:(e,t)=>n.stream.write({type:"write",data:e,position:t}),chunked:!0,chunkSize:n.options?.chunkSize}))}},Jh=1e3,Vb=["avc","hevc","vp9","av1"],Gb=["aac","opus"],Wb=2082844800,$b=["strict","offset","cross-track-offset"],Ce,Oe,Jo,Sn,en,Xt,sr,rr,cu,As,Cs,ua,Kh,pp,Zh,mp,hu,gp,Qh,yp,uu,bp,$o,eu,hi,Si,du,vp,da,Ko,Zo,fu,or,pa,Xo,tu,xp=class{constructor(n){if($e(this,Kh),$e(this,Zh),$e(this,hu),$e(this,Qh),$e(this,uu),$e(this,$o),$e(this,hi),$e(this,du),$e(this,da),$e(this,Zo),$e(this,or),$e(this,Xo),$e(this,Ce,void 0),$e(this,Oe,void 0),$e(this,Jo,void 0),$e(this,Sn,void 0),$e(this,en,null),$e(this,Xt,null),$e(this,sr,Math.floor(Date.now()/1e3)+Wb),$e(this,rr,[]),$e(this,cu,1),$e(this,As,[]),$e(this,Cs,[]),$e(this,ua,!1),Qe(this,Kh,pp).call(this,n),n.video=la(n.video),n.audio=la(n.audio),n.fastStart=la(n.fastStart),this.target=n.target,qt(this,Ce,{firstTimestampBehavior:"strict",...n}),n.target instanceof ru)qt(this,Oe,new Ub(n.target));else if(n.target instanceof hp)qt(this,Oe,new lu(n.target));else if(n.target instanceof Fb)qt(this,Oe,new Hb(n.target));else throw new Error(`Invalid target: ${n.target}`);Qe(this,Qh,yp).call(this),Qe(this,Zh,mp).call(this)}addVideoChunk(n,e,t,i){if(!(n instanceof EncodedVideoChunk))throw new TypeError("addVideoChunk's first argument (sample) must be of type EncodedVideoChunk.");if(e&&typeof e!="object")throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");if(t!==void 0&&(!Number.isFinite(t)||t<0))throw new TypeError("addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number.");if(i!==void 0&&!Number.isFinite(i))throw new TypeError("addVideoChunk's fourth argument (compositionTimeOffset), when provided, must be a real number.");let s=new Uint8Array(n.byteLength);n.copyTo(s),this.addVideoChunkRaw(s,n.type,t??n.timestamp,n.duration,e,i)}addVideoChunkRaw(n,e,t,i,s,r){if(!(n instanceof Uint8Array))throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");if(e!=="key"&&e!=="delta")throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(t)||t<0)throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(i)||i<0)throw new TypeError("addVideoChunkRaw's fourth argument (duration) must be a non-negative real number.");if(s&&typeof s!="object")throw new TypeError("addVideoChunkRaw's fifth argument (meta), when provided, must be an object.");if(r!==void 0&&!Number.isFinite(r))throw new TypeError("addVideoChunkRaw's sixth argument (compositionTimeOffset), when provided, must be a real number.");if(Qe(this,Xo,tu).call(this),!N(this,Ce).video)throw new Error("No video track declared.");if(typeof N(this,Ce).fastStart=="object"&&N(this,en).samples.length===N(this,Ce).fastStart.expectedVideoChunks)throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${N(this,Ce).fastStart.expectedVideoChunks}).`);let a=Qe(this,$o,eu).call(this,N(this,en),n,e,t,i,s,r);if(N(this,Ce).fastStart==="fragmented"&&N(this,Xt)){for(;N(this,Cs).length>0&&N(this,Cs)[0].decodeTimestamp<=a.decodeTimestamp;){let o=N(this,Cs).shift();Qe(this,hi,Si).call(this,N(this,Xt),o)}a.decodeTimestamp<=N(this,Xt).lastDecodeTimestamp?Qe(this,hi,Si).call(this,N(this,en),a):N(this,As).push(a)}else Qe(this,hi,Si).call(this,N(this,en),a)}addAudioChunk(n,e,t){if(!(n instanceof EncodedAudioChunk))throw new TypeError("addAudioChunk's first argument (sample) must be of type EncodedAudioChunk.");if(e&&typeof e!="object")throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");if(t!==void 0&&(!Number.isFinite(t)||t<0))throw new TypeError("addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number.");let i=new Uint8Array(n.byteLength);n.copyTo(i),this.addAudioChunkRaw(i,n.type,t??n.timestamp,n.duration,e)}addAudioChunkRaw(n,e,t,i,s){if(!(n instanceof Uint8Array))throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");if(e!=="key"&&e!=="delta")throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(t)||t<0)throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(i)||i<0)throw new TypeError("addAudioChunkRaw's fourth argument (duration) must be a non-negative real number.");if(s&&typeof s!="object")throw new TypeError("addAudioChunkRaw's fifth argument (meta), when provided, must be an object.");if(Qe(this,Xo,tu).call(this),!N(this,Ce).audio)throw new Error("No audio track declared.");if(typeof N(this,Ce).fastStart=="object"&&N(this,Xt).samples.length===N(this,Ce).fastStart.expectedAudioChunks)throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${N(this,Ce).fastStart.expectedAudioChunks}).`);let r=Qe(this,$o,eu).call(this,N(this,Xt),n,e,t,i,s);if(N(this,Ce).fastStart==="fragmented"&&N(this,en)){for(;N(this,As).length>0&&N(this,As)[0].decodeTimestamp<=r.decodeTimestamp;){let a=N(this,As).shift();Qe(this,hi,Si).call(this,N(this,en),a)}r.decodeTimestamp<=N(this,en).lastDecodeTimestamp?Qe(this,hi,Si).call(this,N(this,Xt),r):N(this,Cs).push(r)}else Qe(this,hi,Si).call(this,N(this,Xt),r)}finalize(){if(N(this,ua))throw new Error("Cannot finalize a muxer more than once.");if(N(this,Ce).fastStart==="fragmented"){for(let e of N(this,As))Qe(this,hi,Si).call(this,N(this,en),e);for(let e of N(this,Cs))Qe(this,hi,Si).call(this,N(this,Xt),e);Qe(this,Zo,fu).call(this,!1)}else N(this,en)&&Qe(this,da,Ko).call(this,N(this,en)),N(this,Xt)&&Qe(this,da,Ko).call(this,N(this,Xt));let n=[N(this,en),N(this,Xt)].filter(Boolean);if(N(this,Ce).fastStart==="in-memory"){let e;for(let i=0;i<2;i++){let s=Vo(n,N(this,sr)),r=N(this,Oe).measureBox(s);e=N(this,Oe).measureBox(N(this,Sn));let a=N(this,Oe).pos+r+e;for(let o of N(this,rr)){o.offset=a;for(let{data:l}of o.samples)a+=l.byteLength,e+=l.byteLength}if(a<2**32)break;e>=2**32&&(N(this,Sn).largeSize=!0)}let t=Vo(n,N(this,sr));N(this,Oe).writeBox(t),N(this,Sn).size=e,N(this,Oe).writeBox(N(this,Sn));for(let i of N(this,rr))for(let s of i.samples)N(this,Oe).write(s.data),s.data=null}else if(N(this,Ce).fastStart==="fragmented"){let e=N(this,Oe).pos,t=Pb(n);N(this,Oe).writeBox(t);let i=N(this,Oe).pos-e;N(this,Oe).seek(N(this,Oe).pos-4),N(this,Oe).writeU32(i)}else{let e=N(this,Oe).offsets.get(N(this,Sn)),t=N(this,Oe).pos-e;N(this,Sn).size=t,N(this,Sn).largeSize=t>=2**32,N(this,Oe).patchBox(N(this,Sn));let i=Vo(n,N(this,sr));if(typeof N(this,Ce).fastStart=="object"){N(this,Oe).seek(N(this,Jo)),N(this,Oe).writeBox(i);let s=e-N(this,Oe).pos;N(this,Oe).writeBox(Wy(s))}else N(this,Oe).writeBox(i)}Qe(this,or,pa).call(this),N(this,Oe).finalize(),qt(this,ua,!0)}};Ce=new WeakMap;Oe=new WeakMap;Jo=new WeakMap;Sn=new WeakMap;en=new WeakMap;Xt=new WeakMap;sr=new WeakMap;rr=new WeakMap;cu=new WeakMap;As=new WeakMap;Cs=new WeakMap;ua=new WeakMap;Kh=new WeakSet;pp=function(n){if(typeof n!="object")throw new TypeError("The muxer requires an options object to be passed to its constructor.");if(!(n.target instanceof Qo))throw new TypeError("The target must be provided and an instance of Target.");if(n.video){if(!Vb.includes(n.video.codec))throw new TypeError(`Unsupported video codec: ${n.video.codec}`);if(!Number.isInteger(n.video.width)||n.video.width<=0)throw new TypeError(`Invalid video width: ${n.video.width}. Must be a positive integer.`);if(!Number.isInteger(n.video.height)||n.video.height<=0)throw new TypeError(`Invalid video height: ${n.video.height}. Must be a positive integer.`);let e=n.video.rotation;if(typeof e=="number"&&![0,90,180,270].includes(e))throw new TypeError(`Invalid video rotation: ${e}. Has to be 0, 90, 180 or 270.`);if(Array.isArray(e)&&(e.length!==9||e.some(t=>typeof t!="number")))throw new TypeError(`Invalid video transformation matrix: ${e.join()}`);if(n.video.frameRate!==void 0&&(!Number.isInteger(n.video.frameRate)||n.video.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${n.video.frameRate}. Must be a positive integer.`)}if(n.audio){if(!Gb.includes(n.audio.codec))throw new TypeError(`Unsupported audio codec: ${n.audio.codec}`);if(!Number.isInteger(n.audio.numberOfChannels)||n.audio.numberOfChannels<=0)throw new TypeError(`Invalid number of audio channels: ${n.audio.numberOfChannels}. Must be a positive integer.`);if(!Number.isInteger(n.audio.sampleRate)||n.audio.sampleRate<=0)throw new TypeError(`Invalid audio sample rate: ${n.audio.sampleRate}. Must be a positive integer.`)}if(n.firstTimestampBehavior&&!$b.includes(n.firstTimestampBehavior))throw new TypeError(`Invalid first timestamp behavior: ${n.firstTimestampBehavior}`);if(typeof n.fastStart=="object"){if(n.video){if(n.fastStart.expectedVideoChunks===void 0)throw new TypeError("'fastStart' is an object but is missing property 'expectedVideoChunks'.");if(!Number.isInteger(n.fastStart.expectedVideoChunks)||n.fastStart.expectedVideoChunks<0)throw new TypeError("'expectedVideoChunks' must be a non-negative integer.")}if(n.audio){if(n.fastStart.expectedAudioChunks===void 0)throw new TypeError("'fastStart' is an object but is missing property 'expectedAudioChunks'.");if(!Number.isInteger(n.fastStart.expectedAudioChunks)||n.fastStart.expectedAudioChunks<0)throw new TypeError("'expectedAudioChunks' must be a non-negative integer.")}}else if(![!1,"in-memory","fragmented"].includes(n.fastStart))throw new TypeError("'fastStart' option must be false, 'in-memory', 'fragmented' or an object.");if(n.minFragmentDuration!==void 0&&(!Number.isFinite(n.minFragmentDuration)||n.minFragmentDuration<0))throw new TypeError("'minFragmentDuration' must be a non-negative number.")};Zh=new WeakSet;mp=function(){if(N(this,Oe).writeBox(Gy({holdsAvc:N(this,Ce).video?.codec==="avc",fragmented:N(this,Ce).fastStart==="fragmented"})),qt(this,Jo,N(this,Oe).pos),N(this,Ce).fastStart==="in-memory")qt(this,Sn,qh(!1));else if(N(this,Ce).fastStart!=="fragmented"){if(typeof N(this,Ce).fastStart=="object"){let n=Qe(this,hu,gp).call(this);N(this,Oe).seek(N(this,Oe).pos+n)}qt(this,Sn,qh(!0)),N(this,Oe).writeBox(N(this,Sn))}Qe(this,or,pa).call(this)};hu=new WeakSet;gp=function(){if(typeof N(this,Ce).fastStart!="object")return;let n=0,e=[N(this,Ce).fastStart.expectedVideoChunks,N(this,Ce).fastStart.expectedAudioChunks];for(let t of e)t&&(n+=8*Math.ceil(2/3*t),n+=4*t,n+=12*Math.ceil(2/3*t),n+=4*t,n+=8*t);return n+=4096,n};Qh=new WeakSet;yp=function(){if(N(this,Ce).video&&qt(this,en,{id:1,info:{type:"video",codec:N(this,Ce).video.codec,width:N(this,Ce).video.width,height:N(this,Ce).video.height,rotation:N(this,Ce).video.rotation??0,decoderConfig:null},timescale:N(this,Ce).video.frameRate??57600,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),N(this,Ce).audio&&(qt(this,Xt,{id:N(this,Ce).video?2:1,info:{type:"audio",codec:N(this,Ce).audio.codec,numberOfChannels:N(this,Ce).audio.numberOfChannels,sampleRate:N(this,Ce).audio.sampleRate,decoderConfig:null},timescale:N(this,Ce).audio.sampleRate,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),N(this,Ce).audio.codec==="aac")){let n=Qe(this,uu,bp).call(this,2,N(this,Ce).audio.sampleRate,N(this,Ce).audio.numberOfChannels);N(this,Xt).info.decoderConfig={codec:N(this,Ce).audio.codec,description:n,numberOfChannels:N(this,Ce).audio.numberOfChannels,sampleRate:N(this,Ce).audio.sampleRate}}};uu=new WeakSet;bp=function(n,e,t){let s=[96e3,88200,64e3,48e3,44100,32e3,24e3,22050,16e3,12e3,11025,8e3,7350].indexOf(e),r=t,a="";a+=n.toString(2).padStart(5,"0"),a+=s.toString(2).padStart(4,"0"),s===15&&(a+=e.toString(2).padStart(24,"0")),a+=r.toString(2).padStart(4,"0");let o=Math.ceil(a.length/8)*8;a=a.padEnd(o,"0");let l=new Uint8Array(a.length/8);for(let c=0;c<a.length;c+=8)l[c/8]=parseInt(a.slice(c,c+8),2);return l};$o=new WeakSet;eu=function(n,e,t,i,s,r,a){let o=i/1e6,l=(i-(a??0))/1e6,c=s/1e6,h=Qe(this,du,vp).call(this,o,l,n);return o=h.presentationTimestamp,l=h.decodeTimestamp,r?.decoderConfig&&(n.info.decoderConfig===null?n.info.decoderConfig=r.decoderConfig:Object.assign(n.info.decoderConfig,r.decoderConfig)),{presentationTimestamp:o,decodeTimestamp:l,duration:c,data:e,size:e.byteLength,type:t,timescaleUnitsToNextSample:di(c,n.timescale)}};hi=new WeakSet;Si=function(n,e){N(this,Ce).fastStart!=="fragmented"&&n.samples.push(e);let t=di(e.presentationTimestamp-e.decodeTimestamp,n.timescale);if(n.lastTimescaleUnits!==null){let s=di(e.decodeTimestamp,n.timescale,!1),r=Math.round(s-n.lastTimescaleUnits);if(n.lastTimescaleUnits+=r,n.lastSample.timescaleUnitsToNextSample=r,N(this,Ce).fastStart!=="fragmented"){let a=qo(n.timeToSampleTable);a.sampleCount===1?(a.sampleDelta=r,a.sampleCount++):a.sampleDelta===r?a.sampleCount++:(a.sampleCount--,n.timeToSampleTable.push({sampleCount:2,sampleDelta:r}));let o=qo(n.compositionTimeOffsetTable);o.sampleCompositionTimeOffset===t?o.sampleCount++:n.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:t})}}else n.lastTimescaleUnits=0,N(this,Ce).fastStart!=="fragmented"&&(n.timeToSampleTable.push({sampleCount:1,sampleDelta:di(e.duration,n.timescale)}),n.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:t}));n.lastSample=e;let i=!1;if(!n.currentChunk)i=!0;else{let s=e.presentationTimestamp-n.currentChunk.startTimestamp;if(N(this,Ce).fastStart==="fragmented"){let r=N(this,en)??N(this,Xt),a=N(this,Ce).minFragmentDuration??1;n===r&&e.type==="key"&&s>=a&&(i=!0,Qe(this,Zo,fu).call(this))}else i=s>=.5}i&&(n.currentChunk&&Qe(this,da,Ko).call(this,n),n.currentChunk={startTimestamp:e.presentationTimestamp,samples:[]}),n.currentChunk.samples.push(e)};du=new WeakSet;vp=function(n,e,t){let i=N(this,Ce).firstTimestampBehavior==="strict",s=t.lastDecodeTimestamp===-1;if(i&&s&&e!==0)throw new Error(`The first chunk for your media track must have a timestamp of 0 (received DTS=${e}).Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of thedocument, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
`);if(N(this,Ce).firstTimestampBehavior==="offset"||N(this,Ce).firstTimestampBehavior==="cross-track-offset"){t.firstDecodeTimestamp===void 0&&(t.firstDecodeTimestamp=e);let a;N(this,Ce).firstTimestampBehavior==="offset"?a=t.firstDecodeTimestamp:a=Math.min(N(this,en)?.firstDecodeTimestamp??1/0,N(this,Xt)?.firstDecodeTimestamp??1/0),e-=a,n-=a}if(e<t.lastDecodeTimestamp)throw new Error(`Timestamps must be monotonically increasing (DTS went from ${t.lastDecodeTimestamp*1e6} to ${e*1e6}).`);return t.lastDecodeTimestamp=e,{presentationTimestamp:n,decodeTimestamp:e}};da=new WeakSet;Ko=function(n){if(N(this,Ce).fastStart==="fragmented")throw new Error("Can't finalize individual chunks if 'fastStart' is set to 'fragmented'.");if(n.currentChunk){if(n.finalizedChunks.push(n.currentChunk),N(this,rr).push(n.currentChunk),(n.compactlyCodedChunkTable.length===0||qo(n.compactlyCodedChunkTable).samplesPerChunk!==n.currentChunk.samples.length)&&n.compactlyCodedChunkTable.push({firstChunk:n.finalizedChunks.length,samplesPerChunk:n.currentChunk.samples.length}),N(this,Ce).fastStart==="in-memory"){n.currentChunk.offset=0;return}n.currentChunk.offset=N(this,Oe).pos;for(let e of n.currentChunk.samples)N(this,Oe).write(e.data),e.data=null;Qe(this,or,pa).call(this)}};Zo=new WeakSet;fu=function(n=!0){if(N(this,Ce).fastStart!=="fragmented")throw new Error("Can't finalize a fragment unless 'fastStart' is set to 'fragmented'.");let e=[N(this,en),N(this,Xt)].filter(o=>o&&o.currentChunk);if(e.length===0)return;let t=zy(this,cu)._++;if(t===1){let o=Vo(e,N(this,sr),!0);N(this,Oe).writeBox(o)}let i=N(this,Oe).pos,s=sp(t,e);N(this,Oe).writeBox(s);{let o=qh(!1),l=0;for(let h of e)for(let u of h.currentChunk.samples)l+=u.size;let c=N(this,Oe).measureBox(o)+l;c>=2**32&&(o.largeSize=!0,c=N(this,Oe).measureBox(o)+l),o.size=c,N(this,Oe).writeBox(o)}for(let o of e){o.currentChunk.offset=N(this,Oe).pos,o.currentChunk.moofOffset=i;for(let l of o.currentChunk.samples)N(this,Oe).write(l.data),l.data=null}let r=N(this,Oe).pos;N(this,Oe).seek(N(this,Oe).offsets.get(s));let a=sp(t,e);N(this,Oe).writeBox(a),N(this,Oe).seek(r);for(let o of e)o.finalizedChunks.push(o.currentChunk),N(this,rr).push(o.currentChunk),o.currentChunk=null;n&&Qe(this,or,pa).call(this)};or=new WeakSet;pa=function(){N(this,Oe)instanceof lu&&N(this,Oe).flush()};Xo=new WeakSet;tu=function(){if(N(this,ua))throw new Error("Cannot add new video or audio chunks after the file has been finalized.")};function yu(n){return(n.lap??0)-(n.shifted?1:0)}var pu=class{set;frame;laps;top;invariant;frames;stores=new Map;box=null;constructor(e,t,i,s=1){this.set=e,this.frame=t,this.frames=i,this.laps=e.periodic?s:1,this.top=this.laps-1,this.invariant=i.requirements(e.def.frame,t).channels.size===0}storeLap(e){return this.invariant?0:e}lapKey(e){return this.invariant?e<this.top?"joined":"top":String(e)}store(e){let t=this.storeLap(e),i=this.stores.get(t);return i===void 0&&(i={buf:new Float64Array(3*this.set.samples),done:new Uint8Array(this.set.tracks),all:!1},this.stores.set(t,i)),i}ensure(e,t){let i=Xb(t),s=this.store(i);if(s.done[e]===1)return s.buf;let r=this.set,a=this.storeLap(i),o=r.start(e);for(let l=0;l<r.count(e);l++)s.buf.set(this.frames.transform(r.position(e,l),r.def.frame,this.frame,{set:r,track:e,sample:l,shifted:!1,lap:a}),3*(o+l));return s.done[e]=1,s.buf}lapPositions(e){let t=this.store(e);if(!t.all){for(let i=0;i<this.set.tracks;i++)this.ensure(i,e);t.all=!0}return t.buf}get positions(){return this.lapPositions(0)}get shifted(){return this.set.periodic?this.lapPositions(-1):null}track(e,t){let i=this.ensure(e,t),s=this.set.start(e);return i.subarray(3*s,3*(s+this.set.count(e)))}gpuSample(e,t,i,s,r=0){let a=i===this.set.count(e)-1&&t<this.top,o=this.ensure(e,a?t+1:t),l=3*(this.set.start(e)+(a?0:i));s[r]=o[l],s[r+1]=o[l+1],s[r+2]=o[l+2]}bounds(e){if(e===void 0&&this.box!==null)return this.box;let t=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let i=0;i<=(this.invariant?0:this.top);i++){let s=e===void 0?this.lapPositions(i):this.track(e,i);for(let r=0;r<s.length;r+=3)for(let a=0;a<3;a++){let o=s[r+a];o<t[a]&&(t[a]=o),o>t[a+3]&&(t[a+3]=o)}}return e===void 0&&(this.box=t),t}vertex(e,t,i,s=0){let r=this.ensure(e,yu(t)),a=this.set.start(e);if("sample"in t){let c=3*(a+t.sample);i[s]=r[c],i[s+1]=r[c+1],i[s+2]=r[c+2];return}let o=3*(a+t.k),l=t.w;for(let c=0;c<3;c++)i[s+c]=(1-l)*r[o+c]+l*r[o+3+c]}},Xb=n=>n===!0?-1:n===!1?0:n,mu=class{channel;clocks;u;constructor(e,t){this.channel=t,this.clocks=[],this.u=new Float64Array(e.samples);for(let i=0;i<e.tracks;i++){let s=new ci(e,i,t),r=e.start(i);for(let a=0;a<s.m;a++)this.u[r+a]=s.at(a);this.clocks.push(s)}}},el=class{scene;sets;frames;geometries=new Map;readingsBy=new Map;bodyTrails=new Map;data;constructor(e,t){this.scene=e,this.data=t,this.sets=new $i(e,t),this.frames=new Vi(e)}bytes(e){this.data.has(e)||T("2.4",`the data container does not hold view ${JSON.stringify(e)}`);let t=this.data.view(e);return t.dtype!=="uint8"&&T("2.4",`view ${e} holds ${t.dtype}, not the uint8 bytes of an image`),t.data}geometry(e,t){let i=`${e}\0${t}`,s=this.geometries.get(i);return s||(s=new pu(this.sets.get(e),t,this.frames,Pt(this.scene.clock)),this.geometries.set(i,s)),s}hasChannel(e,t){return t===rt||this.sets.get(e).hasChannel(t)}readings(e,t){let i=`${e}\0${t}`,s=this.readingsBy.get(i);return s||(s=new mu(this.sets.get(e),t),this.readingsBy.set(i,s)),s}bodyTrail(e,t,i,s){let r=`${e}\0${t}\0${i}\0${s}`,a=this.bodyTrails.get(r);return a||(a=new gu(this.frames,e,t,this.sets.get(i),s),this.bodyTrails.set(r,a)),a}};function Sp(n,e,t,i,s,r,a=!1){let o=Pt(s),l=an(o*qn(e.reading(s,r)),o),{k:c,w:h}=e.locate(l.u);return a?n.channelAt(i,t,h>=1?c+1:c,!1,l.lap):(1-h)*n.channelAt(i,t,c,!1,l.lap)+h*n.channelAt(i,t,c+1,!1,l.lap)}var tl=n=>n,_p=1<<20,ma=[_p,0,-_p,0],qb=n=>[0,-1,n,2];function nl(n,e,t,i){let s=0,r=n.m;for(;s<r;){let a=s+r>>1,o=i(n.at(a));o>e||t&&o===e?r=a:s=a+1}return s}function Yb(n,e,t,i,s=tl){if(e===t)return{range:[...ma],laps:null,pieces:[]};let r=i-1,a=an(e,i),o=an(t,i),l=Lt(n,a.u,!1,a.lap),c=Lt(n,o.u,!1,o.lap),h=a.lap,u=s(a.u),f=o.lap,d=s(o.u);d===0&&(f--,d=1);let p=[h,u,f,d],y=I=>s(n.at(I)),m=I=>I<r?n.m-2:n.m-1,g=(I,R)=>I<f||I===f&&R<d,b=(I,R)=>I>h||I===h&&u<R,_=nl(n,u,!1,s),v=_<=m(h)?[h,_]:h<r?[h+1,0]:null;v!==null&&!g(v[0],y(v[1]))&&(v=null);let w=Math.min(nl(n,d,!0,s)-1,m(f)),E=w>=0?[f,w]:null;if(E!==null&&!b(E[0],y(E[1]))&&(E=null),v===null||E===null||v[0]>E[0]||v[0]===E[0]&&v[1]>E[1])return{range:p,laps:null,pieces:[[l,c]]};let x=[[l,{sample:v[1],shifted:!1,lap:v[0]}],[{sample:E[1],shifted:!1,lap:E[0]},c]],A=v[0]===E[0]&&v[1]===E[1];return{range:p,laps:A?null:[v[0],E[1]===0?E[0]-1:E[0]],pieces:x}}function wp(n,e){return(n.reveal??"none")!=="none"||Wi(n)||e.mode==="value"&&(n.before==="hidden"||n.after==="hidden")}function Mp(n,e,t=1){return{reveal:n.reveal??"none",fraction:n.trail?.fraction??1,before:n.before,after:n.after,head:Wi(n),periodic:e,laps:e?t:1}}function Ep(n,e,t,i,s=tl){let r=i.laps,a={range:qb(r-1),laps:[0,r-1],pieces:[]};if(n===null)return{hidden:!1,reading:null,loop:null,head:null,...a};let o=qn(n.reading(e,t),i.before,i.after);if(o===null)return{hidden:!0,reading:null,loop:null,head:null,range:[...ma],laps:null,pieces:[]};let l=r*o,c=an(l,r),h=i.head?Lt(n,c.u,!1,c.lap):null;if(i.reveal==="none")return{hidden:!1,reading:o,loop:l,head:h,...a};let u=i.reveal==="grow"?0:l-r*i.fraction;return u<0&&!i.periodic&&(u=0),{hidden:!1,reading:o,loop:l,head:h,...Yb(n,u,l,r,s)}}function il(n){return n.samples-n.tracks}function jb(n,e){return n.start(e)-e}function Tp(n,e){let t=0;for(let i=0;i<n.tracks;i++){let s=n.start(i),r=n.count(i);for(let a=0;a+1<r;a++)e(t++,s+a)}}function bu(n,e,t){let i=new Float32Array(2*t*il(n));return Tp(n,(s,r)=>{for(let a=0;a<t;a++)i[2*t*s+a]=e[t*r+a],i[2*t*s+t+a]=e[t*(r+1)+a]}),i}function vu(n,e,t,i){let s=new Float32Array(2*e*(i-1));for(let r=0;r+1<i;r++)for(let a=0;a<e;a++)s[2*e*r+a]=n[e*(t+r)+a],s[2*e*r+e+a]=n[e*(t+r+1)+a];return s}function Ap(n,e,t,i,s){let r=n.set.count(e),a=n.track(e,t),o=[0,0,0];t<n.top&&n.gpuSample(e,t,r-1,o);for(let l=0;l+1<r;l++,s++)for(let c=0;c<3;c++)i[6*s+c]=a[3*l+c],i[6*s+3+c]=l+2===r&&t<n.top?o[c]:a[3*(l+1)+c]}function Cp(n,e){let t=new Float32Array(6*il(n.set));for(let i=0;i<n.set.tracks;i++)Ap(n,i,e,t,jb(n.set,i));return t}function Rp(n,e,t){let i=new Float32Array(6*(n.set.count(e)-1));return Ap(n,e,t,i,0),i}function Pp(n,e){return("sample"in e?n.at(e.sample):(1-e.w)*n.at(e.k)+e.w*n.at(e.k+1))+yu(e)}function Lp(n,e){let t=new Float32Array(4*il(n));return Tp(n,(i,s)=>{t[4*i]=t[4*i+2]=e[s],t[4*i+1]=t[4*i+3]=e[s+1]}),t}function Ip(n,e,t){let i=new Float32Array(4*(t-1));for(let s=0;s+1<t;s++)i[4*s]=i[4*s+2]=n[e+s],i[4*s+1]=i[4*s+3]=n[e+s+1];return i}function kp(n){let e=new Float32Array(2*il(n)),t=0;for(let i=0;i<n.tracks;i++)for(let s=0;s+1<n.count(i);s++,t++)e[2*t]=e[2*t+1]=i;return e}var gu=class{constructor(e,t,i,s,r){this.frames=e;this.body=t;this.display=i;this.set=s;this.track=r;this.m=s.count(r),this.invariant=e.bodyRequirements(t,i).channels.size===0}frames;body;display;set;track;m;invariant;laps=new Map;lap(e){let t=this.invariant?0:e,i=this.laps.get(t);if(i===void 0){i=new Float64Array(3*this.m);let{set:s,track:r}=this;for(let a=0;a<this.m;a++)i.set(this.frames.bodyPosition(this.body,this.display,{set:s,track:r,sample:a,shifted:!1,lap:t}),3*a);this.laps.set(t,i)}return i}vertex(e,t,i=0){let s=this.lap(yu(e));if("sample"in e){let o=3*e.sample;t[i]=s[o],t[i+1]=s[o+1],t[i+2]=s[o+2];return}let r=3*e.k,a=e.w;for(let o=0;o<3;o++)t[i+o]=(1-a)*s[r+o]+a*s[r+3+o]}polyline(e,t,i,s,r){let a=0,o=u=>{this.vertex(u,r,3*a),a++},l=an(t,s);if(t===i)return o(Lt(e,l.u,!1,l.lap)),a;let c=an(i,s),h=(u,f,d)=>{let p=nl(e,f,!1,tl),y=nl(e,d,!0,tl);y>p&&(r.set(this.lap(u).subarray(3*p,3*y),3*a),a+=y-p)};if(l.lap===c.lap)return o(Lt(e,l.u,!1,l.lap)),h(l.lap,l.u,c.u),o(Lt(e,c.u,!1,c.lap)),a;o(Lt(e,l.u,!1,l.lap)),h(l.lap,l.u,1);for(let u=l.lap+1;u<c.lap;u++)o(Lt(e,0,!1,u)),h(u,0,1);return o(Lt(e,0,!1,c.lap)),c.u===0||(h(c.lap,0,c.u),o(Lt(e,c.u,!1,c.lap))),a}};function Dp(n,e,t){return(Math.ceil(e*t)+2)*(n+1)+2}var Np="\u2212";function Yi(n,e,t,i=!1){if(!Number.isFinite(n))return Number.isNaN(n)?"NaN":n>0?"\u221E":`${Np}\u221E`;n===0&&(n=0);let s;if(t!==void 0)s=n.toFixed(t),/^-0(\.0*)?$/.test(s)&&(s=s.slice(1));else if(e!==void 0)s=n.toPrecision(e);else if(Number.isInteger(n)&&Math.abs(n)<1e21)s=String(n);else{s=n.toPrecision(6);let[r,a]=s.split("e"),o=r.includes(".")?r.replace(/0+$/,"").replace(/\.$/,""):r;s=a===void 0?o:`${o}e${a}`}return i&&!s.includes("e")&&(s=s.replace(/^(-?)(\d+)/,(r,a,o)=>a+o.replace(/\B(?=(\d{3})+(?!\d))/g,","))),s.replace("e+","e").replace(/-/g,Np)}function qi(n,e){return Yi((e.factor??1)*n+(e.offset??0),e.digits,e.decimals,e.grouping??!1).padStart(e.width??0," ")}function rl(n,e,t){let i=at(n.scene,t.variable);if(i?.kind!=="selector"||i.parameter===void 0)return[];let s=[];for(let r of ia(n,t.domain)){let a=e.get(r);if(!Object.hasOwn(a.def.parameters??{},i.parameter))continue;let o=a.parameter(i.parameter,"2.9");for(let l=0;l<o.length;l++)s.push(o[l])}return s.sort((r,a)=>r-a),s.filter((r,a)=>a===0||r!==s[a-1])}function ga(n,e){let t=-1;for(let i=0;i<n.length;i++)(t<0||Math.abs(n[i]-e)<Math.abs(n[t]-e))&&(t=i);return t}function al(n,e,t,i,s,r){return n+Math.max(0,e)*i*s/(t*r)}function ya(n,e){return(Math.floor(n)%e+e)%e}function ba(n,e){let t=(n%e+e)%e/e;return t<1?t:0}function Op(n,e){let{scene:t,geometry:i,state:s}=n,r=s.panels[n.panel];if(r===void 0||!Object.hasOwn(s.panels,n.panel))return[];let a={scene:t,state:s,panel:r},o=t.views[r.view],l=t.clock.steps,c=(n.frameIndex%l+l)%l,h=n.progress??c/l,u,f=()=>{if(u===void 0){let y=Et(a,o.driver.sets);u=y===null?null:{setId:y,track:er(a,o.driver.member,i.sets.get(y))}}return u},d=[],p=zn(t.clock,h);for(let y of e)if(typeof y=="string")d.push(y);else if("sub"in y)d.push(y.sub);else if("sup"in y)d.push(y.sup);else if("steps"in y){let m="";for(let[g,b]of y.steps)g<=p&&(m=String(b));d.push(m)}else if("keys"in y)d.push(qi(Js(y.keys,p),y));else if("clock"in y)if(y.clock==="index"||y.clock==="steps"){let m=y.clock==="index"?c:l,g=y.factor!==void 0||y.offset!==void 0||y.decimals!==void 0||y.grouping;d.push(g?qi(m,y):String(m).padStart(y.width??0," "))}else y.clock==="time"?d.push(qi(p,y)):d.push(qi(t.clock.mode==="fraction"?h:So(t.clock,h),y));else if("var"in y){let m=Gi(a,y.var),g=at(t,y.var);typeof m=="number"?d.push(qi(m,y)):typeof m=="boolean"?d.push(m?"on":"off"):g?.kind==="choice"&&g.labels!==void 0?d.push(g.labels[g.values.indexOf(m)]??m):d.push(m)}else{let m=f();if(m===null){d.push("\u2014");continue}let g=i.sets.get(m.setId);if("member"in y)d.push(qi(g.parameter(y.member,"2.9")[m.track],y));else if("attr"in y)d.push(qi(g.attr(y.attr),y));else if("channel"in y){let b=i.readings(m.setId,s.clock.channel).clocks[m.track];g.hasChannel(y.channel)||T("2.9",`track set ${m.setId} lacks channel ${JSON.stringify(y.channel)}`);let _=g.def.channels?.[y.channel]?.interp==="hold";d.push(qi(Sp(g,b,m.track,y.channel,t.clock,h,_),y))}}return d}function Fp(n){let e=[""],t=[];if(n.forEach((a,o)=>{typeof a=="string"?e[e.length-1]+=a:(t.push(o),e.push(""))}),t.length===0)return null;let i=a=>a.every(o=>o.trim()===""),s=[];for(let a=0;a<t.length;a++){let o=e[a].split(","),l=e[a+1].split(",");if((a>0?o.length<2||!i(o.slice(1,-1)):!i(o.slice(0,-1)))||a===t.length-1&&!i(l.slice(1)))return null;let c=o[o.length-1].replace(/\s*[=:]\s*$/,"").trim();if(c==="")return null;let h=n[t[a]],u="clock"in h||"keys"in h?5:"channel"in h?(h.digits??6)+5:null;s.push({label:c,part:t[a],unit:l[0].trim(),width:u})}let r=a=>"attr"in n[a.part];return[...s.filter(a=>!r(a)),...s.filter(r)]}var sl=class{times=[];reset(){this.times.length=0}note(e){this.times.push(e);let t=0;for(;t<this.times.length&&this.times[t]<e-1e3;)t++;t>0&&this.times.splice(0,t)}report(e){let t=this.times;if(t.length<2||e-t[0]<900||e-t[t.length-1]>1e3)return null;let i=[];for(let o=1;o<t.length;o++)i.push(t[o]-t[o-1]);let s=[...i].sort((o,l)=>o-l),r=s[Math.floor(s.length/10)],a=i.filter(o=>o>1.5*r).length;return{drawn:t.length,late:a,refresh:r}}};function xu(n){return n===null?"\u2013\u2013 fps":`${n.drawn} fps`}function _u(n){if(n===null)return"Frames drawn per second during playback";let e=Math.round(1e3/n.refresh);return`${n.drawn} frames drawn in the last second, ${n.late} late, on a display refreshing about ${e} times a second`}function Up(n,e,t){let i=e?10:1;switch(n){case" ":case"k":case"K":return{kind:"toggle"};case"ArrowRight":case".":return{kind:"step",by:i};case"ArrowLeft":case",":return{kind:"step",by:-i};case">":return{kind:"step",by:10};case"<":return{kind:"step",by:-10};case"Home":return{kind:"seek",frame:0};case"f":case"F":return{kind:"fit"};case"ArrowUp":return{kind:"slider",by:i};case"ArrowDown":return{kind:"slider",by:-i}}return/^[0-9]$/.test(n)?{kind:"seek",frame:Math.round(t*Number(n)/10)%t}:null}function Bp(n,e,t){let i=t.startsWith("Arrow")||t==="Home"||t==="End"||t==="PageUp"||t==="PageDown";return n==="BUTTON"||n==="INPUT"&&e==="checkbox"?t===" "||t==="Enter":n==="INPUT"&&e==="range"?i:n==="SELECT"?i||t==="Enter"||t.length===1:n==="TEXTAREA"||n==="INPUT"}function Jb(n,e){let t=new Set([e]);for(let i of Object.values(n.track_sets)){let s=i?.parameters;if(s===void 0||!Object.hasOwn(s,e))continue;let r=s[e],a=r.label??e;t.add(r.unit?`${a}, ${r.unit}`:a)}return t}function zp(n,e,t){for(let i of e.layers){if(i.kind!=="track"||i.color===void 0||typeof i.color=="string"||!("parameter"in i.color))continue;let s=i.color.parameter;if(Jb(n,s).has(t))for(let[r,a]of Object.entries(n.variables??{})){if(a===void 0||a.kind!=="selector"||a.scope==="panel"||a.by==="index"||a.parameter!==s)continue;let o=(n.controls??[]).find(l=>l.kind==="slider"&&l.variable===r);return{variable:r,label:o?.label??r,domain:o?.domain??i.sets}}}return null}function Hp(n,e,t,i){return ga(n,e+Math.min(1,Math.max(0,i))*(t-e))}var wu={frames:2e3,seconds:90},ol=[24,30,60],Vp=[1,2,3,4];function ll(n,e,t,i=1,s=0,r=Qr){let a=Math.round(t*r*e/i),o=l=>al(s,l,e,n,i,r);return{count:a,duration:a/e,index:l=>ya(o(l),n),progress:l=>ba(o(l),n)}}function cl(n,e,t=wu){return n>=1?n>t.frames?`${n} frames is more than the ${t.frames} an export may have: lower the frame rate or the loops, or raise the speed`:n/e>t.seconds?`${(n/e).toFixed(1)} s is longer than the ${t.seconds} s an export may last: lower the loops or raise the speed`:null:`the frame count of the export is ${n}, not a count of at least one`}function Gp(n,e,t=Qr){for(let i of[...ol].reverse())if(cl(ll(n,i,1,e,0,t).count,i)===null)return i;return null}function va(n,e={w:1280,h:720},t=1,i=30){if(n==="720p")return{width:1280,height:720,pixelRatio:1};if(n==="1080p")return{width:1920,height:1080,pixelRatio:1.5};let s=l=>Math.max(2,2*Math.floor(l/2)),r=s(e.w),a=s(e.h),o={width:r,height:a,pixelRatio:1};for(let l=8*Math.min(2,Math.max(1,Math.round(t)));l>=1;l--){let c=l/8;if(o={width:s(r*c),height:s(a*c),pixelRatio:c},$p(o.width,o.height,i))break}return o}var Kb=[[30,1620,40500],[31,3600,108e3],[32,5120,216e3],[40,8192,245760],[42,8704,522240],[50,22080,589824],[51,36864,983040],[52,36864,2073600]],Wp=4096;function $p(n,e,t){return n%2===0&&e%2===0&&Math.max(n,e)<=Wp&&Xp(n,e,t)!==null}function Xp(n,e,t,i="high"){let s=Math.ceil(n/16),r=Math.ceil(e/16),a=s*r,o=Kb.find(([,c,h])=>a<=c&&a*t<=h&&Math.max(s,r)<=Math.sqrt(8*c));return o===void 0?null:`avc1.${{high:"6400",main:"4d40",baseline:"42e0"}[i]}${o[0].toString(16).padStart(2,"0")}`}function Zb(n,e,t){return Math.round(Math.min(4e7,Math.max(1e6,.08*n*e*t)))}var Su=class{muxer;constructor(e,t,i){if(e%2!==0||t%2!==0)throw new Error(`an MP4 export needs even sides, not ${e} by ${t}`);this.muxer=new xp({target:new ru,video:{codec:"avc",width:e,height:t,frameRate:i},fastStart:"in-memory"})}add(e,t,i,s,r){let a=r?.decoderConfig;if(a!==void 0){if(!a.codec.startsWith("avc1."))throw new Error(`an MP4 export holds H.264 only, not ${a.codec}`);if(a.description===void 0)throw new Error('the H.264 encoder did not give an avcC record. Configure it with avc: { format: "avc" }')}this.muxer.addVideoChunkRaw(e,t?"key":"delta",i,s,r)}finish(){return this.muxer.finalize(),new Uint8Array(this.muxer.target.buffer)}};function Mu(){return typeof VideoEncoder>"u"||typeof VideoFrame>"u"?"this browser does not have a WebCodecs video encoder":null}async function Qb(n,e,t,i,s="no-preference"){if(!$p(n,e,t))throw new Error(`${n} by ${e} at ${t} fps is past H.264, which needs even sides, at most ${Wp} pixels a side, and a frame size and rate within level 5.2`);for(let r of["high","main","baseline"]){let o={codec:Xp(n,e,t,r),width:n,height:e,bitrate:i,framerate:t,hardwareAcceleration:s,avc:{format:"avc"}};if((await VideoEncoder.isConfigSupported(o)).supported===!0)return o}throw new Error(`this browser does not have an H.264 encoder for ${n} by ${e} at ${t} fps, and an MP4 that QuickTime opens needs H.264`)}async function qp(n,e={}){let t=Mu();if(t!==null)throw new Error(t);let i=e.fps??30,s=typeof e.size=="object"?e.size:va(e.size??"720p",n.stage,typeof window>"u"?1:window.devicePixelRatio,i),r=n.clock,a=ll(r.steps,i,e.loops??1,e.speed??1,e.start??0,Rt(r)),o=cl(a.count,i,e.limits);if(o!==null)throw new Error(o);let l=e.keyFrameInterval??2*i;if(!(l>=1))throw new Error(`the key-frame interval is ${l}, not a count of at least one frame`);let{width:c,height:h,pixelRatio:u}=s,f=e.signal,d=()=>new DOMException("the export was canceled","AbortError");if(f?.aborted)throw d();let p=await Qb(c,h,i,e.bitrate??Zb(c,h,i),e.hardwareAcceleration);e.onConfig?.(p);let y=new Su(c,h,i),m=null,g=new VideoEncoder({output:(_,v)=>{let w=new Uint8Array(_.byteLength);_.copyTo(w);try{y.add(w,_.type==="key",_.timestamp,_.duration??Math.round(1e6/i),v)}catch(E){m??=E}},error:_=>m=_});g.configure(p);let b=null;try{b=await n.open(c/u,h/u,u);let _=document.createElement("canvas");_.width=c,_.height=h;let v=_.getContext("2d",{alpha:!1});for(let w=0;w<a.count;w++){if(f?.aborted)throw d();if(m!==null)throw m;v.setTransform(u,0,0,u,0,0),b.draw(v,a.index(w),a.progress(w)),e.onFrame?.(_,w);let E=new VideoFrame(_,{timestamp:Math.round(w*1e6/i),duration:Math.round(1e6/i)});for(g.encode(E,{keyFrame:w%l===0}),E.close(),e.onProgress?.(w+1,a.count);g.encodeQueueSize>4;)await new Promise(x=>setTimeout(x,1));await new Promise(x=>setTimeout(x,0))}if(await g.flush(),m!==null)throw m}finally{g.state!=="closed"&&g.close(),b?.close()}return new Blob([y.finish()],{type:"video/mp4"})}var Yp="http://www.w3.org/2000/svg",jp=(n,e)=>`M${n-1} ${e}a1 1 0 1 0 2 0a1 1 0 1 0-2 0`,ev={house:{grid:24,fill:!1,d:["M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8","M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"]},chevronDown:{grid:24,fill:!1,d:["m6 9 6 6 6-6"]},grip:{grid:24,fill:!1,d:[[5,12,19].map(n=>jp(9,n)).join(""),[5,12,19].map(n=>jp(15,n)).join("")]},x:{grid:24,fill:!1,d:["M18 6 6 18","m6 6 12 12"]},rotateCcw:{grid:24,fill:!1,d:["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","M3 3v5h5"]},plus:{grid:24,fill:!1,d:["M5 12h14","M12 5v14"]},download:{grid:24,fill:!1,d:["M12 15V3","M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","m7 10 5 5 5-5"]},play:{grid:16,fill:!0,d:["M5 3.5v9l7.5-4.5z"]},pause:{grid:16,fill:!0,d:["M4.5 3H7v10H4.5zM9 3h2.5v10H9z"]}};function jn(n,e){let t=ev[n],i=document.createElementNS(Yp,"svg"),s={viewBox:`0 0 ${t.grid} ${t.grid}`,"aria-hidden":"true",focusable:"false",fill:t.fill?"currentColor":"none",stroke:t.fill?"none":"currentColor"};t.fill||Object.assign(s,{"stroke-width":"2","stroke-linecap":"round","stroke-linejoin":"round"});for(let[r,a]of Object.entries(s))i.setAttribute(r,a);i.setAttribute("class",e===void 0?`i i-${n}`:`i i-${n} ${e}`);for(let r of t.d){let a=document.createElementNS(Yp,"path");a.setAttribute("d",r),i.appendChild(a)}return i}function hl(n){return n?n.kind==="panel"?[n.id]:[...hl(n.a),...hl(n.b)]:[]}function xa(n,e,t,i){if(n.kind==="panel"){if(n.id!==e)return n;if(i==="centre")return{kind:"panel",id:t};let s={kind:"panel",id:t},r=i==="left"||i==="right"?"row":"col",a=i==="left"||i==="top";return{kind:"split",dir:r,ratio:.5,a:a?s:n,b:a?n:s}}return{...n,a:xa(n.a,e,t,i),b:xa(n.b,e,t,i)}}function _a(n,e){if(n.kind==="panel")return n.id===e?null:n;let t=_a(n.a,e),i=_a(n.b,e);return t?i?{...n,a:t,b:i}:t:i}function ul(n,e=1){return n.kind==="panel"?[{id:n.id,area:e}]:[...ul(n.a,e*n.ratio),...ul(n.b,e*(1-n.ratio))]}function Jp(n,e,t,i){let s=n/Math.max(1,t),r=e/Math.max(1,i),a=.28,o=[{zone:"left",v:s},{zone:"right",v:1-s},{zone:"top",v:r},{zone:"bottom",v:1-r}].sort((l,c)=>l.v-c.v)[0];return o.v<a?o.zone:"centre"}var $n={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},ti={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Am=0,Zu=1,Cm=2;var Xa=1,Rm=2,Fr=3,ls=0,gn=1,In=2,ki=0,Ur=1,Qu=2,ed=3,td=4,Pm=5;var Vs=100,Lm=101,Im=102,km=103,Dm=104,Nm=200,Om=201,Fm=202,Um=203,nd=204,id=205,Bm=206,zm=207,Hm=208,Vm=209,Gm=210,Wm=211,$m=212,Xm=213,qm=214,Fl=0,Ul=1,Bl=2,Sr=3,zl=4,Hl=5,Vl=6,Gl=7,sd=0,Ym=1,jm=2,gi=0,rd=1,ad=2,od=3,ld=4,cd=5,hd=6,ud=7;var dd=300,Gs=301,Br=302,pc=303,mc=304,Wl=1e3,mi=1001,$l=1002,vt=1003,Jm=1004;var qa=1005;var pn=1006,gc=1007;var Di=1008;var kn=1009,fd=1010,pd=1011,zr=1012,yc=1013,ni=1014,Dn=1015,ii=1016,bc=1017,vc=1018,Ws=1020,md=35902,gd=35899,yd=1021,bd=1022,Nn=1023,Pi=1026,Ni=1027,vd=1028,xc=1029,cs=1030,_c=1031;var Sc=1033,Ya=33776,ja=33777,Ja=33778,Ka=33779,wc=35840,Mc=35841,Ec=35842,Tc=35843,Ac=36196,Cc=37492,Rc=37496,Pc=37488,Lc=37489,Za=37490,Ic=37491,kc=37808,Dc=37809,Nc=37810,Oc=37811,Fc=37812,Uc=37813,Bc=37814,zc=37815,Hc=37816,Vc=37817,Gc=37818,Wc=37819,$c=37820,Xc=37821,qc=36492,Yc=36494,jc=36495,Jc=36283,Kc=36284,Qa=36285,Zc=36286;var Pa=2300,Xl=2301,Ol=2302,$u=2303,Xu=2400,qu=2401,Yu=2402;var Km=3200;var xd=0,Zm=1,si="",Tn="srgb",Os="srgb-linear",La="linear",ot="srgb";var Ns=7680,_d=7681;var Sd=517;var Qm=519,eg=512,tg=513,ng=514,wd=515,ig=516,sg=517,Md=518,Ed=519,Td=35044,yi=35048;var eo="300 es",Wn=2e3,Ia=2001;function tv(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function nv(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function ka(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function rg(){let n=ka("canvas");return n.style.display="block",n}var Kp={},wr=null;function Da(...n){let e="THREE."+n.shift();wr?wr("log",e,...n):console.log(e,...n)}function ag(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function Le(...n){n=ag(n);let e="THREE."+n.shift();if(wr)wr("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Fe(...n){n=ag(n);let e="THREE."+n.shift();if(wr)wr("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function Aa(...n){let e=n.join(" ");e in Kp||(Kp[e]=!0,Le(...n))}function og(n,e,t){return new Promise(function(i,s){function r(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:s();break;case n.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:i()}}setTimeout(r,t)})}var lg={[Fl]:Fl,[Bl]:Vl,[zl]:zl,[Sr]:Hl,[Ul]:Ul,[Vl]:Bl,[Gl]:Gl,[Hl]:Sr},Qn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let s=i[e];if(s!==void 0){let r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let s=i.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}},on=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Zp=1234567,Ca=Math.PI/180,Mr=180/Math.PI;function hs(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(on[n&255]+on[n>>8&255]+on[n>>16&255]+on[n>>24&255]+"-"+on[e&255]+on[e>>8&255]+"-"+on[e>>16&15|64]+on[e>>24&255]+"-"+on[t&63|128]+on[t>>8&255]+"-"+on[t>>16&255]+on[t>>24&255]+on[i&255]+on[i>>8&255]+on[i>>16&255]+on[i>>24&255]).toLowerCase()}function je(n,e,t){return Math.max(e,Math.min(t,n))}function Ad(n,e){return(n%e+e)%e}function iv(n,e,t,i,s){return i+(n-e)*(s-i)/(t-e)}function sv(n,e,t){return n!==e?(t-n)/(e-n):0}function Ra(n,e,t){return(1-t)*n+t*e}function rv(n,e,t,i){return Ra(n,e,1-Math.exp(-t*i))}function av(n,e=1){return e-Math.abs(Ad(n,e*2)-e)}function ov(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function lv(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function cv(n,e){return n+Math.floor(Math.random()*(e-n+1))}function hv(n,e){return n+Math.random()*(e-n)}function uv(n){return n*(.5-Math.random())}function dv(n){n!==void 0&&(Zp=n);let e=Zp+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function fv(n){return n*Ca}function pv(n){return n*Mr}function mv(n){return n>0&&Number.isInteger(n)&&2**Math.round(Math.log2(n))===n}function gv(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function Cd(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function yv(n,e,t,i,s){let r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+i)/2),h=a((e+i)/2),u=r((e-i)/2),f=a((e-i)/2),d=r((i-e)/2),p=a((i-e)/2);switch(s){case"XYX":n.set(o*h,l*u,l*f,o*c);break;case"YZY":n.set(l*f,o*h,l*u,o*c);break;case"ZXZ":n.set(l*u,l*f,o*h,o*c);break;case"XZX":n.set(o*h,l*p,l*d,o*c);break;case"YXY":n.set(l*d,o*h,l*p,o*c);break;case"ZYZ":n.set(l*p,l*d,o*h,o*c);break;default:Le("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Qc(n){switch(n.constructor){case Uint32Array:return 4294967295;case Uint16Array:return 65535;case Uint8Array:case Uint8ClampedArray:return 255;case Int32Array:return 2147483647;case Int16Array:return 32767;case Int8Array:return 127;default:return}}function Rd(n,e){if(e.constructor===Float32Array)return n;let t=Qc(e);if(t===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.max(n/t,-1)}function Pd(n,e){if(e.constructor===Float32Array)return n;let t=Qc(e);if(t===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.round(n*t)}var Ld={DEG2RAD:Ca,RAD2DEG:Mr,generateUUID:hs,clamp:je,euclideanModulo:Ad,mapLinear:iv,inverseLerp:sv,lerp:Ra,damp:rv,pingpong:av,smoothstep:ov,smootherstep:lv,randInt:cv,randFloat:hv,randFloatSpread:uv,seededRandom:dv,degToRad:fv,radToDeg:pv,isPowerOfTwo:mv,ceilPowerOfTwo:gv,floorPowerOfTwo:Cd,setQuaternionFromProperEuler:yv,normalize:Pd,denormalize:Rd},Pe=class{static{this.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6],this.y=s[1]*t+s[4]*i+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*i-a*s+e.x,this.y=r*s+a*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Cn=class{constructor(e=0,t=0,i=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=s}static slerpFlat(e,t,i,s,r,a,o){let l=i[s+0],c=i[s+1],h=i[s+2],u=i[s+3],f=r[a+0],d=r[a+1],p=r[a+2],y=r[a+3];if(u!==y||l!==f||c!==d||h!==p){let m=l*f+c*d+h*p+u*y;m<0&&(f=-f,d=-d,p=-p,y=-y,m=-m);let g=1-o;if(m<.9995){let b=Math.acos(m),_=Math.sin(b);g=Math.sin(g*b)/_,o=Math.sin(o*b)/_,l=l*g+f*o,c=c*g+d*o,h=h*g+p*o,u=u*g+y*o}else{l=l*g+f*o,c=c*g+d*o,h=h*g+p*o,u=u*g+y*o;let b=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=b,c*=b,h*=b,u*=b}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,i,s,r,a){let o=i[s],l=i[s+1],c=i[s+2],h=i[s+3],u=r[a],f=r[a+1],d=r[a+2],p=r[a+3];return e[t]=o*p+h*u+l*d-c*f,e[t+1]=l*p+h*f+c*u-o*d,e[t+2]=c*p+h*d+o*f-l*u,e[t+3]=h*p-o*u-l*f-c*d,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,s){return this._x=e,this._y=t,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(i/2),h=o(s/2),u=o(r/2),f=l(i/2),d=l(s/2),p=l(r/2);switch(a){case"XYZ":this._x=f*h*u+c*d*p,this._y=c*d*u-f*h*p,this._z=c*h*p+f*d*u,this._w=c*h*u-f*d*p;break;case"YXZ":this._x=f*h*u+c*d*p,this._y=c*d*u-f*h*p,this._z=c*h*p-f*d*u,this._w=c*h*u+f*d*p;break;case"ZXY":this._x=f*h*u-c*d*p,this._y=c*d*u+f*h*p,this._z=c*h*p+f*d*u,this._w=c*h*u-f*d*p;break;case"ZYX":this._x=f*h*u-c*d*p,this._y=c*d*u+f*h*p,this._z=c*h*p-f*d*u,this._w=c*h*u+f*d*p;break;case"YZX":this._x=f*h*u+c*d*p,this._y=c*d*u+f*h*p,this._z=c*h*p-f*d*u,this._w=c*h*u-f*d*p;break;case"XZY":this._x=f*h*u-c*d*p,this._y=c*d*u-f*h*p,this._z=c*h*p+f*d*u,this._w=c*h*u+f*d*p;break;default:Le("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,s=Math.sin(i);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],u=t[10],f=i+o+u;if(f>0){let d=.5/Math.sqrt(f+1);this._w=.25/d,this._x=(h-l)*d,this._y=(r-c)*d,this._z=(a-s)*d}else if(i>o&&i>u){let d=2*Math.sqrt(1+i-o-u);this._w=(h-l)/d,this._x=.25*d,this._y=(s+a)/d,this._z=(r+c)/d}else if(o>u){let d=2*Math.sqrt(1+o-i-u);this._w=(r-c)/d,this._x=(s+a)/d,this._y=.25*d,this._z=(l+h)/d}else{let d=2*Math.sqrt(1+u-i-o);this._w=(a-s)/d,this._x=(r+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(je(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let s=Math.min(1,t/i);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=i*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-i*c,this._z=r*h+a*c+i*l-s*o,this._w=a*h-i*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(i=-i,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},O=class{static{this.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Qp.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Qp.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6]*s,this.y=r[1]*t+r[4]*i+r[7]*s,this.z=r[2]*t+r[5]*i+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*i+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*i+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*i+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*i+r[10]*s+r[14])*a,this}applyQuaternion(e){let t=this.x,i=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*i),h=2*(o*t-r*s),u=2*(r*i-a*t);return this.x=t+l*c+a*u-o*h,this.y=i+l*h+o*c-r*u,this.z=s+l*u+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*i+r[8]*s,this.y=r[1]*t+r[5]*i+r[9]*s,this.z=r[2]*t+r[6]*i+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-i*l,this.z=i*o-s*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Eu.copy(this).projectOnVector(e),this.sub(Eu)}reflect(e){return this.sub(Eu.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,s=this.z-e.z;return t*t+i*i+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let s=Math.sin(t)*e;return this.x=s*Math.sin(i),this.y=Math.cos(t)*e,this.z=s*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Eu=new O,Qp=new Cn,Ue=class{static{this.prototype.isMatrix3=!0}constructor(e,t,i,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c)}set(e,t,i,s,r,a,o,l,c){let h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=i,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],h=i[4],u=i[7],f=i[2],d=i[5],p=i[8],y=s[0],m=s[3],g=s[6],b=s[1],_=s[4],v=s[7],w=s[2],E=s[5],x=s[8];return r[0]=a*y+o*b+l*w,r[3]=a*m+o*_+l*E,r[6]=a*g+o*v+l*x,r[1]=c*y+h*b+u*w,r[4]=c*m+h*_+u*E,r[7]=c*g+h*v+u*x,r[2]=f*y+d*b+p*w,r[5]=f*m+d*_+p*E,r[8]=f*g+d*v+p*x,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-i*r*h+i*o*l+s*r*c-s*a*l}invert(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=h*a-o*c,f=o*l-h*r,d=c*r-a*l,p=t*u+i*f+s*d;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let y=1/p;return e[0]=u*y,e[1]=(s*c-h*i)*y,e[2]=(o*i-s*a)*y,e[3]=f*y,e[4]=(h*t-s*l)*y,e[5]=(s*r-o*t)*y,e[6]=d*y,e[7]=(i*l-c*t)*y,e[8]=(a*t-i*r)*y,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return Aa("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Tu.makeScale(e,t)),this}rotate(e){return Aa("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Tu.makeRotation(-e)),this}translate(e,t){return Aa("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Tu.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let s=0;s<9;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Tu=new Ue,em=new Ue().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),tm=new Ue().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function bv(){let n={enabled:!0,workingColorSpace:Os,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===ot&&(s.r=Ri(s.r),s.g=Ri(s.g),s.b=Ri(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ot&&(s.r=_r(s.r),s.g=_r(s.g),s.b=_r(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===si?La:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[a].fromXYZ).multiply(this.spaces[r].toXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[Os]:{primaries:e,whitePoint:i,transfer:La,toXYZ:em,fromXYZ:tm,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Tn},outputColorSpaceConfig:{drawingBufferColorSpace:Tn}},[Tn]:{primaries:e,whitePoint:i,transfer:ot,toXYZ:em,fromXYZ:tm,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Tn}}}),n}var Ye=bv();function Ri(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function _r(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var lr,ql=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{lr===void 0&&(lr=ka("canvas")),lr.width=e.width,lr.height=e.height;let s=lr.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),i=lr}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=ka("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let s=i.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Ri(r[a]/255)*255;return i.putImageData(s,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Ri(t[i]/255)*255):t[i]=Ri(t[i]);return{data:t,width:e.width,height:e.height}}else return Le("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},vv=0,Er=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:vv++}),this.uuid=hs(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width||0,t.height||0,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Au(s[a].image)):r.push(Au(s[a]))}else r=Au(s);i.url=r}return t||(e.images[this.uuid]=i),i}};function Au(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?ql.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(Le("Texture: Unable to serialize Texture."),{})}var xv=0,Cu=new O,tn=class n extends Qn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=mi,s=mi,r=pn,a=Di,o=Nn,l=kn,c=n.DEFAULT_ANISOTROPY,h=si){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:xv++}),this.uuid=hs(),this.name="",this.source=new Er(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Pe(0,0),this.repeat=new Pe(1,1),this.center=new Pe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ue,this.generateMipmaps=!0,this.mipmapsAutoUpdate=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.isPMREMTexture=!1,this.normalized=!1}get width(){return this.source.getSize(Cu).x}get height(){return this.source.getSize(Cu).y}get depth(){return this.source.getSize(Cu).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.mipmapsAutoUpdate=e.mipmapsAutoUpdate,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isPMREMTexture=e.isPMREMTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){Le(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){Le(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,mipmapsAutoUpdate:this.mipmapsAutoUpdate,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==dd)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Wl:e.x=e.x-Math.floor(e.x);break;case mi:e.x=e.x<0?0:1;break;case $l:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Wl:e.y=e.y-Math.floor(e.y);break;case mi:e.y=e.y<0?0:1;break;case $l:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};tn.DEFAULT_IMAGE=null;tn.DEFAULT_MAPPING=dd;tn.DEFAULT_ANISOTROPY=1;var lt=class{static{this.prototype.isVector4=!0}constructor(e=0,t=0,i=0,s=1){this.x=e,this.y=t,this.z=i,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,s){return this.x=e,this.y=t,this.z=i,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*i+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*i+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*i+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,s,r,l=e.elements,c=l[0],h=l[4],u=l[8],f=l[1],d=l[5],p=l[9],y=l[2],m=l[6],g=l[10];if(Math.abs(h-f)<.01&&Math.abs(u-y)<.01&&Math.abs(p-m)<.01){if(Math.abs(h+f)<.1&&Math.abs(u+y)<.1&&Math.abs(p+m)<.1&&Math.abs(c+d+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let _=(c+1)/2,v=(d+1)/2,w=(g+1)/2,E=(h+f)/4,x=(u+y)/4,A=(p+m)/4;return _>v&&_>w?_<.01?(i=0,s=.707106781,r=.707106781):(i=Math.sqrt(_),s=E/i,r=x/i):v>w?v<.01?(i=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),i=E/s,r=A/s):w<.01?(i=.707106781,s=.707106781,r=0):(r=Math.sqrt(w),i=x/r,s=A/r),this.set(i,s,r,t),this}let b=Math.sqrt((m-p)*(m-p)+(u-y)*(u-y)+(f-h)*(f-h));return Math.abs(b)<.001&&(b=1),this.x=(m-p)/b,this.y=(u-y)/b,this.z=(f-h)/b,this.w=Math.acos((c+d+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this.w=je(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this.w=je(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Yl=class extends Qn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:pn,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new lt(0,0,e,t),this.scissorTest=!1,this.viewport=new lt(0,0,e,t),this.textures=[];let s=i.count;for(let r=0;r<s;r++)this.textures[r]=new tn({width:e,height:t,depth:i.depth}),this.textures[r].isRenderTargetTexture=!0,this.textures[r].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveColorBuffer=i.resolveColorBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.storeMultisampledColorBuffer=i.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=i.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=i.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:pn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.mipmapsAutoUpdate!==void 0&&(t.mipmapsAutoUpdate=e.mipmapsAutoUpdate),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let s=Object.assign({},e.textures[t].image);this.textures[t].source=new Er(s)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;else this.depthTexture=null;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},mn=class extends Yl{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},Na=class extends tn{constructor(e=null,t=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=vt,this.minFilter=vt,this.wrapR=mi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var jl=class extends tn{constructor(e=null,t=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=vt,this.minFilter=vt,this.wrapR=mi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var ft=class n{static{this.prototype.isMatrix4=!0}constructor(e,t,i,s,r,a,o,l,c,h,u,f,d,p,y,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c,h,u,f,d,p,y,m)}set(e,t,i,s,r,a,o,l,c,h,u,f,d,p,y,m){let g=this.elements;return g[0]=e,g[4]=t,g[8]=i,g[12]=s,g[1]=r,g[5]=a,g[9]=o,g[13]=l,g[2]=c,g[6]=h,g[10]=u,g[14]=f,g[3]=d,g[7]=p,g[11]=y,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,s=1/cr.setFromMatrixColumn(e,0).length(),r=1/cr.setFromMatrixColumn(e,1).length(),a=1/cr.setFromMatrixColumn(e,2).length();return t[0]=i[0]*s,t[1]=i[1]*s,t[2]=i[2]*s,t[3]=0,t[4]=i[4]*r,t[5]=i[5]*r,t[6]=i[6]*r,t[7]=0,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,s=e.y,r=e.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){let f=a*h,d=a*u,p=o*h,y=o*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=d+p*c,t[5]=f-y*c,t[9]=-o*l,t[2]=y-f*c,t[6]=p+d*c,t[10]=a*l}else if(e.order==="YXZ"){let f=l*h,d=l*u,p=c*h,y=c*u;t[0]=f+y*o,t[4]=p*o-d,t[8]=a*c,t[1]=a*u,t[5]=a*h,t[9]=-o,t[2]=d*o-p,t[6]=y+f*o,t[10]=a*l}else if(e.order==="ZXY"){let f=l*h,d=l*u,p=c*h,y=c*u;t[0]=f-y*o,t[4]=-a*u,t[8]=p+d*o,t[1]=d+p*o,t[5]=a*h,t[9]=y-f*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){let f=a*h,d=a*u,p=o*h,y=o*u;t[0]=l*h,t[4]=p*c-d,t[8]=f*c+y,t[1]=l*u,t[5]=y*c+f,t[9]=d*c-p,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){let f=a*l,d=a*c,p=o*l,y=o*c;t[0]=l*h,t[4]=y-f*u,t[8]=p*u+d,t[1]=u,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=d*u+p,t[10]=f-y*u}else if(e.order==="XZY"){let f=a*l,d=a*c,p=o*l,y=o*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=f*u+y,t[5]=a*h,t[9]=d*u-p,t[2]=p*u-d,t[6]=o*h,t[10]=y*u+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(_v,e,Sv)}lookAt(e,t,i){let s=this.elements;return Mn.subVectors(e,t),Mn.lengthSq()===0&&(Mn.z=1),Mn.normalize(),ji.crossVectors(i,Mn),ji.lengthSq()===0&&(Math.abs(i.z)===1?Mn.x+=1e-4:Mn.z+=1e-4,Mn.normalize(),ji.crossVectors(i,Mn)),ji.normalize(),dl.crossVectors(Mn,ji),s[0]=ji.x,s[4]=dl.x,s[8]=Mn.x,s[1]=ji.y,s[5]=dl.y,s[9]=Mn.y,s[2]=ji.z,s[6]=dl.z,s[10]=Mn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],h=i[1],u=i[5],f=i[9],d=i[13],p=i[2],y=i[6],m=i[10],g=i[14],b=i[3],_=i[7],v=i[11],w=i[15],E=s[0],x=s[4],A=s[8],I=s[12],R=s[1],D=s[5],H=s[9],X=s[13],L=s[2],V=s[6],G=s[10],W=s[14],te=s[3],q=s[7],ee=s[11],ne=s[15];return r[0]=a*E+o*R+l*L+c*te,r[4]=a*x+o*D+l*V+c*q,r[8]=a*A+o*H+l*G+c*ee,r[12]=a*I+o*X+l*W+c*ne,r[1]=h*E+u*R+f*L+d*te,r[5]=h*x+u*D+f*V+d*q,r[9]=h*A+u*H+f*G+d*ee,r[13]=h*I+u*X+f*W+d*ne,r[2]=p*E+y*R+m*L+g*te,r[6]=p*x+y*D+m*V+g*q,r[10]=p*A+y*H+m*G+g*ee,r[14]=p*I+y*X+m*W+g*ne,r[3]=b*E+_*R+v*L+w*te,r[7]=b*x+_*D+v*V+w*q,r[11]=b*A+_*H+v*G+w*ee,r[15]=b*I+_*X+v*W+w*ne,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],u=e[6],f=e[10],d=e[14],p=e[3],y=e[7],m=e[11],g=e[15],b=l*d-c*f,_=o*d-c*u,v=o*f-l*u,w=a*d-c*h,E=a*f-l*h,x=a*u-o*h;return t*(y*b-m*_+g*v)-i*(p*b-m*w+g*E)+s*(p*_-y*w+g*x)-r*(p*v-y*E+m*x)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],s=e[8],r=e[1],a=e[5],o=e[9],l=e[2],c=e[6],h=e[10];return t*(a*h-o*c)-i*(r*h-o*l)+s*(r*c-a*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=e[9],f=e[10],d=e[11],p=e[12],y=e[13],m=e[14],g=e[15],b=t*o-i*a,_=t*l-s*a,v=t*c-r*a,w=i*l-s*o,E=i*c-r*o,x=s*c-r*l,A=h*y-u*p,I=h*m-f*p,R=h*g-d*p,D=u*m-f*y,H=u*g-d*y,X=f*g-d*m,L=b*X-_*H+v*D+w*R-E*I+x*A;if(L===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let V=1/L;return e[0]=(o*X-l*H+c*D)*V,e[1]=(s*H-i*X-r*D)*V,e[2]=(y*x-m*E+g*w)*V,e[3]=(f*E-u*x-d*w)*V,e[4]=(l*R-a*X-c*I)*V,e[5]=(t*X-s*R+r*I)*V,e[6]=(m*v-p*x-g*_)*V,e[7]=(h*x-f*v+d*_)*V,e[8]=(a*H-o*R+c*A)*V,e[9]=(i*R-t*H-r*A)*V,e[10]=(p*E-y*v+g*b)*V,e[11]=(u*v-h*E-d*b)*V,e[12]=(o*I-a*D-l*A)*V,e[13]=(t*D-i*I+s*A)*V,e[14]=(y*_-p*w-m*b)*V,e[15]=(h*w-u*_+f*b)*V,this}scale(e){let t=this.elements,i=e.x,s=e.y,r=e.z;return t[0]*=i,t[4]*=s,t[8]*=r,t[1]*=i,t[5]*=s,t[9]*=r,t[2]*=i,t[6]*=s,t[10]*=r,t[3]*=i,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,s))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),s=Math.sin(t),r=1-i,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+i,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+i,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,s,r,a){return this.set(1,i,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,i){let s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,u=o+o,f=r*c,d=r*h,p=r*u,y=a*h,m=a*u,g=o*u,b=l*c,_=l*h,v=l*u,w=i.x,E=i.y,x=i.z;return s[0]=(1-(y+g))*w,s[1]=(d+v)*w,s[2]=(p-_)*w,s[3]=0,s[4]=(d-v)*E,s[5]=(1-(f+g))*E,s[6]=(m+b)*E,s[7]=0,s[8]=(p+_)*x,s[9]=(m-b)*x,s[10]=(1-(f+y))*x,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,i){let s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];let r=this.determinantAffine();if(r===0)return i.set(1,1,1),t.identity(),this;let a=cr.set(s[0],s[1],s[2]).length(),o=cr.set(s[4],s[5],s[6]).length(),l=cr.set(s[8],s[9],s[10]).length();r<0&&(a=-a),Jn.copy(this);let c=1/a,h=1/o,u=1/l;return Jn.elements[0]*=c,Jn.elements[1]*=c,Jn.elements[2]*=c,Jn.elements[4]*=h,Jn.elements[5]*=h,Jn.elements[6]*=h,Jn.elements[8]*=u,Jn.elements[9]*=u,Jn.elements[10]*=u,t.setFromRotationMatrix(Jn),i.x=a,i.y=o,i.z=l,this}makePerspective(e,t,i,s,r,a,o=Wn,l=!1){let c=this.elements,h=2*r/(t-e),u=2*r/(i-s),f=(t+e)/(t-e),d=(i+s)/(i-s),p,y;if(l)p=r/(a-r),y=a*r/(a-r);else if(o===Wn)p=-(a+r)/(a-r),y=-2*a*r/(a-r);else if(o===Ia)p=-a/(a-r),y=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=f,c[12]=0,c[1]=0,c[5]=u,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=y,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,s,r,a,o=Wn,l=!1){let c=this.elements,h=2/(t-e),u=2/(i-s),f=-(t+e)/(t-e),d=-(i+s)/(i-s),p,y;if(l)p=1/(a-r),y=a/(a-r);else if(o===Wn)p=-2/(a-r),y=-(a+r)/(a-r);else if(o===Ia)p=-1/(a-r),y=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=f,c[1]=0,c[5]=u,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=p,c[14]=y,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let s=0;s<16;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},cr=new O,Jn=new ft,_v=new O(0,0,0),Sv=new O(1,1,1),ji=new O,dl=new O,Mn=new O,nm=new ft,im=new Cn,ts=class n{constructor(e=0,t=0,i=0,s=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,s=this._order){return this._x=e,this._y=t,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],f=s[6],d=s[10];switch(t){case"XYZ":this._y=Math.asin(je(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-je(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(je(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-u,d),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-je(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(f,d),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(je(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,d));break;case"XZY":this._z=Math.asin(-je(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,d),this._y=0);break;default:Le("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return nm.makeRotationFromQuaternion(e),this.setFromRotationMatrix(nm,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return im.setFromEuler(this),this.setFromQuaternion(im,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};ts.DEFAULT_ORDER="XYZ";var Oa=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},wv=0,sm=new O,hr=new Cn,Mi=new ft,fl=new O,Sa=new O,Mv=new O,Ev=new Cn,rm=new O(1,0,0),am=new O(0,1,0),om=new O(0,0,1),lm={type:"added"},Tv={type:"removed"},ur={type:"childadded",child:null},Ru={type:"childremoved",child:null},jt=class n extends Qn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:wv++}),this.uuid=hs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new O,t=new ts,i=new Cn,s=new O(1,1,1);function r(){i.setFromEuler(t,!1)}function a(){t.setFromQuaternion(i,void 0,!1)}t._onChange(r),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ft},normalMatrix:{value:new Ue}}),this.matrix=new ft,this.matrixWorld=new ft,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Oa,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale),this.pivot!==null&&this.position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return hr.setFromAxisAngle(e,t),this.quaternion.multiply(hr),this}rotateOnWorldAxis(e,t){return hr.setFromAxisAngle(e,t),this.quaternion.premultiply(hr),this}rotateX(e){return this.rotateOnAxis(rm,e)}rotateY(e){return this.rotateOnAxis(am,e)}rotateZ(e){return this.rotateOnAxis(om,e)}translateOnAxis(e,t){return sm.copy(e).applyQuaternion(this.quaternion),this.position.add(sm.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(rm,e)}translateY(e){return this.translateOnAxis(am,e)}translateZ(e){return this.translateOnAxis(om,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Mi.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?fl.copy(e):fl.set(e,t,i);let s=this.parent;this.updateWorldMatrix(!0,!1),Sa.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Mi.lookAt(Sa,fl,this.up):Mi.lookAt(fl,Sa,this.up),this.quaternion.setFromRotationMatrix(Mi),s&&(Mi.extractRotation(s.matrixWorld),hr.setFromRotationMatrix(Mi),this.quaternion.premultiply(hr.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Fe("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(lm),ur.child=e,this.dispatchEvent(ur),ur.child=null):Fe("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Tv),Ru.child=e,this.dispatchEvent(Ru),Ru.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Mi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Mi.multiply(e.parent.matrixWorld)),e.applyMatrix4(Mi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(lm),ur.child=e,this.dispatchEvent(ur),ur.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,s=this.children.length;i<s;i++){let a=this.children[i].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Sa,e,Mv),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Sa,Ev,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){return!0}traverse(e){e(this);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*i-r[8]*s,r[13]+=i-r[1]*t-r[5]*i-r[9]*s,r[14]+=s-r[2]*t-r[6]*i-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let u=l[c];r(e.shapes,u)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){let o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),u=a(e.shapes),f=a(e.skeletons),d=a(e.animations),p=a(e.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),u.length>0&&(i.shapes=u),f.length>0&&(i.skeletons=f),d.length>0&&(i.animations=d),p.length>0&&(i.nodes=p)}return i.object=s,i;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let s=e.children[i];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};jt.DEFAULT_UP=new O(0,1,0);jt.DEFAULT_MATRIX_AUTO_UPDATE=!0;jt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var fn=class extends jt{constructor(){super(),this.isGroup=!0,this.type="Group"}},Av={type:"move"},Tr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new fn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new fn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new O,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new O),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new fn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new O,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new O,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(let y of e.hand.values()){let m=t.getJointPose(y,i),g=this._getHandJoint(c,y);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.quaternion,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}let h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],f=h.position.distanceTo(u.position),d=.02,p=.005;c.inputState.pinching&&f>d+p?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&f<=d-p&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.quaternion,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,i),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Av)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new fn;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},cg={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ji={h:0,s:0,l:0},pl={h:0,s:0,l:0};function Pu(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var Xe=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Tn){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ye.colorSpaceToWorking(this,t),this}setRGB(e,t,i,s=Ye.workingColorSpace){return this.r=e,this.g=t,this.b=i,Ye.colorSpaceToWorking(this,s),this}setHSL(e,t,i,s=Ye.workingColorSpace){if(e=Ad(e,1),t=je(t,0,1),i=je(i,0,1),t===0)this.r=this.g=this.b=i;else{let r=i<=.5?i*(1+t):i+t-i*t,a=2*i-r;this.r=Pu(a,r,e+1/3),this.g=Pu(a,r,e),this.b=Pu(a,r,e-1/3)}return Ye.colorSpaceToWorking(this,s),this}setStyle(e,t=Tn){function i(r){r!==void 0&&parseFloat(r)<1&&Le("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(100,parseFloat(r[1]))/100,Math.min(100,parseFloat(r[2]))/100,Math.min(100,parseFloat(r[3]))/100,t);break;case"hsl":case"hsla":if(r=/^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Le("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Le("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Tn){let i=cg[e.toLowerCase()];return i!==void 0?this.setHex(i,t):Le("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Ri(e.r),this.g=Ri(e.g),this.b=Ri(e.b),this}copyLinearToSRGB(e){return this.r=_r(e.r),this.g=_r(e.g),this.b=_r(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Tn){return Ye.workingToColorSpace(ln.copy(this),e),Math.round(je(ln.r*255,0,255))*65536+Math.round(je(ln.g*255,0,255))*256+Math.round(je(ln.b*255,0,255))}getHexString(e=Tn){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ye.workingColorSpace){Ye.workingToColorSpace(ln.copy(this),t);let i=ln.r,s=ln.g,r=ln.b,a=Math.max(i,s,r),o=Math.min(i,s,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case i:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-i)/u+2;break;case r:l=(i-s)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Ye.workingColorSpace){return Ye.workingToColorSpace(ln.copy(this),t),e.r=ln.r,e.g=ln.g,e.b=ln.b,e}getStyle(e=Tn){Ye.workingToColorSpace(ln.copy(this),e);let t=ln.r,i=ln.g,s=ln.b;return e!==Tn?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(e,t,i){return this.getHSL(Ji),this.setHSL(Ji.h+e,Ji.s+t,Ji.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(Ji),e.getHSL(pl);let i=Ra(Ji.h,pl.h,t),s=Ra(Ji.s,pl.s,t),r=Ra(Ji.l,pl.l,t);return this.setHSL(i,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*i+r[6]*s,this.g=r[1]*t+r[4]*i+r[7]*s,this.b=r[2]*t+r[5]*i+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},ln=new Xe;Xe.NAMES=cg;var Fs=class extends jt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ts,this.environmentIntensity=1,this.environmentRotation=new ts,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),this.background=e.background!==null?e.background.clone():null,this.environment=e.environment!==null?e.environment.clone():null,this.fog=e.fog!==null?e.fog.clone():null,this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),this.overrideMaterial=e.overrideMaterial!==null?e.overrideMaterial.clone():null,this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Kn=new O,Ei=new O,Lu=new O,Ti=new O,dr=new O,fr=new O,cm=new O,Iu=new O,ku=new O,Du=new O,Nu=new lt,Ou=new lt,Fu=new lt,es=class n{constructor(e=new O,t=new O,i=new O){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,s){s.subVectors(i,t),Kn.subVectors(e,t),s.cross(Kn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,i,s,r){Kn.subVectors(s,t),Ei.subVectors(i,t),Lu.subVectors(e,t);let a=Kn.dot(Kn),o=Kn.dot(Ei),l=Kn.dot(Lu),c=Ei.dot(Ei),h=Ei.dot(Lu),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;let f=1/u,d=(c*l-o*h)*f,p=(a*h-o*l)*f;return r.set(1-d-p,p,d)}static containsPoint(e,t,i,s){return this.getBarycoord(e,t,i,s,Ti)===null?!1:Ti.x>=0&&Ti.y>=0&&Ti.x+Ti.y<=1}static getInterpolation(e,t,i,s,r,a,o,l){return this.getBarycoord(e,t,i,s,Ti)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ti.x),l.addScaledVector(a,Ti.y),l.addScaledVector(o,Ti.z),l)}static getInterpolatedAttribute(e,t,i,s,r,a){return Nu.setScalar(0),Ou.setScalar(0),Fu.setScalar(0),Nu.fromBufferAttribute(e,t),Ou.fromBufferAttribute(e,i),Fu.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Nu,r.x),a.addScaledVector(Ou,r.y),a.addScaledVector(Fu,r.z),a}static isFrontFacing(e,t,i,s){return Kn.subVectors(i,t),Ei.subVectors(e,t),Kn.cross(Ei).dot(s)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,s){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,i,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Kn.subVectors(this.c,this.b),Ei.subVectors(this.a,this.b),Kn.cross(Ei).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,s,r){return n.getInterpolation(e,this.a,this.b,this.c,t,i,s,r)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,s=this.b,r=this.c,a,o;dr.subVectors(s,i),fr.subVectors(r,i),Iu.subVectors(e,i);let l=dr.dot(Iu),c=fr.dot(Iu);if(l<=0&&c<=0)return t.copy(i);ku.subVectors(e,s);let h=dr.dot(ku),u=fr.dot(ku);if(h>=0&&u<=h)return t.copy(s);let f=l*u-h*c;if(f<=0&&l>=0&&h<=0&&l-h>0)return a=l/(l-h),t.copy(i).addScaledVector(dr,a);Du.subVectors(e,r);let d=dr.dot(Du),p=fr.dot(Du);if(p>=0&&d<=p)return t.copy(r);let y=d*c-l*p;if(y<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(i).addScaledVector(fr,o);let m=h*p-d*u;if(m<=0&&u-h>=0&&d-p>=0)return cm.subVectors(r,s),o=(u-h)/(u-h+(d-p)),t.copy(s).addScaledVector(cm,o);let g=1/(m+y+f);return a=y*g,o=f*g,t.copy(i).addScaledVector(dr,a).addScaledVector(fr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},ei=class{constructor(e=new O(1/0,1/0,1/0),t=new O(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(Zn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(Zn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=Zn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let r=i.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0&&e.isBatchedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Zn):Zn.fromBufferAttribute(r,a),Zn.applyMatrix4(e.matrixWorld),this.expandByPoint(Zn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ml.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),ml.copy(i.boundingBox)),ml.applyMatrix4(e.matrixWorld),this.union(ml)}let s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Zn),Zn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(wa),gl.subVectors(this.max,wa),pr.subVectors(e.a,wa),mr.subVectors(e.b,wa),gr.subVectors(e.c,wa),Ki.subVectors(mr,pr),Zi.subVectors(gr,mr),Ls.subVectors(pr,gr);let t=[0,-Ki.z,Ki.y,0,-Zi.z,Zi.y,0,-Ls.z,Ls.y,Ki.z,0,-Ki.x,Zi.z,0,-Zi.x,Ls.z,0,-Ls.x,-Ki.y,Ki.x,0,-Zi.y,Zi.x,0,-Ls.y,Ls.x,0];return!Uu(t,pr,mr,gr,gl)||(t=[1,0,0,0,1,0,0,0,1],!Uu(t,pr,mr,gr,gl))?!1:(yl.crossVectors(Ki,Zi),t=[yl.x,yl.y,yl.z],Uu(t,pr,mr,gr,gl))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Zn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Zn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ai[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ai[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ai[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ai[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ai[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ai[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ai[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ai[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ai),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Ai=[new O,new O,new O,new O,new O,new O,new O,new O],Zn=new O,ml=new ei,pr=new O,mr=new O,gr=new O,Ki=new O,Zi=new O,Ls=new O,wa=new O,gl=new O,yl=new O,Is=new O;function Uu(n,e,t,i,s){for(let r=0,a=n.length-3;r<=a;r+=3){Is.fromArray(n,r);let o=s.x*Math.abs(Is.x)+s.y*Math.abs(Is.y)+s.z*Math.abs(Is.z),l=e.dot(Is),c=t.dot(Is),h=i.dot(Is);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var kt=new O,bl=new Pe,Cv=0,Dt=class extends Qn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Cv++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Td,this.updateRanges=[],this.gpuType=Dn,this.version=0,this._normalizationScale=e!==void 0?Qc(e):void 0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this._normalizationScale=e._normalizationScale,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[i+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)bl.fromBufferAttribute(this,t),bl.applyMatrix3(e),this.setXY(t,bl.x,bl.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)kt.fromBufferAttribute(this,t),kt.applyMatrix3(e),this.setXYZ(t,kt.x,kt.y,kt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)kt.fromBufferAttribute(this,t),kt.applyMatrix4(e),this.setXYZ(t,kt.x,kt.y,kt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)kt.fromBufferAttribute(this,t),kt.applyNormalMatrix(e),this.setXYZ(t,kt.x,kt.y,kt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)kt.fromBufferAttribute(this,t),kt.transformDirection(e),this.setXYZ(t,kt.x,kt.y,kt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=this._denormalize(i)),i}setComponent(e,t,i){return this.normalized&&(i=this._normalize(i)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=this._denormalize(t)),t}setX(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=this._denormalize(t)),t}setY(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=this._denormalize(t)),t}setZ(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=this._denormalize(t)),t}setW(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),i=this._normalize(i)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,s){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s),r=this._normalize(r)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}_denormalize(e){let t=this._normalizationScale;return t!==void 0?Math.max(e/t,-1):Rd(e,this.array)}_normalize(e){let t=this._normalizationScale;return t!==void 0?Math.round(e*t):Pd(e,this.array)}};var Fa=class extends Dt{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var Ua=class extends Dt{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var Ut=class extends Dt{constructor(e,t,i){super(new Float32Array(e),t,i)}},Rv=new ei,Ma=new O,Bu=new O,ns=class{constructor(e=new O,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):Rv.setFromPoints(e).getCenter(i);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,i.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ma.subVectors(e,this.center);let t=Ma.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),s=(i-this.radius)*.5;this.center.addScaledVector(Ma,s/i),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Bu.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ma.copy(e.center).add(Bu)),this.expandByPoint(Ma.copy(e.center).sub(Bu))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Pv=0,Gn=new ft,zu=new jt,yr=new O,En=new ei,Ea=new ei,Yt=new O,xt=class n extends Qn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Pv++}),this.uuid=hs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(tv(e)?Ua:Fa)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let r=new Ue().getNormalMatrix(e);i.applyNormalMatrix(r),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Gn.makeRotationFromQuaternion(e),this.applyMatrix4(Gn),this}rotateX(e){return Gn.makeRotationX(e),this.applyMatrix4(Gn),this}rotateY(e){return Gn.makeRotationY(e),this.applyMatrix4(Gn),this}rotateZ(e){return Gn.makeRotationZ(e),this.applyMatrix4(Gn),this}translate(e,t,i){return Gn.makeTranslation(e,t,i),this.applyMatrix4(Gn),this}scale(e,t,i){return Gn.makeScale(e,t,i),this.applyMatrix4(Gn),this}lookAt(e){return zu.lookAt(e),zu.updateMatrix(),this.applyMatrix4(zu.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(yr).negate(),this.translate(yr.x,yr.y,yr.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let s=0,r=e.length;s<r;s++){let a=e[s];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Ut(i,3))}else{let i=Math.min(e.length,t.count);for(let s=0;s<i;s++){let r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&Le("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ei);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Fe("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new O(-1/0,-1/0,-1/0),new O(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,s=t.length;i<s;i++){let r=t[i];En.setFromBufferAttribute(r),this.morphTargetsRelative?(Yt.addVectors(this.boundingBox.min,En.min),this.boundingBox.expandByPoint(Yt),Yt.addVectors(this.boundingBox.max,En.max),this.boundingBox.expandByPoint(Yt)):(this.boundingBox.expandByPoint(En.min),this.boundingBox.expandByPoint(En.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Fe('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ns);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Fe("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new O,1/0);return}if(e){let i=this.boundingSphere.center;if(En.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){let o=t[r];Ea.setFromBufferAttribute(o),this.morphTargetsRelative?(Yt.addVectors(En.min,Ea.min),En.expandByPoint(Yt),Yt.addVectors(En.max,Ea.max),En.expandByPoint(Yt)):(En.expandByPoint(Ea.min),En.expandByPoint(Ea.max))}En.getCenter(i);let s=0;for(let r=0,a=e.count;r<a;r++)Yt.fromBufferAttribute(e,r),s=Math.max(s,i.distanceToSquared(Yt));if(t)for(let r=0,a=t.length;r<a;r++){let o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Yt.fromBufferAttribute(o,c),l&&(yr.fromBufferAttribute(e,c),Yt.add(yr)),s=Math.max(s,i.distanceToSquared(Yt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Fe('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Fe("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,s=t.normal,r=t.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==i.count)&&(a=new Dt(new Float32Array(4*i.count),4),this.setAttribute("tangent",a));let o=[],l=[],c=new Uint8Array(i.count);for(let I=0;I<i.count;I++)o[I]=new O,l[I]=new O;let h=new O,u=new O,f=new O,d=new Pe,p=new Pe,y=new Pe,m=new O,g=new O;function b(I,R,D){c[I]=c[R]=c[D]=1,h.fromBufferAttribute(i,I),u.fromBufferAttribute(i,R),f.fromBufferAttribute(i,D),d.fromBufferAttribute(r,I),p.fromBufferAttribute(r,R),y.fromBufferAttribute(r,D),u.sub(h),f.sub(h),p.sub(d),y.sub(d);let H=1/(p.x*y.y-y.x*p.y);isFinite(H)&&(m.copy(u).multiplyScalar(y.y).addScaledVector(f,-p.y).multiplyScalar(H),g.copy(f).multiplyScalar(p.x).addScaledVector(u,-y.x).multiplyScalar(H),o[I].add(m),o[R].add(m),o[D].add(m),l[I].add(g),l[R].add(g),l[D].add(g))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let I=0,R=_.length;I<R;++I){let D=_[I],H=D.start,X=D.count;for(let L=H,V=H+X;L<V;L+=3)b(e.getX(L+0),e.getX(L+1),e.getX(L+2))}let v=new O,w=new O,E=new O,x=new O;function A(I){E.fromBufferAttribute(s,I),x.copy(E);let R=o[I];v.copy(R),v.sub(E.multiplyScalar(E.dot(R))).normalize(),w.crossVectors(x,R);let H=w.dot(l[I])<0?-1:1;a.setXYZW(I,v.x,v.y,v.z,H)}for(let I=0,R=i.count;I<R;++I)c[I]&&A(I);this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new Dt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let f=0,d=i.count;f<d;f++)i.setXYZ(f,0,0,0);let s=new O,r=new O,a=new O,o=new O,l=new O,c=new O,h=new O,u=new O;if(e)for(let f=0,d=e.count;f<d;f+=3){let p=e.getX(f+0),y=e.getX(f+1),m=e.getX(f+2);s.fromBufferAttribute(t,p),r.fromBufferAttribute(t,y),a.fromBufferAttribute(t,m),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(i,p),l.fromBufferAttribute(i,y),c.fromBufferAttribute(i,m),o.add(h),l.add(h),c.add(h),i.setXYZ(p,o.x,o.y,o.z),i.setXYZ(y,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let f=0,d=t.count;f<d;f+=3)s.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),a.fromBufferAttribute(t,f+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),i.setXYZ(f+0,h.x,h.y,h.z),i.setXYZ(f+1,h.x,h.y,h.z),i.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Yt.fromBufferAttribute(e,t),Yt.normalize(),e.setXYZ(t,Yt.x,Yt.y,Yt.z)}toNonIndexed(){function e(o,l){let c=o.array,h=o.itemSize,u=o.normalized,f=new c.constructor(l.length*h),d=0,p=0;for(let y=0,m=l.length;y<m;y++){o.isInterleavedBufferAttribute?d=l[y]*o.data.stride+o.offset:d=l[y]*h;for(let g=0;g<h;g++)f[p++]=c[d++]}return new Dt(f,h,u)}if(this.index===null)return Le("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=e(l,i);t.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){let f=c[h],d=e(f,i);l.push(d)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let u=0,f=c.length;u<f;u++){let d=c[u];h.push(d.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let s=e.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(t))}let r=e.morphAttributes;for(let c in r){let h=[],u=r[c];for(let f=0,d=u.length;f<d;f++)h.push(u[f].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let c=0,h=a.length;c<h;c++){let u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},Jl=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Td,this.updateRanges=[],this.version=0,this.uuid=hs()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let s=0,r=this.stride;s<r;s++)this.array[e+s]=t.array[i+s];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={});let t=hm(this.array);e.arrayBuffers[t]===void 0&&(e.arrayBuffers[t]=this.array.slice(0).buffer);let i=new this.array.constructor(e.arrayBuffers[t]),s=new this.constructor(i,this.stride);return s.setUsage(this.usage),s}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={});let t=hm(this.array);e.arrayBuffers[t]===void 0&&(e.arrayBuffers[t]=Array.from(new Uint32Array(this.array.slice(0).buffer)));let i={uuid:this.uuid,buffer:t,type:this.array.constructor.name,stride:this.stride};return i.usage=this.usage,i}};function hm(n){return n.buffer._uuid===void 0&&(n.buffer._uuid=hs()),n.byteOffset===0&&n.byteLength===n.buffer.byteLength?n.buffer._uuid:n.buffer._uuid+":"+n.byteOffset+":"+n.byteLength}var dn=new O,Tt=class n{constructor(e,t,i,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=s,this._normalizationScale=e!==void 0?Qc(e.array):void 0}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)dn.fromBufferAttribute(this,t),dn.applyMatrix4(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)dn.fromBufferAttribute(this,t),dn.applyNormalMatrix(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)dn.fromBufferAttribute(this,t),dn.transformDirection(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=this._denormalize(i)),i}setComponent(e,t,i){return this.normalized&&(i=this._normalize(i)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=this._denormalize(t)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=this._denormalize(t)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=this._denormalize(t)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=this._denormalize(t)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),i=this._normalize(i)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s),r=this._normalize(r)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=s,this.data.array[e+3]=r,this}clone(e){if(e===void 0){Da("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return new Dt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new n(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Da("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}_denormalize(e){let t=this._normalizationScale;return t!==void 0?Math.max(e/t,-1):Rd(e,this.data.array)}_normalize(e){let t=this._normalizationScale;return t!==void 0?Math.round(e*t):Pd(e,this.data.array)}},Hu=new O,Lv=new O,Iv=new Ue,An=class{constructor(e=new O(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,s){return this.normal.set(e,t,i),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let s=Hu.subVectors(i,t).cross(Lv.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let s=e.delta(Hu),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/r;return i===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||Iv.getNormalMatrix(e),s=this.coplanarPoint(Hu).applyMatrix4(e),r=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},kv=0,Li=class extends Qn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:kv++}),this.uuid=hs(),this.name="",this.type="Material",this.blending=Ur,this.side=ls,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=nd,this.blendDst=id,this.blendEquation=Vs,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Xe(0,0,0),this.blendAlpha=0,this.depthFunc=Sr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Qm,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ns,this.stencilZFail=Ns,this.stencilZPass=Ns,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){Le(`Material: parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){Le(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,i.blending=this.blending,i.side=this.side,i.shadowSide=this.shadowSide,i.vertexColors=this.vertexColors,i.opacity=this.opacity,i.transparent=this.transparent,i.blendSrc=this.blendSrc,i.blendDst=this.blendDst,i.blendEquation=this.blendEquation,i.blendSrcAlpha=this.blendSrcAlpha,i.blendDstAlpha=this.blendDstAlpha,i.blendEquationAlpha=this.blendEquationAlpha,i.blendColor=this.blendColor.getHex(),i.blendAlpha=this.blendAlpha,i.depthFunc=this.depthFunc,i.depthTest=this.depthTest,i.depthWrite=this.depthWrite,i.colorWrite=this.colorWrite,i.clipIntersection=this.clipIntersection,i.clipShadows=this.clipShadows,i.stencilWriteMask=this.stencilWriteMask,i.stencilFunc=this.stencilFunc,i.stencilRef=this.stencilRef,i.stencilFuncMask=this.stencilFuncMask,i.stencilFail=this.stencilFail,i.stencilZFail=this.stencilZFail,i.stencilZPass=this.stencilZPass,i.stencilWrite=this.stencilWrite,i.polygonOffset=this.polygonOffset,i.polygonOffsetFactor=this.polygonOffsetFactor,i.polygonOffsetUnits=this.polygonOffsetUnits,i.dithering=this.dithering,i.alphaTest=this.alphaTest,i.alphaHash=this.alphaHash,i.alphaToCoverage=this.alphaToCoverage,i.premultipliedAlpha=this.premultipliedAlpha,i.forceSinglePass=this.forceSinglePass,i.allowOverride=this.allowOverride,i.visible=this.visible,i.toneMapped=this.toneMapped,i.name=this.name,this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.diffuseRoughness!==void 0&&(i.diffuseRoughness=this.diffuseRoughness),this.diffuseRoughnessMap&&this.diffuseRoughnessMap.isTexture&&(i.diffuseRoughnessMap=this.diffuseRoughnessMap.toJSON(e).uuid),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(i.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessMinimum!==void 0&&(i.iridescenceThicknessMinimum=this.iridescenceThicknessMinimum),this.iridescenceThicknessMaximum!==void 0&&(i.iridescenceThicknessMaximum=this.iridescenceThicknessMaximum),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(i.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(i.rotation=this.rotation),this.depthPacking!==void 0&&(i.depthPacking=this.depthPacking),this.linewidth!==void 0&&(i.linewidth=this.linewidth),this.linecap!==void 0&&(i.linecap=this.linecap),this.linejoin!==void 0&&(i.linejoin=this.linejoin),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.wireframe!==void 0&&(i.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(i.flatShading=this.flatShading),this.fog!==void 0&&(i.fog=this.fog),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(t){let r=s(e.textures),a=s(e.images);r.length>0&&(i.textures=r),a.length>0&&(i.images=a)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Xe().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.diffuseRoughness!==void 0&&(this.diffuseRoughness=e.diffuseRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessMinimum!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessMinimum),e.iridescenceThicknessMaximum!==void 0&&(this.iridescenceThicknessMaximum=e.iridescenceThicknessMaximum),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessRange[0],this.iridescenceThicknessMaximum=e.iridescenceThicknessRange[1]),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(i=>new An().fromJSON(i))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Pe().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Pe().fromArray(e.clearcoatNormalScale)),e.diffuseRoughnessMap!==void 0&&(this.diffuseRoughnessMap=t[e.diffuseRoughnessMap]||null),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let s=t.length;i=new Array(s);for(let r=0;r!==s;++r)i[r]=t[r].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Ci=new O,Vu=new O,vl=new O,xl=new O,is=class{constructor(e=new O,t=new O(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ci)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Ci.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ci.copy(this.origin).addScaledVector(this.direction,t),Ci.distanceToSquared(e))}distanceSqToSegment(e,t,i,s){Vu.copy(e).add(t).multiplyScalar(.5),vl.copy(t).sub(e).normalize(),xl.copy(this.origin).sub(Vu);let r=e.distanceTo(t)*.5,a=-this.direction.dot(vl),o=xl.dot(this.direction),l=-xl.dot(vl),c=xl.lengthSq(),h=Math.abs(1-a*a),u,f,d,p;if(h>0)if(u=a*l-o,f=a*o-l,p=r*h,u>=0)if(f>=-p)if(f<=p){let y=1/h;u*=y,f*=y,d=u*(u+a*f+2*o)+f*(a*u+f+2*l)+c}else f=r,u=Math.max(0,-(a*f+o)),d=-u*u+f*(f+2*l)+c;else f=-r,u=Math.max(0,-(a*f+o)),d=-u*u+f*(f+2*l)+c;else f<=-p?(u=Math.max(0,-(-a*r+o)),f=u>0?-r:Math.min(Math.max(-r,-l),r),d=-u*u+f*(f+2*l)+c):f<=p?(u=0,f=Math.min(Math.max(-r,-l),r),d=f*(f+2*l)+c):(u=Math.max(0,-(a*r+o)),f=u>0?r:Math.min(Math.max(-r,-l),r),d=-u*u+f*(f+2*l)+c);else f=a>0?-r:r,u=Math.max(0,-(a*f+o)),d=-u*u+f*(f+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(Vu).addScaledVector(vl,f),d}intersectSphere(e,t){if(e.radius<0)return null;Ci.subVectors(e.center,this.origin);let i=Ci.dot(this.direction),s=Ci.dot(Ci)-i*i,r=e.radius*e.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,s,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,f=this.origin;return c>=0?(i=(e.min.x-f.x)*c,s=(e.max.x-f.x)*c):(i=(e.max.x-f.x)*c,s=(e.min.x-f.x)*c),h>=0?(r=(e.min.y-f.y)*h,a=(e.max.y-f.y)*h):(r=(e.max.y-f.y)*h,a=(e.min.y-f.y)*h),i>a||r>s||((r>i||isNaN(i))&&(i=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(e.min.z-f.z)*u,l=(e.max.z-f.z)*u):(o=(e.max.z-f.z)*u,l=(e.min.z-f.z)*u),i>l||o>s)||((o>i||i!==i)&&(i=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,t)}intersectsBox(e){return this.intersectBox(e,Ci)!==null}intersectTriangle(e,t,i,s,r){let a=this.origin,o=this.direction,l=o.x,c=o.y,h=o.z,u=e.x-a.x,f=e.y-a.y,d=e.z-a.z,p=t.x-a.x,y=t.y-a.y,m=t.z-a.z,g=i.x-a.x,b=i.y-a.y,_=i.z-a.z,v=Math.abs(l),w=Math.abs(c),E=Math.abs(h),x,A,I,R,D,H,X,L,V,G,W,te;if(v>=w&&v>=E?(I=l,H=u,V=p,te=g,l>=0?(x=c,A=h,R=f,D=d,X=y,L=m,G=b,W=_):(x=h,A=c,R=d,D=f,X=m,L=y,G=_,W=b)):w>=E?(I=c,H=f,V=y,te=b,c>=0?(x=h,A=l,R=d,D=u,X=m,L=p,G=_,W=g):(x=l,A=h,R=u,D=d,X=p,L=m,G=g,W=_)):(I=h,H=d,V=m,te=_,h>=0?(x=l,A=c,R=u,D=f,X=p,L=y,G=g,W=b):(x=c,A=l,R=f,D=u,X=y,L=p,G=b,W=g)),I===0)return null;let q=x/I,ee=A/I,ne=1/I,be=R-q*H,De=D-ee*H,J=X-q*V,me=L-ee*V,we=G-q*te,Ie=W-ee*te,ve=we*me-Ie*J,He=be*Ie-De*we,At=J*De-me*be;if(s){if(ve<0||He<0||At<0)return null}else if((ve<0||He<0||At<0)&&(ve>0||He>0||At>0))return null;let Ne=ve+He+At;if(Ne===0)return null;let ct=ne*(ve*H+He*V+At*te);return(Ne>0?ct<0:ct>0)?null:this.at(ct/Ne,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Ar=class extends Li{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Xe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ts,this.combine=sd,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},um=new ft,ks=new is,_l=new ns,dm=new O,Sl=new O,wl=new O,Ml=new O,Gu=new O,El=new O,fm=new O,Tl=new O,Jt=class extends jt{constructor(e=new xt,t=new Ar){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0?this.morphTargetInfluences=e.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,e.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let i=this.geometry,s=i.attributes.position,r=i.morphAttributes.position,a=i.morphTargetsRelative;t.fromBufferAttribute(s,e);let o=this.morphTargetInfluences;if(r&&o){El.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],u=r[l];h!==0&&(Gu.fromBufferAttribute(u,e),a?El.addScaledVector(Gu,h):El.addScaledVector(Gu.sub(t),h))}t.add(El)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),_l.copy(i.boundingSphere),_l.applyMatrix4(r),ks.copy(e.ray).recast(e.near),!(_l.containsPoint(ks.origin)===!1&&(ks.intersectSphere(_l,dm)===null||ks.origin.distanceToSquared(dm)>(e.far-e.near)**2))&&(um.copy(r).invert(),ks.copy(e.ray).applyMatrix4(um),!(i.boundingBox!==null&&ks.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,ks)))}_computeIntersections(e,t,i){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,f=r.groups,d=r.drawRange;if(o!==null)if(Array.isArray(a))for(let p=0,y=f.length;p<y;p++){let m=f[p],g=a[m.materialIndex],b=Math.max(m.start,d.start),_=Math.min(o.count,Math.min(m.start+m.count,d.start+d.count));for(let v=b,w=_;v<w;v+=3){let E=o.getX(v),x=o.getX(v+1),A=o.getX(v+2);s=Al(this,g,e,i,c,h,u,E,x,A),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let p=Math.max(0,d.start),y=Math.min(o.count,d.start+d.count);for(let m=p,g=y;m<g;m+=3){let b=o.getX(m),_=o.getX(m+1),v=o.getX(m+2);s=Al(this,a,e,i,c,h,u,b,_,v),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let p=0,y=f.length;p<y;p++){let m=f[p],g=a[m.materialIndex],b=Math.max(m.start,d.start),_=Math.min(l.count,Math.min(m.start+m.count,d.start+d.count));for(let v=b,w=_;v<w;v+=3){let E=v,x=v+1,A=v+2;s=Al(this,g,e,i,c,h,u,E,x,A),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let p=Math.max(0,d.start),y=Math.min(l.count,d.start+d.count);for(let m=p,g=y;m<g;m+=3){let b=m,_=m+1,v=m+2;s=Al(this,a,e,i,c,h,u,b,_,v),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}};function Dv(n,e,t,i,s,r,a,o){let l;if(e.side===gn?l=i.intersectTriangle(a,r,s,!0,o):l=i.intersectTriangle(s,r,a,e.side===ls,o),l===null)return null;Tl.copy(o),Tl.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(Tl);return c<t.near||c>t.far?null:{distance:c,point:Tl.clone(),object:n}}function Al(n,e,t,i,s,r,a,o,l,c){n.getVertexPosition(o,Sl),n.getVertexPosition(l,wl),n.getVertexPosition(c,Ml);let h=Dv(n,e,t,i,Sl,wl,Ml,fm);if(h){let u=new O;es.getBarycoord(fm,Sl,wl,Ml,u),s&&(h.uv=es.getInterpolatedAttribute(s,o,l,c,u,new Pe)),r&&(h.uv1=es.getInterpolatedAttribute(r,o,l,c,u,new Pe)),a&&(h.normal=es.getInterpolatedAttribute(a,o,l,c,u,new O),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let f={a:o,b:l,c,normal:new O,materialIndex:0};es.getNormal(Sl,wl,Ml,f.normal),h.face=f,h.barycoord=u}return h}var Cr=class extends tn{constructor(e=null,t=1,i=1,s,r,a,o,l,c=vt,h=vt,u,f){super(null,a,o,l,c,h,s,r,u,f),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ds=new ns,Nv=new Pe(.5,.5),Cl=new O,Us=class{constructor(e=new An,t=new An,i=new An,s=new An,r=new An,a=new An){this.planes=[e,t,i,s,r,a]}set(e,t,i,s,r,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=Wn,i=!1){let s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],u=r[5],f=r[6],d=r[7],p=r[8],y=r[9],m=r[10],g=r[11],b=r[12],_=r[13],v=r[14],w=r[15];if(s[0].setComponents(c-a,d-h,g-p,w-b).normalize(),s[1].setComponents(c+a,d+h,g+p,w+b).normalize(),s[2].setComponents(c+o,d+u,g+y,w+_).normalize(),s[3].setComponents(c-o,d-u,g-y,w-_).normalize(),i)s[4].setComponents(l,f,m,v).normalize(),s[5].setComponents(c-l,d-f,g-m,w-v).normalize();else if(s[4].setComponents(c-l,d-f,g-m,w-v).normalize(),t===Wn)s[5].setComponents(c+l,d+f,g+m,w+v).normalize();else if(t===Ia)s[5].setComponents(l,f,m,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Ds.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Ds.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Ds)}intersectsSprite(e){Ds.center.set(0,0,0);let t=Nv.distanceTo(e.center);return Ds.radius=.7071067811865476+t,Ds.applyMatrix4(e.matrixWorld),this.intersectsSphere(Ds)}intersectsSphere(e){let t=this.planes,i=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(i)<s)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let s=t[i];if(Cl.x=s.normal.x>0?e.max.x:e.min.x,Cl.y=s.normal.y>0?e.max.y:e.min.y,Cl.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Cl)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},pm=new ft,Kl=class n{constructor(){this.coordinateSystem=Wn,this._frustums=[],this._count=0}setFromArrayCamera(e){let t=e.cameras,i=this._frustums;for(let s=0;s<t.length;s++){let r=t[s];pm.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),i[s]===void 0&&(i[s]=new Us),i[s].setFromProjectionMatrix(pm,r.coordinateSystem,r.reversedDepth)}return this._count=t.length,this}getFrustum(e){return this._frustums[e]}intersectsObject(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsObject(e))return!0;return!1}intersectsSprite(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsSprite(e))return!0;return!1}intersectsSphere(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsSphere(e))return!0;return!1}intersectsBox(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsBox(e))return!0;return!1}containsPoint(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].containsPoint(e))return!0;return!1}copy(e){this.coordinateSystem=e.coordinateSystem;let t=this._frustums,i=e._frustums;for(let s=0;s<e._count;s++)t[s]===void 0&&(t[s]=new Us),t[s].copy(i[s]);return this._count=e._count,this}clone(){return new n().copy(this)}};var Bs=class extends Li{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Xe(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Zl=new O,Ql=new O,mm=new ft,Ta=new is,Rl=new ns,Wu=new O,gm=new O,Rr=class extends jt{constructor(e=new xt,t=new Bs){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0?this.morphTargetInfluences=e.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,e.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[0];for(let s=1,r=t.count;s<r;s++)Zl.fromBufferAttribute(t,s-1),Ql.fromBufferAttribute(t,s),i[s]=i[s-1],i[s]+=Zl.distanceTo(Ql);e.setAttribute("lineDistance",new Ut(i,1))}else Le("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Rl.copy(i.boundingSphere),Rl.applyMatrix4(s),Rl.radius+=r,e.ray.intersectsSphere(Rl)===!1)return;mm.copy(s).invert(),Ta.copy(e.ray).applyMatrix4(mm);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=i.index,f=i.attributes.position;if(h!==null){let d=Math.max(0,a.start),p=Math.min(h.count,a.start+a.count);for(let y=d,m=p-1;y<m;y+=c){let g=h.getX(y),b=h.getX(y+1),_=Pl(this,e,Ta,l,g,b,y);_&&t.push(_)}if(this.isLineLoop){let y=h.getX(p-1),m=h.getX(d),g=Pl(this,e,Ta,l,y,m,p-1);g&&t.push(g)}}else{let d=Math.max(0,a.start),p=Math.min(f.count,a.start+a.count);for(let y=d,m=p-1;y<m;y+=c){let g=Pl(this,e,Ta,l,y,y+1,y);g&&t.push(g)}if(this.isLineLoop){let y=Pl(this,e,Ta,l,p-1,d,p-1);y&&t.push(y)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function Pl(n,e,t,i,s,r,a){let o=n.geometry.attributes.position;if(Zl.fromBufferAttribute(o,s),Ql.fromBufferAttribute(o,r),t.distanceSqToSegment(Zl,Ql,Wu,gm)>i)return;Wu.applyMatrix4(n.matrixWorld);let c=e.ray.origin.distanceTo(Wu);if(!(c<e.near||c>e.far))return{distance:c,point:gm.clone().applyMatrix4(n.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:n}}var ym=new O,bm=new O,Pr=class extends Rr{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[];for(let s=0,r=t.count;s<r;s+=2)ym.fromBufferAttribute(t,s),bm.fromBufferAttribute(t,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+ym.distanceTo(bm);e.setAttribute("lineDistance",new Ut(i,1))}else Le("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var zs=class extends Li{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Xe(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},vm=new ft,ju=new is,Ll=new ns,Il=new O,Lr=class extends jt{constructor(e=new xt,t=new zs){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0?this.morphTargetInfluences=e.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,e.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Ll.copy(i.boundingSphere),Ll.applyMatrix4(s),Ll.radius+=r,e.ray.intersectsSphere(Ll)===!1)return;vm.copy(s).invert(),ju.copy(e.ray).applyMatrix4(vm);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=i.index,u=i.attributes.position;if(c!==null){let f=Math.max(0,a.start),d=Math.min(c.count,a.start+a.count);for(let p=f,y=d;p<y;p++){let m=c.getX(p);Il.fromBufferAttribute(u,m),xm(Il,m,l,s,e,t,this)}}else{let f=Math.max(0,a.start),d=Math.min(u.count,a.start+a.count);for(let p=f,y=d;p<y;p++)Il.fromBufferAttribute(u,p),xm(Il,p,l,s,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function xm(n,e,t,i,s,r,a){let o=ju.distanceSqToPoint(n);if(o<t){let l=new O;ju.closestPointToPoint(n,l),l.applyMatrix4(i);let c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}var Ba=class extends tn{constructor(e=[],t=Gs,i,s,r,a,o,l,c,h){super(e,t,i,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Ir=class extends tn{constructor(e,t,i,s,r,a,o,l,c){super(e,t,i,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Ii=class extends tn{constructor(e,t,i=ni,s,r,a,o=vt,l=vt,c,h=Pi,u=1){if(h!==Pi&&h!==Ni)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let f={width:e,height:t,depth:u};super(f,s,r,a,o,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Er(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},za=class extends Ii{constructor(e,t=ni,i=Gs,s,r,a=vt,o=vt,l,c=Pi){let h={width:e,height:e,depth:1},u=[h,h,h,h,h,h];super(e,e,t,i,s,r,a,o,l,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Ha=class extends tn{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},kr=class n extends xt{constructor(e=1,t=1,i=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],u=[],f=0,d=0;p("z","y","x",-1,-1,i,t,e,a,r,0),p("z","y","x",1,-1,i,t,-e,a,r,1),p("x","z","y",1,1,e,i,t,s,a,2),p("x","z","y",1,-1,e,i,-t,s,a,3),p("x","y","z",1,-1,e,t,i,s,r,4),p("x","y","z",-1,-1,e,t,-i,s,r,5),this.setIndex(l),this.setAttribute("position",new Ut(c,3)),this.setAttribute("normal",new Ut(h,3)),this.setAttribute("uv",new Ut(u,2));function p(y,m,g,b,_,v,w,E,x,A,I){let R=v/x,D=w/A,H=v/2,X=w/2,L=E/2,V=x+1,G=A+1,W=0,te=0,q=new O;for(let ee=0;ee<G;ee++){let ne=ee*D-X;for(let be=0;be<V;be++){let De=be*R-H;q[y]=De*b,q[m]=ne*_,q[g]=L,c.push(q.x,q.y,q.z),q[y]=0,q[m]=0,q[g]=E>0?1:-1,h.push(q.x,q.y,q.z),u.push(be/x),u.push(1-ee/A),W+=1}}for(let ee=0;ee<A;ee++)for(let ne=0;ne<x;ne++){let be=f+ne+V*ee,De=f+ne+V*(ee+1),J=f+(ne+1)+V*(ee+1),me=f+(ne+1)+V*ee;l.push(be,De,me),l.push(De,J,me),te+=6}o.addGroup(d,te,I),d+=te,f+=W}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var Hs=class n extends xt{constructor(e=1,t=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:s};let r=e/2,a=t/2,o=Math.floor(i),l=Math.floor(s),c=o+1,h=l+1,u=e/o,f=t/l,d=[],p=[],y=[],m=[];for(let g=0;g<h;g++){let b=g*f-a;for(let _=0;_<c;_++){let v=_*u-r;p.push(v,-b,0),y.push(0,0,1),m.push(_/o),m.push(1-g/l)}}for(let g=0;g<l;g++)for(let b=0;b<o;b++){let _=b+c*g,v=b+c*(g+1),w=b+1+c*(g+1),E=b+1+c*g;d.push(_,v,E),d.push(v,w,E)}this.setIndex(d),this.setAttribute("position",new Ut(p,3)),this.setAttribute("normal",new Ut(y,3)),this.setAttribute("uv",new Ut(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function $s(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let s=n[t][i];if(_m(s))s.isRenderTargetTexture?(Le("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=s.clone();else if(Array.isArray(s))if(_m(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][i]=r}else e[t][i]=s.slice();else e[t][i]=s}}return e}function hn(n){let e={};for(let t=0;t<n.length;t++){let i=$s(n[t]);for(let s in i)e[s]=i[s]}return e}function _m(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function Ov(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Id(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ye.workingColorSpace}var hg={clone:$s,merge:hn},Fv=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Uv=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Rn=class extends Li{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Fv,this.fragmentShader=Uv,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=$s(e.uniforms),this.uniformsGroups=Ov(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let s=e.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=t[s.value]||null;break;case"c":this.uniforms[i].value=new Xe().setHex(s.value);break;case"v2":this.uniforms[i].value=new Pe().fromArray(s.value);break;case"v3":this.uniforms[i].value=new O().fromArray(s.value);break;case"v4":this.uniforms[i].value=new lt().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Ue().fromArray(s.value);break;case"m4":this.uniforms[i].value=new ft().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},ec=class extends Rn{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var tc=class extends Li{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Km,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},nc=class extends Li{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function br(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}function kl(n){return n!==void 0&&n.inTangents!==void 0&&n.outTangents!==void 0}var ss=class{constructor(e,t,i,s){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,s=t[i],r=t[i-1];n:{e:{let a;t:{i:if(!(e<s)){for(let o=i+2;;){if(s===void 0){if(e<r)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(r=s,s=t[++i],e<s)break e}a=t.length;break t}if(!(e>=r)){let o=t[1];e<o&&(i=2,r=o);for(let l=i-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(s=r,r=t[--i-1],e>=r)break e}a=i,i=0;break t}break n}for(;i<a;){let o=i+a>>>1;e<t[o]?a=o:i=o+1}if(s=t[i],r=t[i-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,r,s)}return this.interpolate_(i,r,e,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,s=this.valueSize,r=e*s;for(let a=0;a!==s;++a)t[a]=i[r+a];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},ic=class extends ss{constructor(e,t,i,s){super(e,t,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Xu,endingEnd:Xu}}intervalChanged_(e,t,i){let s=this.parameterPositions,r=e-2,a=e+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case qu:r=e,o=2*t-i;break;case Yu:r=s.length-2,o=t+s[r]-s[r+1];break;default:r=e,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case qu:a=e,l=2*i-t;break;case Yu:a=1,l=i+s[1]-s[0];break;default:a=e-1,l=t}let c=(i-t)*.5,h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-i),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,f=this._weightPrev,d=this._weightNext,p=(i-t)/(s-t),y=p*p,m=y*p,g=-f*m+2*f*y-f*p,b=(1+f)*m+(-1.5-2*f)*y+(-.5+f)*p+1,_=(-1-d)*m+(1.5+d)*y+.5*p,v=d*m-d*y;for(let w=0;w!==o;++w)r[w]=g*a[h+w]+b*a[c+w]+_*a[l+w]+v*a[u+w];return r}},sc=class extends ss{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(i-t)/(s-t),u=1-h;for(let f=0;f!==o;++f)r[f]=a[c+f]*u+a[l+f]*h;return r}},rc=class extends ss{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e){return this.copySampleValue_(e-1)}},ac=class extends ss{interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this.inTangents,u=this.outTangents;if(!h||!u){let p=(i-t)/(s-t),y=1-p;for(let m=0;m!==o;++m)r[m]=a[c+m]*y+a[l+m]*p;return r}let f=o*2,d=e-1;for(let p=0;p!==o;++p){let y=a[c+p],m=a[l+p],g=d*f+p*2,b=u[g],_=u[g+1],v=e*f+p*2,w=h[v],E=h[v+1],x=zv(i,t,b,w,s);r[p]=ug(x,y,_,E,m)}return r}};function ug(n,e,t,i,s){let r=1-n;return r*r*r*e+3*r*r*n*t+3*r*n*n*i+n*n*n*s}function Bv(n,e,t,i,s){let r=1-n;return 3*r*r*(t-e)+6*r*n*(i-t)+3*n*n*(s-i)}function zv(n,e,t,i,s){let r=(n-e)/(s-e);for(let a=0;a<8;a++){let o=ug(r,e,t,i,s)-n;if(Math.abs(o)<1e-10)break;let l=Bv(r,e,t,i,s);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-o/l))}return r}var Pn=class{constructor(e,t,i,s){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=br(t,this.TimeBufferType),this.values=br(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:br(e.times,Array),values:br(e.values,Array)};let s=e.getInterpolation();s!==e.DefaultInterpolation&&(i.interpolation=s),kl(e.settings)&&(i.settings={inTangents:br(e.settings.inTangents,Array),outTangents:br(e.settings.outTangents,Array)})}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new rc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new sc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ic(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new ac(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Pa:t=this.InterpolantFactoryMethodDiscrete;break;case Xl:t=this.InterpolantFactoryMethodLinear;break;case Ol:t=this.InterpolantFactoryMethodSmooth;break;case $u:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Le("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Pa;case this.InterpolantFactoryMethodLinear:return Xl;case this.InterpolantFactoryMethodSmooth:return Ol;case this.InterpolantFactoryMethodBezier:return $u}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]+=e;kl(this.settings)&&(Sm(this.settings.inTangents,e),Sm(this.settings.outTangents,e))}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]*=e;kl(this.settings)&&(wm(this.settings.inTangents,e),wm(this.settings.outTangents,e))}return this}trim(e,t){let i=this.times,s=i.length,r=0,a=s-1;for(;r!==s&&i[r]<e;)++r;for(;a!==-1&&i[a]>t;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=i.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Fe("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,s=this.values,r=i.length;r===0&&(Fe("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==r;o++){let l=i[o];if(typeof l=="number"&&isNaN(l)){Fe("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Fe("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(s!==void 0&&nv(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){Fe("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===Ol,r=e.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=e[o],h=e[o+1];if(c!==h&&(o!==1||c!==e[0]))if(s)l=!0;else{let u=o*i,f=u-i,d=u+i;for(let p=0;p!==i;++p){let y=t[u+p];if(y!==t[f+p]||y!==t[d+p]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];let u=o*i,f=a*i;for(let d=0;d!==i;++d)t[f+d]=t[u+d]}++a}}if(r>0){e[a]=e[r];for(let o=r*i,l=a*i,c=0;c!==i;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,s=new i(this.name,e,t);return s.createInterpolant=this.createInterpolant,kl(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function Sm(n,e){for(let t=0,i=n.length;t!==i;t+=2)n[t]+=e}function wm(n,e){for(let t=0,i=n.length;t!==i;t+=2)n[t]*=e}Pn.prototype.ValueTypeName="";Pn.prototype.TimeBufferType=Float32Array;Pn.prototype.ValueBufferType=Float32Array;Pn.prototype.DefaultInterpolation=Xl;var rs=class extends Pn{constructor(e,t,i){super(e,t,i)}};rs.prototype.ValueTypeName="bool";rs.prototype.ValueBufferType=Array;rs.prototype.DefaultInterpolation=Pa;rs.prototype.InterpolantFactoryMethodLinear=void 0;rs.prototype.InterpolantFactoryMethodSmooth=void 0;var oc=class extends Pn{constructor(e,t,i,s){super(e,t,i,s)}};oc.prototype.ValueTypeName="color";var lc=class extends Pn{constructor(e,t,i,s){super(e,t,i,s)}};lc.prototype.ValueTypeName="number";var cc=class extends ss{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(i-t)/(s-t),c=e*o;for(let h=c+o;c!==h;c+=4)Cn.slerpFlat(r,0,a,c-o,a,c,l);return r}},Va=class extends Pn{constructor(e,t,i,s){super(e,t,i,s)}InterpolantFactoryMethodLinear(e){return new cc(this.times,this.values,this.getValueSize(),e)}};Va.prototype.ValueTypeName="quaternion";Va.prototype.InterpolantFactoryMethodSmooth=void 0;var as=class extends Pn{constructor(e,t,i){super(e,t,i)}};as.prototype.ValueTypeName="string";as.prototype.ValueBufferType=Array;as.prototype.DefaultInterpolation=Pa;as.prototype.InterpolantFactoryMethodLinear=void 0;as.prototype.InterpolantFactoryMethodSmooth=void 0;var hc=class extends Pn{constructor(e,t,i,s){super(e,t,i,s)}};hc.prototype.ValueTypeName="vector";var uc=class{constructor(e,t,i){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){let u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,f=c.length;u<f;u+=2){let d=c[u],p=c[u+1];if(d.global&&(d.lastIndex=0),d.test(h))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},dg=new uc,dc=class{constructor(e){this.manager=e!==void 0?e:dg,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},this.priority="auto",this.cache="default",typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(s,r){i.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}setPriority(e){return this.priority=e,this}setCache(e){return this.cache=e,this}abort(){return this}};dc.DEFAULT_MATERIAL_NAME="__DEFAULT";var Dl=new O,Nl=new Cn,pi=new O,Ga=class extends jt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ft,this.projectionMatrix=new ft,this.projectionMatrixInverse=new ft,this.coordinateSystem=Wn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Dl,Nl,pi),pi.x===1&&pi.y===1&&pi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Dl,Nl,pi.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(Dl,Nl,pi),pi.x===1&&pi.y===1&&pi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Dl,Nl,pi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Qi=new O,Mm=new Pe,Em=new Pe,cn=class extends Ga{constructor(e=50,t=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Mr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Ca*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Mr*2*Math.atan(Math.tan(Ca*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){Qi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Qi.x,Qi.y).multiplyScalar(-e/Qi.z),Qi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Qi.x,Qi.y).multiplyScalar(-e/Qi.z)}getViewSize(e,t){return this.getViewBounds(e,Mm,Em),t.subVectors(Em,Mm)}setViewOffset(e,t,i,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Ca*.5*this.fov)/this.zoom,i=2*t,s=this.aspect*i,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*i/c,s*=a.width/l,i*=a.height/c}let o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Ln=class extends Ga{constructor(e=-1,t=1,i=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=i-e,a=i+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}};var Dr=class extends xt{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}};var vr=-90,xr=1,Nr=class extends jt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new cn(vr,xr,e,t);s.layers=this.layers,this.add(s);let r=new cn(vr,xr,e,t);r.layers=this.layers,this.add(r);let a=new cn(vr,xr,e,t);a.layers=this.layers,this.add(a);let o=new cn(vr,xr,e,t);o.layers=this.layers,this.add(o);let l=new cn(vr,xr,e,t);l.layers=this.layers,this.add(l);let c=new cn(vr,xr,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,s,r,a,o,l]=t;for(let c of t)this.remove(c);if(e===Wn)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Ia)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,u=e.getRenderTarget(),f=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let y=i.texture.mipmapsAutoUpdate;i.texture.mipmapsAutoUpdate=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(i,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(i,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.mipmapsAutoUpdate=y,e.setRenderTarget(i,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(u,f,d),e.xr.enabled=p,i.texture.needsPMREMUpdate=!0}},fc=class extends cn{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e,this.perCameraFrustumCulled=!1}};var kd="\\[\\]\\.:\\/",Hv=new RegExp("["+kd+"]","g"),Dd="[^"+kd+"]",Vv="[^"+kd.replace("\\.","")+"]",Gv=/((?:WC+[\/:])*)/.source.replace("WC",Dd),Wv=/(WCOD+)?/.source.replace("WCOD",Vv),$v=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Dd),Xv=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Dd),qv=new RegExp("^"+Gv+Wv+$v+Xv+"$"),Yv=["material","materials","bones","map"],Ju=class{constructor(e,t,i){let s=i||gt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,s)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=i.length;s!==r;++s)i[s].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},gt=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Hv,"")}static parseTrackName(e){let t=qv.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=i.nodeName.substring(s+1);Yv.indexOf(r)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=r)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===t||o.uuid===t)return o;let l=i(o.children);if(l)return l}return null},s=i(e.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)e[t++]=i[s]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,s=t.propertyName,r=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Le("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Fe("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Fe("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Fe("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Fe("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Fe("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Fe("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Fe("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let a=e[s];if(a===void 0){let c=t.nodeName;Fe("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!e.geometry){Fe("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Fe("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};gt.Composite=Ju;gt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};gt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};gt.prototype.GetterByBindingType=[gt.prototype._getValue_direct,gt.prototype._getValue_array,gt.prototype._getValue_arrayElement,gt.prototype._getValue_toArray];gt.prototype.SetterByBindingTypeAndVersioning=[[gt.prototype._setValue_direct,gt.prototype._setValue_direct_setNeedsUpdate,gt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[gt.prototype._setValue_array,gt.prototype._setValue_array_setNeedsUpdate,gt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[gt.prototype._setValue_arrayElement,gt.prototype._setValue_arrayElement_setNeedsUpdate,gt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[gt.prototype._setValue_fromArray,gt.prototype._setValue_fromArray_setNeedsUpdate,gt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var R1=new Float32Array(1);var os=class extends Jl{constructor(e,t,i=1){super(e,t),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){let t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){let t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}};var Or=class{constructor(e=1,t=0,i=0){this.radius=e,this.phi=t,this.theta=i}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=je(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(je(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var Ku=class{static{this.prototype.isMatrix2=!0}constructor(e,t,i,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,s){let r=this.elements;return r[0]=e,r[2]=t,r[1]=i,r[3]=s,this}},Tm=new Pe,Wa=class{constructor(e=new Pe(1/0,1/0),t=new Pe(-1/0,-1/0)){this.isBox2=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=Tm.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(e){return this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Tm).distanceTo(e)}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}};var $a=class extends Qn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Nd(n,e,t,i){let s=jv(i);switch(t){case yd:return n*e;case vd:return n*e/s.components*s.byteLength;case xc:return n*e/s.components*s.byteLength;case cs:return n*e*2/s.components*s.byteLength;case _c:return n*e*2/s.components*s.byteLength;case bd:return n*e*3/s.components*s.byteLength;case Nn:return n*e*4/s.components*s.byteLength;case Sc:return n*e*4/s.components*s.byteLength;case Ya:case ja:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Ja:case Ka:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Mc:case Tc:return Math.max(n,16)*Math.max(e,8)/4;case wc:case Ec:return Math.max(n,8)*Math.max(e,8)/2;case Ac:case Cc:case Pc:case Lc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Rc:case Za:case Ic:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case kc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Dc:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case Nc:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case Oc:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Fc:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Uc:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Bc:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case zc:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Hc:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Vc:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case Gc:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Wc:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case $c:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Xc:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case qc:case Yc:case jc:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Jc:case Kc:return Math.ceil(n/4)*Math.ceil(e/4)*8;case Qa:case Zc:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function jv(n){switch(n){case kn:case fd:return{byteLength:1,components:1};case zr:case pd:case ii:return{byteLength:2,components:1};case bc:case vc:return{byteLength:2,components:4};case ni:case yc:case Dn:return{byteLength:4,components:1};case md:case gd:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"187"}}));typeof window<"u"&&(window.__THREE__?Le("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="187");function Dg(){let n=null,e=!1,t=null,i=null;function s(r,a){i=n.requestAnimationFrame(s),t(r,a)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(s),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){n=r}}}function Kv(n){let e=new WeakMap;function t(o,l){let c=o.array,h=o.usage,u=c.byteLength,f=n.createBuffer();n.bindBuffer(l,f),n.bufferData(l,c,h),o.onUploadCallback();let d;if(c instanceof Float32Array)d=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=n.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?d=n.HALF_FLOAT:d=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=n.SHORT;else if(c instanceof Uint32Array)d=n.UNSIGNED_INT;else if(c instanceof Int32Array)d=n.INT;else if(c instanceof Int8Array)d=n.BYTE;else if(c instanceof Uint8Array)d=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function i(o,l,c){let h=l.array,u=l.updateRanges;if(n.bindBuffer(c,o),u.length===0)n.bufferSubData(c,0,h);else{u.sort((d,p)=>d.start-p.start);let f=0;for(let d=1;d<u.length;d++){let p=u[f],y=u[d];y.start<=p.start+p.count+1?p.count=Math.max(p.count,y.start+y.count-p.start):(++f,u[f]=y)}u.length=f+1;for(let d=0,p=u.length;d<p;d++){let y=u[d];n.bufferSubData(c,y.start*h.BYTES_PER_ELEMENT,h,y.start,y.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=e.get(o);l&&(n.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var Zv=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Qv=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,ex=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,tx=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,nx=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ix=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,sx=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,rx=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,ax=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,ox=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,lx=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,cx=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,hx=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,ux=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,dx=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,fx=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,px=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,mx=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,gx=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,yx=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,bx=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,vx=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,xx=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,_x=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Sx=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,wx=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Mx=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Ex=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Tx=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Ax="gl_FragColor = linearToOutputTexel( gl_FragColor );",Cx=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Rx=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Px=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif`,Lx=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Ix=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,kx=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Dx=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Nx=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Ox=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Fx=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Ux=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Bx=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,zx=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Hx=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Vx=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Gx=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * worldNormal, ENVMAP_MAX_LOD );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * reflectVec, roughnessToMip( roughness ) );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureLod( envMap, envMapRotation * retroVec, roughnessToMip( roughness ) );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_PMREM
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,Wx=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,$x=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Xx=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,qx=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Yx=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.045 );
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef USE_DIFFUSE_ROUGHNESS
	float diffuseRoughnessFactor = diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		diffuseRoughnessFactor *= texture2D( diffuseRoughnessMap, vDiffuseRoughnessMapUv ).r;
	#endif
	material.diffuseRoughness = saturate( diffuseRoughnessFactor );
#endif
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.045 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,jx=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float diffuseRoughness;
	#endif
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
#ifdef USE_DIFFUSE_ROUGHNESS
	const float EON_EPSILON = 1e-7;
	float FON_DirectionalAlbedo( const in float mu, const in float roughness, const in float A ) {
		float muComp = 1.0 - mu;
		float gOverPi = muComp * ( 0.0571085289 + muComp * ( 0.491881867 + muComp * ( - 0.332181442 + muComp * 0.0714429953 ) ) );
		return A * ( 1.0 + roughness * gOverPi );
	}
	vec3 BRDF_EON( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 diffuseColor, const in float roughness ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return BRDF_Lambert( rho );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float s = dot( lightDir, viewDir ) - dotNL * dotNV;
		float sOverT = ( s > 0.0 ) ? s / max( max( dotNL, dotNV ), EON_EPSILON ) : s;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		vec3 singleScatter = rho * RECIPROCAL_PI * A * ( 1.0 + roughness * sOverT );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		float albedoV = FON_DirectionalAlbedo( dotNV, roughness, A );
		float albedoL = FON_DirectionalAlbedo( dotNL, roughness, A );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		vec3 multiScatter = rhoMultiScatter * RECIPROCAL_PI
			* max( EON_EPSILON, 1.0 - albedoV )
			* max( EON_EPSILON, 1.0 - albedoL )
			/ max( EON_EPSILON, 1.0 - averageAlbedo );
		return singleScatter + multiScatter;
	}
	vec3 EON_DirectionalAlbedo( const in vec3 diffuseColor, const in float roughness, const in float dotNV ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return rho;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		float directionalAlbedo = FON_DirectionalAlbedo( dotNV, roughness, A );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		return rho * directionalAlbedo + rhoMultiScatter * ( 1.0 - directionalAlbedo );
	}
#endif
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = max( material.clearcoatRoughness, 0.045 );
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = max( material.roughness, 0.045 );
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float alphaT = max( material.alphaT, alpha );
		float V = V_GGX_SmithCorrelated_Anisotropic( alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		vec3 diffuseBRDF = BRDF_EON( directLight.direction, geometryViewDir, geometryNormal, material.diffuseColor, material.diffuseRoughness ) * ( 1.0 - material.metalness );
	#else
		vec3 diffuseBRDF = BRDF_Lambert( material.diffuseContribution );
	#endif
	reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuseAlbedo = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness );
		vec3 diffuse = irradiance * RECIPROCAL_PI * diffuseAlbedo * ( 1.0 - singleScattering - multiScattering );
	#else
		vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#endif
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuse = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness ) * ( 1.0 - totalScatteringDielectric );
	#else
		vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	#endif
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Jx=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_LIGHT_PROBE_GRIDS > 0
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		int probeGrid = - 1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( isInsideLightProbeGrid( probeWorldPos, probeWorldNormal, probesMin[ i ], probesMax[ i ], probesResolution[ i ] ) ) probeGrid = UNROLLED_LOOP_INDEX;
		}
		#pragma unroll_loop_end
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( probeGrid == UNROLLED_LOOP_INDEX ) irradiance += getLightProbeGridIrradiance( probesSH[ i ], probesMin[ i ], probesMax[ i ], probesResolution[ i ], probeWorldPos, probeWorldNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Kx=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_PMREM )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Zx=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Qx=`#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMax[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
bool isInsideLightProbeGrid( vec3 worldPos, vec3 worldNormal, vec3 probesMin, vec3 probesMax, vec3 probesResolution ) {
	vec3 spacing = ( probesMax - probesMin ) / probesResolution;
	vec3 samplePos = worldPos + worldNormal * spacing * 0.5;
	vec3 margin = spacing * 0.01;
	return all( greaterThanEqual( samplePos, probesMin - margin ) ) && all( lessThanEqual( samplePos, probesMax + margin ) );
}
vec3 getLightProbeGridIrradiance( highp sampler3D probesSH, vec3 probesMin, vec3 probesMax, vec3 probesResolution, vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 probeSpacing = gridRange / res;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.5 / res, 1.0 - 0.5 / res );
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,e_=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,t_=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,n_=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,i_=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,s_=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,r_=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,a_=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,o_=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,l_=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,c_=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,h_=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,u_=`#if defined( USE_MORPHCOLORS )
	#if defined( USE_COLOR_ALPHA )
		vColor *= morphTargetBaseInfluence;
	#elif defined( USE_COLOR )
		vColor.rgb *= morphTargetBaseInfluence;
	#endif
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,d_=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,f_=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,p_=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,m_=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,g_=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,y_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,b_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,v_=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,x_=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,__=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,S_=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,w_=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,M_=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,E_=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,T_=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,A_=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,C_=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,R_=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,P_=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,L_=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,I_=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,k_=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				vec2 radius = shadowRadius * texelSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float lightDistance = length( lightToPosition );
			float depthRange = shadowCameraFar - shadowCameraNear;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float depthA = - shadowCameraNear / depthRange - shadowBias;
				float depthB = shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#else
				float depthA = shadowCameraFar / depthRange + shadowBias;
				float depthB = - shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			shadow = 0.0;
			for ( int i = 0; i < 5; i ++ ) {
				vec2 offset = vogelDiskSample( i, 5, phi );
				vec3 direction = bd3D + ( tangent * offset.x + bitangent * offset.y ) * texelSize;
				vec3 absDirection = abs( direction );
				float dp = depthA + depthB / max( max( absDirection.x, absDirection.y ), absDirection.z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow *= 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,D_=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,N_=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,O_=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,F_=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,U_=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,B_=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,z_=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,H_=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,V_=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,G_=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,W_=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,$_=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,X_=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,q_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Y_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	uniform mat3 diffuseRoughnessMapTransform;
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,j_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	vDiffuseRoughnessMapUv = ( diffuseRoughnessMapTransform * vec3( DIFFUSE_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,J_=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,K_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Z_=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Q_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,eS=`uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <envmap_common_pars_fragment>
void main() {
	#ifdef ENVMAP_TYPE_PMREM
		vec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );
	#else
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,tS=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,nS=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,iS=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,sS=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,rS=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,aS=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,oS=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,lS=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cS=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,hS=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,uS=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,dS=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,fS=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,pS=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,mS=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,gS=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,yS=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,bS=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,vS=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,xS=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,_S=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,SS=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DIFFUSE_ROUGHNESS
	uniform float diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		uniform sampler2D diffuseRoughnessMap;
	#endif
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,wS=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,MS=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ES=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,TS=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,AS=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,CS=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,RS=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,PS=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,qe={alphahash_fragment:Zv,alphahash_pars_fragment:Qv,alphamap_fragment:ex,alphamap_pars_fragment:tx,alphatest_fragment:nx,alphatest_pars_fragment:ix,aomap_fragment:sx,aomap_pars_fragment:rx,batching_pars_vertex:ax,batching_vertex:ox,begin_vertex:lx,beginnormal_vertex:cx,bsdfs:hx,iridescence_fragment:ux,bumpmap_pars_fragment:dx,clipping_planes_fragment:fx,clipping_planes_pars_fragment:px,clipping_planes_pars_vertex:mx,clipping_planes_vertex:gx,color_fragment:yx,color_pars_fragment:bx,color_pars_vertex:vx,color_vertex:xx,common:_x,defaultnormal_vertex:Sx,displacementmap_pars_vertex:wx,displacementmap_vertex:Mx,emissivemap_fragment:Ex,emissivemap_pars_fragment:Tx,colorspace_fragment:Ax,colorspace_pars_fragment:Cx,envmap_fragment:Rx,envmap_common_pars_fragment:Px,envmap_pars_fragment:Lx,envmap_pars_vertex:Ix,envmap_physical_pars_fragment:Gx,envmap_vertex:kx,fog_vertex:Dx,fog_pars_vertex:Nx,fog_fragment:Ox,fog_pars_fragment:Fx,gradientmap_pars_fragment:Ux,lightmap_pars_fragment:Bx,lights_lambert_fragment:zx,lights_lambert_pars_fragment:Hx,lights_pars_begin:Vx,lights_toon_fragment:Wx,lights_toon_pars_fragment:$x,lights_phong_fragment:Xx,lights_phong_pars_fragment:qx,lights_physical_fragment:Yx,lights_physical_pars_fragment:jx,lights_fragment_begin:Jx,lights_fragment_maps:Kx,lights_fragment_end:Zx,lightprobes_pars_fragment:Qx,logdepthbuf_fragment:e_,logdepthbuf_pars_fragment:t_,logdepthbuf_pars_vertex:n_,logdepthbuf_vertex:i_,map_fragment:s_,map_pars_fragment:r_,map_particle_fragment:a_,map_particle_pars_fragment:o_,metalnessmap_fragment:l_,metalnessmap_pars_fragment:c_,morphinstance_vertex:h_,morphcolor_vertex:u_,morphnormal_vertex:d_,morphtarget_pars_vertex:f_,morphtarget_vertex:p_,normal_fragment_begin:m_,normal_fragment_maps:g_,normal_pars_fragment:y_,normal_pars_vertex:b_,normal_vertex:v_,normalmap_pars_fragment:x_,clearcoat_normal_fragment_begin:__,clearcoat_normal_fragment_maps:S_,clearcoat_pars_fragment:w_,iridescence_pars_fragment:M_,opaque_fragment:E_,packing:T_,premultiplied_alpha_fragment:A_,project_vertex:C_,dithering_fragment:R_,dithering_pars_fragment:P_,roughnessmap_fragment:L_,roughnessmap_pars_fragment:I_,shadowmap_pars_fragment:k_,shadowmap_pars_vertex:D_,shadowmap_vertex:N_,shadowmask_pars_fragment:O_,skinbase_vertex:F_,skinning_pars_vertex:U_,skinning_vertex:B_,skinnormal_vertex:z_,specularmap_fragment:H_,specularmap_pars_fragment:V_,tonemapping_fragment:G_,tonemapping_pars_fragment:W_,transmission_fragment:$_,transmission_pars_fragment:X_,uv_pars_fragment:q_,uv_pars_vertex:Y_,uv_vertex:j_,worldpos_vertex:J_,background_vert:K_,background_frag:Z_,backgroundCube_vert:Q_,backgroundCube_frag:eS,cube_vert:tS,cube_frag:nS,depth_vert:iS,depth_frag:sS,distance_vert:rS,distance_frag:aS,equirect_vert:oS,equirect_frag:lS,linedashed_vert:cS,linedashed_frag:hS,meshbasic_vert:uS,meshbasic_frag:dS,meshlambert_vert:fS,meshlambert_frag:pS,meshmatcap_vert:mS,meshmatcap_frag:gS,meshnormal_vert:yS,meshnormal_frag:bS,meshphong_vert:vS,meshphong_frag:xS,meshphysical_vert:_S,meshphysical_frag:SS,meshtoon_vert:wS,meshtoon_frag:MS,points_vert:ES,points_frag:TS,shadow_vert:AS,shadow_frag:CS,sprite_vert:RS,sprite_frag:PS},ye={common:{diffuse:{value:new Xe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ue}},envmap:{envMap:{value:null},envMapRotation:{value:new Ue},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ue}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ue}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ue},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ue},normalScale:{value:new Pe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ue},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ue}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ue}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ue}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Xe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new Xe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0},uvTransform:{value:new Ue}},sprite:{diffuse:{value:new Xe(16777215)},opacity:{value:1},center:{value:new Pe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}}},vi={basic:{uniforms:hn([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.fog]),vertexShader:qe.meshbasic_vert,fragmentShader:qe.meshbasic_frag},lambert:{uniforms:hn([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,ye.lights,{emissive:{value:new Xe(0)},envMapIntensity:{value:1}}]),vertexShader:qe.meshlambert_vert,fragmentShader:qe.meshlambert_frag},phong:{uniforms:hn([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,ye.lights,{emissive:{value:new Xe(0)},specular:{value:new Xe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:qe.meshphong_vert,fragmentShader:qe.meshphong_frag},standard:{uniforms:hn([ye.common,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.roughnessmap,ye.metalnessmap,ye.fog,ye.lights,{emissive:{value:new Xe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:qe.meshphysical_vert,fragmentShader:qe.meshphysical_frag},toon:{uniforms:hn([ye.common,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.gradientmap,ye.fog,ye.lights,{emissive:{value:new Xe(0)}}]),vertexShader:qe.meshtoon_vert,fragmentShader:qe.meshtoon_frag},matcap:{uniforms:hn([ye.common,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,{matcap:{value:null}}]),vertexShader:qe.meshmatcap_vert,fragmentShader:qe.meshmatcap_frag},points:{uniforms:hn([ye.points,ye.fog]),vertexShader:qe.points_vert,fragmentShader:qe.points_frag},dashed:{uniforms:hn([ye.common,ye.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:qe.linedashed_vert,fragmentShader:qe.linedashed_frag},depth:{uniforms:hn([ye.common,ye.displacementmap]),vertexShader:qe.depth_vert,fragmentShader:qe.depth_frag},normal:{uniforms:hn([ye.common,ye.bumpmap,ye.normalmap,ye.displacementmap,{opacity:{value:1}}]),vertexShader:qe.meshnormal_vert,fragmentShader:qe.meshnormal_frag},sprite:{uniforms:hn([ye.sprite,ye.fog]),vertexShader:qe.sprite_vert,fragmentShader:qe.sprite_frag},background:{uniforms:{uvTransform:{value:new Ue},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:qe.background_vert,fragmentShader:qe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ue}},vertexShader:qe.backgroundCube_vert,fragmentShader:qe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:qe.cube_vert,fragmentShader:qe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:qe.equirect_vert,fragmentShader:qe.equirect_frag},distance:{uniforms:hn([ye.common,ye.displacementmap,{referencePosition:{value:new O},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:qe.distance_vert,fragmentShader:qe.distance_frag},shadow:{uniforms:hn([ye.lights,ye.fog,{color:{value:new Xe(0)},opacity:{value:1}}]),vertexShader:qe.shadow_vert,fragmentShader:qe.shadow_frag}};vi.physical={uniforms:hn([vi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ue},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ue},clearcoatNormalScale:{value:new Pe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ue},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new Ue},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ue},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ue},sheen:{value:0},sheenColor:{value:new Xe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ue},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ue},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ue},transmissionSamplerSize:{value:new Pe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ue},attenuationDistance:{value:0},attenuationColor:{value:new Xe(0)},specularColor:{value:new Xe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ue},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ue},anisotropyVector:{value:new Pe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ue}}]),vertexShader:qe.meshphysical_vert,fragmentShader:qe.meshphysical_frag};var eh={r:0,b:0,g:0},LS=new ft,Ng=new Ue;Ng.set(-1,0,0,0,1,0,0,0,1);function IS(n,e,t,i,s,r){let a=new Xe(0),o=s===!0?0:1,l,c,h=null,u=0,f=null;function d(b){let _=b.isScene===!0?b.background:null;if(_&&_.isTexture){let v=b.backgroundBlurriness>0;_=e.get(_,v)}return _}function p(b){let _=!1,v=d(b);v===null?m(a,o):v&&v.isColor&&(m(v,1),_=!0);let w=n.xr.getEnvironmentBlendMode();w==="additive"?t.buffers.color.setClear(0,0,0,1,r):w==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(n.autoClear||_)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function y(b,_){let v=d(_);v&&v.isCubeTexture?(c===void 0&&(c=new Jt(new kr(1,1,1),new Rn({name:"BackgroundCubeMaterial",uniforms:$s(vi.backgroundCube.uniforms),vertexShader:vi.backgroundCube.vertexShader,fragmentShader:vi.backgroundCube.fragmentShader,side:gn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(w,E,x){this.matrixWorld.copyPosition(x.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=_.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(LS.makeRotationFromEuler(_.backgroundRotation)).transpose(),v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Ng),c.material.toneMapped=Ye.getTransfer(v.colorSpace)!==ot,(h!==v||u!==v.version||f!==n.toneMapping)&&(c.material.needsUpdate=!0,h=v,u=v.version,f=n.toneMapping),c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new Jt(new Hs(2,2),new Rn({name:"BackgroundMaterial",uniforms:$s(vi.background.uniforms),vertexShader:vi.background.vertexShader,fragmentShader:vi.background.fragmentShader,side:ls,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,l.material.toneMapped=Ye.getTransfer(v.colorSpace)!==ot,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(h!==v||u!==v.version||f!==n.toneMapping)&&(l.material.needsUpdate=!0,h=v,u=v.version,f=n.toneMapping),l.layers.enableAll(),b.unshift(l,l.geometry,l.material,0,0,null))}function m(b,_){b.getRGB(eh,Id(n)),t.buffers.color.setClear(eh.r,eh.g,eh.b,_,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(b,_=1){a.set(b),o=_,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(b){o=b,m(a,o)},render:p,addToRenderList:y,dispose:g}}function kS(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},s=f(null),r=s,a=!1;function o(D,H,X,L,V){let G=!1,W=u(D,L,X,H);r!==W&&(r=W,c(r.object)),G=d(D,L,X,V),G&&p(D,L,X,V),V!==null&&e.update(V,n.ELEMENT_ARRAY_BUFFER),(G||a)&&(a=!1,v(D,H,X,L),V!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(V).buffer))}function l(){return n.createVertexArray()}function c(D){return n.bindVertexArray(D)}function h(D){return n.deleteVertexArray(D)}function u(D,H,X,L){let V=L.wireframe===!0,G=i[H.id];G===void 0&&(G={},i[H.id]=G);let W=D.isInstancedMesh===!0?D.id:0,te=G[W];te===void 0&&(te={},G[W]=te);let q=te[X.id];q===void 0&&(q={},te[X.id]=q);let ee=q[V];return ee===void 0&&(ee=f(l()),q[V]=ee),ee}function f(D){let H=[],X=[],L=[];for(let V=0;V<t;V++)H[V]=0,X[V]=0,L[V]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:H,enabledAttributes:X,attributeDivisors:L,object:D,attributes:{},index:null}}function d(D,H,X,L){let V=r.attributes,G=H.attributes,W=0,te=X.getAttributes();for(let q in te)if(te[q].location>=0){let ne=V[q],be=G[q];if(be===void 0&&(q==="instanceMatrix"&&D.instanceMatrix&&(be=D.instanceMatrix),q==="instanceColor"&&D.instanceColor&&(be=D.instanceColor)),ne===void 0||ne.attribute!==be||be&&ne.data!==be.data)return!0;W++}return r.attributesNum!==W||r.index!==L}function p(D,H,X,L){let V={},G=H.attributes,W=0,te=X.getAttributes();for(let q in te)if(te[q].location>=0){let ne=G[q];ne===void 0&&(q==="instanceMatrix"&&D.instanceMatrix&&(ne=D.instanceMatrix),q==="instanceColor"&&D.instanceColor&&(ne=D.instanceColor));let be={};be.attribute=ne,ne&&ne.data&&(be.data=ne.data),V[q]=be,W++}r.attributes=V,r.attributesNum=W,r.index=L}function y(){let D=r.newAttributes;for(let H=0,X=D.length;H<X;H++)D[H]=0}function m(D){g(D,0)}function g(D,H){let X=r.newAttributes,L=r.enabledAttributes,V=r.attributeDivisors;X[D]=1,L[D]===0&&(n.enableVertexAttribArray(D),L[D]=1),V[D]!==H&&(n.vertexAttribDivisor(D,H),V[D]=H)}function b(){let D=r.newAttributes,H=r.enabledAttributes;for(let X=0,L=H.length;X<L;X++)H[X]!==D[X]&&(n.disableVertexAttribArray(X),H[X]=0)}function _(D,H,X,L,V,G,W){W===!0?n.vertexAttribIPointer(D,H,X,V,G):n.vertexAttribPointer(D,H,X,L,V,G)}function v(D,H,X,L){y();let V=L.attributes,G=X.getAttributes(),W=H.defaultAttributeValues;for(let te in G){let q=G[te];if(q.location>=0){let ee=V[te];if(ee===void 0&&(te==="instanceMatrix"&&D.instanceMatrix&&(ee=D.instanceMatrix),te==="instanceColor"&&D.instanceColor&&(ee=D.instanceColor)),ee!==void 0){let ne=ee.normalized,be=ee.itemSize,De=e.get(ee);if(De===void 0)continue;let J=De.buffer,me=De.type,we=De.bytesPerElement,Ie=me===n.INT||me===n.UNSIGNED_INT||ee.gpuType===yc;if(ee.isInterleavedBufferAttribute){let ve=ee.data,He=ve.isInterleavedBuffer===!0?ve.stride:ve.itemSize,At=ee.offset;if(ve.isInstancedInterleavedBuffer||ve.isInstancedBufferAttribute){for(let Ne=0;Ne<q.locationSize;Ne++)g(q.location+Ne,ve.meshPerAttribute);D.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=ve.meshPerAttribute*ve.count)}else for(let Ne=0;Ne<q.locationSize;Ne++)m(q.location+Ne);n.bindBuffer(n.ARRAY_BUFFER,J);for(let Ne=0;Ne<q.locationSize;Ne++)_(q.location+Ne,be/q.locationSize,me,ne,He*we,(At+be/q.locationSize*Ne)*we,Ie)}else{if(ee.isInstancedBufferAttribute){for(let ve=0;ve<q.locationSize;ve++)g(q.location+ve,ee.meshPerAttribute);D.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let ve=0;ve<q.locationSize;ve++)m(q.location+ve);n.bindBuffer(n.ARRAY_BUFFER,J);for(let ve=0;ve<q.locationSize;ve++)_(q.location+ve,be/q.locationSize,me,ne,be*we,be/q.locationSize*ve*we,Ie)}}else if(W!==void 0){let ne=W[te];if(ne!==void 0)switch(ne.length){case 2:n.vertexAttrib2fv(q.location,ne);break;case 3:n.vertexAttrib3fv(q.location,ne);break;case 4:n.vertexAttrib4fv(q.location,ne);break;default:n.vertexAttrib1fv(q.location,ne)}}}}b()}function w(){I();for(let D in i){let H=i[D];for(let X in H){let L=H[X];for(let V in L){let G=L[V];for(let W in G)h(G[W].object),delete G[W];delete L[V]}}delete i[D]}}function E(D){if(i[D.id]===void 0)return;let H=i[D.id];for(let X in H){let L=H[X];for(let V in L){let G=L[V];for(let W in G)h(G[W].object),delete G[W];delete L[V]}}delete i[D.id]}function x(D){for(let H in i){let X=i[H];for(let L in X){let V=X[L];if(V[D.id]===void 0)continue;let G=V[D.id];for(let W in G)h(G[W].object),delete G[W];delete V[D.id]}}}function A(D){for(let H in i){let X=i[H],L=D.isInstancedMesh===!0?D.id:0,V=X[L];if(V!==void 0){for(let G in V){let W=V[G];for(let te in W)h(W[te].object),delete W[te];delete V[G]}delete X[L],Object.keys(X).length===0&&delete i[H]}}}function I(){R(),a=!0,r!==s&&(r=s,c(r.object))}function R(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:I,resetDefaultState:R,dispose:w,releaseStatesOfGeometry:E,releaseStatesOfObject:A,releaseStatesOfProgram:x,initAttributes:y,enableAttribute:m,disableUnusedAttributes:b}}function DS(n,e,t){let i;function s(l){i=l}function r(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function a(l,c,h){h!==0&&(n.drawArraysInstanced(i,l,c,h),t.update(c,i,h))}function o(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let f=0;for(let d=0;d<h;d++)f+=c[d];t.update(f,i,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function NS(n,e,t,i){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){let x=e.get("EXT_texture_filter_anisotropic");s=n.getParameter(x.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(x){return!(x!==Nn&&i.convert(x)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(x){let A=x===ii&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(x!==kn&&x!==Dn&&!A&&i.convert(x)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE))}function l(x){if(x==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";x="mediump"}return x==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(Le("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),f=t.logarithmicDepthBuffer===!0&&u===!1;t.reversedDepthBuffer===!0&&u===!1&&Le("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer."),t.logarithmicDepthBuffer===!0&&u===!0&&Le("WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.");let d=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),p=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=n.getParameter(n.MAX_TEXTURE_SIZE),m=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),g=n.getParameter(n.MAX_VERTEX_ATTRIBS),b=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),_=n.getParameter(n.MAX_VARYING_VECTORS),v=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),w=n.getParameter(n.MAX_SAMPLES),E=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:u,maxTextures:d,maxVertexTextures:p,maxTextureSize:y,maxCubemapSize:m,maxAttributes:g,maxVertexUniforms:b,maxVaryings:_,maxFragmentUniforms:v,maxSamples:w,samples:E}}function OS(n){let e=this,t=null,i=0,s=!1,r=!1,a=new An,o=new Ue,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,f){let d=u.length!==0||f||i!==0||s;return s=f,i=u.length,d},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,f){t=h(u,f,0)},this.setState=function(u,f,d){let p=u.clippingPlanes,y=u.clipIntersection,m=u.clipShadows,g=n.get(u);if(!s||p===null||p.length===0||r&&!m)r?h(null):c();else{let b=r?0:i,_=b*4,v=g.clippingState||null;l.value=v,v=h(p,f,_,d);for(let w=0;w!==_;++w)v[w]=t[w];g.clippingState=v,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=b}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function h(u,f,d,p){let y=u!==null?u.length:0,m=null;if(y!==0){if(m=l.value,p!==!0||m===null){let g=d+y*4,b=f.matrixWorldInverse;o.getNormalMatrix(b),(m===null||m.length<g)&&(m=new Float32Array(g));for(let _=0,v=d;_!==y;++_,v+=4)a.copy(u[_]).applyMatrix4(b,o),a.normal.toArray(m,v),m[v+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=y,e.numIntersection=0,m}}var io=class extends mn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},s=[i,i,i,i,i,i];this.texture=new Ba(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new kr(5,5,5),r=new Rn({name:"CubemapFromEquirect",uniforms:$s(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:gn,blending:ki});r.uniforms.tEquirect.value=t;let a=new Jt(s,r),o=t.minFilter;return t.minFilter===Di&&(t.minFilter=pn),new Nr(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,i=!0,s=!0){let r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,i,s);e.setRenderTarget(r)}},fg=256,FS=3,US=20,Og=256,Fg=16,BS=3,zS=new O,HS=new Xe,nh=class n{constructor(e){this._renderer=e,this._cubeSize=0,this._sourceTarget=null,this._cubeCamera=new Nr(1,10,null),this._boxMesh=new Jt(new kr(5,5,5),null),this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null,this._integrationMaterial=null}fromScene(e,t=0,i=.1,s=100,r={}){let{size:a=256,position:o=zS}=r,l=this._renderer;this._setSize(a);let c=this._allocateTarget(),h=this._getSourceTarget(!0);t>0&&(h.texture.mipmapsAutoUpdate=!1);let u=l.autoClear,f=l.autoClearColor,d=l.autoClearDepth,p=l.autoClearStencil,y=e.background;l.autoClear=!0,l.autoClearColor=!0,l.autoClearDepth=!0,l.autoClearStencil=!0,y===null&&(e.background=l.getClearColor(HS));let m=new Nr(i,s,h);return m.position.copy(o),m.update(l,e),l.autoClear=u,l.autoClearColor=f,l.autoClearDepth=d,l.autoClearStencil=p,e.background=y,t>0&&(h.texture.mipmapsAutoUpdate=!0,this._blur(c,t)),this._applyPMREM(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=gg(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=mg(),this._compileMaterial(this._equirectMaterial))}dispose(){this._sourceTarget!==null&&this._sourceTarget.dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._integrationMaterial!==null&&this._integrationMaterial.dispose(),this._boxMesh.geometry.dispose()}static lodToRoughness(e,t){return t>0?1-Math.sqrt(1-e/t):0}_setSize(e){this._cubeSize=Math.max(fg,Cd(e))}_fromTexture(e,t){e.mapping===Gs||e.mapping===Br?this._setSize(e.image.length===0?fg:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4);let i=t||this._allocateTarget();return this._textureToCubemap(e),this._applyPMREM(i),i}_allocateTarget(){let e=this._cubeSize,t=pg(e,!1,!1),i=Math.log2(e)-FS;for(let s=0;s<=i;s++)t.texture.mipmaps.push({width:e>>s,height:e>>s});return t.texture.name="PMREM",t.texture.isPMREMTexture=!0,t}_getSourceTarget(e=!1){let t=this._cubeSize,i=this._sourceTarget;return(i===null||i.width!==t||e&&i.depthBuffer===!1)&&(i!==null&&i.dispose(),this._sourceTarget=pg(t,!0,e)),this._sourceTarget}_compileMaterial(e){this._boxMesh.material=e,this._renderer.compile(this._boxMesh,this._cubeCamera.children[0])}_renderCube(e,t,i){let s=this._boxMesh,r=this._cubeCamera;s.material=i,r.renderTarget=e,r.activeMipmapLevel=t;let a=e.width>>t;e.viewport.set(0,0,a,a),r.update(this._renderer,s),e.viewport.set(0,0,e.width,e.height)}_textureToCubemap(e){let t;e.mapping===Gs||e.mapping===Br?(this._cubemapMaterial===null&&(this._cubemapMaterial=gg()),t=this._cubemapMaterial,t.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):(this._equirectMaterial===null&&(this._equirectMaterial=mg()),t=this._equirectMaterial),t.uniforms.envMap.value=e,this._renderCube(this._getSourceTarget(),0,t)}_applyPMREM(e){this._ggxMaterial===null&&(this._ggxMaterial=VS(),this._integrationMaterial=GS());let t=this._cubeSize,i=e.texture.mipmaps.length-1,s=this._ggxMaterial.uniforms;s.envMap.value=this._sourceTarget.texture;let r=this._integrationMaterial.uniforms;r.envMap.value=this._sourceTarget.texture,r.sourceLod.value=Math.log2(t/Fg);for(let a=0;a<=i;a++){let o=n.lodToRoughness(a,i);if(a>i-BS)r.roughness.value=o,this._renderCube(e,a,this._integrationMaterial);else{let l=o>0?Math.log2(t)+.5*Math.log2(6/(Og*Math.pow(o,4)))+.5:0;s.roughness.value=o,s.lodBias.value=l,this._renderCube(e,a,this._ggxMaterial)}}}_blur(e,t){this._blurMaterial===null&&(this._blurMaterial=WS());let i=this._blurMaterial,s=i.uniforms,r=this._sourceTarget;s.sigma.value=Math.min(t,Math.PI)/Math.SQRT2,s.envMap.value=r.texture,this._renderCube(e,0,i),s.envMap.value=e.texture,this._renderCube(r,0,i)}};function pg(n,e,t){return new io(n,{minFilter:Di,generateMipmaps:e,type:ii,colorSpace:Os,depthBuffer:t})}function so(n,e,t){return new Rn({name:n,uniforms:e,vertexShader:qe.cube_vert,fragmentShader:t,side:gn,blending:ki,depthTest:!1,depthWrite:!1})}function VS(){return so("PMREMGGXConvolution",{envMap:{value:null},roughness:{value:0},lodBias:{value:0}},`

		#define GGX_SAMPLES ${Og}u

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float lodBias;

		#include <common>

		// Van der Corput radical inverse
		float radicalInverse_VdC( uint bits ) {

			bits = ( bits << 16u ) | ( bits >> 16u );
			bits = ( ( bits & 0x55555555u ) << 1u ) | ( ( bits & 0xAAAAAAAAu ) >> 1u );
			bits = ( ( bits & 0x33333333u ) << 2u ) | ( ( bits & 0xCCCCCCCCu ) >> 2u );
			bits = ( ( bits & 0x0F0F0F0Fu ) << 4u ) | ( ( bits & 0xF0F0F0F0u ) >> 4u );
			bits = ( ( bits & 0x00FF00FFu ) << 8u ) | ( ( bits & 0xFF00FF00u ) >> 8u );
			return float( bits ) * 2.3283064365386963e-10; // / 0x100000000

		}

		// Hammersley sequence
		vec2 hammersley( uint i, uint N ) {

			return vec2( float( i ) / float( N ), radicalInverse_VdC( i ) );

		}

		void main() {

			vec3 N = normalize( vWorldDirection );

			// For very low roughness, just sample the environment directly
			if ( roughness < 0.001 ) {

				gl_FragColor = vec4( textureLod( envMap, N, 0.0 ).rgb, 1.0 );
				return;

			}

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			// Tangent space basis for VNDF sampling
			vec3 up = abs( N.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, N ) );
			vec3 bitangent = cross( N, tangent );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			for ( uint i = 0u; i < GGX_SAMPLES; i ++ ) {

				vec2 Xi = hammersley( i, GGX_SAMPLES );

				// With V = N, sample the reflected direction directly.
				float invQ = 1.0 / ( 1.0 - Xi.x + alpha2 * Xi.x );
				float NdotL = ( 1.0 - Xi.x - alpha2 * Xi.x ) * invQ;

				if ( NdotL > 0.0 ) {

					float phi = 2.0 * PI * Xi.y;
					float sinTheta = 2.0 * alpha * sqrt( Xi.x * ( 1.0 - Xi.x ) ) * invQ;
					vec3 L = N * NdotL + ( tangent * cos( phi ) + bitangent * sin( phi ) ) * sinTheta;

					// Match the source mip to the sample's solid angle. The terms
					// independent of the sample are precomputed in lodBias.
					float d = alpha2 * invQ;
					float lod = max( log2( d ) + lodBias, 0.0 );

					// Weight by NdotL for the split-sum approximation
					prefilteredColor += textureLod( envMap, L, lod ).rgb * NdotL;
					totalWeight += NdotL;

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function GS(){return so("PMREMGGXIntegration",{envMap:{value:null},roughness:{value:0},sourceLod:{value:0},sourceSize:{value:Fg}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float sourceLod;
		uniform int sourceSize;

		void main() {

			vec3 N = normalize( vWorldDirection );

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			float texelSize = 2.0 / float( sourceSize );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			// Pair opposite texels: only the one in N's hemisphere contributes.
			for ( int face = 0; face < 3; face ++ ) {

				for ( int y = 0; y < sourceSize; y ++ ) {

					for ( int x = 0; x < sourceSize; x ++ ) {

						vec2 uv = ( vec2( x, y ) + 0.5 ) * texelSize - 1.0;
						vec3 texelDirection = face == 0 ? vec3( 1.0, uv ) : ( face == 1 ? vec3( uv.x, 1.0, uv.y ) : vec3( uv, 1.0 ) );

						float invDistance = inversesqrt( 1.0 + dot( uv, uv ) );
						float NdotL = dot( N, texelDirection );
						texelDirection *= NdotL < 0.0 ? - 1.0 : 1.0;
						NdotL = abs( NdotL ) * invDistance;

						// With V = N, NdotH squared is ( 1 + NdotL ) / 2. Common factors
						// in the GGX distribution and texel solid angle cancel when normalized.
						float d = 1.0 + alpha2 + ( alpha2 - 1.0 ) * NdotL;
						float weight = NdotL * invDistance * invDistance * invDistance / ( d * d );

						prefilteredColor += textureLod( envMap, texelDirection, sourceLod ).rgb * weight;
						totalWeight += weight;

					}

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function WS(){return so("PMREMSphericalGaussianBlur",{envMap:{value:null},sigma:{value:0}},`

		#define SAMPLES ${US}
		#define GOLDEN_ANGLE 2.39996322973

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float sigma;

		#include <common>

		void main() {

			vec3 outputDirection = normalize( vWorldDirection );

			vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, outputDirection ) );
			vec3 bitangent = cross( outputDirection, tangent );

			// Truncate the kernel at three standard deviations or at the antipode.
			float thetaMax = min( 3.0 * sigma, PI );
			float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

			vec3 accumColor = vec3( 0.0 );
			float accumWeight = 0.0;

			for ( int i = 0; i < SAMPLES; i ++ ) {

				// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
				float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
				float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
				float phi = float( i ) * GOLDEN_ANGLE;

				vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
				vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

				// Correct the planar sample density to solid angle.
				float weight = sin( theta ) / theta;

				accumColor += weight * textureLod( envMap, sampleDirection, 0.0 ).rgb;
				accumWeight += weight;

			}

			gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

		}
	`)}function mg(){return so("PMREMEquirectangularToCubemap",{envMap:{value:null}},`

		varying vec3 vWorldDirection;

		uniform sampler2D envMap;

		#include <common>

		void main() {

			// Average four subpixel samples to preserve small, bright features.
			vec3 direction = normalize( vWorldDirection );
			vec3 dx = dFdx( direction ) * 0.25;
			vec3 dy = dFdy( direction ) * 0.25;

			vec3 color = textureLod( envMap, equirectUv( normalize( direction - dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction - dx + dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx + dy ) ), 0.0 ).rgb;
			gl_FragColor = vec4( color * 0.25, 1.0 );

		}
	`)}function gg(){return so("PMREMCubemapToCubemap",{envMap:{value:null},flipEnvMap:{value:-1}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`)}function $S(n){let e=new WeakMap,t=new WeakMap,i=null;function s(f,d=!1){return f==null?null:d?a(f):r(f)}function r(f){if(f&&f.isTexture){let d=f.mapping;if(d===pc||d===mc)if(e.has(f)){let p=e.get(f).texture;return o(p,f.mapping)}else{let p=f.image;if(p&&p.height>0){let y=new io(p.height);return y.fromEquirectangularTexture(n,f),e.set(f,y),f.addEventListener("dispose",c),o(y.texture,f.mapping)}else return null}}return f}function a(f){if(f&&f.isTexture&&f.isPMREMTexture!==!0){let d=f.mapping,p=d===pc||d===mc,y=d===Gs||d===Br;if(p||y){let m=t.get(f),g=m!==void 0?m.texture.pmremVersion:0;if(f.isRenderTargetTexture&&f.pmremVersion!==g)return i===null&&(i=new nh(n)),m=p?i.fromEquirectangular(f,m):i.fromCubemap(f,m),m.texture.pmremVersion=f.pmremVersion,t.set(f,m),m.texture;if(m!==void 0)return m.texture;{let b=f.image;return p&&b&&b.height>0||y&&b&&l(b)?(i===null&&(i=new nh(n)),m=p?i.fromEquirectangular(f):i.fromCubemap(f),m.texture.pmremVersion=f.pmremVersion,t.set(f,m),f.addEventListener("dispose",h),m.texture):null}}}return f}function o(f,d){return d===pc?f.mapping=Gs:d===mc&&(f.mapping=Br),f}function l(f){let d=0,p=6;for(let y=0;y<p;y++)f[y]!==void 0&&d++;return d===p}function c(f){let d=f.target;d.removeEventListener("dispose",c);let p=e.get(d);p!==void 0&&(e.delete(d),p.dispose())}function h(f){let d=f.target;d.removeEventListener("dispose",h);let p=t.get(d);p!==void 0&&(t.delete(d),p.dispose())}function u(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:u}}function XS(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let s=n.getExtension(i);return e[i]=s,s}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let s=t(i);return s===null&&Aa("WebGLRenderer: "+i+" extension not supported."),s}}}function qS(n,e,t,i){let s={},r=new WeakMap,a=new FinalizationRegistry(p=>delete s[p]);function o(p){l(p.target)}function l(p){p.index!==null&&e.remove(p.index);for(let m in p.attributes)e.remove(p.attributes[m]);p.removeEventListener("dispose",o),delete s[p.id],a.unregister(p);let y=r.get(p);y&&(e.remove(y),r.delete(p)),i.releaseStatesOfGeometry(p),p.isInstancedBufferGeometry===!0&&delete p._maxInstanceCount,t.memory.geometries--}function c(p,y){return s[y.id]!==void 0||(y.addEventListener("dispose",o),s[y.id]=new WeakRef(y),a.register(y,y.id,y),t.memory.geometries++),y}function h(p){let y=p.attributes;for(let m in y)e.update(y[m],n.ARRAY_BUFFER)}function u(p){let y=p.index,m=p.attributes.position,g=0;if(m===void 0)return;let b=y!==null?y.array.length:m.array.length/3-1,_=m.count>=65535?Ua:Fa,v=new _(Math.ceil(b/3)*6,1),w=v.array;if(y!==null){let x=y.array;g=y.version;for(let A=0,I=0;A<b;A+=3){let R=x[A+0],D=x[A+1],H=x[A+2];w[I++]=R,w[I++]=D,w[I++]=D,w[I++]=H,w[I++]=H,w[I++]=R}}else{g=m.version;for(let x=0,A=0;x<b;x+=3){let I=x+0,R=x+1,D=x+2;w[A++]=I,w[A++]=R,w[A++]=R,w[A++]=D,w[A++]=D,w[A++]=I}}v.version=g;let E=r.get(p);E&&e.remove(E),r.set(p,v)}function f(p){let y=r.get(p);if(y){let m=p.index;m!==null&&y.version<m.version&&u(p)}else u(p);return r.get(p)}function d(){for(let p in s){let y=s[p].deref();y!==void 0&&l(y)}}return{get:c,update:h,getWireframeAttribute:f,dispose:d}}function YS(n,e,t){let i;function s(u){i=u}let r,a;function o(u){r=u.type,a=u.bytesPerElement}function l(u,f){n.drawElements(i,f,r,u*a),t.update(f,i,1)}function c(u,f,d){d!==0&&(n.drawElementsInstanced(i,f,r,u*a,d),t.update(f,i,d))}function h(u,f,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,f,0,r,u,0,d);let y=0;for(let m=0;m<d;m++)y+=f[m];t.update(y,i,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function jS(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,a,o){switch(t.calls++,a){case n.TRIANGLES:t.triangles+=o*(r/3);break;case n.LINES:t.lines+=o*(r/2);break;case n.LINE_STRIP:t.lines+=o*(r-1);break;case n.LINE_LOOP:t.lines+=o*r;break;case n.POINTS:t.points+=o*r;break;default:Fe("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:i}}function JS(n,e,t){let i=new WeakMap,s=new lt;function r(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0,f=i.get(o);if(f===void 0||f.count!==u){let I=function(){x.dispose(),i.delete(o),o.removeEventListener("dispose",I)};f!==void 0&&f.texture.dispose();let d=o.morphAttributes.position!==void 0,p=o.morphAttributes.normal!==void 0,y=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],g=o.morphAttributes.normal||[],b=o.morphAttributes.color||[],_=0;d===!0&&(_=1),p===!0&&(_=2),y===!0&&(_=3);let v=o.attributes.position.count*_,w=1;v>e.maxTextureSize&&(w=Math.ceil(v/e.maxTextureSize),v=e.maxTextureSize);let E=new Float32Array(v*w*4*u),x=new Na(E,v,w,u);x.type=Dn,x.needsUpdate=!0;let A=_*4;for(let R=0;R<u;R++){let D=m[R],H=g[R],X=b[R],L=v*w*4*R;for(let V=0;V<D.count;V++){let G=V*A;d===!0&&(s.fromBufferAttribute(D,V),E[L+G+0]=s.x,E[L+G+1]=s.y,E[L+G+2]=s.z,E[L+G+3]=0),p===!0&&(s.fromBufferAttribute(H,V),E[L+G+4]=s.x,E[L+G+5]=s.y,E[L+G+6]=s.z,E[L+G+7]=0),y===!0&&(s.fromBufferAttribute(X,V),E[L+G+8]=s.x,E[L+G+9]=s.y,E[L+G+10]=s.z,E[L+G+11]=X.itemSize===4?s.w:1)}}f={count:u,texture:x,size:new Pe(v,w)},i.set(o,f),o.addEventListener("dispose",I)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",a.morphTexture,t);else{let d=0;for(let y=0;y<c.length;y++)d+=c[y];let p=o.morphTargetsRelative?1:1-d;l.getUniforms().setValue(n,"morphTargetBaseInfluence",p),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",f.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",f.size)}return{update:r}}function KS(n,e,t,i,s){let r=new WeakMap;function a(c){let h=s.render.frame,u=c.geometry,f=e.get(c,u);if(r.get(f)!==h&&(e.update(f),r.set(f,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let d=c.skeleton;r.get(d)!==h&&(d.update(),r.set(d,h))}return f}function o(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:a,dispose:o}}var ZS={[rd]:"LINEAR_TONE_MAPPING",[ad]:"REINHARD_TONE_MAPPING",[od]:"CINEON_TONE_MAPPING",[ld]:"ACES_FILMIC_TONE_MAPPING",[hd]:"AGX_TONE_MAPPING",[ud]:"NEUTRAL_TONE_MAPPING",[cd]:"CUSTOM_TONE_MAPPING"};function QS(n,e,t,i,s,r){let a=new mn(e,t,{type:n,depthBuffer:s,stencilBuffer:r,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),o=null,l=null,c=null,h=new xt;h.setAttribute("position",new Ut([-1,3,0,-1,-1,0,3,-1,0],3)),h.setAttribute("uv",new Ut([0,2,0,0,2,0],2));let u=new ec({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),f=new Jt(h,u),d=new Ln(-1,1,1,-1,0,1),p=null,y=null,m=!1,g,b=null,_=[],v=!1;this.setSize=function(w,E){a.setSize(w,E),o!==null&&o.setSize(w,E),l!==null&&l.setSize(w,E);for(let x=0;x<_.length;x++){let A=_[x];A.setSize&&A.setSize(w,E)}},this.setEffects=function(w){_=w,v=_.length>0&&_[0].isRenderPass===!0;let E=a.width,x=a.height;_.length>0&&o===null&&(o=new mn(E,x,{type:ii,depthBuffer:!1,stencilBuffer:!1}),l=new mn(E,x,{type:ii,depthBuffer:!1,stencilBuffer:!1}));let A=s===!0&&_.some(I=>I.needsDepthTexture===!0);A!==(a.depthTexture!==null)&&(A===!0&&c===null&&(c=new Ii(E,x),r===!0&&(c.format=Ni,c.type=Ws)),a.dispose(),a.depthTexture=A?c:null,a.resolveDepthBuffer=A,a.storeMultisampledDepthBuffer=A);for(let I=0;I<_.length;I++){let R=_[I];R.setSize&&R.setSize(E,x),A&&R.needsDepthTexture===!0&&R.setDepthTexture&&R.setDepthTexture(c)}},this.begin=function(w,E){if(m||w.toneMapping===gi&&_.length===0)return!1;if(b=E,E!==null){let x=E.width,A=E.height;(a.width!==x||a.height!==A)&&this.setSize(x,A)}return v===!1&&w.setRenderTarget(a),g=w.toneMapping,w.toneMapping=gi,!0},this.hasRenderPass=function(){return v},this.end=function(w,E){w.toneMapping=g,m=!0;let x=a,A=o;for(let I=0;I<_.length;I++){let R=_[I];R.enabled!==!1&&(R.render(w,A,x,E),R.needsSwap!==!1&&(x=A,A=A===o?l:o))}if(p!==w.outputColorSpace||y!==w.toneMapping){p=w.outputColorSpace,y=w.toneMapping,u.defines={},Ye.getTransfer(p)===ot&&(u.defines.SRGB_TRANSFER="");let I=ZS[y];I&&(u.defines[I]=""),u.needsUpdate=!0}u.uniforms.tDiffuse.value=x.texture,w.setRenderTarget(b),w.render(f,d),b=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),l!==null&&l.dispose(),h.dispose(),u.dispose()}}var Ug=new tn,Bg=new Ii(1,1),zg=new za(1),Hg=new Na,Vg=new jl,Gg=new Ba,yg=[],bg=[],vg=new Float32Array(16),xg=new Float32Array(9),_g=new Float32Array(4);function Vr(n,e,t){let i=n[0];if(i<=0||i>0)return n;let s=e*t,r=yg[s];if(r===void 0&&(r=new Float32Array(s),yg[s]=r),e!==0){i.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,n[a].toArray(r,o)}return r}function Bt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function zt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function sh(n,e){let t=bg[e];t===void 0&&(t=new Int32Array(e),bg[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function ew(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function tw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2fv(this.addr,e),zt(t,e)}}function nw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Bt(t,e))return;n.uniform3fv(this.addr,e),zt(t,e)}}function iw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4fv(this.addr,e),zt(t,e)}}function sw(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),zt(t,e)}else{if(Bt(t,i))return;_g.set(i),n.uniformMatrix2fv(this.addr,!1,_g),zt(t,i)}}function rw(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),zt(t,e)}else{if(Bt(t,i))return;xg.set(i),n.uniformMatrix3fv(this.addr,!1,xg),zt(t,i)}}function aw(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),zt(t,e)}else{if(Bt(t,i))return;vg.set(i),n.uniformMatrix4fv(this.addr,!1,vg),zt(t,i)}}function ow(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function lw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2iv(this.addr,e),zt(t,e)}}function cw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Bt(t,e))return;n.uniform3iv(this.addr,e),zt(t,e)}}function hw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4iv(this.addr,e),zt(t,e)}}function uw(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function dw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2uiv(this.addr,e),zt(t,e)}}function fw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Bt(t,e))return;n.uniform3uiv(this.addr,e),zt(t,e)}}function pw(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4uiv(this.addr,e),zt(t,e)}}function rh(n){return n.version===0&&(n.compareFunction=Ed,n.needsUpdate=!0),n}function mw(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_2D_SHADOW?r=rh(Bg):r=Ug,t.setTexture2D(e||r,s)}function gw(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture3D(e||Vg,s)}function yw(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_CUBE_SHADOW?r=rh(zg):r=Gg,t.setTextureCube(e||r,s)}function bw(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture2DArray(e||Hg,s)}function vw(n){switch(n){case 5126:return ew;case 35664:return tw;case 35665:return nw;case 35666:return iw;case 35674:return sw;case 35675:return rw;case 35676:return aw;case 5124:case 35670:return ow;case 35667:case 35671:return lw;case 35668:case 35672:return cw;case 35669:case 35673:return hw;case 5125:return uw;case 36294:return dw;case 36295:return fw;case 36296:return pw;case 35678:case 36198:case 36298:case 36306:case 35682:return mw;case 35679:case 36299:case 36307:return gw;case 35680:case 36300:case 36308:case 36293:return yw;case 36289:case 36303:case 36311:case 36292:return bw}}function xw(n,e){n.uniform1fv(this.addr,e)}function _w(n,e){let t=Vr(e,this.size,2);n.uniform2fv(this.addr,t)}function Sw(n,e){let t=Vr(e,this.size,3);n.uniform3fv(this.addr,t)}function ww(n,e){let t=Vr(e,this.size,4);n.uniform4fv(this.addr,t)}function Mw(n,e){let t=Vr(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Ew(n,e){let t=Vr(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Tw(n,e){let t=Vr(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Aw(n,e){n.uniform1iv(this.addr,e)}function Cw(n,e){n.uniform2iv(this.addr,e)}function Rw(n,e){n.uniform3iv(this.addr,e)}function Pw(n,e){n.uniform4iv(this.addr,e)}function Lw(n,e){n.uniform1uiv(this.addr,e)}function Iw(n,e){n.uniform2uiv(this.addr,e)}function kw(n,e){n.uniform3uiv(this.addr,e)}function Dw(n,e){n.uniform4uiv(this.addr,e)}function Nw(n,e,t){let i=this.cache,s=e.length,r=sh(t,s);Bt(i,r)||(n.uniform1iv(this.addr,r),zt(i,r));let a;this.type===n.SAMPLER_2D_SHADOW?a=rh(Bg):a=Ug;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function Ow(n,e,t){let i=this.cache,s=e.length,r=sh(t,s);Bt(i,r)||(n.uniform1iv(this.addr,r),zt(i,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||Vg,r[a])}function Fw(n,e,t){let i=this.cache,s=e.length,r=sh(t,s);Bt(i,r)||(n.uniform1iv(this.addr,r),zt(i,r));let a;this.type===n.SAMPLER_CUBE_SHADOW?a=rh(zg):a=Gg;for(let o=0;o!==s;++o)t.setTextureCube(e[o]||a,r[o])}function Uw(n,e,t){let i=this.cache,s=e.length,r=sh(t,s);Bt(i,r)||(n.uniform1iv(this.addr,r),zt(i,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Hg,r[a])}function Bw(n){switch(n){case 5126:return xw;case 35664:return _w;case 35665:return Sw;case 35666:return ww;case 35674:return Mw;case 35675:return Ew;case 35676:return Tw;case 5124:case 35670:return Aw;case 35667:case 35671:return Cw;case 35668:case 35672:return Rw;case 35669:case 35673:return Pw;case 5125:return Lw;case 36294:return Iw;case 36295:return kw;case 36296:return Dw;case 35678:case 36198:case 36298:case 36306:case 35682:return Nw;case 35679:case 36299:case 36307:return Ow;case 35680:case 36300:case 36308:case 36293:return Fw;case 36289:case 36303:case 36311:case 36292:return Uw}}var Ud=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=vw(t.type)}},Bd=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Bw(t.type)}},zd=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(e,t[o.id],i)}}},Od=/(\w+)(\])?(\[|\.)?/g;function Sg(n,e){n.seq.push(e),n.map[e.id]=e}function zw(n,e,t){let i=n.name,s=i.length;for(Od.lastIndex=0;;){let r=Od.exec(i),a=Od.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Sg(t,c===void 0?new Ud(o,n,e):new Bd(o,n,e));break}else{let u=t.map[o];u===void 0&&(u=new zd(o),Sg(t,u)),t=u}}}var Hr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<i;++a){let o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);zw(o,l,this)}let s=[],r=[];for(let a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,i,s){let r=this.map[t];r!==void 0&&r.setValue(e,i,s)}setOptional(e,t,i){let s=t[i];s!==void 0&&this.setValue(e,i,s)}static upload(e,t,i,s){for(let r=0,a=t.length;r!==a;++r){let o=t[r],l=i[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){let i=[];for(let s=0,r=e.length;s!==r;++s){let a=e[s];a.id in t&&i.push(a)}return i}};function wg(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var Hw=37297,Vw=0;function Gw(n,e){let t=n.split(`
`),i=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){let o=a+1;i.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return i.join(`
`)}var Mg=new Ue;function Ww(n){Ye._getMatrix(Mg,Ye.workingColorSpace,n);let e=`mat3( ${Mg.elements.map(t=>t.toFixed(4))} )`;switch(Ye.getTransfer(n)){case La:return[e,"LinearTransferOETF"];case ot:return[e,"sRGBTransferOETF"];default:return Le("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function Eg(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),r=(n.getShaderInfoLog(e)||"").trim();if(i&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+Gw(n.getShaderSource(e),o)}else return r}function $w(n,e){let t=Ww(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( ${t[0]} * value.rgb, value.a ) );`,"}"].join(`
`)}var Xw={[rd]:"Linear",[ad]:"Reinhard",[od]:"Cineon",[ld]:"ACESFilmic",[hd]:"AgX",[ud]:"Neutral",[cd]:"Custom"};function qw(n,e){let t=Xw[e];return t===void 0?(Le("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var th=new O;function Yw(){Ye.getLuminanceCoefficients(th);let n=th.x.toFixed(4),e=th.y.toFixed(4),t=th.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function jw(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(no).join(`
`)}function Jw(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function Kw(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let r=n.getActiveAttrib(e,s),a=r.name,o=1;r.type===n.FLOAT_MAT2&&(o=2),r.type===n.FLOAT_MAT3&&(o=3),r.type===n.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:n.getAttribLocation(e,a),locationSize:o}}return t}function no(n){return n!==""}function Tg(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows).replace(/NUM_LIGHT_PROBE_GRIDS/g,e.numLightProbeGrids)}function Ag(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var Zw=/^[ \t]*#include +<([\w\d./]+)>/gm;function Hd(n){return n.replace(Zw,Qw)}function Qw(n,e){let t=qe[e];if(t===void 0)throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">");return Hd(t)}var eM=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Cg(n){return n.replace(eM,tM)}function tM(n,e,t,i){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Rg(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var nM={[Xa]:"SHADOWMAP_TYPE_PCF",[Fr]:"SHADOWMAP_TYPE_VSM"};function iM(n){return nM[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var sM={[Br]:"ENVMAP_MODE_REFRACTION"};function rM(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":sM[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var aM={[sd]:"ENVMAP_BLENDING_MULTIPLY",[Ym]:"ENVMAP_BLENDING_MIX",[jm]:"ENVMAP_BLENDING_ADD"};function oM(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":aM[n.combine]||"ENVMAP_BLENDING_NONE"}function lM(n,e,t,i){let s=n.getContext(),r=t.defines,a=t.vertexShader,o=t.fragmentShader,l=iM(t),c=t.envMapPMREM===!0?"ENVMAP_TYPE_PMREM":"ENVMAP_TYPE_CUBE",h=rM(t),u=oM(t),f=jw(t),d=Jw(r),p=s.createProgram(),y,m,g=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(y=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d].filter(no).join(`
`),y.length>0&&(y+=`
`),m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d].filter(no).join(`
`),m.length>0&&(m+=`
`)):(y=[Rg(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.diffuseRoughnessMapUv?"#define DIFFUSE_ROUGHNESSMAP_UV "+t.diffuseRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(no).join(`
`),m=[Rg(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,d,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",t.envMapPMREM?"#define ENVMAP_MAX_LOD "+t.envMapMaxLod+".0":"",t.envMapPMREM?"#define ENVMAP_SIZE "+t.envMapSize+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughness?"#define USE_DIFFUSE_ROUGHNESS":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==gi?"#define TONE_MAPPING":"",t.toneMapping!==gi?qe.tonemapping_pars_fragment:"",t.toneMapping!==gi?qw("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",qe.colorspace_pars_fragment,$w("linearToOutputTexel",t.outputColorSpace),Yw(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(no).join(`
`)),a=Hd(a),a=Tg(a,t),a=Ag(a,t),o=Hd(o),o=Tg(o,t),o=Ag(o,t),a=Cg(a),o=Cg(o),t.isRawShaderMaterial!==!0&&(g=`#version 300 es
`,y=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+y,m=["#define varying in",t.glslVersion===eo?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===eo?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let b=g+y+a,_=g+m+o,v=wg(s,s.VERTEX_SHADER,b),w=wg(s,s.FRAGMENT_SHADER,_);s.attachShader(p,v),s.attachShader(p,w),t.index0AttributeName!==void 0?s.bindAttribLocation(p,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(p,0,"position"),s.linkProgram(p);function E(R){if(n.debug.checkShaderErrors){let D=s.getProgramInfoLog(p)||"",H=s.getShaderInfoLog(v)||"",X=s.getShaderInfoLog(w)||"",L=D.trim(),V=H.trim(),G=X.trim(),W=!0,te=!0;if(s.getProgramParameter(p,s.LINK_STATUS)===!1)if(W=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(s,p,v,w);else{let q=Eg(s,v,"vertex"),ee=Eg(s,w,"fragment");Fe("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(p,s.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+L+`
`+q+`
`+ee)}else L!==""?Le("WebGLProgram: Program Info Log:",L):(V===""||G==="")&&(te=!1);te&&(R.diagnostics={runnable:W,programLog:L,vertexShader:{log:V,prefix:y},fragmentShader:{log:G,prefix:m}})}s.deleteShader(v),s.deleteShader(w),x=new Hr(s,p),A=Kw(s,p)}let x;this.getUniforms=function(){return x===void 0&&E(this),x};let A;this.getAttributes=function(){return A===void 0&&E(this),A};let I=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return I===!1&&(I=s.getProgramParameter(p,Hw)),I},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(p),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Vw++,this.cacheKey=e,this.usedTimes=1,this.program=p,this.vertexShader=v,this.fragmentShader=w,this}var cM=0,Vd=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Gd(e),t.set(e,i)),i}},Gd=class{constructor(e){this.id=cM++,this.code=e,this.usedTimes=0}};function hM(n){return n===cs||n===Za||n===Qa}function uM(n,e,t,i,s,r){let a=new Oa,o=new Vd,l=new Set,c=[],h=new Map,u=i.logarithmicDepthBuffer,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function d(x){return l.add(x),x===0?"uv":`uv${x}`}function p(x,A,I,R,D,H){let X=R.fog,L=D.geometry,V=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?R.environment:null,G=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,W=e.get(x.envMap||V,G),te=f[x.type],q=i.precision;x.precision!==null&&(q=i.getMaxPrecision(x.precision),q!==x.precision&&Le("WebGLProgram.getParameters:",x.precision,"not supported, using",q,"instead."));let ee=L.morphAttributes.position||L.morphAttributes.normal||L.morphAttributes.color,ne=ee!==void 0?ee.length:0,be=0;L.morphAttributes.position!==void 0&&(be=1),L.morphAttributes.normal!==void 0&&(be=2),L.morphAttributes.color!==void 0&&(be=3);let De,J,me,we;if(te){let ge=vi[te];De=ge.vertexShader,J=ge.fragmentShader}else{De=x.vertexShader,J=x.fragmentShader;let ge=o.getVertexShaderStage(x),ht=o.getFragmentShaderStage(x);o.update(x,ge,ht),me=ge.id,we=ht.id}let Ie=n.getRenderTarget(),ve=n.state.buffers.depth.getReversed(),He=D.isInstancedMesh===!0,At=D.isBatchedMesh===!0,Ne=!!x.map,ct=!!x.matcap,ut=!!W,Je=ut&&W.isPMREMTexture===!0,Kt=!!x.aoMap,Nt=!!x.lightMap,yn=!!x.bumpMap&&x.wireframe===!1,_t=!!x.normalMap,oi=!!x.displacementMap,Vt=!!x.emissiveMap,On=!!x.metalnessMap,Fn=!!x.roughnessMap,Un=x.anisotropy>0,F=x.clearcoat>0,Bn=x.diffuseRoughness>0,yt=x.dispersion>0,bt=x.retroreflectivity>0,pe=x.iridescence>0,Ot=x.sheen>0,ke=x.transmission>0,Be=Un&&!!x.anisotropyMap,C=F&&!!x.clearcoatMap,S=F&&!!x.clearcoatNormalMap,B=F&&!!x.clearcoatRoughnessMap,ie=Bn&&!!x.diffuseRoughnessMap,Q=pe&&!!x.iridescenceMap,oe=pe&&!!x.iridescenceThicknessMap,de=Ot&&!!x.sheenColorMap,j=Ot&&!!x.sheenRoughnessMap,K=!!x.specularMap,ce=!!x.specularColorMap,P=!!x.specularIntensityMap,Z=ke&&!!x.transmissionMap,Y=ke&&!!x.thicknessMap,he=!!x.gradientMap,ae=!!x.alphaMap,le=x.alphaTest>0,Ae=!!x.alphaHash,We=!!x.extensions,se=gi;x.toneMapped&&(Ie===null||Ie.isXRRenderTarget===!0)&&(se=n.toneMapping);let Re=Je?W.isCompressedCubeTexture?W.image[0].mipmaps:W.mipmaps:null,Ve={shaderID:te,shaderType:x.type,shaderName:x.name,vertexShader:De,fragmentShader:J,defines:x.defines,customVertexShaderID:me,customFragmentShaderID:we,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:q,batching:At,batchingColor:At&&D._colorsTexture!==null,instancing:He,instancingColor:He&&D.instanceColor!==null,instancingMorph:He&&D.morphTexture!==null,outputColorSpace:Ie===null?n.outputColorSpace:Ie.isXRRenderTarget===!0?Ie.texture.colorSpace:Ye.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Ne,matcap:ct,envMap:ut,envMapMode:ut&&W.mapping,envMapPMREM:Je,envMapMaxLod:Je?Re.length-1:null,envMapSize:Je?Re[0].width:null,aoMap:Kt,lightMap:Nt,bumpMap:yn,normalMap:_t,displacementMap:oi,emissiveMap:Vt,normalMapObjectSpace:_t&&x.normalMapType===Zm,normalMapTangentSpace:_t&&x.normalMapType===xd,packedNormalMap:_t&&x.normalMapType===xd&&hM(x.normalMap.format),metalnessMap:On,roughnessMap:Fn,anisotropy:Un,anisotropyMap:Be,clearcoat:F,clearcoatMap:C,clearcoatNormalMap:S,clearcoatRoughnessMap:B,diffuseRoughness:Bn,diffuseRoughnessMap:ie,dispersion:yt,retroreflection:bt,iridescence:pe,iridescenceMap:Q,iridescenceThicknessMap:oe,sheen:Ot,sheenColorMap:de,sheenRoughnessMap:j,specularMap:K,specularColorMap:ce,specularIntensityMap:P,transmission:ke,transmissionMap:Z,thicknessMap:Y,gradientMap:he,opaque:x.transparent===!1&&x.blending===Ur&&x.alphaToCoverage===!1,alphaMap:ae,alphaTest:le,alphaHash:Ae,combine:x.combine,mapUv:Ne&&d(x.map.channel),aoMapUv:Kt&&d(x.aoMap.channel),lightMapUv:Nt&&d(x.lightMap.channel),bumpMapUv:yn&&d(x.bumpMap.channel),normalMapUv:_t&&d(x.normalMap.channel),displacementMapUv:oi&&d(x.displacementMap.channel),emissiveMapUv:Vt&&d(x.emissiveMap.channel),metalnessMapUv:On&&d(x.metalnessMap.channel),roughnessMapUv:Fn&&d(x.roughnessMap.channel),anisotropyMapUv:Be&&d(x.anisotropyMap.channel),clearcoatMapUv:C&&d(x.clearcoatMap.channel),clearcoatNormalMapUv:S&&d(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:B&&d(x.clearcoatRoughnessMap.channel),diffuseRoughnessMapUv:ie&&d(x.diffuseRoughnessMap.channel),iridescenceMapUv:Q&&d(x.iridescenceMap.channel),iridescenceThicknessMapUv:oe&&d(x.iridescenceThicknessMap.channel),sheenColorMapUv:de&&d(x.sheenColorMap.channel),sheenRoughnessMapUv:j&&d(x.sheenRoughnessMap.channel),specularMapUv:K&&d(x.specularMap.channel),specularColorMapUv:ce&&d(x.specularColorMap.channel),specularIntensityMapUv:P&&d(x.specularIntensityMap.channel),transmissionMapUv:Z&&d(x.transmissionMap.channel),thicknessMapUv:Y&&d(x.thicknessMap.channel),alphaMapUv:ae&&d(x.alphaMap.channel),vertexTangents:!!L.attributes.tangent&&(_t||Un),vertexNormals:!!L.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!L.attributes.color&&L.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!L.attributes.uv&&(Ne||ae),fog:!!X,useFog:x.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||L.attributes.normal===void 0&&_t===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:ve,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:L.attributes.position!==void 0,morphTargets:L.morphAttributes.position!==void 0,morphNormals:L.morphAttributes.normal!==void 0,morphColors:L.morphAttributes.color!==void 0,morphTargetsCount:ne,morphTextureStride:be,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:H.filter(ge=>ge.texture!==null).length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:x.dithering,shadowMapEnabled:n.shadowMap.enabled&&I.length>0,shadowMapType:n.shadowMap.type,toneMapping:se,decodeVideoTexture:Ne&&x.map.isVideoTexture===!0&&Ye.getTransfer(x.map.colorSpace)===ot,decodeVideoTextureEmissive:Vt&&x.emissiveMap.isVideoTexture===!0&&Ye.getTransfer(x.emissiveMap.colorSpace)===ot,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===In,flipSided:x.side===gn,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:We&&x.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(We&&x.extensions.multiDraw===!0||At)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return Ve.vertexUv1s=l.has(1),Ve.vertexUv2s=l.has(2),Ve.vertexUv3s=l.has(3),l.clear(),Ve}function y(x){let A=[];if(x.shaderID?A.push(x.shaderID):(A.push(x.customVertexShaderID),A.push(x.customFragmentShaderID)),x.defines!==void 0)for(let I in x.defines)A.push(I),A.push(x.defines[I]);return x.isRawShaderMaterial===!1&&(m(A,x),g(A,x),A.push(n.outputColorSpace)),A.push(x.customProgramCacheKey),A.join()}function m(x,A){x.push(A.precision),x.push(A.outputColorSpace),x.push(A.envMapMode),x.push(A.envMapPMREM),x.push(A.envMapMaxLod),x.push(A.envMapSize),x.push(A.mapUv),x.push(A.alphaMapUv),x.push(A.lightMapUv),x.push(A.aoMapUv),x.push(A.bumpMapUv),x.push(A.normalMapUv),x.push(A.displacementMapUv),x.push(A.emissiveMapUv),x.push(A.metalnessMapUv),x.push(A.roughnessMapUv),x.push(A.anisotropyMapUv),x.push(A.clearcoatMapUv),x.push(A.clearcoatNormalMapUv),x.push(A.clearcoatRoughnessMapUv),x.push(A.diffuseRoughnessMapUv),x.push(A.iridescenceMapUv),x.push(A.iridescenceThicknessMapUv),x.push(A.sheenColorMapUv),x.push(A.sheenRoughnessMapUv),x.push(A.specularMapUv),x.push(A.specularColorMapUv),x.push(A.specularIntensityMapUv),x.push(A.transmissionMapUv),x.push(A.thicknessMapUv),x.push(A.combine),x.push(A.fogExp2),x.push(A.sizeAttenuation),x.push(A.morphTargetsCount),x.push(A.numSunLights),x.push(A.numDirLights),x.push(A.numPointLights),x.push(A.numSpotLights),x.push(A.numSpotLightMaps),x.push(A.numHemiLights),x.push(A.numRectAreaLights),x.push(A.numSunLightShadows),x.push(A.numDirLightShadows),x.push(A.numPointLightShadows),x.push(A.numSpotLightShadows),x.push(A.numSpotLightShadowsWithMaps),x.push(A.numLightProbes),x.push(A.numLightProbeGrids),x.push(A.shadowMapType),x.push(A.toneMapping),x.push(A.numClippingPlanes),x.push(A.numClipIntersection),x.push(A.depthPacking)}function g(x,A){a.disableAll(),A.instancing&&a.enable(0),A.instancingColor&&a.enable(1),A.instancingMorph&&a.enable(2),A.matcap&&a.enable(3),A.envMap&&a.enable(4),A.normalMapObjectSpace&&a.enable(5),A.normalMapTangentSpace&&a.enable(6),A.clearcoat&&a.enable(7),A.iridescence&&a.enable(8),A.alphaTest&&a.enable(9),A.vertexColors&&a.enable(10),A.vertexAlphas&&a.enable(11),A.vertexUv1s&&a.enable(12),A.vertexUv2s&&a.enable(13),A.vertexUv3s&&a.enable(14),A.vertexTangents&&a.enable(15),A.anisotropy&&a.enable(16),A.alphaHash&&a.enable(17),A.batching&&a.enable(18),A.dispersion&&a.enable(19),A.retroreflection&&a.enable(24),A.diffuseRoughness&&a.enable(25),A.batchingColor&&a.enable(20),A.gradientMap&&a.enable(21),A.packedNormalMap&&a.enable(22),A.vertexNormals&&a.enable(23),x.push(a.mask),a.disableAll(),A.fog&&a.enable(0),A.useFog&&a.enable(1),A.flatShading&&a.enable(2),A.logarithmicDepthBuffer&&a.enable(3),A.reversedDepthBuffer&&a.enable(4),A.skinning&&a.enable(5),A.morphTargets&&a.enable(6),A.morphNormals&&a.enable(7),A.morphColors&&a.enable(8),A.premultipliedAlpha&&a.enable(9),A.shadowMapEnabled&&a.enable(10),A.doubleSided&&a.enable(11),A.flipSided&&a.enable(12),A.useDepthPacking&&a.enable(13),A.dithering&&a.enable(14),A.transmission&&a.enable(15),A.sheen&&a.enable(16),A.opaque&&a.enable(17),A.pointsUvs&&a.enable(18),A.decodeVideoTexture&&a.enable(19),A.decodeVideoTextureEmissive&&a.enable(20),A.alphaToCoverage&&a.enable(21),A.numLightProbeGrids>0&&a.enable(22),A.hasPositionAttribute&&a.enable(23),x.push(a.mask)}function b(x){let A=f[x.type],I;if(A){let R=vi[A];I=hg.clone(R.uniforms)}else I=x.uniforms;return I}function _(x,A){let I=h.get(A);return I!==void 0?++I.usedTimes:(I=new lM(n,A,x,s),c.push(I),h.set(A,I)),I}function v(x){if(--x.usedTimes===0){let A=c.indexOf(x);c[A]=c[c.length-1],c.pop(),h.delete(x.cacheKey),x.destroy()}}function w(x){o.remove(x)}function E(){o.dispose()}return{getParameters:p,getProgramCacheKey:y,getUniforms:b,acquireProgram:_,releaseProgram:v,releaseShaderCache:w,programs:c,dispose:E}}function dM(){let n=new WeakMap;function e(a){return n.has(a)}function t(a){let o=n.get(a);return o===void 0&&(o={},n.set(a,o)),o}function i(a){n.delete(a)}function s(a,o,l){n.get(a)[o]=l}function r(){n=new WeakMap}return{has:e,get:t,remove:i,update:s,dispose:r}}function fM(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function Pg(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function Lg(){let n=[],e=0,t=[],i=[],s=[];function r(){e=0,t.length=0,i.length=0,s.length=0}function a(f){let d=0;return f.isInstancedMesh&&(d+=2),f.isSkinnedMesh&&(d+=1),d}function o(f,d,p,y,m,g){let b=n[e];return b===void 0?(b={id:f.id,object:f,geometry:d,material:p,materialVariant:a(f),groupOrder:y,renderOrder:f.renderOrder,z:m,group:g},n[e]=b):(b.id=f.id,b.object=f,b.geometry=d,b.material=p,b.materialVariant=a(f),b.groupOrder=y,b.renderOrder=f.renderOrder,b.z=m,b.group=g),e++,b}function l(f,d,p,y,m,g,b){b.reversedDepth===!0&&(m=-m);let _=o(f,d,p,y,m,g);p.transmission>0?i.push(_):p.transparent===!0?s.push(_):t.push(_)}function c(f,d,p,y,m,g){let b=o(f,d,p,y,m,g);p.transmission>0?i.unshift(b):p.transparent===!0?s.unshift(b):t.unshift(b)}function h(f,d){t.length>1&&t.sort(f||fM),i.length>1&&i.sort(d||Pg),s.length>1&&s.sort(d||Pg)}function u(){for(let f=e,d=n.length;f<d;f++){let p=n[f];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:i,transparent:s,init:r,push:l,unshift:c,finish:u,sort:h}}function pM(){let n=new WeakMap;function e(i,s){let r=n.get(i),a;return r===void 0?(a=new Lg,n.set(i,[a])):s>=r.length?(a=new Lg,r.push(a)):a=r[s],a}function t(){n=new WeakMap}return{get:e,dispose:t}}function mM(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new O,color:new Xe};break;case"SpotLight":t={position:new O,direction:new O,color:new Xe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new O,color:new Xe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new O,skyColor:new Xe,groundColor:new Xe};break;case"RectAreaLight":t={color:new Xe,position:new O,halfWidth:new O,halfHeight:new O};break}return n[e.id]=t,t}}}function gM(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Pe};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Pe};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Pe,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var yM=0;function bM(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function vM(n){let e=new mM,t=gM(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new O);let s=new O,r=new ft,a=new ft;function o(c){let h=0,u=0,f=0;for(let H=0;H<9;H++)i.probe[H].set(0,0,0);let d=0,p=0,y=0,m=0,g=0,b=0,_=0,v=0,w=0,E=0,x=0,A=0,I=0,R=0;c.sort(bM);for(let H=0,X=c.length;H<X;H++){let L=c[H],V=L.color,G=L.intensity,W=L.distance,te=null;if(L.shadow&&L.shadow.map&&(L.shadow.map.texture.format===cs?te=L.shadow.map.texture:te=L.shadow.map.depthTexture||L.shadow.map.texture),L.isAmbientLight)h+=V.r*G,u+=V.g*G,f+=V.b*G;else if(L.isLightProbe){for(let q=0;q<9;q++)i.probe[q].addScaledVector(L.sh.coefficients[q],G);R++}else if(L.isSunLight){let q=e.get(L);if(q.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){let ee=L.shadow,ne=t.get(L);ne.shadowIntensity=ee.intensity,ne.shadowBias=ee.bias,ne.shadowNormalBias=ee.normalBias,ne.shadowRadius=ee.radius,ne.shadowMapSize.copy(ee.mapSize).multiply(ee.getFrameExtents()),i.sunShadow[p]=ne,i.sunShadowMap[p]=te;let be=ee.getViewportCount();for(let De=0;De<be;De++)i.sunShadowMatrix[y+De]=ee.getMatrix(De),i.sunShadowCascade[y+De]=ee._cascadeData[De];y+=be,p++}i.sun[d]=q,d++}else if(L.isDirectionalLight){let q=e.get(L);if(q.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){let ee=L.shadow,ne=t.get(L);ne.shadowIntensity=ee.intensity,ne.shadowBias=ee.bias,ne.shadowNormalBias=ee.normalBias,ne.shadowRadius=ee.radius,ne.shadowMapSize=ee.mapSize,i.directionalShadow[m]=ne,i.directionalShadowMap[m]=te,i.directionalShadowMatrix[m]=L.shadow.matrix,w++}i.directional[m]=q,m++}else if(L.isSpotLight){let q=e.get(L);q.position.setFromMatrixPosition(L.matrixWorld),q.color.copy(V).multiplyScalar(G),q.distance=W,q.coneCos=Math.cos(L.angle),q.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),q.decay=L.decay,i.spot[b]=q;let ee=L.shadow;if(L.map&&(i.spotLightMap[A]=L.map,A++,ee.updateMatrices(L),L.castShadow&&I++),i.spotLightMatrix[b]=ee.matrix,L.castShadow){let ne=t.get(L);ne.shadowIntensity=ee.intensity,ne.shadowBias=ee.bias,ne.shadowNormalBias=ee.normalBias,ne.shadowRadius=ee.radius,ne.shadowMapSize=ee.mapSize,i.spotShadow[b]=ne,i.spotShadowMap[b]=te,x++}b++}else if(L.isRectAreaLight){let q=e.get(L);q.color.copy(V).multiplyScalar(G),q.halfWidth.set(L.width*.5,0,0),q.halfHeight.set(0,L.height*.5,0),i.rectArea[_]=q,_++}else if(L.isPointLight){let q=e.get(L);if(q.color.copy(L.color).multiplyScalar(L.intensity),q.distance=L.distance,q.decay=L.decay,L.castShadow){let ee=L.shadow,ne=t.get(L);ne.shadowIntensity=ee.intensity,ne.shadowBias=ee.bias,ne.shadowNormalBias=ee.normalBias,ne.shadowRadius=ee.radius,ne.shadowMapSize=ee.mapSize,ne.shadowCameraNear=ee.camera.near,ne.shadowCameraFar=ee.camera.far,i.pointShadow[g]=ne,i.pointShadowMap[g]=te,i.pointShadowMatrix[g]=L.shadow.matrix,E++}i.point[g]=q,g++}else if(L.isHemisphereLight){let q=e.get(L);q.skyColor.copy(L.color).multiplyScalar(G),q.groundColor.copy(L.groundColor).multiplyScalar(G),i.hemi[v]=q,v++}}_>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ye.LTC_FLOAT_1,i.rectAreaLTC2=ye.LTC_FLOAT_2):(i.rectAreaLTC1=ye.LTC_HALF_1,i.rectAreaLTC2=ye.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=u,i.ambient[2]=f;let D=i.hash;(D.sunLength!==d||D.directionalLength!==m||D.pointLength!==g||D.spotLength!==b||D.rectAreaLength!==_||D.hemiLength!==v||D.numSunShadows!==p||D.numDirectionalShadows!==w||D.numPointShadows!==E||D.numSpotShadows!==x||D.numSpotMaps!==A||D.numLightProbes!==R)&&(i.sun.length=d,i.directional.length=m,i.spot.length=b,i.rectArea.length=_,i.point.length=g,i.hemi.length=v,i.sunShadow.length=p,i.sunShadowMap.length=p,i.sunShadowMatrix.length=y,i.sunShadowCascade.length=y,i.directionalShadow.length=w,i.directionalShadowMap.length=w,i.directionalShadowMatrix.length=w,i.pointShadow.length=E,i.pointShadowMap.length=E,i.pointShadowMatrix.length=E,i.spotShadow.length=x,i.spotShadowMap.length=x,i.spotLightMatrix.length=x+A-I,i.spotLightMap.length=A,i.numSpotLightShadowsWithMaps=I,i.numLightProbes=R,D.sunLength=d,D.directionalLength=m,D.pointLength=g,D.spotLength=b,D.rectAreaLength=_,D.hemiLength=v,D.numSunShadows=p,D.numDirectionalShadows=w,D.numPointShadows=E,D.numSpotShadows=x,D.numSpotMaps=A,D.numLightProbes=R,i.version=yM++)}function l(c,h){let u=0,f=0,d=0,p=0,y=0,m=0,g=h.matrixWorldInverse;for(let b=0,_=c.length;b<_;b++){let v=c[b];if(v.isSunLight){let w=i.sun[u];w.direction.setFromMatrixPosition(v.matrixWorld),w.direction.transformDirection(g),u++}else if(v.isDirectionalLight){let w=i.directional[f];w.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),w.direction.sub(s),w.direction.transformDirection(g),f++}else if(v.isSpotLight){let w=i.spot[p];w.position.setFromMatrixPosition(v.matrixWorld),w.position.applyMatrix4(g),w.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),w.direction.sub(s),w.direction.transformDirection(g),p++}else if(v.isRectAreaLight){let w=i.rectArea[y];w.position.setFromMatrixPosition(v.matrixWorld),w.position.applyMatrix4(g),a.identity(),r.copy(v.matrixWorld),r.premultiply(g),a.extractRotation(r),w.halfWidth.set(v.width*.5,0,0),w.halfHeight.set(0,v.height*.5,0),w.halfWidth.applyMatrix4(a),w.halfHeight.applyMatrix4(a),y++}else if(v.isPointLight){let w=i.point[d];w.position.setFromMatrixPosition(v.matrixWorld),w.position.applyMatrix4(g),d++}else if(v.isHemisphereLight){let w=i.hemi[m];w.direction.setFromMatrixPosition(v.matrixWorld),w.direction.transformDirection(g),m++}}}return{setup:o,setupView:l,state:i}}function Ig(n){let e=new vM(n),t=[],i=[],s=[];function r(u){h.camera=u,t.length=0,i.length=0,s.length=0}function a(u){u.isLightProbeGrid?s.push(u):t.push(u)}function o(u){i.push(u)}function l(){e.setup(t),s.sort((u,f)=>u.priority-f.priority||u.id-f.id)}function c(u){e.setupView(t,u)}let h={lightsArray:t,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:h,setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function xM(n){let e=new WeakMap;function t(s,r=0){let a=e.get(s),o;return a===void 0?(o=new Ig(n),e.set(s,[o])):r>=a.length?(o=new Ig(n),a.push(o)):o=a[r],o}function i(){e=new WeakMap}return{get:t,dispose:i}}var _M=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,SM=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,wM=[new O(1,0,0),new O(-1,0,0),new O(0,1,0),new O(0,-1,0),new O(0,0,1),new O(0,0,-1)],MM=[new O(0,-1,0),new O(0,-1,0),new O(0,0,1),new O(0,0,-1),new O(0,-1,0),new O(0,-1,0)],kg=new ft,to=new O,Fd=new O;function EM(n,e,t){let i=new Us,s=new Pe,r=new Pe,a=new lt,o=new tc,l=new nc,c={},h=t.maxTextureSize,u={[ls]:gn,[gn]:ls,[In]:In},f=new Rn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Pe},radius:{value:4}},vertexShader:_M,fragmentShader:SM}),d=f.clone();d.defines.HORIZONTAL_PASS=1;let p=new xt;p.setAttribute("position",new Dt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let y=new Jt(p,f),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Xa;let g=this.type;this.render=function(E,x,A){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;this.type===Rm&&(Le("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Xa);let I=n.getRenderTarget(),R=n.getActiveCubeFace(),D=n.getActiveMipmapLevel(),H=n.state;H.setBlending(ki),H.buffers.depth.getReversed()===!0?H.buffers.color.setClear(0,0,0,0):H.buffers.color.setClear(1,1,1,1),H.buffers.depth.setTest(!0),H.setScissorTest(!1);let X=g!==this.type;X&&x.traverse(function(L){L.material&&(Array.isArray(L.material)?L.material.forEach(V=>V.needsUpdate=!0):L.material.needsUpdate=!0)});for(let L=0,V=E.length;L<V;L++){let G=E[L],W=G.shadow;if(W===void 0){Le("WebGLShadowMap:",G,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;s.copy(W.mapSize);let te=W.getFrameExtents();s.multiply(te),r.copy(W.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/te.x),s.x=r.x*te.x,W.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/te.y),s.y=r.y*te.y,W.mapSize.y=r.y));let q=n.state.buffers.depth.getReversed();if(W.camera._reversedDepth=q,W.map===null||X===!0){if(W.map!==null&&(W.map.depthTexture!==null&&(W.map.depthTexture.dispose(),W.map.depthTexture=null),W.map.dispose()),this.type===Fr){if(G.isPointLight){Le("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}W.map=new mn(s.x,s.y,{format:cs,type:ii,minFilter:pn,magFilter:pn,generateMipmaps:!1}),W.map.texture.name=G.name+".shadowMap",W.map.depthTexture=new Ii(s.x,s.y,Dn),W.map.depthTexture.name=G.name+".shadowMapDepth",W.map.depthTexture.format=Pi,W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=vt,W.map.depthTexture.magFilter=vt}else G.isPointLight?(W.map=new io(s.x),W.map.depthTexture=new za(s.x,ni)):(W.map=new mn(s.x,s.y),W.map.depthTexture=new Ii(s.x,s.y,ni)),W.map.depthTexture.name=G.name+".shadowMap",W.map.depthTexture.format=Pi,this.type===Xa?(W.map.depthTexture.compareFunction=q?Md:wd,W.map.depthTexture.minFilter=pn,W.map.depthTexture.magFilter=pn):(W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=vt,W.map.depthTexture.magFilter=vt);W.camera.updateProjectionMatrix()}W.map.isWebGLCubeRenderTarget!==!0&&(W.map.width!==s.x||W.map.height!==s.y)&&W.map.setSize(s.x,s.y);let ee=W.map.isWebGLCubeRenderTarget?6:W.getViewportCount();G.isPointLight!==!0&&W.updateMatrices(G,A);let ne=(W.camera.layers.mask&4294967294)!==0?W.camera.layers:A.layers;for(let be=0;be<ee;be++){let De=W.getCamera(be);if(G.isPointLight){let J=W.camera,me=W.matrix,we=G.distance||J.far;we!==J.far&&(J.far=we,J.updateProjectionMatrix()),to.setFromMatrixPosition(G.matrixWorld),J.position.copy(to),Fd.copy(J.position),Fd.add(wM[be]),J.up.copy(MM[be]),J.lookAt(Fd),J.updateMatrixWorld(),me.makeTranslation(-to.x,-to.y,-to.z),kg.multiplyMatrices(J.projectionMatrix,J.matrixWorldInverse),W._frustum.setFromProjectionMatrix(kg,J.coordinateSystem,J.reversedDepth)}if(W.map.isWebGLCubeRenderTarget)n.setRenderTarget(W.map,be),n.clear();else{be===0&&(n.setRenderTarget(W.map),n.clear());let J=W.getViewport(be);a.set(r.x*J.x,r.y*J.y,r.x*J.z,r.y*J.w),H.viewport(a)}i=W.getFrustum(be),v(x,A,De,G,ne,this.type)}W.isPointLightShadow!==!0&&this.type===Fr&&b(W,A),W.needsUpdate=!1}g=this.type,m.needsUpdate=!1,n.setRenderTarget(I,R,D)};function b(E,x){let A=e.update(y);f.defines.VSM_SAMPLES!==E.blurSamples&&(f.defines.VSM_SAMPLES=E.blurSamples,d.defines.VSM_SAMPLES=E.blurSamples,f.needsUpdate=!0,d.needsUpdate=!0),E.mapPass===null?E.mapPass=new mn(s.x,s.y,{format:cs,type:ii}):(E.mapPass.width!==E.map.width||E.mapPass.height!==E.map.height)&&E.mapPass.setSize(E.map.width,E.map.height),f.uniforms.shadow_pass.value=E.map.depthTexture,f.uniforms.resolution.value.set(E.map.width,E.map.height),f.uniforms.radius.value=E.radius,n.setRenderTarget(E.mapPass),n.clear(),n.renderBufferDirect(x,null,A,f,y,null),d.uniforms.shadow_pass.value=E.mapPass.texture,d.uniforms.resolution.value.set(E.map.width,E.map.height),d.uniforms.radius.value=E.radius,n.setRenderTarget(E.map),n.clear(),n.renderBufferDirect(x,null,A,d,y,null)}function _(E,x,A,I){let R=null,D=A.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(D!==void 0)R=D;else if(R=A.isPointLight===!0?l:o,n.localClippingEnabled&&x.clipShadows===!0&&Array.isArray(x.clippingPlanes)&&x.clippingPlanes.length!==0||x.displacementMap&&x.displacementScale!==0||x.alphaMap&&x.alphaTest>0||x.map&&x.alphaTest>0||x.alphaToCoverage===!0){let H=R.uuid,X=x.uuid,L=c[H];L===void 0&&(L={},c[H]=L);let V=L[X];V===void 0&&(V=R.clone(),L[X]=V,x.addEventListener("dispose",w)),R=V}if(R.visible=x.visible,R.wireframe=x.wireframe,I===Fr?R.side=x.shadowSide!==null?x.shadowSide:x.side:R.side=x.shadowSide!==null?x.shadowSide:u[x.side],R.alphaMap=x.alphaMap,R.alphaTest=x.alphaToCoverage===!0?.5:x.alphaTest,R.map=x.map,R.clipShadows=x.clipShadows,R.clippingPlanes=x.clippingPlanes,R.clipIntersection=x.clipIntersection,R.displacementMap=x.displacementMap,R.displacementScale=x.displacementScale,R.displacementBias=x.displacementBias,R.wireframeLinewidth=x.wireframeLinewidth,R.linewidth=x.linewidth,A.isPointLight===!0&&R.isMeshDistanceMaterial===!0){let H=n.properties.get(R);H.light=A}return R}function v(E,x,A,I,R,D){if(E.visible===!1)return;if(E.layers.test(R)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&D===Fr)&&(!E.frustumCulled||E.intersectsFrustum(i))){E.modelViewMatrix.multiplyMatrices(A.matrixWorldInverse,E.matrixWorld);let L=e.update(E),V=E.material;if(Array.isArray(V)){let G=L.groups;for(let W=0,te=G.length;W<te;W++){let q=G[W],ee=V[q.materialIndex];if(ee&&ee.visible){let ne=_(E,ee,I,D);E.onBeforeShadow(n,E,x,A,L,ne,q),n.renderBufferDirect(A,null,L,ne,E,q),E.onAfterShadow(n,E,x,A,L,ne,q)}}}else if(V.visible){let G=_(E,V,I,D);E.onBeforeShadow(n,E,x,A,L,G,null),n.renderBufferDirect(A,null,L,G,E,null),E.onAfterShadow(n,E,x,A,L,G,null)}}let X=E.children;for(let L=0,V=X.length;L<V;L++)v(X[L],x,A,I,R,D)}function w(E){E.target.removeEventListener("dispose",w);for(let A in c){let I=c[A],R=E.target.uuid;R in I&&(I[R].dispose(),delete I[R])}}}function TM(n,e){function t(){let P=!1,Z=new lt,Y=null,he=new lt(0,0,0,0);return{setMask:function(ae){Y!==ae&&!P&&(n.colorMask(ae,ae,ae,ae),Y=ae)},setLocked:function(ae){P=ae},setClear:function(ae,le,Ae,We,se){se===!0&&(ae*=We,le*=We,Ae*=We),Z.set(ae,le,Ae,We),he.equals(Z)===!1&&(n.clearColor(ae,le,Ae,We),he.copy(Z))},reset:function(){P=!1,Y=null,he.set(-1,0,0,0)}}}function i(){let P=!1,Z=!1,Y=null,he=null,ae=null;return{setReversed:function(le){if(Z!==le){let Ae=e.get("EXT_clip_control");le?Ae.clipControlEXT(Ae.LOWER_LEFT_EXT,Ae.ZERO_TO_ONE_EXT):Ae.clipControlEXT(Ae.LOWER_LEFT_EXT,Ae.NEGATIVE_ONE_TO_ONE_EXT),Z=le;let We=ae;ae=null,this.setClear(We)}},getReversed:function(){return Z},setTest:function(le){le?ve(n.DEPTH_TEST):He(n.DEPTH_TEST)},setMask:function(le){Y!==le&&!P&&(n.depthMask(le),Y=le)},setFunc:function(le){if(Z&&(le=lg[le]),he!==le){switch(le){case Fl:n.depthFunc(n.NEVER);break;case Ul:n.depthFunc(n.ALWAYS);break;case Bl:n.depthFunc(n.LESS);break;case Sr:n.depthFunc(n.LEQUAL);break;case zl:n.depthFunc(n.EQUAL);break;case Hl:n.depthFunc(n.GEQUAL);break;case Vl:n.depthFunc(n.GREATER);break;case Gl:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}he=le}},setLocked:function(le){P=le},setClear:function(le){ae!==le&&(ae=le,Z&&(le=1-le),n.clearDepth(le))},reset:function(){P=!1,Y=null,he=null,ae=null,Z=!1}}}function s(){let P=!1,Z=null,Y=null,he=null,ae=null,le=null,Ae=null,We=null,se=null;return{setTest:function(Re){P||(Re?ve(n.STENCIL_TEST):He(n.STENCIL_TEST))},setMask:function(Re){Z!==Re&&!P&&(n.stencilMask(Re),Z=Re)},setFunc:function(Re,Ve,ge){(Y!==Re||he!==Ve||ae!==ge)&&(n.stencilFunc(Re,Ve,ge),Y=Re,he=Ve,ae=ge)},setOp:function(Re,Ve,ge){(le!==Re||Ae!==Ve||We!==ge)&&(n.stencilOp(Re,Ve,ge),le=Re,Ae=Ve,We=ge)},setLocked:function(Re){P=Re},setClear:function(Re){se!==Re&&(n.clearStencil(Re),se=Re)},reset:function(){P=!1,Z=null,Y=null,he=null,ae=null,le=null,Ae=null,We=null,se=null}}}let r=new t,a=new i,o=new s,l={},c=new WeakMap,h={},u={},f={},d=new WeakMap,p=[],y=null,m=!1,g=null,b=null,_=null,v=null,w=null,E=null,x=null,A=new Xe(0,0,0),I=0,R=!1,D=null,H=null,X=null,L=null,V=null,G=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),W=!1,te=0,q=n.getParameter(n.VERSION);q.indexOf("WebGL")!==-1?(te=parseFloat(/^WebGL (\d)/.exec(q)[1]),W=te>=1):q.indexOf("OpenGL ES")!==-1&&(te=parseFloat(/^OpenGL ES (\d)/.exec(q)[1]),W=te>=2);let ee=null,ne={},be=n.getParameter(n.SCISSOR_BOX),De=n.getParameter(n.VIEWPORT),J=new lt().fromArray(be),me=new lt().fromArray(De);function we(P,Z,Y,he){let ae=new Uint8Array(4),le=n.createTexture();n.bindTexture(P,le),n.texParameteri(P,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(P,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Ae=0;Ae<Y;Ae++)P===n.TEXTURE_3D||P===n.TEXTURE_2D_ARRAY?n.texImage3D(Z,0,n.RGBA,1,1,he,0,n.RGBA,n.UNSIGNED_BYTE,ae):n.texImage2D(Z+Ae,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ae);return le}let Ie={};Ie[n.TEXTURE_2D]=we(n.TEXTURE_2D,n.TEXTURE_2D,1),Ie[n.TEXTURE_CUBE_MAP]=we(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),Ie[n.TEXTURE_2D_ARRAY]=we(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),Ie[n.TEXTURE_3D]=we(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),ve(n.DEPTH_TEST),a.setFunc(Sr),yn(!1),_t(Zu),ve(n.CULL_FACE),Kt(ki);function ve(P){h[P]!==!0&&(n.enable(P),h[P]=!0)}function He(P){h[P]!==!1&&(n.disable(P),h[P]=!1)}function At(P,Z){return f[P]!==Z?(n.bindFramebuffer(P,Z),f[P]=Z,P===n.DRAW_FRAMEBUFFER&&(f[n.FRAMEBUFFER]=Z),P===n.FRAMEBUFFER&&(f[n.DRAW_FRAMEBUFFER]=Z),!0):!1}function Ne(P,Z){let Y=p,he=!1;if(P){Y=d.get(Z),Y===void 0&&(Y=[],d.set(Z,Y));let ae=P.textures;if(Y.length!==ae.length||Y[0]!==n.COLOR_ATTACHMENT0){for(let le=0,Ae=ae.length;le<Ae;le++)Y[le]=n.COLOR_ATTACHMENT0+le;Y.length=ae.length,he=!0}}else Y[0]!==n.BACK&&(Y[0]=n.BACK,he=!0);he&&n.drawBuffers(Y)}function ct(P){return y!==P?(n.useProgram(P),y=P,!0):!1}let ut={[Vs]:n.FUNC_ADD,[Lm]:n.FUNC_SUBTRACT,[Im]:n.FUNC_REVERSE_SUBTRACT};ut[km]=n.MIN,ut[Dm]=n.MAX;let Je={[Nm]:n.ZERO,[Om]:n.ONE,[Fm]:n.SRC_COLOR,[nd]:n.SRC_ALPHA,[Gm]:n.SRC_ALPHA_SATURATE,[Hm]:n.DST_COLOR,[Bm]:n.DST_ALPHA,[Um]:n.ONE_MINUS_SRC_COLOR,[id]:n.ONE_MINUS_SRC_ALPHA,[Vm]:n.ONE_MINUS_DST_COLOR,[zm]:n.ONE_MINUS_DST_ALPHA,[Wm]:n.CONSTANT_COLOR,[$m]:n.ONE_MINUS_CONSTANT_COLOR,[Xm]:n.CONSTANT_ALPHA,[qm]:n.ONE_MINUS_CONSTANT_ALPHA};function Kt(P,Z,Y,he,ae,le,Ae,We,se,Re){if(P===ki){m===!0&&(He(n.BLEND),m=!1);return}if(m===!1&&(ve(n.BLEND),m=!0),P!==Pm){if(P!==g||Re!==R){if((b!==Vs||w!==Vs)&&(n.blendEquation(n.FUNC_ADD),b=Vs,w=Vs),Re)switch(P){case Ur:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Qu:n.blendFunc(n.ONE,n.ONE);break;case ed:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case td:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Fe("WebGLState: Invalid blending: ",P);break}else switch(P){case Ur:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Qu:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case ed:Fe("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case td:Fe("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Fe("WebGLState: Invalid blending: ",P);break}_=null,v=null,E=null,x=null,A.set(0,0,0),I=0,g=P,R=Re}return}ae=ae||Z,le=le||Y,Ae=Ae||he,(Z!==b||ae!==w)&&(n.blendEquationSeparate(ut[Z],ut[ae]),b=Z,w=ae),(Y!==_||he!==v||le!==E||Ae!==x)&&(n.blendFuncSeparate(Je[Y],Je[he],Je[le],Je[Ae]),_=Y,v=he,E=le,x=Ae),(We.equals(A)===!1||se!==I)&&(n.blendColor(We.r,We.g,We.b,se),A.copy(We),I=se),g=P,R=!1}function Nt(P,Z){P.side===In?He(n.CULL_FACE):ve(n.CULL_FACE);let Y=P.side===gn;Z&&(Y=!Y),yn(Y),P.blending===Ur&&P.transparent===!1?Kt(ki):Kt(P.blending,P.blendEquation,P.blendSrc,P.blendDst,P.blendEquationAlpha,P.blendSrcAlpha,P.blendDstAlpha,P.blendColor,P.blendAlpha,P.premultipliedAlpha),a.setFunc(P.depthFunc),a.setTest(P.depthTest),a.setMask(P.depthWrite),r.setMask(P.colorWrite);let he=P.stencilWrite;o.setTest(he),he&&(o.setMask(P.stencilWriteMask),o.setFunc(P.stencilFunc,P.stencilRef,P.stencilFuncMask),o.setOp(P.stencilFail,P.stencilZFail,P.stencilZPass)),Vt(P.polygonOffset,P.polygonOffsetFactor,P.polygonOffsetUnits),P.alphaToCoverage===!0?ve(n.SAMPLE_ALPHA_TO_COVERAGE):He(n.SAMPLE_ALPHA_TO_COVERAGE)}function yn(P){D!==P&&(P?n.frontFace(n.CW):n.frontFace(n.CCW),D=P)}function _t(P){P!==Am?(ve(n.CULL_FACE),P!==H&&(P===Zu?n.cullFace(n.BACK):P===Cm?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):He(n.CULL_FACE),H=P}function oi(P){P!==X&&(W&&n.lineWidth(P),X=P)}function Vt(P,Z,Y){P?(ve(n.POLYGON_OFFSET_FILL),(L!==Z||V!==Y)&&(L=Z,V=Y,a.getReversed()&&(Z=-Z,Y=-Y),n.polygonOffset(Z,Y))):He(n.POLYGON_OFFSET_FILL)}function On(P){P?ve(n.SCISSOR_TEST):He(n.SCISSOR_TEST)}function Fn(P){P===void 0&&(P=n.TEXTURE0+G-1),ee!==P&&(n.activeTexture(P),ee=P)}function Un(P,Z,Y){Y===void 0&&(ee===null?Y=n.TEXTURE0+G-1:Y=ee);let he=ne[Y];he===void 0&&(he={type:void 0,texture:void 0},ne[Y]=he),(he.type!==P||he.texture!==Z)&&(ee!==Y&&(n.activeTexture(Y),ee=Y),n.bindTexture(P,Z||Ie[P]),he.type=P,he.texture=Z)}function F(){let P=ne[ee];P!==void 0&&P.type!==void 0&&(n.bindTexture(P.type,null),P.type=void 0,P.texture=void 0)}function Bn(){try{n.compressedTexImage2D(...arguments)}catch(P){Fe("WebGLState:",P)}}function yt(){try{n.compressedTexImage3D(...arguments)}catch(P){Fe("WebGLState:",P)}}function bt(){try{n.texSubImage2D(...arguments)}catch(P){Fe("WebGLState:",P)}}function pe(){try{n.texSubImage3D(...arguments)}catch(P){Fe("WebGLState:",P)}}function Ot(){try{n.compressedTexSubImage2D(...arguments)}catch(P){Fe("WebGLState:",P)}}function ke(){try{n.compressedTexSubImage3D(...arguments)}catch(P){Fe("WebGLState:",P)}}function Be(){try{n.texStorage2D(...arguments)}catch(P){Fe("WebGLState:",P)}}function C(){try{n.texStorage3D(...arguments)}catch(P){Fe("WebGLState:",P)}}function S(){try{n.texImage2D(...arguments)}catch(P){Fe("WebGLState:",P)}}function B(){try{n.texImage3D(...arguments)}catch(P){Fe("WebGLState:",P)}}function ie(P){return u[P]!==void 0?u[P]:n.getParameter(P)}function Q(P,Z){u[P]!==Z&&(n.pixelStorei(P,Z),u[P]=Z)}function oe(P){J.equals(P)===!1&&(n.scissor(P.x,P.y,P.z,P.w),J.copy(P))}function de(P){me.equals(P)===!1&&(n.viewport(P.x,P.y,P.z,P.w),me.copy(P))}function j(P,Z){let Y=c.get(Z);Y===void 0&&(Y=new WeakMap,c.set(Z,Y));let he=Y.get(P);he===void 0&&(he=n.getUniformBlockIndex(Z,P.name),n.uniformBlockBinding(Z,he,he),Y.set(P,he))}function K(P,Z,Y){let ae=c.get(Z).get(P);l[ae]!==Y&&(n.bindBufferBase(n.UNIFORM_BUFFER,ae,Y),l[ae]=Y)}function ce(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),a.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),h={},u={},ee=null,ne={},f={},l={},d=new WeakMap,p=[],y=null,m=!1,g=null,b=null,_=null,v=null,w=null,E=null,x=null,A=new Xe(0,0,0),I=0,R=!1,D=null,H=null,X=null,L=null,V=null,J.set(0,0,n.canvas.width,n.canvas.height),me.set(0,0,n.canvas.width,n.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:ve,disable:He,bindFramebuffer:At,drawBuffers:Ne,useProgram:ct,setBlending:Kt,setMaterial:Nt,setFlipSided:yn,setCullFace:_t,setLineWidth:oi,setPolygonOffset:Vt,setScissorTest:On,activeTexture:Fn,bindTexture:Un,unbindTexture:F,compressedTexImage2D:Bn,compressedTexImage3D:yt,texImage2D:S,texImage3D:B,pixelStorei:Q,getParameter:ie,updateUBOMapping:j,uniformBlockBinding:K,texStorage2D:Be,texStorage3D:C,texSubImage2D:bt,texSubImage3D:pe,compressedTexSubImage2D:Ot,compressedTexSubImage3D:ke,scissor:oe,viewport:de,reset:ce}}function AM(n,e,t,i,s,r,a){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Pe,h=new WeakMap,u=new Set,f,d=new WeakMap,p=new Set,y=new FinalizationRegistry(C=>p.delete(C)),m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(C,S){return m?new OffscreenCanvas(C,S):ka("canvas")}function b(C,S,B){let ie=1,Q=Be(C);if((Q.width>B||Q.height>B)&&(ie=B/Math.max(Q.width,Q.height)),ie<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let oe=Math.floor(ie*Q.width),de=Math.floor(ie*Q.height);f===void 0&&(f=g(oe,de));let j=S?g(oe,de):f;return j.width=oe,j.height=de,j.getContext("2d").drawImage(C,0,0,oe,de),Le("WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+oe+"x"+de+")."),j}else return"data"in C&&Le("WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),C;return C}function _(C){return C.generateMipmaps}function v(C){n.generateMipmap(C)}function w(C){return C.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?n.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function E(C,S,B,ie,Q,oe=!1){if(C!==null){if(n[C]!==void 0)return n[C];Le("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let de;ie&&(de=e.get("EXT_texture_norm16"),de||Le("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let j=S;if(S===n.RED&&(B===n.FLOAT&&(j=n.R32F),B===n.HALF_FLOAT&&(j=n.R16F),B===n.UNSIGNED_BYTE&&(j=n.R8),B===n.UNSIGNED_SHORT&&de&&(j=de.R16_EXT),B===n.SHORT&&de&&(j=de.R16_SNORM_EXT)),S===n.RED_INTEGER&&(B===n.UNSIGNED_BYTE&&(j=n.R8UI),B===n.UNSIGNED_SHORT&&(j=n.R16UI),B===n.UNSIGNED_INT&&(j=n.R32UI),B===n.BYTE&&(j=n.R8I),B===n.SHORT&&(j=n.R16I),B===n.INT&&(j=n.R32I)),S===n.RG&&(B===n.FLOAT&&(j=n.RG32F),B===n.HALF_FLOAT&&(j=n.RG16F),B===n.UNSIGNED_BYTE&&(j=n.RG8),B===n.UNSIGNED_SHORT&&de&&(j=de.RG16_EXT),B===n.SHORT&&de&&(j=de.RG16_SNORM_EXT)),S===n.RG_INTEGER&&(B===n.UNSIGNED_BYTE&&(j=n.RG8UI),B===n.UNSIGNED_SHORT&&(j=n.RG16UI),B===n.UNSIGNED_INT&&(j=n.RG32UI),B===n.BYTE&&(j=n.RG8I),B===n.SHORT&&(j=n.RG16I),B===n.INT&&(j=n.RG32I)),S===n.RGB_INTEGER&&(B===n.UNSIGNED_BYTE&&(j=n.RGB8UI),B===n.UNSIGNED_SHORT&&(j=n.RGB16UI),B===n.UNSIGNED_INT&&(j=n.RGB32UI),B===n.BYTE&&(j=n.RGB8I),B===n.SHORT&&(j=n.RGB16I),B===n.INT&&(j=n.RGB32I)),S===n.RGBA_INTEGER&&(B===n.UNSIGNED_BYTE&&(j=n.RGBA8UI),B===n.UNSIGNED_SHORT&&(j=n.RGBA16UI),B===n.UNSIGNED_INT&&(j=n.RGBA32UI),B===n.BYTE&&(j=n.RGBA8I),B===n.SHORT&&(j=n.RGBA16I),B===n.INT&&(j=n.RGBA32I)),S===n.RGB&&(B===n.UNSIGNED_SHORT&&de&&(j=de.RGB16_EXT),B===n.SHORT&&de&&(j=de.RGB16_SNORM_EXT),B===n.UNSIGNED_INT_5_9_9_9_REV&&(j=n.RGB9_E5),B===n.UNSIGNED_INT_10F_11F_11F_REV&&(j=n.R11F_G11F_B10F)),S===n.RGBA){let K=oe?La:Ye.getTransfer(Q);B===n.FLOAT&&(j=n.RGBA32F),B===n.HALF_FLOAT&&(j=n.RGBA16F),B===n.UNSIGNED_BYTE&&(j=K===ot?n.SRGB8_ALPHA8:n.RGBA8),B===n.UNSIGNED_SHORT&&de&&(j=de.RGBA16_EXT),B===n.SHORT&&de&&(j=de.RGBA16_SNORM_EXT),B===n.UNSIGNED_SHORT_4_4_4_4&&(j=n.RGBA4),B===n.UNSIGNED_SHORT_5_5_5_1&&(j=n.RGB5_A1)}return(j===n.R16F||j===n.R32F||j===n.RG16F||j===n.RG32F||j===n.RGBA16F||j===n.RGBA32F)&&e.get("EXT_color_buffer_float"),j}function x(C,S){let B;return C?S===null||S===ni||S===Ws?B=n.DEPTH24_STENCIL8:S===Dn?B=n.DEPTH32F_STENCIL8:S===zr&&(B=n.DEPTH24_STENCIL8,Le("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===ni||S===Ws?B=n.DEPTH_COMPONENT24:S===Dn?B=n.DEPTH_COMPONENT32F:S===zr&&(B=n.DEPTH_COMPONENT16),B}function A(C,S){return _(C)===!0||C.isFramebufferTexture&&C.minFilter!==vt&&C.minFilter!==pn?Math.log2(Math.max(S.width,S.height))+1:C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?S.mipmaps.length:1}function I(C){let S=new WeakRef(C);i.get(C).__ref=S,p.add(S),y.register(C,S,S)}function R(C){let S=i.get(C).__ref;S!==void 0&&(p.delete(S),y.unregister(S))}function D(C){X(C.target)}function H(C){L(C.target)}function X(C){C.removeEventListener("dispose",D),R(C),G(C),C.isVideoTexture&&h.delete(C),C.isHTMLTexture&&u.delete(C)}function L(C){C.removeEventListener("dispose",H),R(C),te(C)}function V(){for(let C of p){let S=C.deref();S!==void 0&&(S.isRenderTarget===!0?L(S):X(S))}p.clear(),u.clear()}function G(C){let S=i.get(C);if(S.__webglInit===void 0)return;let B=C.source,ie=d.get(B);if(ie){let Q=ie[S.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&W(C),Object.keys(ie).length===0&&d.delete(B)}i.remove(C)}function W(C){let S=i.get(C);n.deleteTexture(S.__webglTexture);let B=C.source,ie=d.get(B);delete ie[S.__cacheKey],a.memory.textures--}function te(C){let S=i.get(C);S.__depthDisposeCallback&&S.__depthDisposeCallback();let B=C.depthTexture;if(B&&B.renderTarget===C&&X(B),C.isWebGLCubeRenderTarget)for(let Q=0;Q<6;Q++){if(Array.isArray(S.__webglFramebuffer[Q]))for(let oe=0;oe<S.__webglFramebuffer[Q].length;oe++)n.deleteFramebuffer(S.__webglFramebuffer[Q][oe]);else n.deleteFramebuffer(S.__webglFramebuffer[Q]);S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer[Q])}else{if(Array.isArray(S.__webglFramebuffer))for(let Q=0;Q<S.__webglFramebuffer.length;Q++)n.deleteFramebuffer(S.__webglFramebuffer[Q]);else n.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&n.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let Q=0;Q<S.__webglColorRenderbuffer.length;Q++)S.__webglColorRenderbuffer[Q]&&n.deleteRenderbuffer(S.__webglColorRenderbuffer[Q]);S.__webglDepthRenderbuffer&&n.deleteRenderbuffer(S.__webglDepthRenderbuffer)}let ie=C.textures;for(let Q=0,oe=ie.length;Q<oe;Q++){let de=i.get(ie[Q]);de.__webglTexture&&(n.deleteTexture(de.__webglTexture),a.memory.textures--),i.remove(ie[Q])}i.remove(C)}let q=0;function ee(){q=0}function ne(){return q}function be(C){q=C}function De(){let C=q;return C>=s.maxTextures&&Le("WebGLTextures: Trying to use "+(C+1)+" texture units while this GPU supports only "+s.maxTextures),q+=1,C}function J(C){let S=[];return S.push(C.wrapS),S.push(C.wrapT),S.push(C.wrapR||0),S.push(C.magFilter),S.push(C.minFilter),S.push(C.anisotropy),S.push(C.internalFormat),S.push(C.format),S.push(C.type),S.push(C.generateMipmaps),S.push(C.mipmapsAutoUpdate),S.push(C.premultiplyAlpha),S.push(C.flipY),S.push(C.unpackAlignment),S.push(C.colorSpace),S.join()}function me(C,S){let B=i.get(C);if(C.isVideoTexture&&Ot(C),C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&B.__version!==C.version){let ie=C.image;if(ie===null)Le("WebGLRenderer: Texture marked for update but no image data found.");else if(ie.complete===!1)Le("WebGLRenderer: Texture marked for update but image is incomplete");else{Nt(B,C,S);return}}else C.isExternalTexture&&(B.__webglTexture=C.sourceTexture?C.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,B.__webglTexture,n.TEXTURE0+S)}function we(C,S){let B=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&B.__version!==C.version){Nt(B,C,S);return}else C.isExternalTexture&&(B.__webglTexture=C.sourceTexture?C.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,B.__webglTexture,n.TEXTURE0+S)}function Ie(C,S){let B=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&B.__version!==C.version){Nt(B,C,S);return}t.bindTexture(n.TEXTURE_3D,B.__webglTexture,n.TEXTURE0+S)}function ve(C,S){let B=i.get(C);if(C.version>0&&B.__version!==C.version){yn(B,C,S);return}t.bindTexture(n.TEXTURE_CUBE_MAP,B.__webglTexture,n.TEXTURE0+S)}let He={[Wl]:n.REPEAT,[mi]:n.CLAMP_TO_EDGE,[$l]:n.MIRRORED_REPEAT},At={[vt]:n.NEAREST,[Jm]:n.NEAREST_MIPMAP_NEAREST,[qa]:n.NEAREST_MIPMAP_LINEAR,[pn]:n.LINEAR,[gc]:n.LINEAR_MIPMAP_NEAREST,[Di]:n.LINEAR_MIPMAP_LINEAR},Ne={[eg]:n.NEVER,[Ed]:n.ALWAYS,[tg]:n.LESS,[wd]:n.LEQUAL,[ng]:n.EQUAL,[Md]:n.GEQUAL,[ig]:n.GREATER,[sg]:n.NOTEQUAL};function ct(C,S){if(S.type===Dn&&e.has("OES_texture_float_linear")===!1&&(S.magFilter===pn||S.magFilter===gc||S.magFilter===qa||S.magFilter===Di||S.minFilter===pn||S.minFilter===gc||S.minFilter===qa||S.minFilter===Di)&&Le("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(C,n.TEXTURE_WRAP_S,He[S.wrapS]),n.texParameteri(C,n.TEXTURE_WRAP_T,He[S.wrapT]),(C===n.TEXTURE_3D||C===n.TEXTURE_2D_ARRAY)&&n.texParameteri(C,n.TEXTURE_WRAP_R,He[S.wrapR]),n.texParameteri(C,n.TEXTURE_MAG_FILTER,At[S.magFilter]),n.texParameteri(C,n.TEXTURE_MIN_FILTER,At[S.minFilter]),S.compareFunction&&(n.texParameteri(C,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(C,n.TEXTURE_COMPARE_FUNC,Ne[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===vt||S.minFilter!==qa&&S.minFilter!==Di||S.type===Dn&&e.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||i.get(S).__currentAnisotropy){let B=e.get("EXT_texture_filter_anisotropic");n.texParameterf(C,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,s.getMaxAnisotropy())),i.get(S).__currentAnisotropy=S.anisotropy}}}function ut(C,S){let B=!1;C.__webglInit===void 0&&(C.__webglInit=!0,S.addEventListener("dispose",D),I(S));let ie=S.source,Q=d.get(ie);Q===void 0&&(Q={},d.set(ie,Q));let oe=J(S);if(oe!==C.__cacheKey){Q[oe]===void 0&&(Q[oe]={texture:n.createTexture(),usedTimes:0},a.memory.textures++,B=!0),Q[oe].usedTimes++;let de=Q[C.__cacheKey];de!==void 0&&(Q[C.__cacheKey].usedTimes--,de.usedTimes===0&&W(S)),C.__cacheKey=oe,C.__webglTexture=Q[oe].texture}return B}function Je(C,S,B){return Math.floor(Math.floor(C/B)/S)}function Kt(C,S,B,ie){let oe=C.updateRanges;if(oe.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,S.width,S.height,B,ie,S.data);else{oe.sort((P,Z)=>P.start-Z.start);let de=0;for(let P=1;P<oe.length;P++){let Z=oe[de],Y=oe[P],he=Z.start+Z.count,ae=Je(Y.start,S.width,4),le=Je(Z.start,S.width,4);Y.start<=he+1&&ae===le&&Je(Y.start+Y.count-1,S.width,4)===ae?Z.count=Math.max(Z.count,Y.start+Y.count-Z.start):(++de,oe[de]=Y)}oe.length=de+1;let j=t.getParameter(n.UNPACK_ROW_LENGTH),K=t.getParameter(n.UNPACK_SKIP_PIXELS),ce=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,S.width);for(let P=0,Z=oe.length;P<Z;P++){let Y=oe[P],he=Math.floor(Y.start/4),ae=Math.ceil(Y.count/4),le=he%S.width,Ae=Math.floor(he/S.width),We=ae,se=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,le),t.pixelStorei(n.UNPACK_SKIP_ROWS,Ae),t.texSubImage2D(n.TEXTURE_2D,0,le,Ae,We,se,B,ie,S.data)}C.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,j),t.pixelStorei(n.UNPACK_SKIP_PIXELS,K),t.pixelStorei(n.UNPACK_SKIP_ROWS,ce)}}function Nt(C,S,B){let ie=n.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(ie=n.TEXTURE_2D_ARRAY),S.isData3DTexture&&(ie=n.TEXTURE_3D);let Q=ut(C,S),oe=S.source;t.bindTexture(ie,C.__webglTexture,n.TEXTURE0+B);let de=i.get(oe);if(oe.version!==de.__version||Q===!0){if(t.activeTexture(n.TEXTURE0+B),(typeof ImageBitmap<"u"&&S.image instanceof ImageBitmap)===!1){let se=Ye.getPrimaries(Ye.workingColorSpace),Re=S.colorSpace===si?null:Ye.getPrimaries(S.colorSpace),Ve=S.colorSpace===si||se===Re?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ve)}t.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment);let K=b(S.image,!1,s.maxTextureSize);K=ke(S,K);let ce=r.convert(S.format,S.colorSpace),P=r.convert(S.type),Z=E(S.internalFormat,ce,P,S.normalized,S.colorSpace,S.isVideoTexture);ct(ie,S);let Y,he=S.mipmaps,ae=S.isVideoTexture!==!0,le=de.__version===void 0||Q===!0,Ae=oe.dataReady,We=A(S,K);if(S.isDepthTexture)Z=x(S.format===Ni,S.type),le&&(ae?t.texStorage2D(n.TEXTURE_2D,1,Z,K.width,K.height):t.texImage2D(n.TEXTURE_2D,0,Z,K.width,K.height,0,ce,P,null));else if(S.isDataTexture)if(he.length>0){ae&&le&&t.texStorage2D(n.TEXTURE_2D,We,Z,he[0].width,he[0].height);for(let se=0,Re=he.length;se<Re;se++)Y=he[se],ae?Ae&&t.texSubImage2D(n.TEXTURE_2D,se,0,0,Y.width,Y.height,ce,P,Y.data):t.texImage2D(n.TEXTURE_2D,se,Z,Y.width,Y.height,0,ce,P,Y.data);S.generateMipmaps=!1}else ae?(le&&t.texStorage2D(n.TEXTURE_2D,We,Z,K.width,K.height),Ae&&Kt(S,K,ce,P)):t.texImage2D(n.TEXTURE_2D,0,Z,K.width,K.height,0,ce,P,K.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){ae&&le&&t.texStorage3D(n.TEXTURE_2D_ARRAY,We,Z,he[0].width,he[0].height,K.depth);for(let se=0,Re=he.length;se<Re;se++)if(Y=he[se],S.format!==Nn)if(ce!==null)if(ae){if(Ae)if(S.layerUpdates.size>0){let Ve=Nd(Y.width,Y.height,S.format,S.type);for(let ge of S.layerUpdates){let ht=Y.data.subarray(ge*Ve/Y.data.BYTES_PER_ELEMENT,(ge+1)*Ve/Y.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,se,0,0,ge,Y.width,Y.height,1,ce,ht)}}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,se,0,0,0,Y.width,Y.height,K.depth,ce,Y.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,se,Z,Y.width,Y.height,K.depth,0,Y.data,0,0);else Le("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else ae?Ae&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,se,0,0,0,Y.width,Y.height,K.depth,ce,P,Y.data):t.texImage3D(n.TEXTURE_2D_ARRAY,se,Z,Y.width,Y.height,K.depth,0,ce,P,Y.data);S.layerUpdates.size>0&&S.clearLayerUpdates()}else{ae&&le&&t.texStorage2D(n.TEXTURE_2D,We,Z,he[0].width,he[0].height);for(let se=0,Re=he.length;se<Re;se++)Y=he[se],S.format!==Nn?ce!==null?ae?Ae&&t.compressedTexSubImage2D(n.TEXTURE_2D,se,0,0,Y.width,Y.height,ce,Y.data):t.compressedTexImage2D(n.TEXTURE_2D,se,Z,Y.width,Y.height,0,Y.data):Le("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):ae?Ae&&t.texSubImage2D(n.TEXTURE_2D,se,0,0,Y.width,Y.height,ce,P,Y.data):t.texImage2D(n.TEXTURE_2D,se,Z,Y.width,Y.height,0,ce,P,Y.data)}else if(S.isDataArrayTexture)if(ae){if(le&&t.texStorage3D(n.TEXTURE_2D_ARRAY,We,Z,K.width,K.height,K.depth),Ae)if(S.layerUpdates.size>0){let se=Nd(K.width,K.height,S.format,S.type);for(let Re of S.layerUpdates){let Ve=K.data.subarray(Re*se/K.data.BYTES_PER_ELEMENT,(Re+1)*se/K.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,Re,K.width,K.height,1,ce,P,Ve)}S.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,ce,P,K.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,Z,K.width,K.height,K.depth,0,ce,P,K.data);else if(S.isData3DTexture)ae?(le&&t.texStorage3D(n.TEXTURE_3D,We,Z,K.width,K.height,K.depth),Ae&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,ce,P,K.data)):t.texImage3D(n.TEXTURE_3D,0,Z,K.width,K.height,K.depth,0,ce,P,K.data);else if(S.isFramebufferTexture){if(le)if(ae)t.texStorage2D(n.TEXTURE_2D,We,Z,K.width,K.height);else{let se=K.width,Re=K.height;for(let Ve=0;Ve<We;Ve++)t.texImage2D(n.TEXTURE_2D,Ve,Z,se,Re,0,ce,P,null),se>>=1,Re>>=1}}else if(S.isHTMLTexture){if("texElementImage2D"in n){let se=n.canvas;if(se.hasAttribute("layoutsubtree")||se.setAttribute("layoutsubtree","true"),K.parentNode!==se){se.appendChild(K),u.add(S),se.onpaint=Re=>{let Ve=Re.changedElements;for(let ge of u)Ve.includes(ge.image)&&(ge.needsUpdate=!0)},se.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,K);else{let Ve=n.RGBA,ge=n.RGBA,ht=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,Ve,ge,ht,K)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(he.length>0){if(ae&&le){let se=Be(he[0]);t.texStorage2D(n.TEXTURE_2D,We,Z,se.width,se.height)}for(let se=0,Re=he.length;se<Re;se++)Y=he[se],ae?Ae&&t.texSubImage2D(n.TEXTURE_2D,se,0,0,ce,P,Y):t.texImage2D(n.TEXTURE_2D,se,Z,ce,P,Y);S.generateMipmaps=!1}else if(ae){if(le){let se=Be(K);t.texStorage2D(n.TEXTURE_2D,We,Z,se.width,se.height)}Ae&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,ce,P,K)}else t.texImage2D(n.TEXTURE_2D,0,Z,ce,P,K);_(S)&&S.mipmapsAutoUpdate===!0&&v(ie),de.__version=oe.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function yn(C,S,B){if(S.image.length!==6)return;let ie=ut(C,S),Q=S.source;t.bindTexture(n.TEXTURE_CUBE_MAP,C.__webglTexture,n.TEXTURE0+B);let oe=i.get(Q);if(Q.version!==oe.__version||ie===!0){t.activeTexture(n.TEXTURE0+B);let de=Ye.getPrimaries(Ye.workingColorSpace),j=S.colorSpace===si?null:Ye.getPrimaries(S.colorSpace),K=S.colorSpace===si||de===j?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);let ce=S.isCompressedTexture||S.image[0].isCompressedTexture,P=S.image[0]&&S.image[0].isDataTexture,Z=[];for(let ge=0;ge<6;ge++)!ce&&!P?Z[ge]=b(S.image[ge],!0,s.maxCubemapSize):Z[ge]=P?S.image[ge].image:S.image[ge],Z[ge]=ke(S,Z[ge]);let Y=Z[0],he=r.convert(S.format,S.colorSpace),ae=r.convert(S.type),le=E(S.internalFormat,he,ae,S.normalized,S.colorSpace),Ae=S.isVideoTexture!==!0,We=oe.__version===void 0||ie===!0,se=Q.dataReady,Re=A(S,Y);ct(n.TEXTURE_CUBE_MAP,S);let Ve;if(S.isDepthTexture){if(le=x(S.format===Ni,S.type),We)if(Ae)t.texStorage2D(n.TEXTURE_CUBE_MAP,1,le,Y.width,Y.height);else for(let ge=0;ge<6;ge++)t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,0,le,Y.width,Y.height,0,he,ae,null)}else if(ce){Ae&&We&&t.texStorage2D(n.TEXTURE_CUBE_MAP,Re,le,Y.width,Y.height);for(let ge=0;ge<6;ge++){Ve=Z[ge].mipmaps;for(let ht=0;ht<Ve.length;ht++){let Gt=Ve[ht];S.format!==Nn?he!==null?Ae?se&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht,0,0,Gt.width,Gt.height,he,Gt.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht,le,Gt.width,Gt.height,0,Gt.data):Le("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ae?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht,0,0,Gt.width,Gt.height,he,ae,Gt.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht,le,Gt.width,Gt.height,0,he,ae,Gt.data)}}}else{if(Ve=S.mipmaps,Ae&&We){Ve.length>0&&Re++;let ge=Be(Z[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,Re,le,ge.width,ge.height)}for(let ge=0;ge<6;ge++)if(P){Ae?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,0,0,0,Z[ge].width,Z[ge].height,he,ae,Z[ge].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,0,le,Z[ge].width,Z[ge].height,0,he,ae,Z[ge].data);for(let ht=0;ht<Ve.length;ht++){let Ui=Ve[ht].image[ge].image;Ae?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht+1,0,0,Ui.width,Ui.height,he,ae,Ui.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht+1,le,Ui.width,Ui.height,0,he,ae,Ui.data)}}else{Ae?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,0,0,0,he,ae,Z[ge]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,0,le,he,ae,Z[ge]);for(let ht=0;ht<Ve.length;ht++){let Gt=Ve[ht];Ae?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht+1,0,0,he,ae,Gt.image[ge]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,ht+1,le,he,ae,Gt.image[ge])}}}_(S)&&S.mipmapsAutoUpdate===!0&&v(n.TEXTURE_CUBE_MAP),oe.__version=Q.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function _t(C,S,B,ie,Q,oe){let de=r.convert(B.format,B.colorSpace),j=r.convert(B.type),K=E(B.internalFormat,de,j,B.normalized,B.colorSpace),ce=i.get(S),P=i.get(B);if(P.__renderTarget=S,!ce.__hasExternalTextures){let Z=Math.max(1,S.width>>oe),Y=Math.max(1,S.height>>oe);Q===n.TEXTURE_3D||Q===n.TEXTURE_2D_ARRAY?t.texImage3D(Q,oe,K,Z,Y,S.depth,0,de,j,null):t.texImage2D(Q,oe,K,Z,Y,0,de,j,null)}t.bindFramebuffer(n.FRAMEBUFFER,C),pe(S)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ie,Q,P.__webglTexture,0,bt(S)):(Q===n.TEXTURE_2D||Q>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,ie,Q,P.__webglTexture,oe),t.bindFramebuffer(n.FRAMEBUFFER,null)}function oi(C,S,B){if(n.bindRenderbuffer(n.RENDERBUFFER,C),S.depthBuffer){let ie=S.depthTexture,Q=ie&&ie.isDepthTexture?ie.type:null,oe=x(S.stencilBuffer,Q),de=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;pe(S)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,bt(S),oe,S.width,S.height):B?n.renderbufferStorageMultisample(n.RENDERBUFFER,bt(S),oe,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,oe,S.width,S.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,de,n.RENDERBUFFER,C)}else{let ie=S.textures;for(let Q=0;Q<ie.length;Q++){let oe=ie[Q],de=r.convert(oe.format,oe.colorSpace),j=r.convert(oe.type),K=E(oe.internalFormat,de,j,oe.normalized,oe.colorSpace);pe(S)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,bt(S),K,S.width,S.height):B?n.renderbufferStorageMultisample(n.RENDERBUFFER,bt(S),K,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,K,S.width,S.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function Vt(C,S,B){let ie=S.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,C),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Q=i.get(S.depthTexture);Q.__renderTarget=S;let oe=ie?S.depthTexture.image[0]:S.depthTexture.image;(!Q.__webglTexture||oe.width!==S.width||oe.height!==S.height)&&(oe.width=S.width,oe.height=S.height,S.depthTexture.needsUpdate=!0),ie?ve(S.depthTexture,0):me(S.depthTexture,0);let de=Q.__webglTexture,j=bt(S),K=ie?n.TEXTURE_CUBE_MAP_POSITIVE_X+B:n.TEXTURE_2D,ce=S.depthTexture.format===Ni?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(S.depthTexture.format===Pi)pe(S)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ce,K,de,0,j):n.framebufferTexture2D(n.FRAMEBUFFER,ce,K,de,0);else if(S.depthTexture.format===Ni)pe(S)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ce,K,de,0,j):n.framebufferTexture2D(n.FRAMEBUFFER,ce,K,de,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function On(C){let S=i.get(C),B=C.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==C.depthTexture){let ie=C.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),ie){let Q=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,ie.removeEventListener("dispose",Q)};ie.addEventListener("dispose",Q),S.__depthDisposeCallback=Q}S.__boundDepthTexture=ie}if(C.depthTexture&&!S.__autoAllocateDepthBuffer)if(B)for(let ie=0;ie<6;ie++)Vt(S.__webglFramebuffer[ie],C,ie);else C.texture.mipmaps.length>0?Vt(S.__webglFramebuffer[0],C,0):Vt(S.__webglFramebuffer,C,0);else if(B){S.__webglDepthbuffer=[];for(let ie=0;ie<6;ie++)if(t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer[ie]),S.__webglDepthbuffer[ie]===void 0)S.__webglDepthbuffer[ie]=n.createRenderbuffer(),oi(S.__webglDepthbuffer[ie],C,!1);else{let Q=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,oe=S.__webglDepthbuffer[ie];n.bindRenderbuffer(n.RENDERBUFFER,oe),n.framebufferRenderbuffer(n.FRAMEBUFFER,Q,n.RENDERBUFFER,oe)}}else if(C.texture.mipmaps.length>0?t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=n.createRenderbuffer(),oi(S.__webglDepthbuffer,C,!1);else{let Q=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,oe=S.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,oe),n.framebufferRenderbuffer(n.FRAMEBUFFER,Q,n.RENDERBUFFER,oe)}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Fn(C,S,B){let ie=i.get(C);S!==void 0&&_t(ie.__webglFramebuffer,C,C.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),B!==void 0&&On(C)}function Un(C){let S=C.texture,B=i.get(C),ie=i.get(S);C.addEventListener("dispose",H),I(C);let Q=C.textures,oe=C.isWebGLCubeRenderTarget===!0,de=Q.length>1;if(de||(ie.__webglTexture===void 0&&(ie.__webglTexture=n.createTexture()),ie.__version=S.version,a.memory.textures++),oe){B.__webglFramebuffer=[];for(let j=0;j<6;j++)if(S.mipmaps.length>0){B.__webglFramebuffer[j]=[];for(let K=0;K<S.mipmaps.length;K++)B.__webglFramebuffer[j][K]=n.createFramebuffer()}else B.__webglFramebuffer[j]=n.createFramebuffer()}else{if(S.mipmaps.length>0){B.__webglFramebuffer=[];for(let j=0;j<S.mipmaps.length;j++)B.__webglFramebuffer[j]=n.createFramebuffer()}else B.__webglFramebuffer=n.createFramebuffer();if(de)for(let j=0,K=Q.length;j<K;j++){let ce=i.get(Q[j]);ce.__webglTexture===void 0&&(ce.__webglTexture=n.createTexture(),a.memory.textures++)}if(C.samples>0&&pe(C)===!1){B.__webglMultisampledFramebuffer=n.createFramebuffer(),B.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let j=0;j<Q.length;j++){let K=Q[j];B.__webglColorRenderbuffer[j]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,B.__webglColorRenderbuffer[j]);let ce=r.convert(K.format,K.colorSpace),P=r.convert(K.type),Z=E(K.internalFormat,ce,P,K.normalized,K.colorSpace,C.isXRRenderTarget===!0),Y=bt(C);n.renderbufferStorageMultisample(n.RENDERBUFFER,Y,Z,C.width,C.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+j,n.RENDERBUFFER,B.__webglColorRenderbuffer[j])}n.bindRenderbuffer(n.RENDERBUFFER,null),C.depthBuffer&&(B.__webglDepthRenderbuffer=n.createRenderbuffer(),oi(B.__webglDepthRenderbuffer,C,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(oe){t.bindTexture(n.TEXTURE_CUBE_MAP,ie.__webglTexture),ct(n.TEXTURE_CUBE_MAP,S);for(let j=0;j<6;j++)if(S.mipmaps.length>0)for(let K=0;K<S.mipmaps.length;K++)_t(B.__webglFramebuffer[j][K],C,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,K);else _t(B.__webglFramebuffer[j],C,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0);_(S)?v(n.TEXTURE_CUBE_MAP):S.mipmaps.length>0&&n.texParameteri(n.TEXTURE_CUBE_MAP,n.TEXTURE_MAX_LEVEL,S.mipmaps.length-1),t.unbindTexture()}else if(de){for(let j=0,K=Q.length;j<K;j++){let ce=Q[j],P=i.get(ce),Z=n.TEXTURE_2D;(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(Z=C.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(Z,P.__webglTexture),ct(Z,ce),_t(B.__webglFramebuffer,C,ce,n.COLOR_ATTACHMENT0+j,Z,0),_(ce)&&v(Z)}t.unbindTexture()}else{let j=n.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(j=C.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(j,ie.__webglTexture),ct(j,S),S.mipmaps.length>0)for(let K=0;K<S.mipmaps.length;K++)_t(B.__webglFramebuffer[K],C,S,n.COLOR_ATTACHMENT0,j,K);else _t(B.__webglFramebuffer,C,S,n.COLOR_ATTACHMENT0,j,0);_(S)?v(j):S.mipmaps.length>0&&n.texParameteri(j,n.TEXTURE_MAX_LEVEL,S.mipmaps.length-1),t.unbindTexture()}C.depthBuffer&&On(C)}function F(C){let S=C.textures;for(let B=0,ie=S.length;B<ie;B++){let Q=S[B];if(_(Q)&&Q.mipmapsAutoUpdate===!0){let oe=w(C),de=i.get(Q).__webglTexture;t.bindTexture(oe,de),v(oe),t.unbindTexture()}}}let Bn=[];function yt(C){if(C.samples>0){if(pe(C)===!1){let S=C.textures,B=C.width,ie=C.height,Q=n.COLOR_BUFFER_BIT,oe=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,de=i.get(C),j=S.length>1;if(j)for(let ce=0;ce<S.length;ce++)t.bindFramebuffer(n.FRAMEBUFFER,de.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,de.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,de.__webglMultisampledFramebuffer),C.texture.mipmaps.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,de.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,de.__webglFramebuffer);for(let ce=0;ce<S.length;ce++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(Q|=n.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(Q|=n.STENCIL_BUFFER_BIT)),j){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,de.__webglColorRenderbuffer[ce]);let P=i.get(S[ce]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,P,0)}n.blitFramebuffer(0,0,B,ie,0,0,B,ie,Q,n.NEAREST),l===!0&&(Bn.length=0,Bn.push(n.COLOR_ATTACHMENT0+ce),C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&Bn.push(oe),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Bn))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),j)for(let ce=0;ce<S.length;ce++){t.bindFramebuffer(n.FRAMEBUFFER,de.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.RENDERBUFFER,de.__webglColorRenderbuffer[ce]);let P=i.get(S[ce]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,de.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.TEXTURE_2D,P,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,de.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&l){let S=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[S])}}}function bt(C){return Math.min(s.maxSamples,C.samples)}function pe(C){let S=i.get(C);return C.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function Ot(C){let S=a.render.frame;h.get(C)!==S&&(h.set(C,S),C.update())}function ke(C,S){let B=C.colorSpace,ie=C.format,Q=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||B!==Os&&B!==si&&(Ye.getTransfer(B)===ot?(ie!==Nn||Q!==kn)&&Le("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Fe("WebGLTextures: Unsupported texture color space:",B)),S}function Be(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(c.width=C.displayWidth,c.height=C.displayHeight):(c.width=C.width,c.height=C.height),c}this.allocateTextureUnit=De,this.resetTextureUnits=ee,this.getTextureUnits=ne,this.setTextureUnits=be,this.setTexture2D=me,this.setTexture2DArray=we,this.setTexture3D=Ie,this.setTextureCube=ve,this.rebindTextures=Fn,this.setupRenderTarget=Un,this.updateRenderTargetMipmap=F,this.updateMultisampleRenderTarget=yt,this.setupDepthRenderbuffer=On,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=pe,this.dispose=V}function CM(n,e){function t(i,s=si){let r,a=Ye.getTransfer(s);if(i===kn)return n.UNSIGNED_BYTE;if(i===bc)return n.UNSIGNED_SHORT_4_4_4_4;if(i===vc)return n.UNSIGNED_SHORT_5_5_5_1;if(i===md)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===gd)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===fd)return n.BYTE;if(i===pd)return n.SHORT;if(i===zr)return n.UNSIGNED_SHORT;if(i===yc)return n.INT;if(i===ni)return n.UNSIGNED_INT;if(i===Dn)return n.FLOAT;if(i===ii)return n.HALF_FLOAT;if(i===yd)return n.ALPHA;if(i===bd)return n.RGB;if(i===Nn)return n.RGBA;if(i===Pi)return n.DEPTH_COMPONENT;if(i===Ni)return n.DEPTH_STENCIL;if(i===vd)return n.RED;if(i===xc)return n.RED_INTEGER;if(i===cs)return n.RG;if(i===_c)return n.RG_INTEGER;if(i===Sc)return n.RGBA_INTEGER;if(i===Ya||i===ja||i===Ja||i===Ka)if(a===ot)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===Ya)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===ja)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Ja)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Ka)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===Ya)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===ja)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Ja)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Ka)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===wc||i===Mc||i===Ec||i===Tc)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===wc)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Mc)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Ec)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Tc)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Ac||i===Cc||i===Rc||i===Pc||i===Lc||i===Za||i===Ic)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(i===Ac||i===Cc)return a===ot?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===Rc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===Pc)return r.COMPRESSED_R11_EAC;if(i===Lc)return r.COMPRESSED_SIGNED_R11_EAC;if(i===Za)return r.COMPRESSED_RG11_EAC;if(i===Ic)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===kc||i===Dc||i===Nc||i===Oc||i===Fc||i===Uc||i===Bc||i===zc||i===Hc||i===Vc||i===Gc||i===Wc||i===$c||i===Xc)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(i===kc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Dc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Nc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Oc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Fc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Uc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Bc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===zc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Hc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Vc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Gc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Wc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===$c)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Xc)return a===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===qc||i===Yc||i===jc)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(i===qc)return a===ot?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Yc)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===jc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Jc||i===Kc||i===Qa||i===Zc)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(i===Jc)return r.COMPRESSED_RED_RGTC1_EXT;if(i===Kc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Qa)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Zc)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Ws?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var RM=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,PM=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Wd=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new Ha(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new Rn({vertexShader:RM,fragmentShader:PM,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Jt(new Hs(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},$d=class extends Qn{constructor(e,t){super();let i=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,f=null,d=null,p=null,y=typeof XRWebGLBinding<"u",m=new Wd,g={},b=t.getContextAttributes(),_=null,v=null,w=[],E=[],x=new Pe,A=null,I=null,R=new cn;R.viewport=new lt;let D=new cn;D.viewport=new lt;let H=[R,D],X=new fc,L=null,V=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(J){let me=w[J];return me===void 0&&(me=new Tr,w[J]=me),me.getTargetRaySpace()},this.getControllerGrip=function(J){let me=w[J];return me===void 0&&(me=new Tr,w[J]=me),me.getGripSpace()},this.getHand=function(J){let me=w[J];return me===void 0&&(me=new Tr,w[J]=me),me.getHandSpace()};function G(J){let me=E.indexOf(J.inputSource);if(me===-1)return;let we=w[me];we!==void 0&&(we.update(J.inputSource,J.frame,c||a),we.dispatchEvent({type:J.type,data:J.inputSource}))}function W(){s.removeEventListener("select",G),s.removeEventListener("selectstart",G),s.removeEventListener("selectend",G),s.removeEventListener("squeeze",G),s.removeEventListener("squeezestart",G),s.removeEventListener("squeezeend",G),s.removeEventListener("end",W),s.removeEventListener("inputsourceschange",te);for(let J=0;J<w.length;J++){let me=E[J];me!==null&&(E[J]=null,w[J].disconnect(me))}L=null,V=null,m.reset();for(let J in g)delete g[J];if(e.setRenderTarget(_),d=null,f=null,u=null,s=null,v=null,De.stop(),i.isPresenting=!1,e.setPixelRatio(A),e.setSize(x.width,x.height,!1),I!==null){let J=I.camera;J.fov=I.fov,J.zoom=I.zoom,J.updateProjectionMatrix(),I=null}i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(J){r=J,i.isPresenting===!0&&Le("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(J){o=J,i.isPresenting===!0&&Le("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(J){c=J},this.getBaseLayer=function(){return f!==null?f:d},this.getBinding=function(){return u===null&&y&&(u=new XRWebGLBinding(s,t)),u},this.getFrame=function(){return p},this.getSession=function(){return s},this.setSession=async function(J){if(s=J,s!==null){if(_=e.getRenderTarget(),s.addEventListener("select",G),s.addEventListener("selectstart",G),s.addEventListener("selectend",G),s.addEventListener("squeeze",G),s.addEventListener("squeezestart",G),s.addEventListener("squeezeend",G),s.addEventListener("end",W),s.addEventListener("inputsourceschange",te),b.xrCompatible!==!0&&await t.makeXRCompatible(),A=e.getPixelRatio(),e.getSize(x),y&&"createProjectionLayer"in XRWebGLBinding.prototype){let we=null,Ie=null,ve=null;b.depth&&(ve=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,we=b.stencil?Ni:Pi,Ie=b.stencil?Ws:ni);let He={colorFormat:t.RGBA8,depthFormat:ve,scaleFactor:r};u=this.getBinding(),f=u.createProjectionLayer(He),s.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),v=new mn(f.textureWidth,f.textureHeight,{format:Nn,type:kn,depthTexture:new Ii(f.textureWidth,f.textureHeight,Ie,void 0,void 0,void 0,void 0,void 0,void 0,we),stencilBuffer:b.stencil,colorSpace:e.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}else{let we={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:r};d=new XRWebGLLayer(s,t,we),s.updateRenderState({baseLayer:d}),e.setPixelRatio(1),e.setSize(d.framebufferWidth,d.framebufferHeight,!1),v=new mn(d.framebufferWidth,d.framebufferHeight,{format:Nn,type:kn,colorSpace:e.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),De.setContext(s),De.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function te(J){for(let me=0;me<J.removed.length;me++){let we=J.removed[me],Ie=E.indexOf(we);Ie>=0&&(E[Ie]=null,w[Ie].disconnect(we))}for(let me=0;me<J.added.length;me++){let we=J.added[me],Ie=E.indexOf(we);if(Ie===-1){for(let He=0;He<w.length;He++)if(He>=E.length){E.push(we),Ie=He;break}else if(E[He]===null){E[He]=we,Ie=He;break}if(Ie===-1)break}let ve=w[Ie];ve&&ve.connect(we)}}function q(J,me){me===null?J.matrixWorld.copy(J.matrix):J.matrixWorld.multiplyMatrices(me.matrixWorld,J.matrix),J.matrixWorldInverse.copy(J.matrixWorld).invert()}this.updateCamera=function(J){if(s===null)return;let me=J.near,we=J.far;m.texture!==null&&(m.depthNear>0&&(me=m.depthNear),m.depthFar>0&&(we=m.depthFar)),X.near=D.near=R.near=me,X.far=D.far=R.far=we,(L!==X.near||V!==X.far)&&(s.updateRenderState({depthNear:X.near,depthFar:X.far}),L=X.near,V=X.far),X.layers.mask=J.layers.mask|6,R.layers.mask=X.layers.mask&-5,D.layers.mask=X.layers.mask&-3;let Ie=J.parent,ve=X.cameras;q(X,Ie);for(let He=0;He<ve.length;He++)q(ve[He],Ie);X.projectionMatrix.copy(R.projectionMatrix),X.projectionMatrixInverse.copy(R.projectionMatrixInverse),I===null&&J.isPerspectiveCamera&&(I={camera:J,fov:J.fov,zoom:J.zoom}),ee(J,X,Ie)};function ee(J,me,we){we===null?J.matrix.copy(me.matrixWorld):(J.matrix.copy(we.matrixWorld),J.matrix.invert(),J.matrix.multiply(me.matrixWorld)),J.matrix.decompose(J.position,J.quaternion,J.scale),J.updateMatrixWorld(!0),J.projectionMatrix.copy(me.projectionMatrix),J.projectionMatrixInverse.copy(me.projectionMatrixInverse),J.isPerspectiveCamera&&(J.fov=Mr*2*Math.atan(1/J.projectionMatrix.elements[5]),J.zoom=1)}this.getCamera=function(){return X},this.getFoveation=function(){if(!(f===null&&d===null))return l},this.setFoveation=function(J){l=J,f!==null&&(f.fixedFoveation=J),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=J)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(X)},this.getCameraTexture=function(J){return g[J]};let ne=null;function be(J,me){if(h=me.getViewerPose(c||a),p=me,h!==null){let we=h.views;d!==null&&(e.setRenderTargetFramebuffer(v,d.framebuffer),e.setRenderTarget(v));let Ie=!1;we.length!==X.cameras.length&&(X.cameras.length=0,Ie=!0);for(let Ne=0;Ne<we.length;Ne++){let ct=we[Ne],ut=null;if(d!==null)ut=d.getViewport(ct);else{let Kt=u.getViewSubImage(f,ct);ut=Kt.viewport,Ne===0&&(e.setRenderTargetTextures(v,Kt.colorTexture,Kt.depthStencilTexture),e.setRenderTarget(v))}let Je=H[Ne];Je===void 0&&(Je=new cn,Je.layers.enable(Ne),Je.viewport=new lt,H[Ne]=Je),Je.matrix.fromArray(ct.transform.matrix),Je.matrix.decompose(Je.position,Je.quaternion,Je.scale),Je.projectionMatrix.fromArray(ct.projectionMatrix),Je.projectionMatrixInverse.copy(Je.projectionMatrix).invert(),Je.viewport.set(ut.x,ut.y,ut.width,ut.height),Ne===0&&(X.matrix.copy(Je.matrix),X.matrix.decompose(X.position,X.quaternion,X.scale)),Ie===!0&&X.cameras.push(Je)}let ve=s.enabledFeatures;if(ve&&ve.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&y){u=i.getBinding();let Ne=u.getDepthInformation(we[0]);Ne&&Ne.isValid&&Ne.texture&&m.init(Ne,s.renderState)}if(ve&&ve.includes("camera-access")&&y){e.state.unbindTexture(),u=i.getBinding();for(let Ne=0;Ne<we.length;Ne++){let ct=we[Ne].camera;if(ct){let ut=g[ct];ut||(ut=new Ha,g[ct]=ut);let Je=u.getCameraImage(ct);ut.sourceTexture=Je}}}}for(let we=0;we<w.length;we++){let Ie=E[we],ve=w[we];Ie!==null&&ve!==void 0&&ve.update(Ie,me,c||a)}ne&&ne(J,me),me.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:me}),p=null}let De=new Dg;De.setAnimationLoop(be),this.setAnimationLoop=function(J){ne=J},this.dispose=function(){}}},LM=new ft,Wg=new Ue;Wg.set(-1,0,0,0,1,0,0,0,1);function IM(n,e){function t(m,g){m.matrixAutoUpdate===!0&&m.updateMatrix(),g.value.copy(m.matrix)}function i(m,g){g.color.getRGB(m.fogColor.value,Id(n)),g.isFog?(m.fogNear.value=g.near,m.fogFar.value=g.far):g.isFogExp2&&(m.fogDensity.value=g.density)}function s(m,g,b,_,v){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(m,g):g.isMeshLambertMaterial?(r(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(m,g),u(m,g)):g.isMeshPhongMaterial?(r(m,g),h(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(m,g),f(m,g),g.isMeshPhysicalMaterial&&d(m,g,v)):g.isMeshMatcapMaterial?(r(m,g),p(m,g)):g.isMeshDepthMaterial?r(m,g):g.isMeshDistanceMaterial?(r(m,g),y(m,g)):g.isMeshNormalMaterial?r(m,g):g.isLineBasicMaterial?(a(m,g),g.isLineDashedMaterial&&o(m,g)):g.isPointsMaterial?l(m,g,b,_):g.isSpriteMaterial?c(m,g):g.isShadowMaterial?(m.color.value.copy(g.color),m.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(m,g){m.opacity.value=g.opacity,g.color&&m.diffuse.value.copy(g.color),g.emissive&&m.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.bumpMap&&(m.bumpMap.value=g.bumpMap,t(g.bumpMap,m.bumpMapTransform),m.bumpScale.value=g.bumpScale,g.side===gn&&(m.bumpScale.value*=-1)),g.normalMap&&(m.normalMap.value=g.normalMap,t(g.normalMap,m.normalMapTransform),m.normalScale.value.copy(g.normalScale),g.side===gn&&m.normalScale.value.negate()),g.displacementMap&&(m.displacementMap.value=g.displacementMap,t(g.displacementMap,m.displacementMapTransform),m.displacementScale.value=g.displacementScale,m.displacementBias.value=g.displacementBias),g.emissiveMap&&(m.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,m.emissiveMapTransform)),g.specularMap&&(m.specularMap.value=g.specularMap,t(g.specularMap,m.specularMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest);let b=e.get(g),_=b.envMap,v=b.envMapRotation;_&&(m.envMap.value=_,m.envMapRotation.value.setFromMatrix4(LM.makeRotationFromEuler(v)).transpose(),_.isCubeTexture&&_.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(Wg),m.reflectivity.value=g.reflectivity,m.ior.value=g.ior,m.refractionRatio.value=g.refractionRatio),g.lightMap&&(m.lightMap.value=g.lightMap,m.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,m.lightMapTransform)),g.aoMap&&(m.aoMap.value=g.aoMap,m.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,m.aoMapTransform))}function a(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform))}function o(m,g){m.dashSize.value=g.dashSize,m.totalSize.value=g.dashSize+g.gapSize,m.scale.value=g.scale}function l(m,g,b,_){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.size.value=g.size*b,m.scale.value=_*.5,g.map&&(m.map.value=g.map,t(g.map,m.uvTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function c(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.rotation.value=g.rotation,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function h(m,g){m.specular.value.copy(g.specular),m.shininess.value=Math.max(g.shininess,1e-4)}function u(m,g){g.gradientMap&&(m.gradientMap.value=g.gradientMap)}function f(m,g){m.metalness.value=g.metalness,g.metalnessMap&&(m.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,m.metalnessMapTransform)),m.roughness.value=g.roughness,g.roughnessMap&&(m.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,m.roughnessMapTransform)),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)}function d(m,g,b){m.ior.value=g.ior,g.diffuseRoughness>0&&(m.diffuseRoughness.value=g.diffuseRoughness,g.diffuseRoughnessMap&&(m.diffuseRoughnessMap.value=g.diffuseRoughnessMap,t(g.diffuseRoughnessMap,m.diffuseRoughnessMapTransform))),g.sheen>0&&(m.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),m.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(m.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,m.sheenColorMapTransform)),g.sheenRoughnessMap&&(m.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,m.sheenRoughnessMapTransform))),g.clearcoat>0&&(m.clearcoat.value=g.clearcoat,m.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(m.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,m.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(m.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===gn&&m.clearcoatNormalScale.value.negate())),g.dispersion>0&&(m.dispersion.value=g.dispersion),g.retroreflectivity>0&&(m.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(m.iridescence.value=g.iridescence,m.iridescenceIOR.value=g.iridescenceIOR,m.iridescenceThicknessMinimum.value=g.iridescenceThicknessMinimum,m.iridescenceThicknessMaximum.value=g.iridescenceThicknessMaximum,g.iridescenceMap&&(m.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,m.iridescenceMapTransform)),g.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),g.transmission>0&&(m.transmission.value=g.transmission,m.transmissionSamplerMap.value=b.texture,m.transmissionSamplerSize.value.set(b.width,b.height),g.transmissionMap&&(m.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,m.transmissionMapTransform)),m.thickness.value=g.thickness,g.thicknessMap&&(m.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=g.attenuationDistance,m.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(m.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(m.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=g.specularIntensity,m.specularColor.value.copy(g.specularColor),g.specularColorMap&&(m.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,m.specularColorMapTransform)),g.specularIntensityMap&&(m.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,m.specularIntensityMapTransform))}function p(m,g){g.matcap&&(m.matcap.value=g.matcap)}function y(m,g){let b=e.get(g).light;m.referencePosition.value.setFromMatrixPosition(b.matrixWorld),m.nearDistance.value=b.shadow.camera.near,m.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function kM(n,e,t,i){let s={},r={};function a(b,_){let v=_.program;i.uniformBlockBinding(b,v,s[b.id])}function o(b,_){let v=s[b.id];v===void 0&&(p(b),v=l(b),s[b.id]=v,b.addEventListener("dispose",m));let w=_.program;i.updateUBOMapping(b,w);let E=e.render.frame;r[b.id]!==E&&(c(b),r[b.id]=E)}function l(b){let _=n.createBuffer(),v=b.__size,w=b.usage;return n.bindBuffer(n.UNIFORM_BUFFER,_),n.bufferData(n.UNIFORM_BUFFER,v,w),n.bindBuffer(n.UNIFORM_BUFFER,null),_}function c(b){let _=s[b.id],v=b.uniforms,w=b.__cache;n.bindBuffer(n.UNIFORM_BUFFER,_);for(let E=0,x=v.length;E<x;E++){let A=v[E];if(Array.isArray(A))for(let I=0,R=A.length;I<R;I++)h(A[I],E,I,w);else h(A,E,0,w)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function h(b,_,v,w){if(f(b,_,v,w)===!0){let E=b.__offset,x=b.value;if(Array.isArray(x)){let A=0;for(let I=0;I<x.length;I++){let R=x[I],D=y(R,!0);u(R,b.__data,A),A+=D.storage/Float32Array.BYTES_PER_ELEMENT}}else u(x,b.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,E,b.__data)}}function u(b,_,v){typeof b=="number"||typeof b=="boolean"?_[v]=b:b.isMatrix3?(_[v]=b.elements[0],_[v+1]=b.elements[1],_[v+2]=b.elements[2],_[v+3]=0,_[v+4]=b.elements[3],_[v+5]=b.elements[4],_[v+6]=b.elements[5],_[v+7]=0,_[v+8]=b.elements[6],_[v+9]=b.elements[7],_[v+10]=b.elements[8],_[v+11]=0):ArrayBuffer.isView(b)?_.set(b.subarray(0,_.length-v),v):b.toArray(_,v)}function f(b,_,v,w){let E=b.value,x=_+"_"+v;if(Array.isArray(E)){w[x]===void 0&&(w[x]=[]);let A=w[x],I=!1;for(let R=0;R<E.length;R++)d(E[R],A,R)===!0&&(I=!0);return I}return d(E,w,x)}function d(b,_,v){if(_[v]===void 0)return typeof b=="number"||typeof b=="boolean"?_[v]=b:ArrayBuffer.isView(b)?_[v]=b.slice():_[v]=b.clone(),!0;{let w=_[v];if(typeof b=="number"||typeof b=="boolean"){if(w!==b)return _[v]=b,!0}else{if(ArrayBuffer.isView(b))return!0;if(w.equals(b)===!1)return w.copy(b),!0}}return!1}function p(b){let _=b.uniforms,v=0,w=16;for(let x=0,A=_.length;x<A;x++){let I=Array.isArray(_[x])?_[x]:[_[x]];for(let R=0,D=I.length;R<D;R++){let H=I[R],X=Array.isArray(H.value)?H.value:[H.value],L=Array.isArray(_[x])||Array.isArray(H.value),V=v;for(let W=0,te=X.length;W<te;W++){let q=X[W],ee=y(q,L),ne=v%w,be=ne%ee.boundary,De=ne+be;v+=be,De!==0&&w-De<ee.storage&&(v+=w-De),W===0&&(V=v),v+=ee.storage}let G=H.type==="int"?Int32Array:H.type==="uint"?Uint32Array:Float32Array;H.__data=new G((v-V)/Float32Array.BYTES_PER_ELEMENT),H.__offset=V}}let E=v%w;return E>0&&(v+=w-E),b.__size=v,b.__cache={},this}function y(b,_){let v={boundary:0,storage:0};return typeof b=="number"||typeof b=="boolean"?(v.boundary=4,v.storage=4):b.isVector2?(v.boundary=8,v.storage=8):b.isVector3||b.isColor?(v.boundary=16,v.storage=12):b.isVector4?(v.boundary=16,v.storage=16):b.isMatrix3?(v.boundary=16,v.storage=48):b.isMatrix4?(v.boundary=16,v.storage=64):b.isTexture?Le("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(b)?(v.boundary=16,v.storage=b.byteLength):Le("WebGLRenderer: Unsupported uniform value type.",b),_===!0&&(v.boundary=16,v.storage=Math.ceil(v.storage/16)*16),v}function m(b){let _=b.target;_.removeEventListener("dispose",m),n.deleteBuffer(s[_.id]),delete s[_.id],delete r[_.id]}function g(){for(let b in s)n.deleteBuffer(s[b]);s={},r={}}return{bind:a,update:o,dispose:g}}var DM=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),bi=null;function NM(){return bi===null&&(bi=new Cr(DM,16,16,cs,ii),bi.name="DFG_LUT",bi.minFilter=pn,bi.magFilter=pn,bi.wrapS=mi,bi.wrapT=mi,bi.generateMipmaps=!1,bi.needsUpdate=!0),bi}var ih=class{constructor(e={}){let{canvas:t=rg(),context:i=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:f=!1,outputBufferType:d=kn}=e;this.isWebGLRenderer=!0;let p;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=i.getContextAttributes().alpha}else p=a;let y=d,m=new Set([Sc,_c,xc]),g=new Set([kn,ni,zr,Ws,bc,vc]),b=new Uint32Array(4),_=new Int32Array(4),v={textures:[],min:[],max:[],resolution:[]},w=null,E=null,x=[],A=[],I=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=gi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let R=this,D=!1,H=null,X=null,L=null,V=null;this._outputColorSpace=Tn;let G=0,W=0,te=null,q=-1,ee=null,ne=new lt,be=new lt,De=null,J=new Xe(0),me=0,we=t.width,Ie=t.height,ve=1,He=null,At=null,Ne=new lt(0,0,we,Ie),ct=new lt(0,0,we,Ie),ut=!1,Je=new Us,Kt=new Kl,Nt=!1,yn=!1,_t=new ft,oi=new O,Vt=new lt,On={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Fn=!1;function Un(){return te===null?ve:1}let F=i;function Bn(M,k){return t.getContext(M,k)}let yt,bt,pe,Ot,ke,Be,C,S,B,ie,Q,oe,de,j,K,ce,P,Z,Y,he,ae,le,Ae;try{let M={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"187"}`),t.addEventListener("webglcontextlost",Re,!1),t.addEventListener("webglcontextrestored",Ve,!1),t.addEventListener("webglcontextcreationerror",ge,!1),F===null){let k="webgl2";if(F=Bn(k,M),F===null)throw Bn(k)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}We()}catch(M){throw t.removeEventListener("webglcontextlost",Re,!1),t.removeEventListener("webglcontextrestored",Ve,!1),t.removeEventListener("webglcontextcreationerror",ge,!1),Fe("WebGLRenderer: "+M.message),M}function We(){yt=new XS(F),yt.init(),ae=new CM(F,yt),bt=new NS(F,yt,e,ae),pe=new TM(F,yt),bt.reversedDepthBuffer&&f&&pe.buffers.depth.setReversed(!0),X=F.createFramebuffer(),L=F.createFramebuffer(),V=F.createFramebuffer(),Ot=new jS(F),ke=new dM,Be=new AM(F,yt,pe,ke,bt,ae,Ot),C=new $S(R),S=new Kv(F),le=new kS(F,S),B=new qS(F,S,Ot,le),ie=new KS(F,B,S,le,Ot),Z=new JS(F,bt,Be),K=new OS(ke),Q=new uM(R,C,yt,bt,le,K),oe=new IM(R,ke),de=new pM,j=new xM(yt),P=new IS(R,C,pe,ie,p,l),ce=new EM(R,ie,bt),Ae=new kM(F,Ot,bt,pe),Y=new DS(F,yt,Ot),he=new YS(F,yt,Ot),Ot.programs=Q.programs,R.capabilities=bt,R.extensions=yt,R.properties=ke,R.renderLists=de,R.shadowMap=ce,R.state=pe,R.info=Ot}y!==kn&&(I=new QS(y,t.width,t.height,o,s,r));let se=new $d(R,F);this.xr=se,this.getContext=function(){return F},this.getContextAttributes=function(){return F.getContextAttributes()},this.forceContextLoss=function(){let M=yt.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=yt.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return ve},this.setPixelRatio=function(M){M!==void 0&&(ve=M,this.setSize(we,Ie,!1))},this.getSize=function(M){return M.set(we,Ie)},this.setSize=function(M,k,$=!0){if(se.isPresenting){Le("WebGLRenderer: Can't change size while VR device is presenting.");return}we=M,Ie=k,t.width=Math.floor(M*ve),t.height=Math.floor(k*ve),$===!0&&(t.style.width=M+"px",t.style.height=k+"px"),I!==null&&I.setSize(t.width,t.height),this.setViewport(0,0,M,k)},this.getDrawingBufferSize=function(M){return M.set(we*ve,Ie*ve).floor()},this.setDrawingBufferSize=function(M,k,$){we=M,Ie=k,ve=$,t.width=Math.floor(M*$),t.height=Math.floor(k*$),this.setViewport(0,0,M,k)},this.setEffects=function(M){if(y===kn){Fe("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(M){for(let k=0;k<M.length;k++)if(M[k].isOutputPass===!0){Le("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}I.setEffects(M||[])},this.getCurrentViewport=function(M){return M.copy(ne)},this.getViewport=function(M){return M.copy(Ne)},this.setViewport=function(M,k,$,U){M.isVector4?Ne.set(M.x,M.y,M.z,M.w):Ne.set(M,k,$,U),pe.viewport(ne.copy(Ne).multiplyScalar(Un()).round())},this.getScissor=function(M){return M.copy(ct)},this.setScissor=function(M,k,$,U){M.isVector4?ct.set(M.x,M.y,M.z,M.w):ct.set(M,k,$,U),pe.scissor(be.copy(ct).multiplyScalar(Un()).round())},this.getScissorTest=function(){return ut},this.setScissorTest=function(M){pe.setScissorTest(ut=M)},this.setOpaqueSort=function(M){He=M},this.setTransparentSort=function(M){At=M},this.getClearColor=function(M){return M.copy(P.getClearColor())},this.setClearColor=function(){P.setClearColor(...arguments)},this.getClearAlpha=function(){return P.getClearAlpha()},this.setClearAlpha=function(){P.setClearAlpha(...arguments)},this.clear=function(M=!0,k=!0,$=!0){let U=0;if(M){let z=!1;if(te!==null){let fe=te.texture.format;z=m.has(fe)}if(z){let fe=te.texture.type,Se=g.has(fe),ue=P.getClearColor(),xe=P.getClearAlpha(),Te=ue.r,ze=ue.g,Ke=ue.b;Se?(b[0]=Te,b[1]=ze,b[2]=Ke,b[3]=xe,F.clearBufferuiv(F.COLOR,0,b)):(_[0]=Te,_[1]=ze,_[2]=Ke,_[3]=xe,F.clearBufferiv(F.COLOR,0,_))}else U|=F.COLOR_BUFFER_BIT}k&&(U|=F.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),$&&(U|=F.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),U!==0&&F.clear(U)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(M){M.setRenderer(this),H=M},this.dispose=function(){t.removeEventListener("webglcontextlost",Re,!1),t.removeEventListener("webglcontextrestored",Ve,!1),t.removeEventListener("webglcontextcreationerror",ge,!1),P.dispose(),de.dispose(),j.dispose(),Be.dispose(),ke.dispose(),C.dispose(),ie.dispose(),B.dispose(),le.dispose(),Ae.dispose(),Q.dispose(),se.dispose(),se.removeEventListener("sessionstart",bf),se.removeEventListener("sessionend",vf),ps.stop()};function Re(M){M.preventDefault(),Da("WebGLRenderer: Context Lost."),D=!0}function Ve(){Da("WebGLRenderer: Context Restored."),D=!1;let M=Ot.autoReset,k=ce.enabled,$=ce.autoUpdate,U=ce.needsUpdate,z=ce.type;We(),Ot.autoReset=M,ce.enabled=k,ce.autoUpdate=$,ce.needsUpdate=U,ce.type=z}function ge(M){Fe("WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function ht(M){let k=M.target;k.removeEventListener("dispose",ht),Gt(k)}function Gt(M){Ui(M),ke.remove(M)}function Ui(M){let k=ke.get(M).programs;k!==void 0&&(k.forEach(function($){Q.releaseProgram($)}),M.isShaderMaterial&&Q.releaseShaderCache(M))}this.renderBufferDirect=function(M,k,$,U,z,fe){k===null&&(k=On);let Se=z.isMesh&&z.matrixWorld.determinantAffine()<0,ue=Y0(M,k,$,U,z);pe.setMaterial(U,Se);let xe=$.index,Te=1;if(U.wireframe===!0){if(xe=B.getWireframeAttribute($),xe===void 0)return;Te=2}let ze=$.drawRange,Ke=$.attributes.position,Me=ze.start*Te,Ze=(ze.start+ze.count)*Te;fe!==null&&(Me=Math.max(Me,fe.start*Te),Ze=Math.min(Ze,(fe.start+fe.count)*Te)),xe!==null?(Me=Math.max(Me,0),Ze=Math.min(Ze,xe.count)):Ke!=null&&(Me=Math.max(Me,0),Ze=Math.min(Ze,Ke.count));let Ct=Ze-Me;if(Ct<0||Ct===1/0)return;le.setup(z,U,ue,$,xe);let pt,dt=Y;if(xe!==null&&(pt=S.get(xe),dt=he,dt.setIndex(pt)),z.isMesh)U.wireframe===!0?(pe.setLineWidth(U.wireframeLinewidth*Un()),dt.setMode(F.LINES)):dt.setMode(F.TRIANGLES);else if(z.isLine){let nn=U.linewidth;nn===void 0&&(nn=1),pe.setLineWidth(nn*Un()),z.isLineSegments?dt.setMode(F.LINES):z.isLineLoop?dt.setMode(F.LINE_LOOP):dt.setMode(F.LINE_STRIP)}else z.isPoints?dt.setMode(F.POINTS):z.isSprite&&dt.setMode(F.TRIANGLES);if(z.isBatchedMesh)if(yt.get("WEBGL_multi_draw"))dt.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{let nn=z._multiDrawStarts,Ee=z._multiDrawCounts,un=z._multiDrawCount,nt=xe?S.get(xe).bytesPerElement:1,ms=ke.get(U).currentProgram.getUniforms();for(let sn=0;sn<un;sn++)ms.setValue(F,"_gl_DrawID",sn),dt.render(nn[sn]/nt,Ee[sn])}else if(z.isInstancedMesh)dt.renderInstances(Me,Ct,z.count);else if($.isInstancedBufferGeometry){let nn=$._maxInstanceCount!==void 0?$._maxInstanceCount:1/0,Ee=Math.min($.instanceCount,nn);dt.renderInstances(Me,Ct,Ee)}else dt.render(Me,Ct)};function yf(M,k,$,U){H!==null&&M.isNodeMaterial&&H.setObject(U,M),Nt===!0&&K.setState(M,$,!1),M.transparent===!0&&M.side===In&&M.forceSinglePass===!1?(M.side=gn,M.needsUpdate=!0,jr(M,k,U),M.side=ls,M.needsUpdate=!0,jr(M,k,U),M.side=In):jr(M,k,U)}this.compile=function(M,k,$=null){$===null&&($=M),H!==null&&H.renderStart(M,k,$),E=j.get($),E.init(k),A.push(E),$.traverseVisible(function(z){z.isLight&&z.layers.test(k.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),M!==$&&M.traverseVisible(function(z){z.isLight&&z.layers.test(k.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),E.setupLights(),H!==null&&H.updateLights(E.state.lightsArray),yn=this.localClippingEnabled,Nt=K.init(this.clippingPlanes,yn),Nt===!0&&K.setGlobalState(this.clippingPlanes,k),H!==null&&ce.render(E.state.shadowsArray,$,k);let U=new Set;return M.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;let fe=z.material;if(fe)if(Array.isArray(fe))for(let Se=0;Se<fe.length;Se++){let ue=fe[Se];yf(ue,$,k,z),U.add(ue)}else yf(fe,$,k,z),U.add(fe)}),E=A.pop(),H!==null&&H.renderEnd(),U},this.compileAsync=function(M,k,$=null){let U=this.compile(M,k,$);return new Promise(z=>{function fe(){if(U.forEach(function(Se){let xe=ke.get(Se).currentProgram;(xe===void 0||xe.isReady())&&U.delete(Se)}),U.size===0){z(M);return}setTimeout(fe,10)}yt.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let Ah=null;function X0(M){Ah&&Ah(M)}function bf(){ps.stop()}function vf(){ps.start()}let ps=new Dg;ps.setAnimationLoop(X0),typeof self<"u"&&ps.setContext(self),this.setAnimationLoop=function(M){Ah=M,se.setAnimationLoop(M),M===null?ps.stop():ps.start()},se.addEventListener("sessionstart",bf),se.addEventListener("sessionend",vf),this.render=function(M,k){if(k!==void 0&&k.isCamera!==!0){Fe("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;H!==null&&H.renderStart(M,k);let $=se.enabled===!0&&se.isPresenting===!0,U=I!==null&&(te===null||$)&&I.begin(R,te);if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),k.parent===null&&k.matrixWorldAutoUpdate===!0&&k.updateMatrixWorld(),se.enabled===!0&&se.isPresenting===!0&&(I===null||I.isCompositing()===!1)&&(se.cameraAutoUpdate===!0&&se.updateCamera(k),k=se.getCamera()),M.isScene===!0&&M.onBeforeRender(R,M,k,te),E=j.get(M,A.length),E.init(k),E.state.textureUnits=Be.getTextureUnits(),A.push(E),_t.multiplyMatrices(k.projectionMatrix,k.matrixWorldInverse),k.isArrayCamera?Kt.setFromArrayCamera(k):Je.setFromProjectionMatrix(_t,Wn,k.reversedDepth),yn=this.localClippingEnabled,Nt=K.init(this.clippingPlanes,yn),w=de.get(M,x.length),w.init(),x.push(w),this.info.render.frame++,se.enabled===!0&&se.isPresenting===!0){let Se=R.xr.getDepthSensingMesh();Se!==null&&Ch(Se,k,-1/0,R.sortObjects)}Ch(M,k,0,R.sortObjects),w.finish(),H!==null&&H.updateLights(E.state.lightsArray),R.sortObjects===!0&&w.sort(He,At),Fn=se.enabled===!1||se.isPresenting===!1||se.hasDepthSensing()===!1,Fn&&P.addToRenderList(w,M),this.info.autoReset===!0&&this.info.reset(),Nt===!0&&K.beginShadows();let z=E.state.shadowsArray;if(ce.render(z,M,k),Nt===!0&&K.endShadows(),(U&&I.hasRenderPass())===!1){let Se=w.opaque,ue=w.transmissive;if(E.setupLights(),k.isArrayCamera){let xe=k.cameras;if(ue.length>0)for(let Te=0,ze=xe.length;Te<ze;Te++){let Ke=xe[Te];_f(Se,ue,M,Ke)}Fn&&P.render(M);for(let Te=0,ze=xe.length;Te<ze;Te++){let Ke=xe[Te];xf(w,M,Ke,Ke.viewport)}}else ue.length>0&&_f(Se,ue,M,k),Fn&&P.render(M),xf(w,M,k)}te!==null&&W===0&&(Be.updateMultisampleRenderTarget(te),Be.updateRenderTargetMipmap(te)),U&&I.end(R),M.isScene===!0&&M.onAfterRender(R,M,k),le.resetDefaultState(),q=-1,ee=null,A.pop(),A.length>0?(E=A[A.length-1],Be.setTextureUnits(E.state.textureUnits),Nt===!0&&K.setGlobalState(R.clippingPlanes,E.state.camera)):E=null,x.pop(),x.length>0?w=x[x.length-1]:w=null,H!==null&&H.renderEnd()};function Ch(M,k,$,U){if(M.visible===!1)return;if(M.layers.test(k.layers)){if(M.isGroup)$=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(k);else if(M.isLight)E.pushLight(M),M.castShadow&&E.pushShadow(M);else if(M.isSprite){let Se=k.isArrayCamera?Kt:Je;if(!M.frustumCulled||M.intersectsFrustum(Se)){U&&Vt.setFromMatrixPosition(M.matrixWorld).applyMatrix4(_t);let ue=ie.update(M),xe=M.material;xe.visible&&w.push(M,ue,xe,$,Vt.z,null,k)}}else if(M.isMesh||M.isLine||M.isPoints){let Se=k.isArrayCamera?Kt:Je;if(!M.frustumCulled||M.intersectsFrustum(Se)){let ue=ie.update(M),xe=M.material;if(U&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),Vt.copy(M.boundingSphere.center)):(ue.boundingSphere===null&&ue.computeBoundingSphere(),Vt.copy(ue.boundingSphere.center)),Vt.applyMatrix4(M.matrixWorld).applyMatrix4(_t)),Array.isArray(xe)){let Te=ue.groups;for(let ze=0,Ke=Te.length;ze<Ke;ze++){let Me=Te[ze],Ze=xe[Me.materialIndex];Ze&&Ze.visible&&w.push(M,ue,Ze,$,Vt.z,Me,k)}}else xe.visible&&w.push(M,ue,xe,$,Vt.z,null,k)}}}let fe=M.children;for(let Se=0,ue=fe.length;Se<ue;Se++)Ch(fe[Se],k,$,U)}function xf(M,k,$,U){let{opaque:z,transmissive:fe,transparent:Se}=M;E.setupLightsView($),Nt===!0&&K.setGlobalState(R.clippingPlanes,$),U&&pe.viewport(ne.copy(U)),z.length>0&&yo(z,k,$),fe.length>0&&yo(fe,k,$),Se.length>0&&yo(Se,k,$),pe.buffers.depth.setTest(!0),pe.buffers.depth.setMask(!0),pe.buffers.color.setMask(!0),pe.setPolygonOffset(!1)}function _f(M,k,$,U){if(($.isScene===!0?$.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[U.id]===void 0){let Me=yt.has("EXT_color_buffer_half_float")||yt.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[U.id]=new mn(1,1,{generateMipmaps:!0,type:Me?ii:kn,minFilter:Di,samples:Math.max(4,bt.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Ye.workingColorSpace})}let fe=E.state.transmissionRenderTarget[U.id],Se=U.viewport||ne;fe.setSize(Se.z*R.transmissionResolutionScale,Se.w*R.transmissionResolutionScale);let ue=R.getRenderTarget(),xe=R.getActiveCubeFace(),Te=R.getActiveMipmapLevel();R.setRenderTarget(fe),R.getClearColor(J),me=R.getClearAlpha(),me<1&&R.setClearColor(16777215,.5),R.clear(),Fn&&P.render($);let ze=R.toneMapping;R.toneMapping=gi;let Ke=U.viewport;if(U.viewport!==void 0&&(U.viewport=void 0),E.setupLightsView(U),Nt===!0&&K.setGlobalState(R.clippingPlanes,U),yo(M,$,U),Be.updateMultisampleRenderTarget(fe),Be.updateRenderTargetMipmap(fe),yt.has("WEBGL_multisampled_render_to_texture")===!1){let Me=!1;for(let Ze=0,Ct=k.length;Ze<Ct;Ze++){let pt=k[Ze],{object:dt,geometry:nn,material:Ee,group:un}=pt;if(Ee.side===In&&dt.layers.test(U.layers)){let nt=Ee.side;Ee.side=gn,Ee.needsUpdate=!0,Sf(dt,$,U,nn,Ee,un),Ee.side=nt,Ee.needsUpdate=!0,Me=!0}}Me===!0&&(Be.updateMultisampleRenderTarget(fe),Be.updateRenderTargetMipmap(fe))}R.setRenderTarget(ue,xe,Te),R.setClearColor(J,me),Ke!==void 0&&(U.viewport=Ke),R.toneMapping=ze}function yo(M,k,$){let U=k.isScene===!0?k.overrideMaterial:null;for(let z=0,fe=M.length;z<fe;z++){let Se=M[z],{object:ue,geometry:xe,group:Te}=Se,ze=Se.material;ze.allowOverride===!0&&U!==null&&(ze=U),ue.layers.test($.layers)&&Sf(ue,k,$,xe,ze,Te)}}function Sf(M,k,$,U,z,fe){H!==null&&z.isNodeMaterial&&H.setObject(M,z),M.onBeforeRender(R,k,$,U,z,fe),M.modelViewMatrix.multiplyMatrices($.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),z.onBeforeRender(R,k,$,U,M,fe),z.transparent===!0&&z.side===In&&z.forceSinglePass===!1?(z.side=gn,z.needsUpdate=!0,R.renderBufferDirect($,k,U,z,M,fe),z.side=ls,z.needsUpdate=!0,R.renderBufferDirect($,k,U,z,M,fe),z.side=In):R.renderBufferDirect($,k,U,z,M,fe),M.onAfterRender(R,k,$,U,z,fe)}function wf(M){let k=0;for(let $ of M)$.texture!==null&&k++;return k}function jr(M,k,$){k.isScene!==!0&&(k=On);let U=ke.get(M),z=E.state.lights,fe=E.state.shadowsArray,Se=z.state.version,ue=Q.getParameters(M,z.state,fe,k,$,E.state.lightProbeGridArray),xe=Q.getProgramCacheKey(ue),Te=U.programs;U.environment=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?k.environment:null,U.fog=k.fog;let ze=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap;U.envMap=C.get(M.envMap||U.environment,ze),U.envMapRotation=U.environment!==null&&M.envMap===null?k.environmentRotation:M.envMapRotation,Te===void 0&&(M.addEventListener("dispose",ht),Te=new Map,U.programs=Te,U.programVariants=new Map);let Ke=Te.get(xe);if(Ke!==void 0){if(U.currentProgram===Ke&&U.lightsStateVersion===Se)return Ef(M,ue),Ke}else ue.uniforms=Q.getUniforms(M),H!==null&&M.isNodeMaterial&&H.build(M,$,ue),M.onBeforeCompile(ue,R),Ke=Q.acquireProgram(ue,xe),Te.set(xe,Ke),U.uniforms=ue.uniforms;let Me=U.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Me.clippingPlanes=K.uniform),Ef(M,ue),U.needsLights=J0(M),U.lightsStateVersion=Se,U.needsLights&&(Me.ambientLightColor.value=z.state.ambient,Me.lightProbe.value=z.state.probe,Me.sunLights.value=z.state.sun,Me.sunLightShadows.value=z.state.sunShadow,Me.directionalLights.value=z.state.directional,Me.directionalLightShadows.value=z.state.directionalShadow,Me.spotLights.value=z.state.spot,Me.spotLightShadows.value=z.state.spotShadow,Me.rectAreaLights.value=z.state.rectArea,Me.ltc_1.value=z.state.rectAreaLTC1,Me.ltc_2.value=z.state.rectAreaLTC2,Me.pointLights.value=z.state.point,Me.pointLightShadows.value=z.state.pointShadow,Me.hemisphereLights.value=z.state.hemi,Me.sunShadowMatrix.value=z.state.sunShadowMatrix,Me.sunShadowCascade.value=z.state.sunShadowCascade,Me.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Me.spotLightMatrix.value=z.state.spotLightMatrix,Me.spotLightMap.value=z.state.spotLightMap,Me.pointShadowMatrix.value=z.state.pointShadowMatrix),U.numLightProbeGrids=wf(E.state.lightProbeGridArray),U.currentProgram=Ke,U.uniformsList=null,Ke}function q0(M,k,$,U,z){let fe=ke.get(M),Se=fe.currentProgram.id+","+U+","+z,ue=fe.programVariants.get(Se);return ue===void 0?(ue=jr(M,k,$),fe.programVariants.set(Se,ue)):(fe.currentProgram=ue,fe.uniformsList=null,fe.outputColorSpace=U,fe.toneMapping=z),ue}function Mf(M){if(M.uniformsList===null){let k=M.currentProgram.getUniforms();M.uniformsList=Hr.seqWithValue(k.seq,M.uniforms)}return M.uniformsList}function Ef(M,k){let $=ke.get(M);$.outputColorSpace=k.outputColorSpace,$.batching=k.batching,$.batchingColor=k.batchingColor,$.instancing=k.instancing,$.instancingColor=k.instancingColor,$.instancingMorph=k.instancingMorph,$.skinning=k.skinning,$.morphTargets=k.morphTargets,$.morphNormals=k.morphNormals,$.morphColors=k.morphColors,$.morphTargetsCount=k.morphTargetsCount,$.numClippingPlanes=k.numClippingPlanes,$.numIntersection=k.numClipIntersection,$.vertexAlphas=k.vertexAlphas,$.vertexTangents=k.vertexTangents,$.toneMapping=k.toneMapping}function Y0(M,k,$,U,z){k.isScene!==!0&&(k=On),Be.resetTextureUnits();let fe=k.fog,Se=U.isMeshStandardMaterial||U.isMeshLambertMaterial||U.isMeshPhongMaterial?k.environment:null,ue=te===null?R.outputColorSpace:te.isXRRenderTarget===!0?te.texture.colorSpace:Ye.workingColorSpace,xe=U.isMeshStandardMaterial||U.isMeshLambertMaterial&&!U.envMap||U.isMeshPhongMaterial&&!U.envMap,Te=C.get(U.envMap||Se,xe),ze=U.vertexColors===!0&&!!$.attributes.color&&$.attributes.color.itemSize===4,Ke=!!$.attributes.tangent&&(!!U.normalMap||U.anisotropy>0),Me=!!$.morphAttributes.position,Ze=!!$.morphAttributes.normal,Ct=!!$.morphAttributes.color,pt=gi;U.toneMapped&&(te===null||te.isXRRenderTarget===!0)&&(pt=R.toneMapping);let dt=$.morphAttributes.position||$.morphAttributes.normal||$.morphAttributes.color,nn=dt!==void 0?dt.length:0,Ee=ke.get(U),un=E.state.lights;if(Nt===!0&&(yn===!0||M!==ee)){let St=M===ee&&U.id===q;K.setState(U,M,St)}let nt=!1,ms=!1;U.version===Ee.__version?Ee.needsLights&&Ee.lightsStateVersion!==un.state.version||z.isBatchedMesh&&Ee.batching===!1||!z.isBatchedMesh&&Ee.batching===!0||z.isBatchedMesh&&Ee.batchingColor===!0&&z._colorsTexture===null||z.isBatchedMesh&&Ee.batchingColor===!1&&z._colorsTexture!==null||z.isInstancedMesh&&Ee.instancing===!1||!z.isInstancedMesh&&Ee.instancing===!0||z.isSkinnedMesh&&Ee.skinning===!1||!z.isSkinnedMesh&&Ee.skinning===!0||z.isInstancedMesh&&Ee.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Ee.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Ee.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Ee.instancingMorph===!1&&z.morphTexture!==null||Ee.envMap!==Te||U.fog===!0&&Ee.fog!==fe||Ee.numClippingPlanes!==void 0&&(Ee.numClippingPlanes!==K.numPlanes||Ee.numIntersection!==K.numIntersection)||Ee.vertexAlphas!==ze||Ee.vertexTangents!==Ke||Ee.morphTargets!==Me||Ee.morphNormals!==Ze||Ee.morphColors!==Ct||Ee.morphTargetsCount!==nn||Ee.numLightProbeGrids!==wf(E.state.lightProbeGridArray)?nt=!0:(Ee.outputColorSpace!==ue||Ee.toneMapping!==pt)&&(ms=!0):(nt=!0,Ee.__version=U.version);let sn=Ee.currentProgram;(nt===!0||ms===!0)&&(sn=ms===!0?q0(U,k,z,ue,pt):jr(U,k,z),H&&U.isNodeMaterial&&H.onUpdateProgram(U,sn,Ee));let bo=!1,Bi=!1,gs=!1,tt=sn.getUniforms(),Zt=Ee.uniforms;if(pe.useProgram(sn.program)&&(bo=!0,Bi=!0,gs=!0),U.id!==q&&(q=U.id,Bi=!0),bo||ee!==M){pe.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),tt.setValue(F,"projectionMatrix",M.projectionMatrix),tt.setValue(F,"viewMatrix",M.matrixWorldInverse);let Wt=tt.map.cameraPosition;Wt!==void 0&&Wt.setValue(F,oi.setFromMatrixPosition(M.matrixWorld)),bt.logarithmicDepthBuffer&&tt.setValue(F,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(U.isMeshPhongMaterial||U.isMeshToonMaterial||U.isMeshLambertMaterial||U.isMeshBasicMaterial||U.isMeshStandardMaterial||U.isShaderMaterial)&&tt.setValue(F,"isOrthographic",M.isOrthographicCamera===!0),ee!==M&&(ee=M,Bi=!0,gs=!0)}if(Ee.needsLights&&(un.state.sunShadowMap.length>0&&tt.setValue(F,"sunShadowMap",un.state.sunShadowMap,Be),un.state.directionalShadowMap.length>0&&tt.setValue(F,"directionalShadowMap",un.state.directionalShadowMap,Be),un.state.spotShadowMap.length>0&&tt.setValue(F,"spotShadowMap",un.state.spotShadowMap,Be),un.state.pointShadowMap.length>0&&tt.setValue(F,"pointShadowMap",un.state.pointShadowMap,Be)),z.isSkinnedMesh){tt.setOptional(F,z,"bindMatrix"),tt.setOptional(F,z,"bindMatrixInverse");let St=z.skeleton;St&&(St.boneTexture===null&&St.computeBoneTexture(),tt.setValue(F,"boneTexture",St.boneTexture,Be))}z.isBatchedMesh&&(tt.setOptional(F,z,"batchingTexture"),tt.setValue(F,"batchingTexture",z._matricesTexture,Be),tt.setOptional(F,z,"batchingIdTexture"),tt.setValue(F,"batchingIdTexture",z._indirectTexture,Be),tt.setOptional(F,z,"batchingColorTexture"),z._colorsTexture!==null&&tt.setValue(F,"batchingColorTexture",z._colorsTexture,Be));let Xn=$.morphAttributes;if((Xn.position!==void 0||Xn.normal!==void 0||Xn.color!==void 0)&&Z.update(z,$,sn),(Bi||Ee.receiveShadow!==z.receiveShadow)&&(Ee.receiveShadow=z.receiveShadow,tt.setValue(F,"receiveShadow",z.receiveShadow)),(U.isMeshStandardMaterial||U.isMeshLambertMaterial||U.isMeshPhongMaterial)&&U.envMap===null&&k.environment!==null&&(Zt.envMapIntensity.value=k.environmentIntensity),Zt.dfgLUT!==void 0&&(Zt.dfgLUT.value=NM()),Bi){if(tt.setValue(F,"toneMappingExposure",R.toneMappingExposure),Ee.needsLights&&j0(Zt,gs),fe&&U.fog===!0&&oe.refreshFogUniforms(Zt,fe),oe.refreshMaterialUniforms(Zt,U,ve,Ie,E.state.transmissionRenderTarget[M.id]),Ee.needsLights&&Ee.numLightProbeGrids>0){let St=v,Wt=0;for(let xi of E.state.lightProbeGridArray)xi.texture!==null&&(St.textures[Wt]=xi.texture,St.min[Wt]=xi.boundingBox.min,St.max[Wt]=xi.boundingBox.max,St.resolution[Wt]=xi.resolution,Wt++);for(let xi in St)St[xi].length=Wt;Zt.probesSH.value=St.textures,Zt.probesMin.value=St.min,Zt.probesMax.value=St.max,Zt.probesResolution.value=St.resolution}Hr.upload(F,Mf(Ee),Zt,Be)}if(U.isShaderMaterial&&U.uniformsNeedUpdate===!0&&(Hr.upload(F,Mf(Ee),Zt,Be),U.uniformsNeedUpdate=!1),U.isSpriteMaterial&&tt.setValue(F,"center",z.center),tt.setValue(F,"modelViewMatrix",z.modelViewMatrix),tt.setValue(F,"normalMatrix",z.normalMatrix),tt.setValue(F,"modelMatrix",z.matrixWorld),U.uniformsGroups!==void 0){let St=U.uniformsGroups;for(let Wt=0,xi=St.length;Wt<xi;Wt++){let Af=St[Wt];Ae.update(Af,sn),Ae.bind(Af,sn)}}return sn}function j0(M,k){M.ambientLightColor.needsUpdate=k,M.lightProbe.needsUpdate=k,M.sunLights.needsUpdate=k,M.sunLightShadows.needsUpdate=k,M.directionalLights.needsUpdate=k,M.directionalLightShadows.needsUpdate=k,M.pointLights.needsUpdate=k,M.pointLightShadows.needsUpdate=k,M.spotLights.needsUpdate=k,M.spotLightShadows.needsUpdate=k,M.rectAreaLights.needsUpdate=k,M.hemisphereLights.needsUpdate=k}function J0(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return G},this.getActiveMipmapLevel=function(){return W},this.getRenderTarget=function(){return te},this.setRenderTargetTextures=function(M,k,$){let U=ke.get(M);U.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,U.__autoAllocateDepthBuffer===!1&&(U.__useRenderToTexture=!1),ke.get(M.texture).__webglTexture=k,ke.get(M.depthTexture).__webglTexture=U.__autoAllocateDepthBuffer?void 0:$,U.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,k){let $=ke.get(M);$.__webglFramebuffer=k,$.__useDefaultFramebuffer=k===void 0},this.setRenderTarget=function(M,k=0,$=0){te=M,G=k,W=$;let U=null,z=!1,fe=!1;if(M){let ue=ke.get(M);if(ue.__useDefaultFramebuffer!==void 0){pe.bindFramebuffer(F.FRAMEBUFFER,ue.__webglFramebuffer),ne.copy(M.viewport),be.copy(M.scissor),De=M.scissorTest,pe.viewport(ne),pe.scissor(be),pe.setScissorTest(De),q=-1;return}else if(ue.__webglFramebuffer===void 0)Be.setupRenderTarget(M);else if(ue.__hasExternalTextures)Be.rebindTextures(M,ke.get(M.texture).__webglTexture,ke.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){let ze=M.depthTexture;if(ue.__boundDepthTexture!==ze){if(ze!==null&&ke.has(ze)&&(M.width!==ze.image.width||M.height!==ze.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Be.setupDepthRenderbuffer(M)}}let xe=M.texture;(xe.isData3DTexture||xe.isDataArrayTexture||xe.isCompressedArrayTexture)&&(fe=!0);let Te=ke.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(Te[k])?U=Te[k][$]:U=Te[k],z=!0):M.samples>0&&Be.useMultisampledRTT(M)===!1?U=ke.get(M).__webglMultisampledFramebuffer:Array.isArray(Te)?U=Te[$]:U=Te,ne.copy(M.viewport),be.copy(M.scissor),De=M.scissorTest}else ne.copy(Ne).multiplyScalar(ve).floor(),be.copy(ct).multiplyScalar(ve).floor(),De=ut;if($!==0&&(U=X),pe.bindFramebuffer(F.FRAMEBUFFER,U)&&pe.drawBuffers(M,U),pe.viewport(ne),pe.scissor(be),pe.setScissorTest(De),z){let ue=ke.get(M.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_CUBE_MAP_POSITIVE_X+k,ue.__webglTexture,$)}else if(fe){let ue=k;for(let xe=0;xe<M.textures.length;xe++){let Te=ke.get(M.textures[xe]);F.framebufferTextureLayer(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0+xe,Te.__webglTexture,$,ue)}}else if(M!==null&&$!==0){let ue=ke.get(M.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,ue.__webglTexture,$)}q=-1};function Tf(M){let k=ke.get(M);return(k.__readFormat!==M.format||k.__readType!==M.type)&&(k.__readFormat=M.format,k.__readType=M.type,k.__formatReadable=bt.textureFormatReadable(M.format),k.__typeReadable=bt.textureTypeReadable(M.type)),k}this.readRenderTargetPixels=function(M,k,$,U,z,fe,Se,ue=0){if(!(M&&M.isWebGLRenderTarget)){Fe("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let xe=ke.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Se!==void 0&&(xe=xe[Se],Array.isArray(xe)&&(xe=xe[0])),xe){pe.bindFramebuffer(F.FRAMEBUFFER,xe);try{let Te=M.textures[ue],ze=Te.format,Ke=Te.type;M.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+ue);let Me=Tf(Te);if(Me.__formatReadable===!1){Fe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Me.__typeReadable===!1){Fe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}k>=0&&k<=M.width-U&&$>=0&&$<=M.height-z&&F.readPixels(k,$,U,z,ae.convert(ze),ae.convert(Ke),fe)}finally{let Te=te!==null?ke.get(te).__webglFramebuffer:null;pe.bindFramebuffer(F.FRAMEBUFFER,Te)}}},this.readRenderTargetPixelsAsync=async function(M,k,$,U,z,fe,Se,ue=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let xe=ke.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Se!==void 0&&(xe=xe[Se],Array.isArray(xe)&&(xe=xe[0])),xe)if(k>=0&&k<=M.width-U&&$>=0&&$<=M.height-z){pe.bindFramebuffer(F.FRAMEBUFFER,xe);let Te=M.textures[ue],ze=Te.format,Ke=Te.type;M.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+ue);let Me=Tf(Te);if(Me.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Me.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ze=F.createBuffer();F.bindBuffer(F.PIXEL_PACK_BUFFER,Ze),F.bufferData(F.PIXEL_PACK_BUFFER,fe.byteLength,F.STREAM_READ),F.readPixels(k,$,U,z,ae.convert(ze),ae.convert(Ke),0),F.bindBuffer(F.PIXEL_PACK_BUFFER,null);let Ct=te!==null?ke.get(te).__webglFramebuffer:null;pe.bindFramebuffer(F.FRAMEBUFFER,Ct);let pt=F.fenceSync(F.SYNC_GPU_COMMANDS_COMPLETE,0);return F.flush(),await og(F,pt,4),F.bindBuffer(F.PIXEL_PACK_BUFFER,Ze),F.getBufferSubData(F.PIXEL_PACK_BUFFER,0,fe),F.bindBuffer(F.PIXEL_PACK_BUFFER,null),F.deleteBuffer(Ze),F.deleteSync(pt),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,k=null,$=0){let U=Math.pow(2,-$),z=Math.floor(M.image.width*U),fe=Math.floor(M.image.height*U),Se=k!==null?k.x:0,ue=k!==null?k.y:0;Be.setTexture2D(M,0),F.copyTexSubImage2D(F.TEXTURE_2D,$,0,0,Se,ue,z,fe),pe.unbindTexture()},this.copyTextureToTexture=function(M,k,$=null,U=null,z=0,fe=0){let Se,ue,xe,Te,ze,Ke,Me,Ze,Ct,pt=M.isCompressedTexture?M.mipmaps[fe]:M.image;if($!==null)Se=$.max.x-$.min.x,ue=$.max.y-$.min.y,xe=$.isBox3?$.max.z-$.min.z:1,Te=$.min.x,ze=$.min.y,Ke=$.isBox3?$.min.z:0;else{let tt=Math.pow(2,-z);Se=Math.floor(pt.width*tt),ue=Math.floor(pt.height*tt),M.isDataArrayTexture?xe=pt.depth:M.isData3DTexture?xe=Math.floor(pt.depth*tt):xe=1,Te=0,ze=0,Ke=0}U!==null?(Me=U.x,Ze=U.y,Ct=U.z):(Me=0,Ze=0,Ct=0);let dt=ae.convert(k.format),nn=ae.convert(k.type),Ee;k.isData3DTexture?(Be.setTexture3D(k,0),Ee=F.TEXTURE_3D):k.isDataArrayTexture||k.isCompressedArrayTexture?(Be.setTexture2DArray(k,0),Ee=F.TEXTURE_2D_ARRAY):(Be.setTexture2D(k,0),Ee=F.TEXTURE_2D),pe.activeTexture(F.TEXTURE0),pe.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,k.flipY),pe.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,k.premultiplyAlpha),pe.pixelStorei(F.UNPACK_ALIGNMENT,k.unpackAlignment);let un=pe.getParameter(F.UNPACK_ROW_LENGTH),nt=pe.getParameter(F.UNPACK_IMAGE_HEIGHT),ms=pe.getParameter(F.UNPACK_SKIP_PIXELS),sn=pe.getParameter(F.UNPACK_SKIP_ROWS),bo=pe.getParameter(F.UNPACK_SKIP_IMAGES);pe.pixelStorei(F.UNPACK_ROW_LENGTH,pt.width),pe.pixelStorei(F.UNPACK_IMAGE_HEIGHT,pt.height),pe.pixelStorei(F.UNPACK_SKIP_PIXELS,Te),pe.pixelStorei(F.UNPACK_SKIP_ROWS,ze),pe.pixelStorei(F.UNPACK_SKIP_IMAGES,Ke);let Bi=M.isDataArrayTexture||M.isData3DTexture,gs=k.isDataArrayTexture||k.isData3DTexture;if(M.isDepthTexture){let tt=ke.get(M),Zt=ke.get(k),Xn=ke.get(tt.__renderTarget),St=ke.get(Zt.__renderTarget);pe.bindFramebuffer(F.READ_FRAMEBUFFER,Xn.__webglFramebuffer),pe.bindFramebuffer(F.DRAW_FRAMEBUFFER,St.__webglFramebuffer);for(let Wt=0;Wt<xe;Wt++)Bi&&(F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,ke.get(M).__webglTexture,z,Ke+Wt),F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,ke.get(k).__webglTexture,fe,Ct+Wt)),F.blitFramebuffer(Te,ze,Te+Se,ze+ue,Me,Ze,Me+Se,Ze+ue,F.DEPTH_BUFFER_BIT,F.NEAREST);pe.bindFramebuffer(F.READ_FRAMEBUFFER,null),pe.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else if(z!==0||M.isRenderTargetTexture||ke.has(M)){let tt=ke.get(M),Zt=ke.get(k);pe.bindFramebuffer(F.READ_FRAMEBUFFER,L),pe.bindFramebuffer(F.DRAW_FRAMEBUFFER,V);for(let Xn=0;Xn<xe;Xn++)Bi?F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,tt.__webglTexture,z,Ke+Xn):F.framebufferTexture2D(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,tt.__webglTexture,z),gs?F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,Zt.__webglTexture,fe,Ct+Xn):F.framebufferTexture2D(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,Zt.__webglTexture,fe),z!==0?F.blitFramebuffer(Te,ze,Te+Se,ze+ue,Me,Ze,Me+Se,Ze+ue,F.COLOR_BUFFER_BIT,F.NEAREST):gs?F.copyTexSubImage3D(Ee,fe,Me,Ze,Ct+Xn,Te,ze,Se,ue):F.copyTexSubImage2D(Ee,fe,Me,Ze,Te,ze,Se,ue);pe.bindFramebuffer(F.READ_FRAMEBUFFER,null),pe.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else gs?M.isDataTexture||M.isData3DTexture?F.texSubImage3D(Ee,fe,Me,Ze,Ct,Se,ue,xe,dt,nn,pt.data):k.isCompressedArrayTexture?F.compressedTexSubImage3D(Ee,fe,Me,Ze,Ct,Se,ue,xe,dt,pt.data):F.texSubImage3D(Ee,fe,Me,Ze,Ct,Se,ue,xe,dt,nn,pt):M.isDataTexture?F.texSubImage2D(F.TEXTURE_2D,fe,Me,Ze,Se,ue,dt,nn,pt.data):M.isCompressedTexture?F.compressedTexSubImage2D(F.TEXTURE_2D,fe,Me,Ze,pt.width,pt.height,dt,pt.data):F.texSubImage2D(F.TEXTURE_2D,fe,Me,Ze,Se,ue,dt,nn,pt);pe.pixelStorei(F.UNPACK_ROW_LENGTH,un),pe.pixelStorei(F.UNPACK_IMAGE_HEIGHT,nt),pe.pixelStorei(F.UNPACK_SKIP_PIXELS,ms),pe.pixelStorei(F.UNPACK_SKIP_ROWS,sn),pe.pixelStorei(F.UNPACK_SKIP_IMAGES,bo),fe===0&&k.generateMipmaps===!0&&k.mipmapsAutoUpdate===!0&&F.generateMipmap(Ee),pe.unbindTexture()},this.initRenderTarget=function(M){ke.get(M).__webglFramebuffer===void 0&&Be.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?Be.setTextureCube(M,0):M.isData3DTexture?Be.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?Be.setTexture2DArray(M,0):Be.setTexture2D(M,0),pe.unbindTexture()},this.resetState=function(){G=0,W=0,te=null,pe.reset(),le.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Wn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ye._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ye._getUnpackColorSpace()}};var $g={type:"change"},qd={type:"start"},qg={type:"end"},ah=new is,Xg=new An,FM=Math.cos(70*Ld.DEG2RAD),Ht=new O,xn=2*Math.PI,st={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Xd=1e-6,oh=class extends $a{constructor(e,t=null){super(e,t),this.state=st.NONE,this.target=new O,this.cursor=new O,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:$n.ROTATE,MIDDLE:$n.DOLLY,RIGHT:$n.PAN},this.touches={ONE:ti.ROTATE,TWO:ti.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new O,this._lastQuaternion=new Cn,this._lastTargetPosition=new O,this._quat=new Cn().setFromUnitVectors(e.up,new O(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Or,this._sphericalDelta=new Or,this._scale=1,this._panOffset=new O,this._rotateStart=new Pe,this._rotateEnd=new Pe,this._rotateDelta=new Pe,this._panStart=new Pe,this._panEnd=new Pe,this._panDelta=new Pe,this._dollyStart=new Pe,this._dollyEnd=new Pe,this._dollyDelta=new Pe,this._dollyDirection=new O,this._mouse=new Pe,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=BM.bind(this),this._onPointerDown=UM.bind(this),this._onPointerUp=zM.bind(this),this._onContextMenu=qM.bind(this),this._onMouseWheel=GM.bind(this),this._onKeyDown=WM.bind(this),this._onTouchStart=$M.bind(this),this._onTouchMove=XM.bind(this),this._onMouseDown=HM.bind(this),this._onMouseMove=VM.bind(this),this._interceptControlDown=YM.bind(this),this._interceptControlUp=jM.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.ownerDocument.addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=st.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.ownerDocument.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.ownerDocument.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent($g),this.update(),this.state=st.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Ht.copy(t).sub(this.target),Ht.applyQuaternion(this._quat),this._spherical.setFromVector3(Ht),this.autoRotate&&this.state===st.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(i)&&isFinite(s)&&(i<-Math.PI?i+=xn:i>Math.PI&&(i-=xn),s<-Math.PI?s+=xn:s>Math.PI&&(s-=xn),i<=s?this._spherical.theta=Math.max(i,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+s)/2?Math.max(i,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=a!=this._spherical.radius}if(Ht.setFromSpherical(this._spherical),Ht.applyQuaternion(this._quatInverse),t.copy(this.target).add(Ht),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){let o=Ht.length();a=this._clampDistance(o*this._scale);let l=o-a;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let o=new O(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new O(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(o),this.object.updateMatrixWorld(),a=Ht.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(ah.origin.copy(this.object.position),ah.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(ah.direction))<FM?this.object.lookAt(this.target):(Xg.setFromNormalAndCoplanarPoint(this.object.up,this.target),ah.intersectPlane(Xg,this.target))))}else if(this.object.isOrthographicCamera){let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Xd||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Xd||this._lastTargetPosition.distanceToSquared(this.target)>Xd?(this.dispatchEvent($g),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?xn/60*this.autoRotateSpeed*e:xn/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Ht.setFromMatrixColumn(t,0),Ht.multiplyScalar(-e),this._panOffset.add(Ht)}_panUp(e,t){this.screenSpacePanning===!0?Ht.setFromMatrixColumn(t,1):(Ht.setFromMatrixColumn(t,0),Ht.crossVectors(this.object.up,Ht)),Ht.multiplyScalar(e),this._panOffset.add(Ht)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let s=this.object.position;Ht.copy(s).sub(this.target);let r=Ht.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/i.clientHeight,this.object.matrix),this._panUp(2*t*r/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),s=e-i.left,r=t-i.top,a=i.width,o=i.height;this._mouse.x=s/a*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientY),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(xn*this._rotateDelta.x/t.clientHeight),this._rotateUp(xn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.zoomToCursor&&(this._performCursorZoom=!0,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(i,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(i,s)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(i*i+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),s=.5*(e.pageX+i.x),r=.5*(e.pageY+i.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(xn*this._rotateDelta.x/t.clientHeight),this._rotateUp(xn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(i,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(i*i+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new Pe,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function UM(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function BM(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function zM(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(qg),this.state=st.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function HM(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case $n.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=st.DOLLY;break;case $n.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=st.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=st.ROTATE}break;case $n.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=st.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=st.PAN}break;default:this.state=st.NONE}this.state!==st.NONE&&this.dispatchEvent(qd)}function VM(n){switch(this.state){case st.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case st.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case st.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function GM(n){this.enabled===!1||this.enableZoom===!1||this.state!==st.NONE||(n.preventDefault(),this.dispatchEvent(qd),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(qg))}function WM(n){this.enabled!==!1&&this._handleKeyDown(n)}function $M(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case ti.ROTATE:if(this.enableRotate===!1){this.state=st.NONE;break}this._handleTouchStartRotate(n),this.state=st.TOUCH_ROTATE;break;case ti.PAN:if(this.enablePan===!1){this.state=st.NONE;break}this._handleTouchStartPan(n),this.state=st.TOUCH_PAN;break;default:this.state=st.NONE}break;case 2:switch(this.touches.TWO){case ti.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=st.TOUCH_DOLLY_PAN;break;case ti.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=st.TOUCH_DOLLY_ROTATE;break;default:this.state=st.NONE}break;default:this.state=st.NONE}this.state!==st.NONE&&this.dispatchEvent(qd)}function XM(n){switch(this._trackPointer(n),this.state){case st.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case st.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case st.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case st.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=st.NONE}}function qM(n){this.enabled!==!1&&n.preventDefault()}function YM(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.ownerDocument.addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function jM(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.ownerDocument.removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var Kd='"Helvetica Neue", Arial, sans-serif',Jg=13,Kg=12,Jd=(n,e)=>{let[t,i,s]=Mt(n).map(r=>Math.round(255*r));return`rgba(${t}, ${i}, ${s}, ${e})`};function Zg(n,e,t,i,s,r,a,o){let l=s/2;switch(n.beginPath(),e){case"square":n.rect(t-l,i-l,s,s);break;case"diamond":n.moveTo(t,i-l),n.lineTo(t+l,i),n.lineTo(t,i+l),n.lineTo(t-l,i),n.closePath();break;case"triangle":n.moveTo(t,i-l),n.lineTo(t+.866*l,i+.5*l),n.lineTo(t-.866*l,i+.5*l),n.closePath();break;case"star":for(let c=0;c<10;c++){let h=-Math.PI/2+c*Math.PI/5,u=c%2===0?l:.4*l;c===0?n.moveTo(t+u*Math.cos(h),i+u*Math.sin(h)):n.lineTo(t+u*Math.cos(h),i+u*Math.sin(h))}n.closePath();break;case"cross":case"plus":{e==="cross"?(n.moveTo(t-l,i-l),n.lineTo(t+l,i+l),n.moveTo(t-l,i+l),n.lineTo(t+l,i-l)):(n.moveTo(t-l,i),n.lineTo(t+l,i),n.moveTo(t,i-l),n.lineTo(t,i+l)),n.lineWidth=Math.max(1,o||s/6),n.strokeStyle=r??"#ffffff",n.lineCap="butt",n.stroke();return}default:n.arc(t,i,l,0,2*Math.PI)}if(e==="ring"){n.lineWidth=Math.max(1,o||s/6),n.strokeStyle=r??"#ffffff",n.stroke();return}r!==null&&(n.fillStyle=r,n.fill()),a!==null&&o>0&&(n.lineWidth=o,n.strokeStyle=a,n.lineJoin="miter",n.stroke())}function Zd(n,e){let t=n.shape??"disc",i=typeof n.edge_width=="number"?n.edge_width:n.edge!==void 0?1:0;return t==="ring"||t==="cross"||t==="plus"?Math.max(1,i||e/6):n.edge!==void 0?i:0}function Qg(n,e,t=4){let i=Zd(n,e),s=e+i,r=Math.max(8,Math.min(512,Math.ceil(s*t))),a=document.createElement("canvas");a.width=a.height=r;let o=a.getContext("2d"),l=r/s;return o.scale(l,l),Zg(o,n.shape??"disc",s/2,s/2,e,n.color??"#ffffff",n.edge??null,i),a}var Gr=.984,ch=.227,Wr=Gr-ch,JM=1.15,KM=2/14;function e0(n=1.2){return JM+Wr*(n-1.2)}var t0=.7,n0=.18,ZM=.42;function i0(n){let e=typeof n=="string"?[{text:n}]:n,t=[[]];for(let i of e)i.text.split(`
`).forEach((s,r)=>{r>0&&t.push([]),s!==""&&t[t.length-1].push({text:s,...i.shift?{shift:i.shift}:{}})});return t}var Qd=(n,e)=>`${n.weight==="bold"?"bold ":""}${e?.shift?t0*n.size:n.size}px ${n.font}`;function s0(n,e,t){let i=0;for(let s of e)n.font=Qd(t,s),i+=n.measureText(s.text).width;return i}var lh=n=>typeof n=="string"?n:n.map(e=>e.text).join("");function ef(n,e,t,i,s){let r=i0(e),a=Math.max(0,...r.map(u=>s0(n,u,s)));n.font=Qd(s);let o=(Gr+e0(s.linespacing)*(r.length-1))*s.size,l=s.align==="center"?t-a/2:s.align==="end"?t-a:t,c=s.baseline,h=c==="middle"?i-o/2:c==="bottom"?i-o:c==="alphabetic"?i-o+ch*s.size:i;return[l,h,a,o]}function ro(n,e,t,i,s){if(s.opacity<=0||lh(e)==="")return;let[r,a,o,l]=ef(n,e,t,i,s);n.save(),n.globalAlpha*=s.opacity;let c=s.box;if(c!==void 0){let h=c.pad??4,u=c.radius??0;n.beginPath(),QM(n,r-h,a-h,o+2*h,l+2*h,u),c.fill!==void 0&&(n.fillStyle=Jd(c.fill,c.opacity??1),n.fill()),c.edge!==void 0&&(c.edge_width??1)>0&&(n.lineWidth=c.edge_width??1,n.strokeStyle=Jd(c.edge,c.opacity??1),n.stroke())}n.fillStyle=s.color,n.textBaseline="alphabetic",n.textAlign="left",i0(e).forEach((h,u)=>{let f=s0(n,h,s),d=s.align==="center"?r+(o-f)/2:s.align==="end"?r+o-f:r,p=a+(Wr+e0(s.linespacing)*u)*s.size;for(let y of h){n.font=Qd(s,y);let m=y.shift==="sub"?n0*s.size:y.shift==="sup"?-ZM*s.size:0;n.fillText(y.text,d,p+m),d+=n.measureText(y.text).width}}),n.restore()}function QM(n,e,t,i,s,r){let a=Math.max(0,Math.min(r,i/2,s/2));n.moveTo(e+a,t),n.lineTo(e+i-a,t),n.arcTo(e+i,t,e+i,t+a,a),n.lineTo(e+i,t+s-a),n.arcTo(e+i,t+s,e+i-a,t+s,a),n.lineTo(e+a,t+s),n.arcTo(e,t+s,e,t+s-a,a),n.lineTo(e,t+a),n.arcTo(e,t,e+a,t,a),n.closePath()}function r0(n,e,t){let i=n.box===void 0?void 0:{...n.box,...n.box.fill?{fill:$t(n.box.fill,e)}:{},...n.box.edge?{edge:$t(n.box.edge,e)}:{}};return{size:n.size??Jg,color:n.color!==void 0?$t(n.color,e):e.foreground,weight:n.weight??"normal",font:e.font??Kd,align:n.align??"start",baseline:n.baseline??"middle",opacity:rn(n.opacity,t),box:i,...n.linespacing===void 0?{}:{linespacing:n.linespacing}}}function eE(n,e,t,i,s,r,a){let o=r0(e,r,a);if(o.opacity<=0||lh(t)==="")return;let[l,c]=e.offset??[0,0],h=i+l,u=s+c;if(e.leader!==void 0&&e.leader!==!1&&(l!==0||c!==0)){let[f,d,p,y]=ef(n,t,h,u,o),m=e.box!==void 0?e.box.pad??4:0,g=f+p/2,b=d+y/2,_=i-g,v=s-b,w=p/2+m,E=y/2+m,x=Math.min(Math.abs(_)>1e-9?w/Math.abs(_):1/0,Math.abs(v)>1e-9?E/Math.abs(v):1/0),A=KM*o.size;if(x<1){let I=g+x*_,R=b+x*v,D=Math.hypot(i-I,s-R);if(D>2*A){let H=(i-I)/D,X=(s-R)/D,L=e.leader===!0?{}:e.leader;n.save(),n.globalAlpha*=o.opacity,n.strokeStyle=L.color!==void 0?$t(L.color,r):o.color,n.lineWidth=L.width??1,n.beginPath(),n.moveTo(I+A*H,R+A*X),n.lineTo(i-A*H,s-A*X),n.stroke(),n.restore()}}}ro(n,t,h,u,o)}var tE=[1,2,2.5,5,10];function Yg(n,e,t){let i=e-n;if(!(i>0)||!Number.isFinite(i))return{values:[],step:1};let s=i/Math.max(1,t),r=Math.pow(10,Math.floor(Math.log10(s))),a=[10,1,.1,.01].flatMap(f=>tE.map(d=>d*r*f)),o=a.filter(f=>f>=s*(1-1e-9)).sort((f,d)=>f-d),l=a.filter(f=>f<s*(1-1e-9)).sort((f,d)=>d-f),c=[...o,...l],h=[],u=c[0];for(let f of c){u=f,h=[];for(let d=Math.ceil(n/f-1e-9);d<=Math.floor(e/f+1e-9)&&h.length<200;d++)h.push(d*f+0);if(h.length>=2)break}return{values:h,step:u}}function jg(n,e){let t=0;for(;t<10&&Math.abs(Math.round(e*10**t)-e*10**t)>1e-9*10**t;)t++;return(Math.abs(n)<e*1e-9?0:n).toFixed(t).replace("-","\u2212")}function nE(n,e,t){if(e.opacity<=0||e.rect.w<2||e.rect.h<2)return;let{x:i,y:s,w:r,h:a}=e.rect,o=t.font??Kd,l=t.foreground,c=3.5/14*e.size,h=3.5/14*e.size,u=4/14*e.size,f=.8/14*e.size;n.save(),n.globalAlpha*=e.opacity,n.strokeStyle=l,n.fillStyle=l,n.lineWidth=f,n.strokeRect(i,s,r,a),n.font=`${e.size}px ${o}`;let d=v=>i+(v-e.x0)/(e.x1-e.x0)*r,p=v=>s+a-(v-e.y0)/(e.y1-e.y0)*a,y=Yg(e.x0,e.x1,Math.max(1,Math.floor(r/(3*e.size)))),m=Yg(e.y0,e.y1,Math.max(1,Math.floor(a/(2*e.size))));n.beginPath();for(let v of y.values)n.moveTo(d(v),s+a),n.lineTo(d(v),s+a+c);for(let v of m.values)n.moveTo(i,p(v)),n.lineTo(i-c,p(v));n.stroke();let g=0;if(n.textBaseline="alphabetic",e.ticks.x){n.textAlign="center";for(let v of y.values)n.fillText(jg(v,y.step),d(v),s+a+c+h+Wr*e.size)}if(e.ticks.y){n.textAlign="right";for(let v of m.values){let w=jg(v,m.step);g=Math.max(g,n.measureText(w).width),n.fillText(w,i-c-h,p(v)+Wr/2*e.size)}}let b=16/14*e.size,_={size:b,color:l,weight:"normal",font:o,align:"center",baseline:"alphabetic",opacity:1};lh(e.titles[0])!==""&&ro(n,e.titles[0],i+r/2,s+a+c+h+(e.ticks.x?Gr*e.size:0)+u+Wr*b,_),lh(e.titles[1])!==""&&(n.save(),n.translate(i-c-h-(e.ticks.y?g:0)-u,s+a/2),n.rotate(-Math.PI/2),ro(n,e.titles[1],0,-ch*b,_),n.restore()),n.restore()}function iE(n,e,t,i,s,r){let a=rn(e.opacity,r);if(a<=0||e.entries.length===0)return;let o=e.size??Jg,l=s.font??Kd;n.save(),n.globalAlpha*=a,n.font=`${o}px ${l}`;let c=(e.handle_length??2)*o,h=(e.handle_pad??.8)*o,u=(e.column_spacing??2)*o,f=Math.max(1,Math.min(e.columns??e.entries.length,e.entries.length)),d=Math.ceil(e.entries.length/f),p=V=>c,y=e.entries.map((V,G)=>({e:V,col:Math.floor(G/d),row:G%d})),m=Array.from({length:f},()=>0),g={size:o,color:$t(e.color??s.foreground,s),weight:"normal",font:l,align:"start",baseline:"middle",opacity:1};for(let V of y)m[V.col]=Math.max(m[V.col],p(V.e)+h+ef(n,jd(V.e.label),0,0,g)[2]);let b=m.reduce((V,G)=>V+G,0)+u*(f-1),_=(Gr+.5)*o,v=.4*o,w=.5*o,E=V=>jd(V.label).some(G=>G.shift==="sub")?(n0+(t0-1)*ch)*o:0,x=y.map(({col:V,row:G})=>{let W=0;for(let te=0;te<G;te++)W+=_+E(e.entries[V*d+te]);return W}),A=Math.max(...y.map((V,G)=>x[G]+_+E(V.e)))-.5*o,I=e.at[0]*t,R=e.at[1]*i,D=e.align??"center",H=D==="center"?I-b/2:D==="end"?I-w-v-b:I+w+v,X=e.baseline??"top",L=X==="middle"?R-A/2:X==="bottom"?R-w-v-A:R+w+v;for(let[V,{e:G,col:W}]of y.entries()){let te=H+m.slice(0,W).reduce((be,De)=>be+De,0)+u*W,q=L+x[V]+Gr/2*o,ee=q+(Wr-Gr/2-.35)*o,ne=p(G);if(G.colors!==void 0){let be=G.colors.length,De=ne/be;G.colors.forEach((J,me)=>{n.strokeStyle=$t(J,s),n.lineWidth=G.line?.width??2,n.globalAlpha=a*(G.line?.opacity??1),n.lineCap="butt",n.beginPath(),n.moveTo(te+me*De,ee),n.lineTo(te+(me+1)*De,ee),n.stroke()}),n.globalAlpha=a}else G.line!==void 0&&(n.save(),n.globalAlpha=a*(G.line.opacity??1),n.strokeStyle=$t(G.line.color??s.foreground,s),n.lineWidth=G.line.width??2,n.lineCap=G.line.dash===void 0?"square":"butt",G.line.dash!==void 0&&n.setLineDash(G.line.dash),n.beginPath(),n.moveTo(te,ee),n.lineTo(te+ne,ee),n.stroke(),n.restore());if(G.marker!==void 0){let be=sa(G.marker,s);n.save(),n.globalAlpha=a*rn(be.opacity,r),Zg(n,be.shape??"disc",te+ne/2,ee,ta(be.size,r,.6*o),be.color??s.foreground,be.edge??null,typeof be.edge_width=="number"?be.edge_width:be.edge?1:0),n.restore()}ro(n,jd(G.label),te+ne+h,q,g)}n.restore()}function sE(n,e,t,i){t>=1||(n.save(),n.fillStyle=Jd(i.background,1-Math.max(0,t)),n.fillRect(e.x,e.y,e.w,e.h),n.restore())}function a0(n,e,t,i,s,r,a,o,l){let c=r*Rt(t.clock),h=null,u=f=>f.kind==="panel"?f.id:u(f.a);h=u(i.layout);for(let f of Object.keys(i.panels)){let d=e.paintInfo(f);if(d===null||d.outer.w<1||d.outer.h<1)continue;let p=rn(d.opacity,c);if(sE(n,d.outer,p,s),!(p<=0)){if(n.save(),n.globalAlpha=p,d.box!==null){let y=d.boxTitles,m=y===void 0?d.box.titles:[0,1].map(g=>{let b=y[g];if(b===void 0)return d.box.titles[g];let _=typeof b=="string"?[b]:b;return Yd(_,l(f,_))});nE(n,{...d.box,titles:m,opacity:rn(d.box.opacity,c)},s)}for(let y of d.labels){let m=d.rect;if(y.clip&&!(y.x>=m.x-.5&&y.x<=m.x+m.w+.5&&y.y>=m.y-.5&&y.y<=m.y+m.h+.5))continue;let g=typeof y.layer.text=="string"?[y.layer.text]:y.layer.text;eE(n,y.layer,Yd(g,l(f,g)),y.x,y.y,s,c)}n.restore()}}for(let f of t.overlays??[])if(f.kind==="legend")iE(n,f,a,o,s,c);else if(f.kind==="text"){let d=typeof f.text=="string"?[f.text]:f.text;ro(n,h===null?"":Yd(d,l(h,d)),f.at[0]*a,f.at[1]*o,r0(f,s,c))}}function Yd(n,e){return e.map((t,i)=>{let s=n[i];return typeof s=="object"&&s!==null&&"sub"in s?{text:t,shift:"sub"}:typeof s=="object"&&s!==null&&"sup"in s?{text:t,shift:"sup"}:{text:t}})}function jd(n){return typeof n=="string"?[{text:n}]:n.map(e=>typeof e=="string"?{text:e}:e.sub!==void 0?{text:e.sub,shift:"sub"}:{text:e.sup??"",shift:"sup"})}function rE(n,e){let[t,i,s,r]=n,a=[(t[0]+s[0])/2,(t[1]+s[1])/2],o=[(i[0]-t[0])/2,(i[1]-t[1])/2],l=[(r[0]-t[0])/2,(r[1]-t[1])/2];for(let c of[0,1]){let h=2*(Math.abs(o[c])+Math.abs(l[c]));h>=e||(h>0?(o[c]*=e/h,l[c]*=e/h):(Math.hypot(...o)<Math.hypot(...l)?o:l)[c]=e/2)}return[[a[0]-o[0]-l[0],a[1]-o[1]-l[1]],[a[0]+o[0]-l[0],a[1]+o[1]-l[1]],[a[0]+o[0]+l[0],a[1]+o[1]+l[1]],[a[0]-o[0]+l[0],a[1]-o[1]+l[1]]]}function aE(n,e,t,i,s,r){let a=0,o=1,l=e[0]-n[0],c=e[1]-n[1];for(let[h,u]of[[-l,n[0]-t],[l,i-n[0]],[-c,n[1]-s],[c,r-n[1]]])if(h===0){if(u<0)return null}else{let f=u/h;h<0?a=Math.max(a,f):o=Math.min(o,f)}return a<=o?[a,o]:null}function oE(n,e,t,i){let s=n.length,r=[],a=0,o=[];for(let d=0;d<s;d++){let p=n[d],y=n[(d+1)%s],m=Math.hypot(y[0]-p[0],y[1]-p[1]);r.push(a);let g=aE(p,y,-16,e+16,-16,t+16);if(g!==null&&m>0){let b=o[o.length-1],_=a+g[0]*m;b!==void 0&&_-b[1]<1e-9*Math.max(1,_)?b[1]=a+g[1]*m:o.push([_,a+g[1]*m])}a+=m}let l=a;if(!(l>0)||!Number.isFinite(l))return{closed:!1,paths:[]};if(o.length===1&&o[0][0]===0&&o[0][1]>=l*(1-1e-12)&&i===void 0)return{closed:!0,paths:[n.map(d=>[d[0],d[1]])]};let h=d=>{let p=s-1;for(;p>0&&r[p]>d;)p--;let y=n[p],m=n[(p+1)%s],g=(p+1<s?r[p+1]:l)-r[p],b=g>0?(d-r[p])/g:0;return[y[0]+b*(m[0]-y[0]),y[1]+b*(m[1]-y[1])]},u=(d,p)=>{let y=[h(d)];for(let m=1;m<s;m++)r[m]>d&&r[m]<p&&y.push(n[m]);return y.push(h(p)),y},f=[];for(let[d,p]of o){if(i===void 0){f.push(u(d,p));continue}let y=i[0]+i[1];for(let m=Math.floor(d/y);m*y<p;m++){let g=Math.max(d,m*y),b=Math.min(p,m*y+i[0]);b>g&&f.push(u(g,b))}}return{closed:!1,paths:f}}function lE(n,e,t,i=[]){let s=n.filter((h,u)=>u===0||Math.hypot(h[0]-n[u-1][0],h[1]-n[u-1][1])>1e-9);e&&s.length>1&&Math.hypot(s[0][0]-s[s.length-1][0],s[0][1]-s[s.length-1][1])<=1e-9&&s.pop();let r=s.length;if(r<2)return i;let a=t/2,o=(h,u)=>{let f=Math.hypot(u[0]-h[0],u[1]-h[1]);return[-(u[1]-h[1])/f,(u[0]-h[0])/f]},l=[];for(let h=0;h<r;h++){let u=e||h>0?o(s[(h-1+r)%r],s[h]):null,f=e||h<r-1?o(s[h],s[(h+1)%r]):null;if(u===null||f===null){let g=u??f;l.push([g[0]*a,g[1]*a]);continue}let d=[u[0]+f[0],u[1]+f[1]],p=Math.hypot(d[0],d[1]),y=p>1e-9?[d[0]/p,d[1]/p]:f,m=a/Math.max(1/4,y[0]*f[0]+y[1]*f[1]);l.push([y[0]*m,y[1]*m])}let c=e?r:r-1;for(let h=0;h<c;h++){let u=(h+1)%r,[f,d,p,y]=[s[h],s[u],l[h],l[u]],m=[f[0]+p[0],f[1]+p[1]],g=[f[0]-p[0],f[1]-p[1]],b=[d[0]+y[0],d[1]+y[1]],_=[d[0]-y[0],d[1]-y[1]];i.push(...m,...g,...b,...g,..._,...b)}return i}function o0(n,e,t,i){let{closed:s,paths:r}=oE(rE(n,i.minSize),e,t,i.dash),a=[];for(let o of r)lE(o,s,i.width,a);return a}function l0(n){let e=new Map;for(let t of n){let i=JSON.stringify([t.label,t.gradient,t.lo,t.hi]),s=e.get(i);s===void 0?e.set(i,t):e.set(i,{...s,marker:s.marker??t.marker,band:s.band??t.band})}return[...e.values()]}function uh(n,e,t){let i={panels:new Map,gutters:[]},s=(r,a,o)=>{if(r.kind==="panel"){i.panels.set(r.id,a);return}let l=r.dir==="row",c=r.ratio<=0||r.ratio>=1?0:t,h=Math.max(0,(l?a.w:a.h)-c),u=Math.round(h*Math.min(1,Math.max(0,r.ratio))),f=h-u;l?(s(r.a,{x:a.x,y:a.y,w:u,h:a.h},`${o}a`),c>0&&i.gutters.push({path:o,dir:r.dir,rect:{x:a.x+u,y:a.y,w:c,h:a.h},outer:a}),s(r.b,{x:a.x+u+c,y:a.y,w:f,h:a.h},`${o}b`)):(s(r.a,{x:a.x,y:a.y,w:a.w,h:u},`${o}a`),c>0&&i.gutters.push({path:o,dir:r.dir,rect:{x:a.x,y:a.y+u,w:a.w,h:c},outer:a}),s(r.b,{x:a.x,y:a.y+u+c,w:a.w,h:f},`${o}b`))};return s(n,e,""),i}function hh(n,e,t){return n.kind==="panel"?n:e===""?{...n,ratio:t}:e[0]==="a"?{...n,a:hh(n.a,e.slice(1),t)}:{...n,b:hh(n.b,e.slice(1),t)}}function c0(n,e,t,i){let s=n.outer,r=n.dir==="row"?e-s.x-i/2:t-s.y-i/2,a=Math.max(1,(n.dir==="row"?s.w:s.h)-i);return Math.min(.9,Math.max(.1,r/a))}var yh=6,h0=9,cE=10,hE=.8,uE=8,dE=8,fE=.25,pE=.35,bh="vec4(2.0, 2.0, 2.0, 1.0)",S0=`
attribute vec2 useg;
attribute float track;
uniform highp sampler2D uRanges;
uniform highp sampler2D uAlphas;
uniform int uRangesWidth;
uniform int uKernel;
uniform float uLap;
uniform float uSkip;
uniform float uOpacity;
uniform float uFraction;
uniform float uTaperOpacity;
uniform float uFade;
ivec2 texelOf(float tr) {
  int t = int(tr + 0.5);
  return ivec2(t % uRangesWidth, t / uRangesWidth);
}
bool revealed(vec4 r) {
  bool lo = uLap > r.x || (uLap == r.x && r.y < useg.x);
  bool hi = uLap < r.z || (uLap == r.z && useg.y < r.w);
  return lo && hi && !(uSkip >= 0.0 && abs(track - uSkip) < 0.5);
}
float along(vec4 r, float u) {
  if (uFraction <= 0.0) return 1.0;
  return clamp(1.0 - (r.z + r.w - (uLap + u)) / uFraction, 0.0, 1.0);
}
float alphaOf(float tr) {
  return uKernel == 1 ? texelFetch(uAlphas, texelOf(tr), 0).x : uOpacity;
}
`,w0=`
uniform vec2 uResolution;
void trimSegment(const in vec4 start, inout vec4 end) {
  float nearEstimate = -0.5 * projectionMatrix[3][2] / projectionMatrix[2][2];
  float alpha = (nearEstimate - start.z) / (end.z - start.z);
  end.xyz = mix(start.xyz, end.xyz, alpha);
}
vec4 corner(vec3 a, vec3 b, float w) {
  vec4 va = modelViewMatrix * vec4(a, 1.0);
  vec4 vb = modelViewMatrix * vec4(b, 1.0);
  if (projectionMatrix[2][3] == -1.0) {
    if (va.z >= 0.0 && vb.z >= 0.0) return ${bh};
    if (va.z < 0.0 && vb.z >= 0.0) trimSegment(va, vb);
    else if (vb.z < 0.0 && va.z >= 0.0) trimSegment(vb, va);
  }
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uResolution;
  float len = length(d);
  vec2 dir = len > 1e-9 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = position.y > 0.5 ? cb : ca;
  c.xy += nrm * position.x * w / uResolution * c.w;
  return c;
}
`,mE=S0+`
#ifdef USE_TRACK_COLOR
attribute vec3 tcolor;
#endif
#ifdef DASH
attribute float dist;
uniform highp sampler2D uDashFrom;
uniform int uDashWidth;
uniform float uSegBase;
float restartAt(float j) {
  int i = int(j + uSegBase + 0.5);
  return texelFetch(uDashFrom, ivec2(i % uDashWidth, i / uDashWidth), 0).x;
}
varying float vDist;
#endif
uniform vec3 uColor;
varying vec4 vColor;
void main() {
  vec4 r = texelFetch(uRanges, texelOf(track), 0);
  if (!revealed(r)) {
    vColor = vec4(0.0);
    gl_Position = ${bh};
    return;
  }
  float s = along(r, gl_VertexID % 2 == 1 ? useg.y : useg.x);
#ifdef USE_TRACK_COLOR
  vec3 rgb = tcolor;
#else
  vec3 rgb = uColor;
#endif
#ifdef DASH
  // the pattern starts again where the track last entered the stage
  vDist = dist - restartAt(float(gl_VertexID / 2));
#endif
  vColor = vec4(rgb, uFade * alphaOf(track) * mix(uTaperOpacity, 1.0, s));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,gE=S0+w0+`
attribute vec3 instanceStart;
attribute vec3 instanceEnd;
#ifdef USE_TRACK_COLOR
attribute vec3 colorStart;
attribute vec3 colorEnd;
#endif
#ifdef DASH
attribute float distStart;
attribute float distEnd;
uniform highp sampler2D uDashFrom;
uniform int uDashWidth;
uniform float uSegBase;
float restartAt(float j) {
  int i = int(j + uSegBase + 0.5);
  return texelFetch(uDashFrom, ivec2(i % uDashWidth, i / uDashWidth), 0).x;
}
varying float vDist;
#endif
uniform vec3 uColor;
uniform float uWidth;
uniform float uTaperWidth;
varying vec4 vColor;
void main() {
  vec4 r = texelFetch(uRanges, texelOf(track), 0);
  if (!revealed(r)) {
    vColor = vec4(0.0);
    gl_Position = ${bh};
    return;
  }
  bool atEnd = position.y > 0.5;
  float s = along(r, atEnd ? useg.y : useg.x);
#ifdef USE_TRACK_COLOR
  vec3 rgb = atEnd ? colorEnd : colorStart;
#else
  vec3 rgb = uColor;
#endif
#ifdef DASH
  vDist = (atEnd ? distEnd : distStart) - restartAt(float(gl_InstanceID));
#endif
  vColor = vec4(rgb, uFade * alphaOf(track) * mix(uTaperOpacity, 1.0, s));
  gl_Position = corner(instanceStart, instanceEnd, uWidth * mix(uTaperWidth, 1.0, s));
}
`,yE=w0+`
attribute vec3 instanceStart;
attribute vec3 instanceEnd;
attribute vec4 colorStart;
attribute vec4 colorEnd;
attribute float widthStart;
attribute float widthEnd;
#ifdef DASH
attribute float distStart;
attribute float distEnd;
varying float vDist;
#endif
varying vec4 vColor;
void main() {
  bool atEnd = position.y > 0.5;
  vColor = atEnd ? colorEnd : colorStart;
#ifdef DASH
  vDist = atEnd ? distEnd : distStart;
#endif
  gl_Position = corner(instanceStart, instanceEnd, atEnd ? widthEnd : widthStart);
}
`,u0=`
uniform vec2 uResolution;
uniform vec4 uColor;
uniform float uWidth;
uniform float uHead;
uniform float uHeadWidth;
attribute vec3 instanceBase;
attribute vec3 instanceTip;
varying vec4 vColor;
void main() {
  vColor = uColor;
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(instanceBase, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(instanceTip, 1.0);
  vec2 half_ = 0.5 * uResolution;
  vec2 a = ca.xy / ca.w * half_;
  vec2 b = cb.xy / cb.w * half_;
  float len = length(b - a);
  if (ca.w <= 0.0 || cb.w <= 0.0 || len < 1e-3) {
    gl_Position = ${bh};
    return;
  }
  vec2 dir = (b - a) / len;
  vec2 nrm = vec2(-dir.y, dir.x);
  float head = min(uHead, len);
  vec2 neck = b - dir * head;
#ifdef HEAD
  vec2 p = position.y > 0.5 ? b : neck + nrm * position.x * 0.5 * uHeadWidth * head;
#else
  // the shaft runs half a pixel into the head, so that the two do not leave a seam
  vec2 p = (position.y > 0.5 ? neck + dir * min(0.5, head) : a) + nrm * position.x * 0.5 * uWidth;
#endif
  gl_Position = vec4(p / half_, 0.0, 1.0);
}
`,bE=`
uniform vec4 uColor;
varying vec4 vColor;
void main() {
  vColor = uColor;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,vE=`
varying vec4 vColor;
#ifdef DASH
varying float vDist;
uniform float uPixels;
uniform vec2 uDash;
#endif
void main() {
#ifdef DASH
  // a dash of uDash.x and a gap of uDash.y pixels along the screen, from the arclength in the display frame
  if (mod(vDist * uPixels, uDash.x + uDash.y) > uDash.x) discard;
#endif
  gl_FragColor = vColor;
}
`;function xE(){let n=document.createElement("canvas");n.width=n.height=64;let e=n.getContext("2d");e.fillStyle="#fff",e.beginPath(),e.arc(32,32,28,0,Math.PI*2),e.fill();let t=new Ir(n);return t.needsUpdate=!0,t}function dh(n,e=6){if(!(n>0)||!Number.isFinite(n))return 1;let t=n/e,i=Math.pow(10,Math.floor(Math.log10(t))),s=t/i;return(s<1.5?1:s<3.5?2:s<7.5?5:10)*i}function Fi(n){let e=(o,l,c)=>new O(o,l,c);if(n.kind==="plane")return n.plane==="xz"?{right:e(1,0,0),up:e(0,0,1),normal:e(0,-1,0)}:n.plane==="yz"?{right:e(0,1,0),up:e(0,0,1),normal:e(1,0,0)}:{right:e(1,0,0),up:e(0,1,0),normal:e(0,0,1)};let[t,i,s]=n.up==="x"?[e(0,1,0),e(0,0,1),e(1,0,0)]:n.up==="y"?[e(0,0,1),e(1,0,0),e(0,1,0)]:[e(1,0,0),e(0,1,0),e(0,0,1)],r=t.clone().addScaledVector(i,-1.6).addScaledVector(s,.9).normalize();return{right:new O().crossVectors(s,r).normalize(),up:s,normal:r}}function $r(n){return n.kind==="orbit"&&n.stretch!==void 0?new O(...n.stretch):new O(1,1,1)}function hf(){let n=new Dr;return n.setAttribute("position",new Ut([-1,0,0,1,0,0,-1,1,0,1,1,0],3)),n.setIndex([0,1,2,2,1,3]),n}var ho=(n,e,t={})=>new Rn({vertexShader:n,fragmentShader:vE,uniforms:e,defines:t,transparent:!0,depthTest:!1,depthWrite:!1,side:In}),d0=n=>Math.min(1,Math.max(0,n));function f0(n,e){n.stencilWrite=!0,n.stencilRef=e,n.stencilFunc=Sd,n.stencilFail=Ns,n.stencilZFail=Ns,n.stencilZPass=_d}var rf=class{cache=new Map;get(e,t){let i=this.cache.get(e);return i===void 0&&(i=t(),this.cache.set(e,i)),i}};function _E(n,e){if(e===void 0||typeof e=="string"||ra(e)||typeof e.colormap=="string")return e;let t=e.colormap;at(n.scene,t.var)?.kind!=="choice"&&T("2.7",`the colormap is keyed on ${t.var}, which is not a choice`);let i=Gi(n,t.var),s=typeof i=="string"&&Object.hasOwn(t.map,i)?t.map[i]:void 0;return s===void 0&&T("2.7",`the colormap keyed on ${t.var} does not name a colormap for ${JSON.stringify(i)}`),{...e,colormap:s}}function SE(n,e,t,i){let s=t.panels[i],r=n.views[s.view],a={scene:n,state:t,panel:s},o=vs(a,r),l=Pt(n.clock),c=Et(a,r.driver.sets),h=c===null?null:{set:e.sets.get(c),track:0};h&&(h.track=er(a,r.driver.member,h.set),l>1&&!h.set.periodic&&T("C6",`the driver's track set ${h.set.id} is not periodic, and the clock has ${l} laps`));let u=[];return r.layers.forEach((f,d)=>{if(tr(a,f))if(f.kind==="track"){let p=Et(a,f.sets),y=p===null?null:e.sets.get(p),m=y===null?[]:Qs(a,f.members,y),g=f.clock===void 0?n.clock:na(n.clock,f.clock),b=wp(f,g)?f.clock===void 0?t.clock.channel:g.channels[0]:null,_=f.context??"own";_!=="own"&&_!=="driver"&&T("L6",`a track layer's context is ${JSON.stringify(_)}, not own or driver`),y!==null&&b!==null&&f.clock===void 0&&l>1&&!y.periodic&&T("C6",`a reading is taken on track set ${y.id}, which is not periodic, and the clock has ${l} laps`);let v=f.highlight;if(v?.kernel!==void 0){let x=at(n,v.var);(x?.kind!=="selector"||(x.by??"nearest")!=="nearest"||x.parameter===void 0)&&T("2.7",`a highlight kernel needs a selector by nearest, and ${v.var} is not one`)}let w=y!==null&&v!==void 0?To(a,{var:v.var},y):null,E=w!==null&&m.includes(w)?w:null;u.push({kind:"track",index:d,layer:f,set:y,members:m,highlight:E,selected:w,channel:b,color:_E(a,f.color),context:_,clock:g})}else if(f.kind==="arrow"){let p=Et(a,f.sets),y=f.clock===void 0?n.clock:na(n.clock,f.clock),m=f.clock===void 0?t.clock.channel:y.channels[0];u.push({kind:"arrow",index:d,layer:f,set:p===null?null:e.sets.get(p),channel:m,clock:y})}else if(f.kind==="outline")u.push({kind:"outline",index:d,layer:f});else if(f.kind==="body")u.push({kind:"body",index:d,layer:f});else if(f.kind==="points"){let p=Et(a,f.sets);u.push({kind:"points",index:d,layer:f,set:p===null?null:e.sets.get(p)})}else if(f.kind==="label"){let p=f.at,y=p!==null&&typeof p=="object"&&"sets"in p?Et(a,p.sets):null;u.push({kind:"label",index:d,layer:f,set:y===null?null:e.sets.get(y)})}else u.push({kind:f.kind,index:d,layer:f})}),{viewId:s.view,view:r,display:o,scope:a,driver:h,layers:u}}function wE(n){return[n.viewId,n.display,n.driver?.set.id??"",...n.layers.map(e=>e.kind==="track"||e.kind==="points"?e.set?.id??"":"")].join("\0")}function af(n,e,t,i){let s=n.transform([0,0,0],e,t,i),r=new Float64Array(12);for(let a=0;a<3;a++){let o=n.transform([a===0?1:0,a===1?1:0,a===2?1:0],e,t,i);for(let l=0;l<3;l++)r[3*l+a]=o[l]-s[l]}return r.set(s,9),r}function ME(n,e,t,i=new ft,s){let{a:r,b:a,w:o}=nr(t,_s(n,t,s).at),l=af(n.frames,e,n.display,r),c=af(n.frames,e,n.display,a),h=l.map((u,f)=>(1-o)*u+o*c[f]);return i.set(h[0],h[1],h[2],h[9],h[3],h[4],h[5],h[10],h[6],h[7],h[8],h[11],0,0,0,1)}var EE=4e6;function TE(n,e,t,i,s){let r=i.frames,a=n.set.def.frame,o=i.geometry(n.set.id,a),l=e.set.periodic?Pt(i.scene.clock):1,c=r.requirements(a,t).channels.size>0,h=c?e.set.count(e.track):1,u=n.members.length===n.set.tracks?o.positions:Float64Array.from(n.members.flatMap(d=>[...o.track(d,0)]));if(u.length>24&&u.length/3*h*(c?l:1)>s){let[d,p,y,m,g,b]=o.bounds();u=Float64Array.from([d,p,y,m,p,y,d,g,y,m,g,y,d,p,b,m,p,b,d,g,b,m,g,b])}let f=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let d=0;d<(c?l:1);d++)for(let p=0;p<h;p++){let y=af(r,a,t,{set:e.set,track:e.track,sample:p,shifted:!1,lap:d});for(let m=0;m<u.length;m+=3){let g=u[m],b=u[m+1],_=u[m+2];for(let v=0;v<3;v++){let w=y[3*v]*g+y[3*v+1]*b+y[3*v+2]*_+y[9+v];w<f[v]&&(f[v]=w),w>f[v+3]&&(f[v+3]=w)}}}return f}function AE(n,e,t=EE){let i=null;for(let s of n.layers){if(s.kind!=="track"||s.set===null||s.members.length===0||s.layer.fit===!1||s.context==="driver"&&n.driver===null)continue;let r;if(s.context==="driver")r=[TE(s,n.driver,n.display,e,t)];else{let a=e.geometry(s.set.id,n.display);r=s.members.length===s.set.tracks?[a.bounds()]:s.members.map(o=>a.bounds(o))}for(let a of r)if(i===null)i=[...a];else for(let o=0;o<3;o++)i[o]=Math.min(i[o],a[o]),i[o+3]=Math.max(i[o+3],a[o+3])}return i}var fh=n=>n.kind==="plane"&&n.aspect==="free";function CE(n,e,t){let i=n.getCenter(new O),s=n.getSize(new O),r=Math.max(s.length()/2,1e-9),{right:a,up:o}=Fi(e),l=y=>new O(Math.abs(y.x),Math.abs(y.y),Math.abs(y.z)),c=e.kind==="plane"?s.dot(l(a))/2:r,h=e.kind==="plane"?s.dot(l(o))/2:r,u=Math.max(h,c/t)*1.1,f=u>1e-12?u:Math.max(r,1);if(!fh(e))return{center:i,halfWidth:f*t,halfHeight:f};let d=y=>Math.max(Math.abs(n.min.dot(y)),Math.abs(n.max.dot(y))),p=(y,m)=>y>0&&y>1e-9*m;return{center:i,halfWidth:p(c,d(a))?c*1.1:f*t,halfHeight:p(h,d(o))?h*1.1:f}}function RE(n,e,t,i){let s=t>0?i/(e.width*t):0;return Math.max(n,e.opacity*Math.exp(-s*s))}function PE(n,e,t,i){let{right:s,up:r}=Fi(e),a=n.position.dot(s),o=n.position.dot(r),l=(n.right-n.left)/(2*n.zoom),c=(n.top-n.bottom)/(2*n.zoom);return{x0:a-l,x1:a+l,y0:o-c,y1:o+c,w:t,h:i,stepX:dh(2*l,Math.max(3,t/110)),stepY:dh(2*c,Math.max(3,i/70))}}function ph(n,e,t){let i=[],s=Math.floor(e/t);for(let r=Math.ceil(n/t);r<=s&&i.length<1e3;r++)i.push(r*t);return i}function p0(n,e){let t=Math.max(0,-Math.floor(Math.log10(e)));return(Math.abs(n)<e*1e-9?0:n).toFixed(t).replace("-","\u2212")}var M0=n=>7*n.length-3.5*(n.split(".").length-1);function m0(n){let e=n.kind==="title"?13:12,t=M0(n.text)*e/12,i=n.align==="center"?-t/2:n.align==="end"?-t:0;return n.rotate?[n.x-e/2,n.y-i-t,n.x+e/2,n.y-i]:[n.x+i,n.y-e/2,n.x+i+t,n.y+e/2]}function LE(n,e){let[t,i,s,r]=m0(n),[a,o,l,c]=m0(e);return t<l&&a<s&&i<c&&o<r}var g0=160;function IE(n,e,t){let i=[],s=a=>(a-n.x0)/(n.x1-n.x0)*n.w,r=a=>n.h-(a-n.y0)/(n.y1-n.y0)*n.h;if(e){let a=[];for(let l of ph(n.y0,n.y1,n.stepY)){let c=r(l);c>22&&c<n.h-44&&a.push({text:p0(l,n.stepY),x:0,y:c,align:"end",kind:"tick"})}let o=Math.max(44,22+Math.max(0,...a.map(l=>M0(l.text))));for(let l of ph(n.x0,n.x1,n.stepX)){let c=s(l);c>o+12&&c<n.w-16&&i.push({text:p0(l,n.stepX),x:c,y:n.h-28,align:"center",kind:"tick"})}for(let l of a)i.push({...l,x:o})}return t!==null&&(t[0]!==""&&n.h>=g0&&i.push({text:t[0],x:n.w/2,y:n.h-10,align:"center",kind:"title"}),t[1]!==""&&n.w>=g0&&i.push({text:t[1],x:10,y:n.h/2,align:"center",rotate:!0,kind:"title"})),i}var of=class{holder=new jt;mat;spec;src;wide;obj=null;sharedNames=[];shown="";constructor(e,t,i){this.src=e,this.spec=t,this.wide=t.width>1;let s={...i,uLap:{value:t.lap},uSkip:{value:-1},uSegBase:{value:0},uOpacity:{value:t.opacity},uWidth:{value:t.width},uKernel:{value:e.kernel&&!t.highlight?1:0}},r={};e.coloring.kind==="sample"&&(r.USE_TRACK_COLOR=""),e.dist!==null&&(r.DASH=""),this.mat=ho(this.wide?gE:mE,s,r)}show(e){this.mat.uniforms.uSegBase.value=typeof e=="number"?this.src.set.start(e)-e:0;let t=e===null?"":String(e);if(t===this.shown||(this.clear(),this.shown=t,e===null))return;let i=this.wide?this.quads(e):this.lines(e);this.obj=this.wide?new Jt(i,this.mat):new Pr(i,this.mat),this.obj.frustumCulled=!1,this.obj.renderOrder=this.holder.parent?.renderOrder??0,this.holder.add(this.obj)}arrays(e){let{ctx:t,set:i,geo:s,display:r,readings:a,coloring:o,colorKey:l,dist:c}=this.src,h=this.spec.lap;if(e==="set")return{pos:t.shared.get(`pos\0${i.id}\0${r}\0${s.lapKey(h)}`,()=>Cp(s,h)),u:t.shared.get(`u\0${i.id}\0${a.channel}`,()=>Lp(i,a.u)),tr:t.shared.get(`t\0${i.id}`,()=>kp(i)),col:o.kind==="sample"?t.shared.get(`c\0${i.id}\0${l}`,()=>bu(i,o.rgb,3)):null,dist:c===null?null:t.shared.get(`d\0${i.id}\0${r}\0${tf(c)}`,()=>bu(i,c,1))};let u=i.start(e),f=i.count(e);return{pos:Rp(s,e,h),u:Ip(a.u,u,f),tr:new Float32Array(2*(f-1)).fill(e),col:o.kind==="sample"?vu(o.rgb,3,u,f):null,dist:c===null?null:vu(c,1,u,f)}}lines(e){let t=this.arrays(e),i=(r,a,o)=>e==="set"?this.src.ctx.shared.get(`gl\0${r}\0${this.src.set.id}\0${tf(a)}`,()=>new Dt(a,o)):new Dt(a,o),s=new xt;return s.setAttribute("position",i("position",t.pos,3)),s.setAttribute("useg",i("useg",t.u,2)),s.setAttribute("track",i("track",t.tr,1)),t.col&&s.setAttribute("tcolor",i("tcolor",t.col,3)),t.dist&&s.setAttribute("dist",i("dist",t.dist,1)),this.sharedNames=e==="set"?Object.keys(s.attributes):[],s}quads(e){let t=this.arrays(e),i=(a,o,l)=>e==="set"?this.src.ctx.shared.get(`gpu\0${a}\0${this.src.set.id}\0${tf(o)}`,()=>new os(o,l)):new os(o,l),s=hf(),r=i("pos",t.pos,6);if(s.setAttribute("instanceStart",new Tt(r,3,0)),s.setAttribute("instanceEnd",new Tt(r,3,3)),s.setAttribute("useg",new Tt(i("u",t.u,4),2,0)),s.setAttribute("track",new Tt(i("t",t.tr,2),1,0)),t.col){let a=i("c",t.col,6);s.setAttribute("colorStart",new Tt(a,3,0)),s.setAttribute("colorEnd",new Tt(a,3,3))}if(t.dist){let a=i("d",t.dist,2);s.setAttribute("distStart",new Tt(a,1,0)),s.setAttribute("distEnd",new Tt(a,1,1))}return s.instanceCount=t.pos.length/6,this.sharedNames=e==="set"?Object.keys(s.attributes).filter(a=>a!=="position"):[],s}clear(){if(this.obj!==null){this.holder.remove(this.obj);for(let e of this.sharedNames)this.obj.geometry.deleteAttribute(e);this.obj.geometry.dispose(),this.obj=null,this.sharedNames=[]}}dispose(){this.clear(),this.mat.dispose()}},y0=new WeakMap,kE=0;function tf(n){let e=y0.get(n);return e===void 0&&(e=kE++,y0.set(n,e)),e}var ao=18,lf=class{mesh;buffer;mat;n=0;constructor(e,t,i=null){this.mat=ho(yE,{uResolution:t,...i??{}},i===null?{}:{DASH:""}),this.buffer=this.allocate(e),this.mesh=new Jt(this.geometry(),this.mat),this.mesh.frustumCulled=!1}allocate(e){let t=new os(new Float32Array(ao*Math.max(1,e)),ao);return t.setUsage(yi),t}geometry(){let e=hf(),t=this.buffer;return e.setAttribute("instanceStart",new Tt(t,3,0)),e.setAttribute("instanceEnd",new Tt(t,3,3)),e.setAttribute("colorStart",new Tt(t,4,6)),e.setAttribute("colorEnd",new Tt(t,4,10)),e.setAttribute("widthStart",new Tt(t,1,14)),e.setAttribute("widthEnd",new Tt(t,1,15)),e.setAttribute("distStart",new Tt(t,1,16)),e.setAttribute("distEnd",new Tt(t,1,17)),e.instanceCount=0,e}begin(e){return ao*e>this.buffer.array.length&&(this.mesh.geometry.dispose(),this.buffer=this.allocate(2*e),this.mesh.geometry=this.geometry()),this.n=0,this.buffer.array}end(){this.mesh.geometry.instanceCount=this.n,this.mesh.visible=this.n>0,this.buffer.clearUpdateRanges(),this.buffer.addUpdateRange(0,ao*this.n),this.buffer.needsUpdate=!0}dispose(){this.mesh.geometry.dispose(),this.mat.dispose()}};function DE(n,e,t){let i=e.highlight?.kernel;if(i===void 0)return null;let s=at(n.scene,e.highlight.var);if(s?.kind!=="selector"||s.parameter===void 0)return null;let r=t.parameter(s.parameter,"2.7"),a=1/0,o=-1/0;for(let l=0;l<r.length;l++)a=Math.min(a,r[l]),o=Math.max(o,r[l]);return{parameter:s.parameter,width:i.width,opacity:i.opacity,values:r,extent:o>=a?o-a:0}}function NE(n,e,t,i,s,r,a,o,l,c){let h=i>0?e[t]:0,u=!1;for(let f=0;f+1<i;f++){let d=n[2*(t+f)],p=n[2*(t+f)+1],y=n[2*(t+f+1)]-d,m=n[2*(t+f+1)+1]-p,g=0,b=1,_=!0;for(let[w,E]of[[-y,d-s],[y,a-d],[-m,p-r],[m,o-p]])if(w===0)E<0&&(_=!1);else{let x=E/w;w<0?g=Math.max(g,x):b=Math.min(b,x)}let v=_&&g<=b;if(v&&(g>0||!u)){let w=e[t+f];h=w+g*(e[t+f+1]-w)}l[c+f]=h,u=v&&b>=1}}function nf(n){let e=Math.min(Math.max(n,1),2048),t=Math.ceil(Math.max(n,1)/e),i=new Float32Array(4*e*t),s=new Cr(i,e,t,Nn,Dn);return s.minFilter=s.magFilter=vt,s.generateMipmaps=!1,s.needsUpdate=!0,{data:i,texture:s,width:e}}function b0(n,e,t=1,i=1){let s=new Float32Array(n.samples),r=[1,1,1];r[t]=i;for(let a=0;a<n.tracks;a++){let o=n.start(a),l=0;s[o]=0;for(let c=1;c<n.count(a);c++){let h=3*(o+c-1),u=3*(o+c);l+=Math.hypot(r[0]*(e[u]-e[h]),r[1]*(e[u+1]-e[h+1]),r[2]*(e[u+2]-e[h+2])),s[o+c]=l}}return s}var uo=class{points;material;marker;tinted;texSize=0;texEdge=-1;edgeWidth;constructor(e,t,i){this.marker=e,this.edgeWidth=typeof e.edge_width=="number"?e.edge_width:void 0,this.tinted=i,this.material=new zs({size:t,sizeAttenuation:!1,vertexColors:i,transparent:!0,alphaTest:.01,depthTest:!1,depthWrite:!1}),this.points=new Lr(new xt,this.material),this.points.frustumCulled=!1,this.grow(1),this.setSize(t)}setSize(e,t=this.edgeWidth){this.edgeWidth=t;let i={...this.marker,edge_width:t};this.material.size=e+Zd(i,e);let s=Math.max(1,e),r=t??0;if(Math.abs(s/Math.max(this.texSize,1e-9)-1)>.05||Math.abs(r-this.texEdge)>.05*Math.max(r,.5)){this.texSize=s,this.texEdge=r,this.material.map?.dispose();let a=new Ir(Qg(this.tinted?{...i,color:void 0}:i,s));a.needsUpdate=!0,this.material.map=a,this.material.needsUpdate=!0}}setOpacity(e){this.material.opacity=e}grow(e){let t=this.points.geometry.getAttribute("position");if(t!==void 0&&t.count>=e)return;this.points.geometry.dispose();let i=new xt;i.setAttribute("position",new Dt(new Float32Array(3*e),3).setUsage(yi)),i.setAttribute("color",new Dt(new Float32Array(3*e),3).setUsage(yi)),this.points.geometry=i}get position(){return this.points.geometry.getAttribute("position")}get color(){return this.points.geometry.getAttribute("color")}show(e){this.position.needsUpdate=!0,this.color.needsUpdate=!0,this.points.geometry.setDrawRange(0,e),this.points.visible=e>0}dispose(){this.points.geometry.dispose(),this.material.map?.dispose(),this.material.dispose()}};function sf(n){let e=n.head;return typeof e=="object"&&e!==null?e:{}}var us=class{key;group=new fn;src;layer;set;geo;clocks;clock;spec;color;width;hiWidth;opacity;hiOpacity;fraction;taperWidth;taperOpacity;kernel;ranges;alphas;dashFrom;dashScreen=new Float64Array(0);restartOut=[];resolution={value:new Pe(1,1)};uniforms;baseHolder=new jt;hiHolder=new jt;passes=new Map;pieces;heads=null;glow=null;headSize;headColor;fill=null;fillBuffer=new Float32Array(0);line;flatMark;tweened;members=[];highlight=null;selected=null;baseWhat=null;skip=-1;filled=!1;driverContext;geometry;constructor(e,t,i,s){this.key=s,this.geometry=e.geometry;let r=t.set,a=t.layer;this.set=r,this.layer=a,this.clock=t.clock,this.driverContext=t.context==="driver",this.driverContext&&(this.group.matrixAutoUpdate=!1),this.geo=e.geometry.geometry(r.id,this.driverContext?r.def.frame:i),this.clocks=t.channel===null?null:e.geometry.readings(r.id,t.channel);let o=this.clocks??e.geometry.readings(r.id,rt);this.spec=Mp(a,r.periodic,Pt(t.clock)),this.color=t.color;let l=np(Qf(t.color,e.theme),r,Mt(e.theme.foreground));this.kernel=DE(e,a,r),this.line=a.line!==!1,this.flatMark=a.flat===!0?t.index%255+1:0;let c=a.dash!==void 0&&this.line;this.src={ctx:e,set:r,geo:this.geo,display:this.geo.frame,readings:o,colorKey:JSON.stringify(t.color??null),coloring:l,kernel:this.kernel!==null,dist:c?e.shared.get(`dist\0${r.id}\0${this.geo.frame}`,()=>b0(r,this.geo.positions)):null},this.width=a.width??1,this.hiWidth=a.highlight?.width??this.width,this.opacity=typeof a.opacity=="number"?a.opacity:1,this.hiOpacity=a.highlight?.opacity??1,this.fraction=this.spec.reveal==="trail"?this.spec.laps*this.spec.fraction:0,this.taperWidth=a.trail?.taper?.width??fE,this.taperOpacity=a.trail?.taper?.opacity??pE;let h=sa(sf(a),e.theme);this.tweened=typeof a.opacity=="object"||typeof h.size=="object"||typeof h.opacity=="object"||typeof h.edge_width=="object",this.ranges=nf(r.tracks);for(let f=0;f<r.tracks;f++)this.ranges.data.set(ma,4*f);this.alphas=this.kernel===null?null:nf(r.tracks);let u=c?{uPixels:{value:1},uDash:{value:new Pe(a.dash[0],a.dash[1])}}:null;if(this.dashFrom=c?nf(Math.max(1,r.samples-r.tracks)):null,this.uniforms={uRanges:{value:this.ranges.texture},uAlphas:{value:(this.alphas??this.ranges).texture},uRangesWidth:{value:this.ranges.width},uColor:{value:new O(...l.kind==="constant"?l.rgb:[1,1,1])},uResolution:this.resolution,uFraction:{value:this.fraction},uTaperWidth:{value:this.taperWidth},uTaperOpacity:{value:this.fraction>0?this.taperOpacity:1},uFade:{value:1},...u??{},...this.dashFrom===null?{}:{uDashFrom:{value:this.dashFrom.texture},uDashWidth:{value:this.dashFrom.width}}},a.fill!==void 0){let f=a.fill,d=Mt(f.color!==void 0?$t(f.color,e.theme):l.kind==="constant"?`#${new Xe(...l.rgb).getHexString()}`:e.theme.foreground),p=new Ar({color:new Xe(...d),transparent:!0,opacity:f.opacity??.25,depthTest:!1,depthWrite:!1,side:In});this.fill=new Jt(new xt,p),this.fill.frustumCulled=!1,this.group.add(this.fill)}if(this.group.add(this.baseHolder,this.hiHolder),this.pieces=new lf(2*Math.min(r.tracks,64),this.resolution,u),this.flatMark>0&&f0(this.pieces.mesh.material,this.flatMark),this.group.add(this.pieces.mesh),this.headSize=typeof h.size=="number"?h.size:h0,this.headColor=h.color!==void 0?Mt(h.color):null,Wi(a)){if(h.glow!==void 0){let f=h.glow;this.glow=new uo({shape:"disc",color:f.color??"#d62728"},f.size??2.4*this.headSize,!1),this.glow.setOpacity(f.opacity??.35),this.group.add(this.glow.points)}this.heads=new uo(h,this.headSize,h.color===void 0),this.group.add(this.heads.points)}}resize(e,t){this.resolution.value.set(Math.max(1,e),Math.max(1,t))}dashRatio=1;setPixels(e,t){if(this.uniforms.uPixels===void 0||this.src.dist===null)return;this.uniforms.uPixels.value=e;let i=t/Math.max(e,1e-12);if(Math.abs(i/this.dashRatio-1)>.01){this.dashRatio=i,this.src.dist=b0(this.set,this.geo.positions,this.planeAxes[1],i);for(let s of this.passes.values())s.holder.removeFromParent(),s.dispose();this.passes.clear(),this.filled=!1}}colorAt(e,t,i,s){let r=this.src.coloring;if(r.kind==="constant"){i.set(r.rgb,s);return}let a=this.set.start(e);if("sample"in t){for(let o=0;o<3;o++)i[s+o]=r.rgb[3*(a+t.sample)+o];return}for(let o=0;o<3;o++)i[s+o]=(1-t.w)*r.rgb[3*(a+t.k)+o]+t.w*r.rgb[3*(a+t.k+1)+o]}distAt(e,t){let i=this.src.dist;if(i===null)return 0;let s=this.set.start(e),r="sample"in t?Math.min(t.sample,this.set.count(e)-2):t.k,a=this.dashFrom?.data[4*(s-e+Math.max(0,r))]??0;return"sample"in t?i[s+t.sample]-a:(1-t.w)*i[s+t.k]+t.w*i[s+t.k+1]-a}placeDash(e,t,i,s,r){let a=this.dashFrom,o=this.src.dist;if(a===null||o===null)return;e.updateMatrixWorld(),this.group.updateWorldMatrix(!0,!1);let c=new ft().multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse).multiply(this.group.matrixWorld).elements,h=this.geo.positions;this.dashScreen.length<2*this.set.samples&&(this.dashScreen=new Float64Array(2*this.set.samples));let u=this.dashScreen,f=!1;for(let d of this.members){let p=this.set.start(d),y=this.set.count(d);for(let g=p;g<p+y;g++){let b=h[3*g],_=h[3*g+1],v=h[3*g+2],w=c[3]*b+c[7]*_+c[11]*v+c[15],E=(c[0]*b+c[4]*_+c[8]*v+c[12])/w,x=(c[1]*b+c[5]*_+c[9]*v+c[13])/w;u[2*g]=t.x+(E+1)/2*t.w,u[2*g+1]=t.y+(1-x)/2*t.h}let m=p-d;NE(u,o,p,y,-r,-r,i+r,s+r,this.restartOut,0);for(let g=0;g+1<y;g++){let b=this.restartOut[g];a.data[4*(m+g)]!==b&&(a.data[4*(m+g)]=b,f=!0)}}f&&(a.texture.needsUpdate=!0)}fillKernel(){let e=this.kernel;if(e===null||this.alphas===null)return;let t=this.selected===null?null:e.values[this.selected];for(let i=0;i<this.set.tracks;i++)this.alphas.data[4*i]=t===null?this.opacity:RE(this.opacity,e,e.extent,Math.abs(e.values[i]-t));this.alphas.texture.needsUpdate=!0}showPass(e){e.show(e.spec.highlight?this.highlight:this.baseWhat),e.mat.uniforms.uSkip.value=e.spec.highlight?-1:this.skip}pass(e,t){let i=`${t?"h":"b"}${e}`,s=this.passes.get(i);return s===void 0&&(s=new of(this.src,{lap:e,highlight:t,width:t?this.hiWidth:this.width,opacity:t?this.hiOpacity:this.opacity},this.uniforms),this.flatMark>0&&!t&&f0(s.mat,this.flatMark),(t?this.hiHolder:this.baseHolder).add(s.holder),this.passes.set(i,s),this.showPass(s)),s}syncPasses(e,t){for(let i of this.passes.values())i.holder.visible=!1;if(this.line){if(this.baseWhat!==null)for(let i=e[0];i<=e[1];i++)this.pass(i,!1).holder.visible=!0;if(this.highlight!==null)for(let i=t[0];i<=t[1];i++)this.pass(i,!0).holder.visible=!0}}get isStatic(){return this.clocks===null&&!this.driverContext&&!this.tweened}place(e,t){this.group.visible=t!==null,t!==null&&(ME(e,this.set.def.frame,t,this.group.matrix,this.geometry.readings(t.set.id,e.channel).clocks[t.track]),this.group.matrixWorldNeedsUpdate=!0)}fade(e){let t=this.layer,i=typeof t.opacity=="object"?rn(t.opacity,e):1;this.uniforms.uFade.value=i;let s=sf(t);return this.heads?.setOpacity(i*rn(s.opacity,e)),this.heads!==null&&(typeof s.size=="object"||typeof s.edge_width=="object")&&this.heads.setSize(ta(s.size,e,h0),s.edge_width===void 0?void 0:ea(s.edge_width,e,0)),this.glow!==null&&this.glow.setOpacity(i*rn(s.opacity,e)*(s.glow?.opacity??.35)),this.fill!==null&&(this.fill.material.opacity=i*(t.fill?.opacity??.25)),i}update(e,t,i){let s=zn(t.clock,i),r=this.fade(s),a=e.highlight;if(e.members.length!==this.members.length||e.members.some((_,v)=>_!==this.members[v])||a!==this.highlight||e.selected!==this.selected){let _=e.layer.members!=="all"&&e.members.length===1?e.members[0]:-1;this.members=e.members,this.highlight=a,this.selected=e.selected,this.baseWhat=_>=0?_===a?null:_:e.members.length>0?"set":null,this.skip=_<0&&a!==null?a:-1;for(let v of this.passes.values())this.showPass(v);for(let v=0;v<this.set.tracks;v++)this.ranges.data.set(ma,4*v);this.fillKernel(),this.heads?.grow(e.members.length),this.glow?.grow(e.members.length),this.filled=!1}if(this.clocks===null&&this.filled)return!1;let l=this.pieces.begin(this.line?2*e.members.length:0),c=this.heads?.position,h=this.heads?.color,u=this.glow?.position,f=sf(this.layer).glow?.channel,d=f===void 0?null:this.set.channel(f,"2.7"),p=0,y=0,m=[1/0,-1/0],g=[1/0,-1/0],b=[];for(let _ of e.members){let v=this.clocks?.clocks[_]??null,w=Ep(v,this.clock,i,this.spec,Math.fround);this.ranges.data.set(w.range,4*_);let E=_===a;if(w.laps!==null){let R=E?g:m;R[0]=Math.min(R[0],w.laps[0]),R[1]=Math.max(R[1],w.laps[1])}let x=E?this.hiWidth:this.width,A=r*(E?this.hiOpacity:this.alphas!==null?this.alphas.data[4*_]:this.opacity),I=this.fraction>0&&w.loop!==null;if(this.line)for(let R of w.pieces){let D=ao*this.pieces.n++;R.forEach((H,X)=>{this.geo.vertex(_,H,l,D+3*X),this.colorAt(_,H,l,D+6+4*X);let L=I?d0(1-(w.loop-Pp(v,H))/this.fraction):1;l[D+9+4*X]=A*(I?this.taperOpacity+(1-this.taperOpacity)*L:1),l[D+14+X]=x>1&&I?x*(this.taperWidth+(1-this.taperWidth)*L):x,l[D+16+X]=this.distAt(_,H)})}if(c!==void 0&&h!==void 0&&w.head!==null&&p<c.count&&(this.geo.vertex(_,w.head,c.array,3*p),this.headColor!==null?h.array.set(this.headColor,3*p):this.colorAt(_,w.head,h.array,3*p),p++,u!==void 0&&d!==null)){let R=w.head,D="sample"in R?R.sample:R.w>=1?R.k+1:R.k;d[this.set.start(_)+D]>0&&this.geo.vertex(_,R,u.array,3*y++)}this.fill!==null&&!w.hidden&&this.fillTrack(_,v,w.loop,b)}return this.pieces.end(),this.heads?.show(p),this.glow?.show(y),this.fill!==null&&this.setFill(b),this.syncPasses(m,g),this.ranges.texture.needsUpdate=!0,this.filled=!0,!0}fillTrack(e,t,i,s){let r=this.spec,a=r.laps,o;t===null||i===null||r.reveal==="none"?o=Nh(this.set.count(e),a,r.periodic):r.reveal==="grow"?o=Ro(t,0,i,a):o=Po(t,i,a,r.fraction,r.periodic);let l=this.planeAxes,c=this.layer.fill?.base??0,h=new Float32Array(3),u=null;for(let f of o){this.geo.vertex(e,f,h,0);let d=[h[l[0]],h[l[1]]];u!==null&&OE(u,d,c,s),u=d}}planeAxes=[0,1];setFill(e){let t=this.fill,i=e.length/2;3*i>this.fillBuffer.length&&(this.fillBuffer=new Float32Array(3*Math.max(2*i,96)),t.geometry.dispose(),t.geometry=new xt,t.geometry.setAttribute("position",new Dt(this.fillBuffer,3).setUsage(yi)));let[s,r]=this.planeAxes;this.fillBuffer.fill(0,0,3*i);for(let o=0;o<i;o++)this.fillBuffer[3*o+s]=e[2*o],this.fillBuffer[3*o+r]=e[2*o+1];let a=t.geometry.getAttribute("position");a!==void 0&&(a.clearUpdateRanges(),a.addUpdateRange(0,3*i),a.needsUpdate=!0),t.geometry.setDrawRange(0,i),t.visible=i>0}extend(){}colorbar(){let e=this.color;if(e===void 0||typeof e=="string"||ra(e))return null;let t=Wh(e,this.set),i=this.set.def.parameters??{},s=t.perTrack&&Object.hasOwn(i,t.name)?i[t.name]:void 0,r=s?.label??t.name,[a,o]=t.range,l=d=>o===a?.5:d0((d-a)/(o-a)),c=this.highlight??(this.layer.members!=="all"&&this.members.length===1?this.members[0]:null),h=t.perTrack&&c!==null?l(t.values[c]):null,u=this.kernel,f=null;if(u!==null&&t.perTrack&&t.name===u.parameter&&this.selected!==null){let d=t.values[this.selected],p=1.5*u.width*u.extent;f=[l(d-p),l(d+p)]}return{label:s?.unit?`${r}, ${s.unit}`:r,gradient:ip(t),stops:$h(t),lo:a,hi:o,marker:h,band:f}}dispose(){for(let e of this.passes.values())e.dispose();this.ranges.texture.dispose(),this.alphas?.texture.dispose(),this.pieces.dispose(),this.heads?.dispose(),this.glow?.dispose(),this.fill!==null&&(this.fill.geometry.dispose(),this.fill.material.dispose())}};function OE(n,e,t,i){let[s,r]=n,[a,o]=e,l=r>t,c=o>t;if(!l&&!c)return;let h=(f,d,p,y)=>i.push(f,t,f,d,p,y,f,t,p,y,p,t);if(l&&c){h(s,r,a,o);return}let u=s+(t-r)/(o-r)*(a-s);l?i.push(s,t,s,r,u,t):i.push(u,t,a,o,a,t)}var oo=class{key;group=new fn;sprites;layer;rgb;isStatic;done=!1;constructor(e,t,i){this.key=i,this.layer=t;let s=t.marker??{};this.rgb=Mt(s.color!==void 0?$t(s.color,e.theme):e.theme.foreground),this.sprites=new uo(sa(s,e.theme),typeof s.size=="number"?s.size:4,!1),this.group.add(this.sprites.points),this.isStatic=(t.reveal??"none")==="none"&&t.before===void 0&&t.after===void 0&&typeof s.size!="object"&&typeof s.edge_width!="object"&&typeof s.opacity!="object"&&typeof t.opacity!="object"}update(e,t){let i=zn(e.base?.clock??e.clock,e.q),s=this.layer.marker??{};if(this.sprites.setOpacity(rn(this.layer.opacity,i)*rn(s.opacity,i)),(typeof s.size=="object"||typeof s.edge_width=="object")&&this.sprites.setSize(ta(s.size,i,4),s.edge_width===void 0?void 0:ea(s.edge_width,i,0)),this.isStatic&&this.done)return;let r=Do(e,this.layer,t.set),a=0;for(let h of r.members)a+=h.points.length;this.sprites.grow(a);let o=this.sprites.position.array,l=this.sprites.color.array,c=0;for(let h of r.members)for(let u of h.points)o.set(u,3*c),l.set(this.rgb,3*c),c++;this.sprites.show(a),this.done=!0}extend(e){let t=this.sprites.position,i=this.sprites.points.geometry.drawRange;for(let s=0;s<Math.min(t.count,i.count);s++)e.expandByPoint(new O(t.getX(s),t.getY(s),t.getZ(s)))}dispose(){this.sprites.dispose()}},lo=class{key;group=new fn;layer;at=null;constructor(e,t){this.key=t,this.layer=e}update(e,t,i){let s=ko(e,this.layer,t.set,i);this.at=s.position===null?null:new O(...s.position)}extend(){}dispose(){}},v0=new WeakMap;function FE(n,e){let t=v0.get(n);t===void 0&&v0.set(n,t=new Map);let i=t.get(e);return i===void 0&&(i=(async()=>{let s=n.bytes(e),r=s[0]===255?"image/jpeg":s[0]===82?"image/webp":"image/png",a=await createImageBitmap(new Blob([s],{type:r}),{imageOrientation:"flipY"}),o=new tn(a);return o.generateMipmaps=!1,o.minFilter=vt,o.magFilter=vt,o.flipY=!1,o.colorSpace=si,o.needsUpdate=!0,o})(),t.set(e,i)),i}var ds=class{key;group=new fn;label;size;at=null;point;trail;geometry;scratch=new Float64Array(3);capacity=0;layer;ready;imageError=null;constructor(e,t,i,s=()=>{}){this.key=i,this.layer=t,this.geometry=e.geometry;let r=e.scene.bodies??{},a=Object.hasOwn(r,t.body)?r[t.body]:void 0;this.label=a?.label??null,this.size=t.size??uE;let o=new Xe(...Mt(a?.color!==void 0?$t(a.color,e.theme):e.theme.foreground));this.ready=Promise.resolve();let l=new xt;l.setAttribute("position",new Dt(new Float32Array(3),3).setUsage(yi)),this.point=new Lr(l,new zs({color:o,size:this.size,sizeAttenuation:!1,map:e.disc,alphaTest:.5,transparent:!0,depthTest:!1,depthWrite:!1})),this.point.frustumCulled=!1;let c=a?.image;if(c!==void 0){let h=this.point.material;h.color.setRGB(1,1,1),h.alphaTest=.01,h.map=null,this.point.visible=!1,this.ready=FE(e.geometry,c).then(u=>{h.map=u,h.needsUpdate=!0,s()},u=>{let f=`body ${t.body} has image ${c}, which cannot be decoded as a PNG, JPEG, or WebP file`;this.imageError=u instanceof Qt?u:new Qt("2.11",f),s()})}this.trail=new Rr(new xt,new Bs({color:o,transparent:!0,opacity:.6,depthTest:!1,depthWrite:!1})),this.trail.frustumCulled=!1,this.group.add(this.trail,this.point)}update(e,t,i){if(this.imageError!==null)throw this.imageError;let s=rn(this.layer.opacity,zn(e.clock,e.q));if(this.point.material.opacity=s,this.trail.material.opacity=.6*s,i===null){this.point.visible=!1,this.trail.visible=!1,this.at=null;return}let{set:r,track:a}=i,o=Pt(e.clock),l=this.geometry.readings(r.id,e.channel).clocks[a],c=this.geometry.bodyTrail(t.body,e.display,r.id,a),h=o*qn(l.reading(e.clock,e.q)),u=an(h,o),f=this.scratch;c.vertex(Lt(l,u.u,!1,u.lap),f),this.point.visible=!this.hasImage||this.point.material.map!==null,this.at=new O(f[0],f[1],f[2]);let d=this.point.geometry.getAttribute("position");if(d.setXYZ(0,f[0],f[1],f[2]),d.needsUpdate=!0,t.trail===void 0){this.trail.visible=!1;return}let p=t.trail.fraction,y=h-o*p;y<0&&!r.periodic&&(y=0);let m=Dp(c.m,o,p);if(m>this.capacity){this.capacity=m,this.trail.geometry.dispose();let _=new xt;_.setAttribute("position",new Dt(new Float32Array(3*this.capacity),3).setUsage(yi)),this.trail.geometry=_}let g=this.trail.geometry.getAttribute("position"),b=c.polyline(l,y,h,o,g.array);g.clearUpdateRanges(),g.addUpdateRange(0,3*b),g.needsUpdate=!0,this.trail.geometry.setDrawRange(0,b),this.trail.visible=b>1}extend(e){this.at!==null&&e.expandByPoint(this.at)}clip(e){if(!this.hasImage||this.at===null)return;let t=this.at.clone().project(e);(Math.abs(t.x)>1||Math.abs(t.y)>1)&&(this.point.visible=!1)}get hasImage(){let e=this.geometry.scene.bodies??{};return Object.hasOwn(e,this.layer.body)&&e[this.layer.body].image!==void 0}dispose(){this.point.material.map?.dispose();for(let e of[this.point,this.trail])e.geometry.dispose(),e.material.dispose()}},mh=class{key;group=new fn;geometry;resolution={value:new Pe(1,1)};shaft;head;buffer;constructor(e,t,i){this.key=i,this.geometry=e.geometry;let{layer:s}=t,r={uResolution:this.resolution,uColor:{value:new lt(...Mt($t(s.color??e.theme.foreground,e.theme)),typeof s.opacity=="number"?s.opacity:1)},uWidth:{value:s.width??1},uHead:{value:s.head?.size??cE},uHeadWidth:{value:hE}};this.buffer=this.allocate(t.set.tracks);let a=new Dr;a.setAttribute("position",new Ut([-1,0,0,1,0,0,0,1,0],3)),this.shaft=new Jt(this.attach(hf()),ho(u0,r)),this.head=new Jt(this.attach(a),ho(u0,r,{HEAD:""}));for(let o of[this.shaft,this.head])o.frustumCulled=!1;this.group.add(this.shaft,this.head)}allocate(e){return new os(new Float32Array(6*Math.max(1,e)),6).setUsage(yi)}attach(e){return e.setAttribute("instanceBase",new Tt(this.buffer,3,0)),e.setAttribute("instanceTip",new Tt(this.buffer,3,3)),e.instanceCount=0,e}update(e,t){typeof t.layer.opacity=="object"&&(this.shaft.material.uniforms.uColor.value.w=rn(t.layer.opacity,zn(e.clock,e.q)));let i=this.geometry.readings(t.set.id,t.channel).clocks,r=Lo(e,t.layer,t.set,o=>i[o]).members.filter(o=>o.base!==null&&o.tip!==null);if(6*r.length>this.buffer.array.length){this.buffer=this.allocate(2*r.length);for(let o of[this.shaft,this.head])o.geometry.deleteAttribute("instanceBase"),o.geometry.deleteAttribute("instanceTip"),this.attach(o.geometry)}let a=this.buffer.array;r.forEach((o,l)=>{a.set(o.base,6*l),a.set(o.tip,6*l+3)}),this.buffer.clearUpdateRanges(),this.buffer.addUpdateRange(0,6*r.length),this.buffer.needsUpdate=!0;for(let o of[this.shaft,this.head])o.geometry.instanceCount=r.length,o.visible=r.length>0}resize(e,t){this.resolution.value.set(Math.max(1,e),Math.max(1,t))}extend(){}dispose(){for(let e of[this.shaft,this.head])e.geometry.dispose(),e.material.dispose()}};function UE(n,e,t,i,s,r,a){let{right:o,up:l}=Fi(t),c=$r(s);i.updateMatrixWorld();let[h,u,f]=n.axes.map(p=>new O(...p)),d=[];for(let[p,y]of[[e.x0,e.y0],[e.x1,e.y0],[e.x1,e.y1],[e.x0,e.y1]]){let m=o.clone().multiplyScalar(p).addScaledVector(l,y),g=new O(...n.origin).addScaledVector(h,m.x).addScaledVector(u,m.y).addScaledVector(f,m.z);if(g.multiply(c).applyMatrix4(i.matrixWorldInverse),i instanceof cn&&g.z>=-i.near)return null;g.applyMatrix4(i.projectionMatrix),d.push([(g.x+1)/2*r,(1-g.y)/2*a])}return d}var co=class{key;group=new fn;layer;mesh;positions=new Float32Array(0);map=null;constructor(e,t,i){this.key=i,this.layer=t;let s=new lt(...Mt($t(t.color??e.theme.foreground,e.theme)),typeof t.opacity=="number"?t.opacity:1);this.mesh=new Jt(new xt,ho(bE,{uColor:{value:s}})),this.mesh.frustumCulled=!1,this.mesh.visible=!1,this.group.add(this.mesh)}update(e,t){typeof this.layer.opacity=="object"&&(this.mesh.material.uniforms.uColor.value.w=rn(this.layer.opacity,zn(e.clock,e.q))),this.map=Io(e,this.layer,t)}get target(){return this.map?.origin==null?null:this.map.panel}place(e,t){let i=this.map,s=[],{w:r,h:a}=e.rect;if(i?.origin!=null&&i.axes!==null&&t?.view!=null&&t.error===null&&t.cameraSpec.kind==="plane"){let l=UE({...i,origin:i.origin,axes:i.axes},t.view,t.cameraSpec,e.camera,e.cameraSpec,r,a),c={width:this.layer.width??1,minSize:this.layer.min_size??dE,dash:this.layer.dash};l!==null&&(s=o0(l,r,a,c))}let o=s.length/2;3*o>this.positions.length&&(this.positions=new Float32Array(3*Math.max(2*o,96)),this.mesh.geometry.dispose(),this.mesh.geometry=new xt,this.mesh.geometry.setAttribute("position",new Dt(this.positions,3).setUsage(yi)));for(let l=0;l<o;l++)this.positions[3*l]=2*s[2*l]/r-1,this.positions[3*l+1]=1-2*s[2*l+1]/a;if(o>0){let l=this.mesh.geometry.getAttribute("position");l.clearUpdateRanges(),l.addUpdateRange(0,3*o),l.needsUpdate=!0}this.mesh.geometry.setDrawRange(0,o),this.mesh.visible=o>0}extend(){}dispose(){this.mesh.geometry.dispose(),this.mesh.material.dispose()}},Oi=class{key;group=new fn;kind;follows;full;ticks;box;theme;lines;shown="";tips=[];constructor(e,t,i,s){this.key=s,this.kind=t.kind,this.theme=e.theme;let r=i.kind==="plane";this.box=t.kind==="axes"&&t.span==="box"&&r?t:null,t.kind==="axes"?(this.full=(t.span??(r?"full":"positive"))==="full",this.ticks=r&&this.full):(this.full=!1,this.ticks=r&&(t.labels??r)),this.follows=this.ticks||t.kind==="grid"&&fh(i);let a=new Bs({vertexColors:!0,transparent:!0,depthTest:!1,depthWrite:!1});this.lines=new Pr(new xt,a),this.lines.frustumCulled=!1,this.group.add(this.lines)}set(e,t){this.lines.geometry.dispose();let i=new xt;i.setAttribute("position",new Ut(e,3)),i.setAttribute("color",new Ut(t,4)),this.lines.geometry=i}layout(e,t,i=new O(1,1,1)){if(this.follows||this.box!==null)return;let s=e.getCenter(new O),r=e.getSize(new O),a=Math.max(r.x,r.y,r.z,1e-9),o=[],l=[],c=(h,u,f,d)=>{o.push(h.x,h.y,h.z,u.x,u.y,u.z),l.push(...f,d,...f,d)};if(this.kind==="axes"){let h=r.clone().multiply(i),u=Math.max(h.x,h.y,h.z,1e-9),f=p=>dh(fh(t)&&p>1e-9*u?p:u,2),d=Mt(this.theme.foreground);this.tips=[new O(f(h.x)/i.x,0,0),new O(0,f(h.y)/i.y,0),new O(0,0,f(h.z)/i.z)];for(let p of this.tips)c(this.full?p.clone().negate():new O,p,d,.8)}else{let{right:h,up:u,normal:f}=Fi(t.kind==="plane"?t:{kind:"plane",plane:t.up==="x"?"yz":t.up==="y"?"xz":"xy"}),d=dh(a,8),p=Mt(this.theme.grid),y=Mt(_n(this.theme.grid,this.theme.foreground,.3)),m=s.dot(h),g=s.dot(u),b=Math.abs(f.x)>.5?"x":Math.abs(f.y)>.5?"y":"z",_=new O;_[b]=1;let v=e.min[b]<=0&&e.max[b]>=0?0:s[b],w=2.5*a,E=Math.floor((m-w)/d),x=Math.ceil((m+w)/d),A=Math.floor((g-w)/d),I=Math.ceil((g+w)/d),R=(D,H)=>h.clone().multiplyScalar(D).addScaledVector(u,H).addScaledVector(_,v);for(let D=E;D<=x;D++)c(R(D*d,A*d),R(D*d,I*d),D===0?y:p,1);for(let D=A;D<=I;D++)c(R(E*d,D*d),R(x*d,D*d),D===0?y:p,1)}this.set(o,l)}follow(e,t){if(!this.follows)return;let i=[e.x0,e.x1,e.y0,e.y1,e.stepX,e.stepY].join(",");if(i===this.shown)return;this.shown=i;let{right:s,up:r}=Fi(t),a=[],o=[],l=(c,h,u,f,d,p)=>{let y=s.clone().multiplyScalar(c).addScaledVector(r,h),m=s.clone().multiplyScalar(u).addScaledVector(r,f);a.push(y.x,y.y,y.z,m.x,m.y,m.z),o.push(...d,p,...d,p)};if(this.kind==="axes"){let c=Mt(this.theme.foreground);e.y0<=0&&e.y1>=0&&l(e.x0,0,e.x1,0,c,.5),e.x0<=0&&e.x1>=0&&l(0,e.y0,0,e.y1,c,.5)}else{let c=Mt(this.theme.grid),h=Mt(_n(this.theme.grid,this.theme.foreground,.3));for(let u of ph(e.x0,e.x1,e.stepX))l(u,e.y0,u,e.y1,u===0?h:c,1);for(let u of ph(e.y0,e.y1,e.stepY))l(e.x0,u,e.x1,u,u===0?h:c,1)}this.set(a,o)}extend(){}dispose(){this.lines.geometry.dispose(),this.lines.material.dispose()}},BE=100,zE=150;function x0(n,e,t){return new mn(n,e,{samples:t,depthBuffer:!0,stencilBuffer:!0,minFilter:vt,magFilter:vt,generateMipmaps:!1})}function HE(){let n=new Rn({glslVersion:eo,uniforms:{uUnderlay:{value:null}},vertexShader:"void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",fragmentShader:"uniform sampler2D uUnderlay; out vec4 color; void main() { color = texelFetch(uUnderlay, ivec2(gl_FragCoord.xy), 0); }",depthTest:!1,depthWrite:!1,blending:ki}),e=new Jt(new Hs(2,2),n);e.frustumCulled=!1;let t=new Fs;return t.add(e),{scene:t,camera:new Ln,material:n}}function VE(n,e){n.updateMatrixWorld();let t=n.matrixWorld.elements,i=n.projectionMatrix.elements,s=!1;for(let r=0;r<16;r++)e[r]!==t[r]&&(s=!0,e[r]=t[r]),e[16+r]!==i[r]&&(s=!0,e[16+r]=i[r]);return s}function GE(n,e){return n.x<e.x+e.z&&e.x<n.x+n.z&&n.y<e.y+e.w&&e.y<n.y+n.w}var cf=class{id;scene=new Fs;staticScene=new Fs;underlay=new lt(-1,-1,-1,-1);underlayDirty=!0;staticKey="";rebuiltAt=-1/0;coarse=!1;cameraSeen=new Float64Array(32);camera=new Ln;cameraSpec={kind:"plane",plane:"xy"};controls=null;element=null;labels=null;plan=null;error=null;draws=new Map;rect={x:0,y:0,w:1,h:1};outer={x:0,y:0,w:1,h:1};window=null;atWindow=!1;content="";needsFit=!0;userMoved=!1;fitting=!1;halfWidth=1;halfHeight=1;box=null;target=new O;turned=0;view=null;constructor(e){this.id=e}},_0=n=>JSON.stringify(n),WE=n=>n.kind==="orbit"&&(n.turn??0)!==0,gh=class{canvas;onChange=()=>{};gl;ctx;panels=new Map;lastState=null;size={w:0,h:0,ratio:0};background;cacheStatic;coarseDrags;refineTimer=null;blit;underlay=null;scratch=null;viewport=new lt;cssViewport=new lt;cssScissor=new lt;buffer=new Pe;region=new Wa;corner=new Pe;constructor(e,t,i,s={}){this.canvas=e,Ye.enabled=!1,this.gl=new ih({canvas:e,antialias:!0,stencil:!0,preserveDrawingBuffer:s.preserveDrawingBuffer??!1}),this.cacheStatic=s.cacheStatic??!0,this.coarseDrags=s.coarseDrags??!0,this.blit=HE(),e.addEventListener("webglcontextrestored",()=>{for(let a of this.panels.values())a.underlayDirty=!0}),this.gl.outputColorSpace=Os,this.gl.autoClear=!1;let r=s.theme??Ho(t);this.background=new Xe(...Mt(r.background)),this.ctx={scene:t,geometry:i,shared:new rf,theme:r,disc:xE()}}setTheme(e){this.ctx.theme=e,this.background.setRGB(...Mt(e.background)),this.lastState=null;for(let t of this.panels.values())t.underlayDirty=!0}panel(e){let t=this.panels.get(e);return t||(t=new cf(e),this.panels.set(e,t)),t}bind(e,t){let i=this.panel(e);i.element!==t&&(i.controls?.dispose(),i.controls=null,i.labels?.remove(),i.labels=null,i.element=t,t!==null&&(i.labels=document.createElement("div"),i.labels.className="labels",t.append(i.labels),this.makeControls(i)))}refit(e){let t=this.panels.get(e);t&&(t.needsFit=!0,t.userMoved=!1)}refitAll(){for(let e of this.panels.keys())this.refit(e)}offKeys(e){let t=this.panels.get(e);return t!==void 0&&t.userMoved&&t.cameraSpec.kind==="plane"&&t.cameraSpec.keys!==void 0}makeControls(e){if(e.controls?.dispose(),e.controls=null,e.element===null)return;let t=new oh(e.camera,e.element);t.enableDamping=!1,t.screenSpacePanning=!0,e.cameraSpec.kind==="plane"&&(t.enableRotate=!1,t.zoomToCursor=!0,t.mouseButtons={LEFT:$n.PAN,MIDDLE:$n.DOLLY,RIGHT:$n.PAN},t.touches={ONE:ti.PAN,TWO:ti.DOLLY_PAN}),t.addEventListener("change",()=>{e.fitting||(e.userMoved=!0,this.onChange())}),e.controls=t}setCamera(e,t){e.cameraSpec=t;let i=t.kind==="plane"||t.projection==="orthographic";e.camera=i?new Ln(-1,1,1,-1,-1,1):new cn(35,1,.01,100);let s=$r(t);e.scene.scale.copy(s),e.staticScene.scale.copy(s),e.underlayDirty=!0,e.needsFit=!0,e.userMoved=!1,this.makeControls(e)}drawStatic(e){if(e.staticScene.children.length===0)return;if(!this.cacheStatic||WE(e.cameraSpec)){this.gl.render(e.staticScene,e.camera);return}let t=this.gl.getDrawingBufferSize(this.buffer);if(this.underlay===null||this.underlay.width!==t.x||this.underlay.height!==t.y){this.underlay?.dispose(),this.underlay=x0(t.x,t.y,0),this.gl.initRenderTarget(this.underlay);for(let s of this.panels.values())s.underlayDirty=!0}let i=this.gl.getCurrentViewport(this.viewport);if(i.equals(e.underlay)||(e.underlay.copy(i),e.underlayDirty=!0),VE(e.camera,e.cameraSeen)&&(e.underlayDirty=!0),e.underlayDirty){e.underlayDirty=!1;let s=performance.now();e.coarse=this.coarseDrags&&s-e.rebuiltAt<BE,e.rebuiltAt=s,e.coarse?(this.drawCoarse(e,this.underlay,i),this.scheduleRefine()):this.drawFine(e,this.underlay,i);for(let r of this.panels.values())r!==e&&GE(r.underlay,i)&&(r.underlayDirty=!0);this.gl.setViewport(this.gl.getViewport(this.cssViewport)),this.gl.setScissor(this.gl.getScissor(this.cssScissor))}this.blit.material.uniforms.uUnderlay.value=this.underlay.texture,this.gl.render(this.blit.scene,this.blit.camera)}drawCoarse(e,t,i){t.viewport.copy(i),t.scissor.copy(i),t.scissorTest=!0,this.gl.setRenderTarget(t),this.gl.clear(!0,!1,!0),this.gl.render(e.staticScene,e.camera),this.gl.setRenderTarget(null)}scheduleRefine(){this.refineTimer!==null&&clearTimeout(this.refineTimer),this.refineTimer=setTimeout(()=>{this.refineTimer=null;for(let e of this.panels.values())e.coarse&&(e.underlayDirty=!0,e.rebuiltAt=-1/0);this.onChange()},zE)}drawFine(e,t,i){let s=this.scratch;(s===null||s.width<i.z||s.height<i.w)&&(s?.dispose(),s=this.scratch=x0(Math.max(i.z,s?.width??0),Math.max(i.w,s?.height??0),4)),s.viewport.set(0,0,i.z,i.w),s.scissor.set(0,0,i.z,i.w),s.scissorTest=!0,this.gl.setRenderTarget(s),this.gl.clear(!0,!1,!0),this.gl.render(e.staticScene,e.camera),this.gl.setRenderTarget(null),this.region.min.set(0,0),this.region.max.set(Math.min(i.z,t.width-i.x),Math.min(i.w,t.height-i.y)),this.gl.copyTextureToTexture(s.texture,t.texture,this.region,this.corner.set(i.x,i.y))}disposePanel(e){for(let t of e.draws.values())t.dispose();e.draws.clear(),e.controls?.dispose(),e.labels?.remove(),this.panels.delete(e.id)}replan(e,t){let i=this.ctx.scene,s;try{s=SE(i,this.ctx.geometry,t,e.id),e.error=null}catch(d){if(!(d instanceof Qt))throw d;e.error=d.message,e.plan=null;for(let p of e.draws.values())p.group.visible=!1;return}let r=e.plan,a=s.view.camera??{kind:"plane",plane:"xy"};(r===null||r.viewId!==s.viewId||_0(a)!==_0(e.cameraSpec))&&this.setCamera(e,a);let o=wE(s);o!==e.content&&(e.content=o,e.needsFit=!0,e.userMoved=!1),e.plan=s;let l=new Set,c=JSON.stringify(this.ctx.theme);try{for(let d of s.layers){let p;if(d.kind==="track"){if(d.set===null)continue;let b=`${JSON.stringify(d.color??null)}\0${c}`;p=`track\0${s.viewId}\0${d.index}\0${d.set.id}\0${s.display}\0${d.channel??""}\0${b}`}else if(d.kind==="arrow"){if(d.set===null)continue;let b=JSON.stringify([d.layer.color??null,c,d.layer.opacity,d.layer.width,d.layer.head]);p=`arrow\0${s.viewId}\0${d.index}\0${d.set.id}\0${s.display}\0${d.channel}\0${b}`}else if(d.kind==="outline")p=`outline\0${s.viewId}\0${d.index}\0${JSON.stringify([d.layer,c])}`;else if(d.kind==="points"||d.kind==="label"){if(d.kind==="points"&&d.set===null)continue;p=`${d.kind}\0${s.viewId}\0${d.index}\0${d.set?.id??""}\0${s.display}\0${JSON.stringify(d.layer)}\0${c}`}else p=`${d.kind}\0${s.viewId}\0${d.index}\0${s.display}\0${c}`;l.add(d.index);let y=e.draws.get(d.index);if(y!==void 0&&y.key===p){y.group.visible=!0;continue}y!==void 0&&(y.group.removeFromParent(),y.dispose(),e.draws.delete(d.index));let m=d.kind==="track"?new us(this.ctx,d,s.display,p):d.kind==="arrow"?new mh(this.ctx,d,p):d.kind==="outline"?new co(this.ctx,d.layer,p):d.kind==="body"?new ds(this.ctx,d.layer,p,()=>{e.underlayDirty=!0,this.onChange()}):d.kind==="points"?new oo(this.ctx,d.layer,p):d.kind==="label"?new lo(d.layer,p):new Oi(this.ctx,d.layer,e.cameraSpec,p);m.group.renderOrder=d.index;let g=0;for(let b of m.group.children)b.renderOrder=16*d.index+g++;e.draws.set(d.index,m),m instanceof Oi&&e.box!==null&&m.layout(e.box,e.cameraSpec,$r(e.cameraSpec))}}catch(d){if(!(d instanceof Qt))throw d;e.error=d.message,e.plan=null;for(let p of e.draws.values())p.group.visible=!1;return}for(let[d,p]of[...e.draws])l.has(d)||(p.group.removeFromParent(),p.dispose(),e.draws.delete(d));let h=[],u=!0;for(let d of s.layers){let p=e.draws.get(d.index);p!==void 0&&(u&&=p instanceof us&&p.isStatic,(u?e.staticScene:e.scene).add(p.group),u&&h.push(p.key))}let f=h.join(`
`);f!==e.staticKey&&(e.staticKey=f,e.underlayDirty=!0)}advance(e,t,i){let s=e.plan;if(s===null)return;let r=this.ctx.scene,a={scope:s.scope,frames:this.ctx.geometry.frames,clock:r.clock,channel:t.clock.channel,q:i,display:s.display};e.error=null;let o=e.cameraSpec.kind==="plane"?Ks(e.cameraSpec):[0,1];try{for(let l of s.layers){let c=e.draws.get(l.index);c instanceof us&&l.kind==="track"?(c.planeAxes=o,c.update(l,r,i)&&c.isStatic&&(e.underlayDirty=!0),c.driverContext&&c.place(a,s.driver)):c instanceof mh&&l.kind==="arrow"?c.update(_i(a,l.layer),l):c instanceof co&&l.kind==="outline"?c.update(a,s.driver):c instanceof ds&&l.kind==="body"?c.update(a,l.layer,s.driver):c instanceof oo&&l.kind==="points"?c.update(_i(a,l.layer),l):c instanceof lo&&l.kind==="label"&&c.update(a,l,s.driver)}}catch(l){if(!(l instanceof Qt))throw l;e.error=l.message}}fit(e){let t=new ei,i=e.plan===null?null:AE(e.plan,this.ctx.geometry);if(i!==null)t.set(new O(i[0],i[1],i[2]),new O(i[3],i[4],i[5]));else for(let d of e.draws.values())(d instanceof ds&&d.group.visible||d instanceof oo)&&d.extend(t);t.isEmpty()&&t.set(new O(-1,-1,-1),new O(1,1,1));let s=e.cameraSpec,r=$r(s),a=new ei(t.min.clone().multiply(r),t.max.clone().multiply(r)),o=a.getCenter(new O),l=a.getSize(new O),c=Math.max(l.length()/2,1e-9),{up:h,normal:u}=Fi(s),f=e.camera;if(e.fitting=!0,f instanceof Ln){({halfWidth:e.halfWidth,halfHeight:e.halfHeight}=CE(a,s,e.rect.w/Math.max(1,e.rect.h)));let d=4*c+1,p=10*(o.length()+d+c);f.near=-p,f.far=p,f.zoom=1,f.position.copy(o).addScaledVector(u,d)}else{let d=c/Math.sin(f.fov*Math.PI/360)*1.08;f.near=d/1e3,f.far=d*1e3+o.length(),f.position.copy(o).addScaledVector(u,d)}f.up.copy(h),f.lookAt(o),e.target.copy(o),e.turned=0,this.aspect(e),e.controls&&(e.controls.target.copy(o),e.controls.update());for(let d of e.draws.values())d instanceof Oi&&d.layout(t,s,r);e.box=t,e.fitting=!1,e.needsFit=!1,e.atWindow=!1}aspect(e){let t=e.rect.w/Math.max(1,e.rect.h),i=e.camera;i instanceof Ln?(fh(e.cameraSpec)||(e.halfWidth=e.halfHeight*t),i.top=e.halfHeight,i.bottom=-e.halfHeight,i.left=-e.halfWidth,i.right=e.halfWidth):i.aspect=t,i.updateProjectionMatrix()}turn(e,t){let i=e.cameraSpec;if(i.kind!=="orbit"||i.turn===void 0)return;let s=i.turn*t*Math.PI/180,r=e.controls?.target??e.target;e.camera.position.sub(r).applyAxisAngle(Fi(i).up,s-e.turned).add(r),e.camera.lookAt(r),e.turned=s}follow(e){let t=e.cameraSpec;if(e.view=t.kind==="plane"&&e.camera instanceof Ln?PE(e.camera,t,e.rect.w,e.rect.h):null,!(e.view===null||t.kind!=="plane"))for(let i of e.draws.values())i instanceof Oi&&i.follow(e.view,t)}renderAt(e,t,i,s,r){let a=Math.max(1,Math.floor(i)),o=Math.max(1,Math.floor(s));(a!==this.size.w||o!==this.size.h||r!==this.size.ratio)&&(this.gl.setPixelRatio(r),this.gl.setSize(a,o,!1),this.size={w:a,h:o,ratio:r});let l=zn(this.ctx.scene.clock,t),c=uh(fo(e.layout,l),{x:0,y:0,w:a,h:o},yh);for(let f of[...this.panels.values()])Object.hasOwn(e.panels,f.id)||this.disposePanel(f);let h=e!==this.lastState;this.lastState=e;let u=new Map;this.gl.setScissorTest(!1),this.gl.setClearColor(this.background,1),this.gl.clear(),this.gl.setScissorTest(!0);for(let[f,d]of c.panels){let p=this.panel(f);(h||p.plan===null)&&this.replan(p,e);let m=$E(d,p.plan?.view.margin),g=m.w!==p.rect.w||m.h!==p.rect.h;p.outer=d,p.rect=m,this.advance(p,e,t),p.needsFit||g&&!p.userMoved?this.fit(p):g&&this.aspect(p),this.keyed(p,e,t),this.turn(p,t),this.follow(p);for(let w of p.draws.values())w instanceof ds&&w.clip(p.camera);let b=p.camera instanceof Ln?p.camera:null,_=b===null?1:p.rect.w/Math.max(1e-12,(b.right-b.left)/b.zoom),v=b===null?1:p.rect.h/Math.max(1e-12,(b.top-b.bottom)/b.zoom);for(let w of p.draws.values())w instanceof us&&w.setPixels(_,v);for(let w of p.draws.values())w instanceof us&&w.placeDash(p.camera,p.rect,a,o,1/r)}for(let[f]of c.panels){let d=this.panel(f),p=d.rect;if(d.error!==null){u.set(f,d.error);continue}if(p.w<1||p.h<1||rn(d.plan?.view.opacity,l)<=0)continue;for(let m of d.draws.values())m.resize?.(p.w,p.h);for(let m of d.draws.values())m instanceof co&&m.place(d,m.target===null?void 0:this.panels.get(m.target));let y=o-p.y-p.h;this.gl.setViewport(p.x,y,p.w,p.h),this.gl.setScissor(p.x,y,p.w,p.h),this.drawStatic(d),this.gl.render(d.scene,d.camera),this.placeLabels(d)}return this.gl.setScissorTest(!1),u}labelItems(e){if(e.plan===null)return[];let t=[],i=[],s=[],r=this.ctx.scene.frames[e.plan.display],a=r?.axes??["x","y","z"],{normal:o}=Fi(e.cameraSpec),l=$r(e.cameraSpec),c=e.rect.x-e.outer.x,h=e.rect.y-e.outer.y,u=(p,y,m,g)=>{let b=y.clone().multiply(l).project(e.camera),_=(b.x+1)/2*e.rect.w+m,v=(1-b.y)/2*e.rect.h,w=b.z>-1&&b.z<1&&_>=0&&_<=e.rect.w&&v>=0&&v<=e.rect.h,E={text:p,x:_+c,y:v+h,hidden:g||!w};return t.push(E),E},f=[...e.draws.values()].filter(p=>p instanceof Oi);if(e.view!==null&&e.cameraSpec.kind==="plane"){let[p,y]=Ks(e.cameraSpec),m=_=>a[_]&&r?.unit?`${a[_]} [${r.unit}]`:a[_]??"",g=f.some(_=>_.follows&&_.kind==="axes"),b=f.some(_=>_.ticks);for(let _ of IE(e.view,b,g?[m(p),m(y)]:null)){let v={..._,x:_.x+c,y:_.y+h,hidden:!1};t.push(v),_.kind==="title"&&i.push(v)}}for(let p of e.draws.values())p instanceof Oi&&p.kind==="axes"&&!p.follows&&p.box===null?p.tips.forEach((y,m)=>{let g=a[m]??"",b=l.getComponent(m),_=g!==""&&b!==1?`${g} \xD7${Number(b.toPrecision(4))}`:g;i.push(u(_,y,4,e.cameraSpec.kind==="plane"&&Math.abs(y.clone().normalize().dot(o))>.99))}):p instanceof ds&&p.label!==null&&p.at!==null&&p.group.visible&&s.push(u(p.label,p.at,p.size/2+3,!1));let d=s.filter(p=>!p.hidden);for(let p of i)d.some(y=>LE(p,y))&&(p.hidden=!0);return t}labels(e){let t=this.panels.get(e);return t===void 0?[]:this.labelItems(t).filter(i=>!i.hidden).map(({hidden:i,...s})=>s)}colorbars(e){let t=this.panels.get(e),i=[];if(t===void 0)return i;for(let s of t.draws.values()){if(!(s instanceof us)||!s.group.visible)continue;let r=s.colorbar();r!==null&&i.push(r)}return l0(i)}placeLabels(e){let t=e.labels;if(t===null)return;let i=this.labelItems(e);for(;t.children.length<i.length;)t.appendChild(document.createElement("span"));for(;t.children.length>i.length;)t.lastChild.remove();i.forEach((s,r)=>{let a=t.children[r];a.textContent!==s.text&&(a.textContent=s.text),a.hidden=s.hidden;let o=s.align==="center"?"-50%":s.align==="end"?"-100%":"0";a.style.transformOrigin="0 0",a.style.fontSize=s.kind==="title"?"13px":"",a.style.transform=`translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)${s.rotate?" rotate(-90deg)":""} translate(${o}, -50%)`})}keyed(e,t,i){let s=e.cameraSpec;if(e.window=null,s.kind!=="plane"||s.keys===void 0||e.plan===null||e.userMoved||!(e.camera instanceof Ln))return;let r=this.ctx.scene,a={scope:e.plan.scope,frames:this.ctx.geometry.frames,clock:r.clock,channel:t.clock.channel,q:i,display:e.plan.display},o;try{o=Vh(a,e.plan.view,this.ctx.geometry.sets,e.plan.driver)}catch(b){if(!(b instanceof Qt))throw b;e.error=b.message;return}if(o===null){e.atWindow&&this.fit(e);return}e.window=o,e.atWindow=!0;let l=e.camera,{right:c,up:h,normal:u}=Fi(s),f=e.rect.w/Math.max(1,e.rect.h),d=o.width/2,p=o.height!==null?o.height/2:d/f,y=l.position.dot(u),m=c.clone().multiplyScalar(o.center[0]).addScaledVector(h,o.center[1]),g=m.clone().addScaledVector(u,e.target.dot(u));e.fitting=!0,e.halfWidth=d,e.halfHeight=p,l.left=-d,l.right=d,l.top=p,l.bottom=-p,l.zoom=1,l.position.copy(m).addScaledVector(u,y),l.up.copy(h),l.lookAt(g),l.updateProjectionMatrix(),e.target.copy(g),e.controls&&(e.controls.target.copy(g),e.controls.update()),e.fitting=!1}async ready(){let e=[];for(let t of this.panels.values())for(let i of t.draws.values())i instanceof ds&&e.push(i.ready);await Promise.all(e)}paintInfo(e){let t=this.panels.get(e);if(t===void 0||t.plan===null||t.error!==null)return null;let i=this.ctx.scene,s=$r(t.cameraSpec),r=c=>{let h=c.clone().multiply(s).project(t.camera);return h.z>-1&&h.z<1?[t.rect.x+(h.x+1)/2*t.rect.w,t.rect.y+(1-h.y)/2*t.rect.h]:null},a=[],o=null,l;for(let c of t.plan.layers){let h=t.draws.get(c.index);if(h instanceof lo){let u=h.layer.at,f,d=u!==null&&typeof u=="object"&&"screen"in u&&u.screen!==void 0;d?f=[t.rect.x+u.screen[0]*t.rect.w,t.rect.y+u.screen[1]*t.rect.h]:f=h.at===null?null:r(h.at),f!==null&&a.push({layer:h.layer,x:f[0],y:f[1],clip:!d})}else if(h instanceof Oi&&h.box!==null&&t.view!==null&&t.cameraSpec.kind==="plane"){let u=i.frames[t.plan.display],f=u?.axes??["","",""],[d,p]=Ks(t.cameraSpec),y=g=>f[g]&&u?.unit?`${f[g]} [${u.unit}]`:f[g]??"",m=h.box.ticks??["x","y"];o={rect:t.rect,x0:t.view.x0,x1:t.view.x1,y0:t.view.y0,y1:t.view.y1,ticks:{x:m.includes("x"),y:m.includes("y")},size:h.box.size??Kg,titles:[y(d),y(p)],opacity:h.box.opacity},l=h.box.titles}}return{outer:t.outer,rect:t.rect,opacity:t.plan.view.opacity,labels:a,box:o,...l!==void 0?{boxTitles:l}:{}}}dispose(){for(let e of[...this.panels.values()])this.disposePanel(e);this.refineTimer!==null&&clearTimeout(this.refineTimer),this.blit.material.dispose(),this.underlay?.dispose(),this.scratch?.dispose(),this.ctx.disc.dispose(),this.gl.dispose(),this.gl.forceContextLoss()}};function $E(n,e){if(e===void 0)return n;let t=Math.round((e.left??0)*n.w),i=Math.round((e.right??0)*n.w),s=Math.round((e.top??0)*n.h),r=Math.round((e.bottom??0)*n.h);return{x:n.x+t,y:n.y+s,w:Math.max(0,n.w-t-i),h:Math.max(0,n.h-s-r)}}function fo(n,e){if(n.kind==="panel")return n;let t=fo(n.a,e),i=fo(n.b,e),s=n.keys===void 0?n.ratio:Math.min(1,Math.max(0,Js(n.keys,e)));return t===n.a&&i===n.b&&s===n.ratio?n:{...n,ratio:s,a:t,b:i}}var Ge=n=>{let e=parseFloat(n);return Number.isFinite(e)?e:0};function T0(n){let e=[],t=0,i=0;for(let s=0;s<n.length;s++)n[s]==="("?t++:n[s]===")"?t--:n[s]===","&&t===0&&(e.push(n.slice(i,s).trim()),i=s+1);return e.push(n.slice(i).trim()),e.filter(s=>s!=="")}var A0=/^(rgba?\([^)]*\)|#[0-9a-f]+|[a-z]+)/i;function C0(n){return n==="none"||n===""?[]:T0(n).map(e=>{let t=A0.exec(e)?.[0]??"transparent",i=e.slice(t.length),s=[...i.matchAll(/-?[\d.]+px/g)].map(r=>Ge(r[0]));return{color:t,x:s[0]??0,y:s[1]??0,blur:s[2]??0,spread:s[3]??0,inset:/\binset\b/.test(i)}})}function XE(n){let e=/^linear-gradient\((.*)\)$/.exec(n.trim());if(e===null)return null;let t=T0(e[1]),i=[0,1],s={"to top":[0,-1],"to bottom":[0,1],"to left":[-1,0],"to right":[1,0]};if(s[t[0]]!==void 0)i=s[t.shift()];else if(/^-?[\d.]+deg$/.test(t[0])){let a=Ge(t.shift())*Math.PI/180;i=[Math.sin(a),-Math.cos(a)]}let r=t.map((a,o)=>{let l=A0.exec(a)?.[0]??"transparent",c=/(-?[\d.]+)%/.exec(a.slice(l.length));return[c===null?t.length===1?0:o/(t.length-1):Math.min(1,Math.max(0,Ge(c[1])/100)),l]});return{dir:i,stops:r}}var xh=n=>n==="transparent"||n===""||/rgba\([^)]*,\s*0\)$/.test(n);function R0(n,e,t){let i=n.getTransform(),s=1e5;n.save(),n.shadowColor=e.color,n.shadowBlur=e.blur*Math.hypot(i.a,i.b),n.shadowOffsetX=-s*i.a+(e.x*i.a+e.y*i.c),n.shadowOffsetY=-s*i.b+(e.x*i.b+e.y*i.d),n.fillStyle="#000",t(s),n.restore()}function qE(n,e,t,i,s,r){let a=r.borderTopStyle==="none"?0:Ge(r.borderTopWidth),o=r.borderRightStyle==="none"?0:Ge(r.borderRightWidth),l=r.borderBottomStyle==="none"?0:Ge(r.borderBottomWidth),c=r.borderLeftStyle==="none"?0:Ge(r.borderLeftWidth),h=[[a,r.borderTopColor,[e,t,e+i,t,e+i-o,t+a,e+c,t+a]],[o,r.borderRightColor,[e+i,t,e+i,t+s,e+i-o,t+s-l,e+i-o,t+a]],[l,r.borderBottomColor,[e+i,t+s,e,t+s,e+c,t+s-l,e+i-o,t+s-l]],[c,r.borderLeftColor,[e,t+s,e,t,e+c,t+a,e+c,t+s-l]]];for(let[u,f,d]of h)if(!(u<=0||xh(f))){n.fillStyle=f,n.beginPath(),n.moveTo(d[0],d[1]);for(let p=2;p<8;p+=2)n.lineTo(d[p],d[p+1]);n.closePath(),n.fill()}}function P0(n,e,t,i,s,r){for(let o of C0(r.boxShadow).reverse())o.inset||xh(o.color)||(o.blur===0?(n.fillStyle=o.color,n.fillRect(e+o.x-o.spread,t+o.y-o.spread,i+2*o.spread,s+2*o.spread)):R0(n,o,l=>n.fillRect(e-o.spread+l,t-o.spread,i+2*o.spread,s+2*o.spread)));xh(r.backgroundColor)||(n.fillStyle=r.backgroundColor,n.fillRect(e,t,i,s));let a=XE(r.backgroundImage);if(a!==null){let[o,l]=a.dir,c=(Math.abs(i*o)+Math.abs(s*l))/2,h=e+i/2,u=t+s/2,f=n.createLinearGradient(h-o*c,u-l*c,h+o*c,u+l*c);for(let[d,p]of a.stops)f.addColorStop(d,p);n.fillStyle=f,n.fillRect(e,t,i,s)}qE(n,e,t,i,s,r)}var L0=n=>n!=="none"&&n!==""&&!/^matrix\(1, 0, 0, 1, [^,]+, [^,]+\)$/.test(n),YE=n=>`${n.fontStyle} ${n.fontWeight} ${n.fontSize} ${n.fontFamily}`;function vh(n,e,t,i,s){i=JE(n,i),n.font=YE(s),n.textAlign="left",n.textBaseline="alphabetic",n.letterSpacing=s.letterSpacing==="normal"?"0px":s.letterSpacing;for(let r of C0(s.textShadow).reverse())xh(r.color)||R0(n,r,a=>n.fillText(e,t+a,i));n.fillStyle=s.color,n.fillText(e,t,i)}function jE(n,e){let t=n.getTransform(),i=Math.hypot(t.a,t.b)||1;n.font=`${e.fontStyle} ${e.fontWeight} ${Ge(e.fontSize)*i}px ${e.fontFamily}`;let s=n.measureText("Hg");return[Math.round(s.fontBoundingBoxAscent)/i,Math.round(s.fontBoundingBoxDescent)/i]}function I0(n,e,t,i,s){let r=n.getTransform();if(r.b!==0||r.c!==0||r.a===0||r.d===0)return[e,t,i,s];let a=l=>(Math.round(l*r.a+r.e)-r.e)/r.a,o=l=>(Math.round(l*r.d+r.f)-r.f)/r.d;return[a(e),o(t),a(e+i)-a(e),o(t+s)-o(t)]}function JE(n,e){let t=n.getTransform();return t.b!==0||t.c!==0||t.d===0?e:(Math.round(e*t.d+t.f)-t.f)/t.d}function k0(n,e){let t=e.getBoundingClientRect(),i=e.offsetWidth||t.width,s={x:t.left,y:t.top,scale:i>0?t.width/i:1,baselines:new Map},r=new Map;D0(e,r);try{for(let[a,o]of r)s.baselines.set(a,Xr(s,o.getBoundingClientRect()).y);N0(n,e,s,null)}finally{for(let a of r.values())a.remove()}}function D0(n,e){if(!n.checkVisibility())return;let t=getComputedStyle(n);if(L0(t.transform))return;let i=/flex|grid/.test(t.display);for(let s of[...(n.shadowRoot??n).childNodes])if(s.nodeType===Node.TEXT_NODE&&!i&&s.data.trim()!==""){let r=document.createElement("tycho-probe");r.style.cssText="display: inline-block; width: 0; height: 0; margin: 0; padding: 0; border: 0; vertical-align: baseline;",s.parentNode.insertBefore(r,s),e.set(s,r)}else s instanceof HTMLElement&&!(s instanceof HTMLStyleElement)&&!(s instanceof HTMLScriptElement)&&D0(s,e)}function Xr(n,e){return{x:(e.left-n.x)/n.scale,y:(e.top-n.y)/n.scale,w:e.width/n.scale,h:e.height/n.scale}}function N0(n,e,t,i){if(!e.checkVisibility())return;let s=getComputedStyle(e),r=L0(s.transform),a,o,l,c;if(n.save(),i===null&&!r)({x:a,y:o,w:l,h:c}=Xr(t,e.getBoundingClientRect()));else{if(l=e.offsetWidth,c=e.offsetHeight,i!==null)[a,o]=[i.x+e.offsetLeft,i.y+e.offsetTop];else{let u=e.offsetParent,f=u===null?{x:0,y:0}:Xr(t,u.getBoundingClientRect()),d=u===null?null:getComputedStyle(u);a=f.x+e.offsetLeft+(d===null?0:Ge(d.borderLeftWidth)),o=f.y+e.offsetTop+(d===null?0:Ge(d.borderTopWidth))}if(r){let[u,f]=s.transformOrigin.split(" ").map(Ge),d=new DOMMatrix(s.transform);n.translate(a+u,o+f),n.transform(d.a,d.b,d.c,d.d,d.e,d.f),n.translate(-u,-f),[a,o]=[0,0]}}let h=r||i!==null;if(n.globalAlpha*=Ge(s.opacity),r||([a,o,l,c]=I0(n,a,o,l,c)),e instanceof HTMLCanvasElement?e.width>0&&e.height>0&&n.drawImage(e,a,o,l,c):P0(n,a,o,l,c,s),s.overflowX!=="visible"||s.overflowY!=="visible"){let u=Ge(s.borderLeftWidth),f=Ge(s.borderTopWidth);n.beginPath(),n.rect(a+u,o+f,l-u-Ge(s.borderRightWidth),c-f-Ge(s.borderBottomWidth)),n.clip()}E0(n,e,"::before",a,o,l,c,s);for(let u of(e.shadowRoot??e).childNodes)u.nodeType===Node.TEXT_NODE?KE(n,u,t,s,h?{x:a,y:o}:null):u instanceof HTMLElement&&!(u instanceof HTMLStyleElement)&&!(u instanceof HTMLScriptElement)&&N0(n,u,t,h?u.offsetParent===e?{x:a,y:o}:i:null);E0(n,e,"::after",a,o,l,c,s),n.restore()}function KE(n,e,t,i,s){let r=e.data;if(r.trim()==="")return;let[a,o]=jE(n,i);if(s!==null){let g=i.lineHeight==="normal"?a+o:Ge(i.lineHeight);vh(n,r,s.x+Ge(i.paddingLeft)+Ge(i.borderLeftWidth),s.y+Ge(i.paddingTop)+Ge(i.borderTopWidth)+(g-a-o)/2+a,i);return}let l=document.createRange();l.selectNodeContents(e);let c=l.getClientRects()[0];if(c===void 0)return;let h=Xr(t,c).y,u=t.baselines.get(e),f=g=>u===void 0?g+a:u+g-h,d=(g,b)=>{l.setStart(e,g),l.setEnd(e,b);let _=l.getClientRects()[0];return _===void 0?null:Xr(t,_)};if(/tabular-nums/.test(i.fontVariantNumeric)){for(let g=0;g<r.length;g++){let b=/\s/.test(r[g])?null:d(g,g+1);b!==null&&vh(n,r[g],b.x,f(b.y),i)}return}l.selectNodeContents(e);let p=[...l.getClientRects()],y=r.split(`
`);if(p.length===y.length){p.forEach((g,b)=>{let _=Xr(t,g);vh(n,y[b],_.x,f(_.y),i)});return}let m=0;for(let g of r.split(/(\s+)/)){let b=g.trim()===""?null:d(m,m+g.length);b!==null&&vh(n,g,b.x,f(b.y),i),m+=g.length}}function E0(n,e,t,i,s,r,a,o){let l=getComputedStyle(e,t);if(l.content==="none"||l.content==="normal"||l.display==="none"||l.position!=="absolute")return;let c=i+Ge(o.borderLeftWidth),h=s+Ge(o.borderTopWidth),u=r-Ge(o.borderLeftWidth)-Ge(o.borderRightWidth),f=a-Ge(o.borderTopWidth)-Ge(o.borderBottomWidth),d=Ge(l.borderLeftWidth)+Ge(l.borderRightWidth)+Ge(l.paddingLeft)+Ge(l.paddingRight),p=Ge(l.borderTopWidth)+Ge(l.borderBottomWidth)+Ge(l.paddingTop)+Ge(l.paddingBottom),y=w=>w==="auto"||w==="",m=(w,E,x,A,I)=>{let R=y(x)?y(w)||y(E)?0:A-Ge(w)-Ge(E)-I:Ge(x);l.boxSizing==="border-box"&&!y(x)&&(R-=I);let D=R+I;return[y(w)?y(E)?0:A-Ge(E)-D:Ge(w),D]},[g,b]=m(l.left,l.right,l.width,u,d),[_,v]=m(l.top,l.bottom,l.height,f,p);n.save(),n.globalAlpha*=Ge(l.opacity),P0(n,...I0(n,c+g,h+_,b,v),l),n.restore()}function Sh(){return Object.create(null)}function _h(n,e,t){let i=Sh();for(let[s,r]of Object.entries(n??{}))s!==e&&r!==void 0&&(i[s]=r);return t!==void 0&&(i[e]=t),i}var ZE=(n,e)=>(n%e+e)%e,mo=class{snap;index=0;play=!1;steps;listeners=new Set;constructor(e,t){this.snap=e,this.steps=t}get state(){return this.snap}get frame(){return this.index}get playing(){return this.play}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}emit(e){for(let t of[...this.listeners])t(e)}set(e){e!==this.snap&&(this.snap=e,this.emit("state"))}update(e){this.set(e(this.snap))}setFrame(e){if(!Number.isInteger(e))return;let t=ZE(e,this.steps);t!==this.index&&(this.index=t,this.emit("frame"))}setPlaying(e){e!==this.play&&(this.play=e,this.emit("playing"))}};function fs(n,e,t,i,s){let r=at(n,t);if(r===void 0||!Eo(r,i))return e;if(r.scope==="panel"){if(s===void 0||!Object.hasOwn(e.panels,s))return e;let a=e.panels[s];return a.variables!==void 0&&Object.hasOwn(a.variables,t)&&a.variables[t]===i?e:uf(e,s,{...a,variables:_h(a.variables,t,i)})}return e.variables!==void 0&&Object.hasOwn(e.variables,t)&&e.variables[t]===i?e:{...e,variables:_h(e.variables,t,i)}}function F0(n,e){return n.clock.channel===e?n:{...n,clock:{channel:e}}}function uf(n,e,t){return{...n,panels:_h(n.panels,e,t)}}function po(n,e){return{...n,layout:e}}function U0(n,e){if(!Object.hasOwn(n.panels,e)||Object.keys(n.panels).length<2)return n;let t=_a(n.layout,e);return t===null?n:{...n,panels:_h(n.panels,e,void 0),layout:t}}function QE(n){for(let e=Object.keys(n.panels).length+1;;e++){let t=`p${e}`;if(!Object.hasOwn(n.panels,t))return t}}function df(n,e,t){return n.kind==="panel"?n.id===e?{kind:"panel",id:t}:n.id===t?{kind:"panel",id:e}:n:{...n,a:df(n.a,e,t),b:df(n.b,e,t)}}function wh(n,e,t,i,s,r=1/0){if(!Object.hasOwn(e.panels,t))return e;let a=e.panels[t];if(s.kind==="panel"){if(s.id===t||!Object.hasOwn(e.panels,s.id))return e;if(i==="centre")return po(e,df(e.layout,s.id,t));let h=_a(e.layout,s.id);return h===null?e:po(e,xa(h,t,s.id,i))}if(i==="centre")return s.kind==="view"?Object.hasOwn(n.views,s.view)?uf(e,t,{...a,view:s.view}):e:fs(n,e,s.variable,s.value,t);if(Object.keys(e.panels).length>=r)return e;let o=QE(e),l={view:a.view,variables:Object.assign(Sh(),a.variables)};if(s.kind==="view"){if(!Object.hasOwn(n.views,s.view))return e;l.view=s.view}let c=po(uf(e,o,l),xa(e.layout,t,o,i));return s.kind==="value"?fs(n,c,s.variable,s.value,o):c}function pf(n,e,t,i,s){if(Object.keys(e.panels).length>=i)return e;let r=ul(e.layout).reduce((a,o)=>o.area>a.area?o:a);return wh(n,e,r.id,s(r.id)?"bottom":"right",t,i)}function B0(n,e,t){let i=Object.keys(n.panels).length>=t,s=hl(n.layout),r=s.map(e),a=[{label:"Add panel",placement:{kind:"add"},disabled:i,group:!1}];return s.forEach((o,l)=>{let h=r.filter(u=>u===r[l]).length>1?`${r[l]} (${r.slice(0,l+1).filter(u=>u===r[l]).length})`:r[l];a.push({label:`Split ${h} right`,placement:{kind:"drop",target:o,zone:"right"},disabled:i,group:!0},{label:`Split ${h} below`,placement:{kind:"drop",target:o,zone:"bottom"},disabled:i,group:!1},{label:`Replace ${h}`,placement:{kind:"drop",target:o,zone:"centre"},disabled:!1,group:!1})}),a}function z0(n,e,t,i,s,r){return t.kind==="add"?pf(n,e,i,s,r):wh(n,e,t.target,t.zone,i,s)}function eT(n){let e=new TextEncoder().encode(n),t=2166136261;for(let i of e)t^=i,t=Math.imul(t,16777619)>>>0;return t.toString(16).padStart(8,"0")}function Mh(n){return`tycho:state:${eT(n)}:${n.length}`}var qr=n=>n!==null&&typeof n=="object"&&!Array.isArray(n);function O0(n,e,t){let i=Sh();if(!qr(e))return i;for(let[s,r]of Object.entries(e)){let a=at(n,s);a===void 0||a.scope==="panel"!=(t==="panel")||!Eo(a,r)||(i[s]=r)}return i}function tT(n){if(n!==void 0)try{return li(n,"a split",_o).map(e=>[...e])}catch{return}}function ff(n,e,t){if(!qr(n))return;if(n.kind==="panel")return typeof n.id!="string"?void 0:!e(n.id)||t.has(n.id)?null:(t.add(n.id),{kind:"panel",id:n.id});if(n.kind!=="split"||n.dir!=="row"&&n.dir!=="col")return;let i=ff(n.a,e,t),s=ff(n.b,e,t);if(i===void 0||s===void 0)return;if(i===null)return s;if(s===null)return i;let r=n.ratio,a=typeof r=="number"&&r>0&&r<1?r:.5,o={kind:"split",dir:n.dir,ratio:a,a:i,b:s},l=tT(n.keys);return l!==void 0&&(o.keys=l),o}function H0(n,e){let t=()=>structuredClone(n.initial);if(!qr(e)||!qr(e.clock)||!qr(e.panels))return t();let i=e.clock.channel;if(typeof i!="string"||!n.clock.channels.includes(i))return t();let s=Sh();for(let[c,h]of Object.entries(e.panels))!xo.test(c)||!qr(h)||typeof h.view!="string"||!Object.hasOwn(n.views,h.view)||(s[c]={view:h.view,variables:O0(n,h.variables,"panel")});let r=ff(e.layout,c=>Object.hasOwn(s,c),new Set);if(r==null)return t();let a=new Set,o=c=>c.kind==="panel"?void a.add(c.id):(o(c.a),o(c.b));o(r);for(let c of Object.keys(s))a.has(c)||delete s[c];if(Object.keys(s).length===0)return t();let l={variables:O0(n,e.variables,"scene"),clock:{channel:i},panels:s,layout:r};try{Zs(n,l)}catch{return t()}return l}var Eh=8,nT=[.25,.5,1,2,4],iT=`
:host { display: block; position: relative; background: var(--bg); color: var(--fg);
  font-family: inherit; font-size: 13px; font-style: normal; font-weight: 400; line-height: 1.4; letter-spacing: normal;
  text-align: left; text-transform: none; overflow: hidden; min-height: 240px; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }
button, select, input { font: inherit; color: inherit; margin: 0; }
.root { position: absolute; inset: 0; display: grid; grid-template-rows: auto 1fr auto auto; }
.root.kiosk { grid-template-rows: 1fr; }
.root.kiosk header, .root.kiosk .stats, .root.kiosk footer, .root.kiosk .phead { display: none; }
.root.picture { grid-template-rows: 1fr auto; }
.root.picture header, .root.picture footer, .root.picture .phead { display: none; }
.root.lean:not(.keep-panels) .add, .root.lean:not(.keep-panels) .phead .icon, .root.lean .frame, .root.lean .fps, .root.lean .cap.view, .root.lean .cap.export { display: none; }
.root.dragging, .root.dragging * { cursor: grabbing !important; }

header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; padding: 10px 14px 8px; }
header h1 { font-size: 17px; font-weight: 600; margin: 0; letter-spacing: 0.01em; }
.vars { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
.vars:empty { display: none; }
.add { display: flex; align-items: center; min-width: 0; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.k { color: var(--dim); font-size: 12px; }
.chips > .k { margin-right: 2px; }
.field { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.field output { font-size: 12px; font-variant-numeric: lining-nums tabular-nums; min-width: 7ch; color: var(--fg); }

.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--surface); }
.seg button { background: none; color: var(--dim); border: 0; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
.seg button + button { border-left: 1px solid var(--line); }
.seg button:hover { background: var(--raised); color: var(--fg); }
.seg button[aria-pressed="true"] { background: var(--accent-tint); color: var(--fg); box-shadow: inset 0 -2px var(--accent); }
.seg button:focus-visible { outline-offset: -2px; }
.mini .seg button { padding: 1px 7px; font-size: 11px; }
.icon { width: 28px; height: 28px; flex: none; display: inline-grid; place-items: center; padding: 0; border: 0; border-radius: 6px;
  background: none; color: var(--dim); cursor: pointer; }
.icon:hover { background: var(--raised); color: var(--fg); }
.icon svg { width: 16px; height: 16px; }
.icon.play { color: var(--fg); }
.icon.play.on { color: var(--accent); }
.btn { display: inline-flex; align-items: center; gap: 6px; background: var(--surface); color: var(--fg); border: 1px solid var(--line);
  border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.btn:hover { background: var(--raised); }
.btn svg { width: 14px; height: 14px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #000; }
.btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn.primary:active { background: var(--accent-press); border-color: var(--accent-press); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn[aria-expanded="true"] .chev { transform: rotate(180deg); color: var(--accent-2); }
select { background: var(--surface); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; cursor: pointer; }
select option { background: var(--raised); color: var(--fg); }
input[type=checkbox] { accent-color: var(--accent); }

input[type=range] { -webkit-appearance: none; appearance: none; background: none; width: 200px; height: 18px; cursor: pointer; --p: 0%; }
input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px;
  background: linear-gradient(to right, var(--accent) var(--p), var(--track) var(--p)); }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; margin-top: -5px;
  border: 0; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px var(--bg); }
input[type=range]:hover::-webkit-slider-thumb { background: var(--accent-hover); }
input[type=range]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--track); }
input[type=range]::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--accent); }
input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px var(--bg); }
input[type=range]:disabled { opacity: 0.4; cursor: default; }
.mini input[type=range] { width: 90px; }

.chip { display: inline-flex; align-items: stretch; border: 1px solid var(--line); border-radius: 6px; background: var(--surface);
  color: var(--fg); user-select: none; -webkit-user-select: none; white-space: nowrap; }
.chip .body { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px 3px 4px; cursor: grab; touch-action: none; border-radius: 5px; }
.chip .body:not(:last-child) { border-radius: 5px 0 0 5px; }
.chip .body:hover, .chip .caret:hover { background: var(--raised); }
.chip .body:focus-visible { outline-offset: -2px; }
.chip .grip { width: 14px; height: 14px; flex: none; color: var(--dim); }
.chip .caret { position: relative; display: inline-grid; place-items: center; min-width: 24px; padding: 0 4px; border: 0;
  border-left: 1px solid var(--line); border-radius: 0 5px 5px 0; background: none; color: var(--dim); cursor: pointer; }
.chip .caret svg { width: 14px; height: 14px; transition: transform 0.15s; }
.chip .caret[aria-expanded="true"] { color: var(--accent-2); }
.chip .caret[aria-expanded="true"] svg { transform: rotate(180deg); }
.chip .caret select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }
.chip .caret:has(select:focus-visible) { outline: 2px solid var(--accent-2); outline-offset: 2px; color: var(--accent-2); }
.chip.source { opacity: 0.4; }
.ghost { position: fixed; left: 0; top: 0; z-index: 30; pointer-events: none; transform: translate(12px, 12px);
  border-color: var(--accent-2); background: var(--raised); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); }
.ghost .grip { visibility: visible !important; }

.menu { position: fixed; z-index: 40; min-width: 180px; max-height: 70vh; overflow: auto; display: flex; flex-direction: column; padding: 4px;
  background: var(--raised); border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55); }
.menu button { text-align: left; background: none; border: 0; border-radius: 4px; padding: 5px 10px; color: var(--fg); cursor: pointer; white-space: nowrap; }
.menu button:hover:not(:disabled) { background: var(--accent-tint); }
.menu button:focus-visible { outline-offset: -2px; }
.menu button:disabled { color: var(--dim); cursor: default; }
.menu hr { border: 0; border-top: 1px solid var(--line); margin: 4px 2px; }

.stage { position: relative; min-height: 120px; overflow: hidden; background: var(--gutter); }
.stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.stage canvas.paint { pointer-events: none; }
.panels { position: absolute; inset: 0; }
.panel { position: absolute; overflow: hidden; }
.pbody { position: absolute; inset: 0; }
.phead { position: absolute; top: 0; left: 0; right: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px;
  padding: 3px 3px 3px 6px; background: var(--head); cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none;
  font-size: 12px; white-space: nowrap; min-width: 0; }
.phead .t { font-weight: 600; flex: 0 1 auto; min-width: 2em; overflow: hidden; text-overflow: ellipsis; }
.phead .m { color: var(--dim); flex: 0 10 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.phead .pc { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; flex: 0 1 auto; min-width: 0; }
.phead select { padding: 0 4px; font-size: 11px; }
.phead .sp { flex: 1 0 0; }
.phead .icon { width: 24px; height: 24px; }
.phead .chip { min-width: 0; }
.phead .chip .body { padding: 1px 6px 1px 2px; min-width: 0; }
.phead .chip .lbl { overflow: hidden; text-overflow: ellipsis; }
.phead .chip .grip { visibility: hidden; }
.phead .chip:is(:hover, :focus-within) .grip { visibility: visible; }
.labels, .preadout, .perror, .drop, .cbars { pointer-events: none; }
.labels { position: absolute; inset: 0; z-index: 1; overflow: hidden; }
.labels span { position: absolute; left: 0; top: 0; white-space: nowrap; color: var(--fg); font-size: 12px; text-shadow: 0 0 3px var(--bg), 0 0 3px var(--bg); }
.cbars { position: absolute; right: 10px; top: 40px; z-index: 1; display: flex; gap: 12px; }
.cbar { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; font-size: 11px; color: var(--dim); }
.cbar-t { max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbar-b { display: flex; gap: 5px; height: 120px; }
.cbar-g { position: relative; width: 8px; border: 1px solid var(--line); }
.cbar-g.live { width: 12px; pointer-events: auto; cursor: ns-resize; touch-action: none; }
.cbar-g.live:hover { border-color: var(--dim); }
.cbar-k { position: absolute; left: -3px; right: -3px; background: var(--fg); opacity: 0.18; }
.cbar-g i { position: absolute; left: -9px; right: 0; bottom: 0; height: 0; }
.cbar-g i::before { content: ""; position: absolute; left: 0; top: -4px; border: 4px solid transparent; border-left: 6px solid var(--highlight); border-right: 0; }
.cbar-g.live i::after { content: ""; position: absolute; left: 9px; right: 0; top: -1px; height: 2px; background: var(--highlight); box-shadow: 0 0 0 1px var(--bg); }
.cbar-n { display: flex; flex-direction: column; justify-content: space-between; font-variant-numeric: tabular-nums; }
.preadout { position: absolute; left: 8px; bottom: 6px; z-index: 1; display: flex; flex-direction: column; gap: 6px;
  text-shadow: 0 0 3px var(--bg), 0 0 3px var(--bg); }
.perror { position: absolute; inset: 34px 12px auto 12px; z-index: 1; color: var(--error); white-space: pre-wrap; }
.drop { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; background: var(--accent-2-tint); border: 2px solid var(--accent-2); }
.pbody .follow { position: absolute; right: 8px; bottom: 8px; z-index: 2; padding: 3px 10px 3px 8px; font: inherit; font-size: 12px; cursor: pointer; }
.pbody .follow[hidden] { display: none; }
.drop span { font-size: 11px; color: var(--fg); background: var(--raised); border-radius: 4px; padding: 1px 6px; }
.gutter { position: absolute; z-index: 2; touch-action: none; background: var(--gutter); }
.gutter.row { cursor: col-resize; }
.gutter.col { cursor: row-resize; }
.gutter:hover, .gutter.active { background: var(--accent-tint); }

.stats { display: flex; flex-direction: column; gap: 4px; padding: 8px 14px 0; }
.stats:empty { display: none; }
.readout dl { display: flex; flex-wrap: wrap; margin: 0; }
.wide dl > div { padding: 0 16px; border-left: 1px solid var(--line); }
.wide dl > div:first-child { border-left: 0; padding-left: 0; }
.stack dl { flex-direction: column; gap: 2px; }
.readout dt { font-size: 11px; color: var(--dim); }
.readout dd { margin: 0; white-space: nowrap; }
.readout b { display: inline-block; font-size: 15px; font-weight: 500; line-height: 1.25; font-variant-numeric: lining-nums tabular-nums; }
.stack b { font-size: 13px; }
.readout .u { color: var(--dim); font-size: 12px; margin-left: 0.35em; }
.readout .line { white-space: pre-wrap; font-variant-numeric: tabular-nums; }

footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 14px 10px; }
.cap { display: flex; align-items: center; gap: 4px; padding: 3px; min-height: 36px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.cap.playback { flex: 1 1 520px; flex-wrap: wrap; }
.cap .scrub { flex: 1 1 160px; min-width: 100px; width: auto; margin: 0 6px; }
.cap select { background: none; border-color: transparent; }
.cap select:hover { background: var(--raised); }
.frame, .fps { color: var(--dim); font-size: 12px; font-variant-numeric: lining-nums tabular-nums; white-space: nowrap; text-align: right; }
/* the rate reserves three digits as content, so that the dashes, 9 fps, and 120 fps take one width */
.fps { box-sizing: content-box; min-width: 7ch; padding: 0 6px 0 4px; }
.speed { font-variant-numeric: tabular-nums; }
.why { color: var(--dim); }
.disclose { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border: 0; border-radius: 6px;
  background: none; color: var(--fg); cursor: pointer; overflow: hidden; }
.disclose:hover { background: var(--raised); }
.disclose svg { width: 16px; height: 16px; }
.disclose .chev { width: 14px; height: 14px; color: var(--dim); transition: transform 0.15s; }
.disclose[aria-expanded="true"] { background: var(--accent-tint); box-shadow: inset 0 -2px var(--accent); }
.disclose[aria-expanded="true"] .chev { transform: rotate(180deg); }
.disclose:disabled { color: var(--dim); cursor: default; background: none; }
.disclose .xprog { position: absolute; left: 0; top: 0; height: 2px; width: 0; background: var(--accent); }
.exportbar { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 4px 4px 4px 8px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.exportbar .info { flex: 1 1 12em; color: var(--dim); font-variant-numeric: tabular-nums; }
.exportbar progress { width: 160px; accent-color: var(--accent); }
.status { position: absolute; inset: 0; display: grid; place-items: center; padding: 20px; color: var(--dim); white-space: pre-wrap; z-index: 5; }
.status.error { color: var(--error); }
`;function re(n,e,t){let i=document.createElement(n);return e!==void 0&&(i.className=e),t!==void 0&&(i.textContent=t),i}function ri(n,e){n.textContent!==e&&(n.textContent=e)}var ai=n=>n.stopPropagation();function Yr(n,e,t,i="icon"){let s=re("button",i);return s.type="button",s.setAttribute("aria-label",e),s.title=t,s.appendChild(jn(n)),s.addEventListener("pointerdown",ai),s}function mf(n,e){let t=re("div",e===void 0?"cap":`cap ${e}`);return t.setAttribute("role","group"),t.setAttribute("aria-label",n),t}function V0(n,e,t){let i=re("div","seg");i.setAttribute("role","group"),t!==void 0&&i.setAttribute("aria-label",t);let s=new Map;for(let r of n){let a=re("button",void 0,r.label);a.type="button",a.setAttribute("aria-pressed","false"),a.addEventListener("pointerdown",ai),a.addEventListener("click",()=>e(r.id)),s.set(r.id,a),i.appendChild(a)}return{el:i,set(r){for(let[a,o]of s)o.setAttribute("aria-pressed",String(a===r))}}}function gf(n,e){n.value=String(e);let t=Number(n.max)-Number(n.min);n.style.setProperty("--p",`${t>0?100*(Number(n.value)-Number(n.min))/t:0}%`)}function G0(n,e){let t=re("div","chip"),i=re("span","body"),s=re("span","lbl",n);i.append(jn("grip","grip"),s),t.appendChild(i);let r=null,a=null;if(e==="menu")r=re("button","caret"),r.type="button",r.setAttribute("aria-haspopup","menu"),r.setAttribute("aria-expanded","false"),r.setAttribute("aria-label",`${n}: placement`),r.title="Add, split, or replace a panel",r.appendChild(jn("chevronDown")),r.addEventListener("pointerdown",ai),t.appendChild(r);else if(e==="select"){let o=re("span","caret");a=re("select"),o.append(jn("chevronDown"),a),o.addEventListener("pointerdown",ai),t.appendChild(o)}return{root:t,body:i,label:s,button:r,select:a}}function W0(n,e){let t=Fp(n),i=re("div",`readout ${e}`),s=re("div","line"),r=null,a=[];if(t!==null){r=re("dl");for(let o of t){let l=re("div"),c=re("dd"),h=re("b");o.width!==null&&(h.style.minWidth=`${o.width}ch`),c.appendChild(h),o.unit!==""&&c.appendChild(re("span","u",o.unit)),l.append(re("dt",void 0,o.label),c),r.appendChild(l),a.push(h)}i.appendChild(r),s.hidden=!0}return i.appendChild(s),{parts:n,tiles:t,root:i,list:r,values:a,line:s}}function $0(n,e){let t=Array.isArray(e);if(t&&n.tiles!==null&&n.list!==null&&e.length>0){n.list.hidden=!1,n.line.hidden=!0,n.tiles.forEach((i,s)=>ri(n.values[s],e[i.part]??""));return}n.list!==null&&(n.list.hidden=!0),n.line.hidden=!1,ri(n.line,t?e.join(""):e.error)}function sT(n,e){let t=n.kind==="panel";if(e==="centre")return t?"swap":"replace";let i={left:"left",right:"right",top:"above",bottom:"below"}[e];return`${t?"move":"split"} ${i}`}function rT(){return typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}var aT=typeof HTMLElement>"u"?class{}:HTMLElement,go=class extends aT{static observedAttributes=["theme"];scene=null;sceneText="";geometry=null;store=null;renderer=null;theme=null;kiosk=!1;twin=null;lean=!1;keepPanels=!1;loading=!1;loads=0;choice=null;root;header;titleEl;varsEl;addEl;stage;panelsEl;statusEl;statsEl;footer;canvas=null;paintCanvas=null;get heldProgress(){return this.heldValue!==null&&this.store!==null&&this.store.frame===this.heldFrame?this.heldValue:null}set heldProgress(e){this.heldValue=e,e!==null&&this.scene!==null&&(this.heldFrame=Math.min(this.scene.clock.steps-1,Math.floor(e*this.scene.clock.steps)))}heldValue=null;heldFrame=-1;stopAt=null;panelDom=new Map;gutterDom=new Map;gutters=[];sceneWidgets=[];captions=[];addChips=[];addButton=null;addGroup=null;transport=null;menu=null;closeExport=null;raf=0;intersecting=!0;shown=!1;viewObserver=null;onVisibility=()=>this.syncShown();dirty=!0;anchor={index:0,time:0};playProgress=null;speed=1;meter=new sl;stageSize={w:0,h:0};saveTimer=0;resizeObserver=null;onPageHide=()=>this.flushSave();unsubscribe=null;lastPanels=null;lastLayout=null;refreshExport=null;connectedCallback(){if(this.twin===null){if(this.shadowRoot===null&&this.buildShell(),this.scene!==null){this.applyTheme(),this.start();return}this.loading||(this.loading=!0,document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{this.loadFromSources()},{once:!0}):this.loadFromSources())}}disconnectedCallback(){this.stop()}attributeChangedCallback(){this.applyTheme()}buildShell(){this.kiosk=this.hasAttribute("kiosk")||this.twin==="kiosk",this.lean=this.hasAttribute("lean"),this.keepPanels=this.lean&&(this.getAttribute("lean")??"").split(/\s+/).includes("panels");let e=this.attachShadow({mode:"open"}),t=re("style");t.textContent=iT,e.appendChild(t),this.root=re("div",`root${this.kiosk?" kiosk":""}${this.twin==="picture"?" picture":""}${this.lean?" lean":""}${this.keepPanels?" keep-panels":""}`),this.header=re("header"),this.titleEl=re("h1"),this.varsEl=re("div","vars"),this.varsEl.setAttribute("role","group"),this.varsEl.setAttribute("aria-label","Scene"),this.addEl=re("div","add"),this.addEl.setAttribute("role","group"),this.addEl.setAttribute("aria-label","Add panel"),this.header.append(this.titleEl,this.varsEl,this.addEl),this.stage=re("div","stage"),this.panelsEl=re("div","panels"),this.statusEl=re("div","status","loading\u2026"),this.stage.append(this.panelsEl,this.statusEl),this.statsEl=re("div","stats"),this.footer=re("footer"),this.root.append(this.header,this.stage,this.statsEl,this.footer),e.appendChild(this.root),this.hasAttribute("tabindex")||(this.tabIndex=0),this.addEventListener("keydown",i=>this.onKey(i))}fail(e){this.statusEl.hidden=!1,this.statusEl.className="status error",this.statusEl.textContent=e}select(e){let t=this.getRootNode();try{return t.querySelector?.(e)??document.querySelector(e)}catch{return null}}source(e){for(let s of this.children)if(s.tagName==="SCRIPT"&&s.getAttribute("data-tycho")===e)return s;let t=this.getAttribute(e);if(!t)return this.select(`#tycho-${e}`);let i=this.select(t);if(i===null&&t.startsWith("#"))throw new Error(`the ${e} selector ${t} does not match an element`);return i??t}async read(e){if(typeof e!="string")return vo(e.textContent??"",e.getAttribute("data-encoding")??"base64");let t=await fetch(e);if(!t.ok)throw new Error(`${e} answered ${t.status}`);return new Uint8Array(await t.arrayBuffer())}async loadFromSources(){try{let e=this.source("scene"),t=this.source("data");if(e===null&&t===null){this.loading=!1;return}if(e===null||t===null)throw new Error(`the ${e===null?"scene":"data"} is missing`);let[i,s]=await Promise.all([this.read(e),this.read(t)]);if(this.loads>0)return;await this.load(new TextDecoder("utf-8").decode(i),s)}catch(e){this.fail(`the scene did not load: ${e.message}`)}}async load(e,t){this.shadowRoot===null&&this.buildShell();let i=++this.loads,s,r;try{if(s=JSON.parse(e),r=await Ys.parse(t),i!==this.loads)return;for(let a of zo(s,r))console.warn(`TyCHO: ${a}`)}catch(a){if(i!==this.loads)return;this.stop(),this.fail(a instanceof Qt?a.message:`the scene cannot be read: ${a.message}`);return}this.stop(),this.scene=s,this.sceneText=e,this.geometry=new el(s,r),this.store=new mo(this.recall(),s.clock.steps),this.choice=this.templateChoice(),this.statusEl.hidden=!0,this.applyTheme(),this.titleEl.textContent=s.title??"",this.buildTopBar(),this.buildFooter(),this.start(),(this.kiosk||this.hasAttribute("autoplay"))&&!rT()&&this.play()}start(){if(!(this.scene===null||this.store===null||this.renderer!==null||!this.isConnected)){this.canvas=re("canvas"),this.stage.insertBefore(this.canvas,this.panelsEl),this.paintCanvas=re("canvas","paint"),this.stage.insertBefore(this.paintCanvas,this.panelsEl);try{let e=this.twin===null?{}:{preserveDrawingBuffer:!0,coarseDrags:!1};this.renderer=new gh(this.canvas,this.scene,this.geometry,{theme:this.theme,...e})}catch(e){this.fail(`WebGL is not available: ${e.message}`);return}if(this.renderer.onChange=()=>this.invalidate(),this.unsubscribe=this.store.subscribe(e=>this.onChange(e)),this.measureStage(),this.twin!==null){this.onChange("state");return}this.resizeObserver=new ResizeObserver(()=>{this.measureStage(),this.layoutDom(),this.fitAddGroup(),this.invalidate()}),this.resizeObserver.observe(this.stage),this.resizeObserver.observe(this.header),window.addEventListener("pagehide",this.onPageHide),document.addEventListener("visibilitychange",this.onVisibility),typeof IntersectionObserver<"u"&&(this.intersecting=!1,this.viewObserver=new IntersectionObserver(e=>{this.intersecting=e[e.length-1].isIntersecting,this.syncShown()},{threshold:0}),this.viewObserver.observe(this)),this.lastPanels=null,this.lastLayout=null;for(let e of[...this.panelDom.keys()])this.removePanelDom(e);this.onChange("state"),this.store.playing&&this.onChange("playing"),this.syncShown()}}stop(){cancelAnimationFrame(this.raf),this.raf=0,this.shown=!1,document.removeEventListener("visibilitychange",this.onVisibility),this.viewObserver?.disconnect(),this.viewObserver=null,this.flushSave(),this.closeMenu(!1),window.removeEventListener("pagehide",this.onPageHide),this.unsubscribe?.(),this.unsubscribe=null,this.resizeObserver?.disconnect(),this.resizeObserver=null,this.renderer?.dispose(),this.renderer=null,this.canvas?.remove(),this.canvas=null,this.paintCanvas?.remove(),this.paintCanvas=null}hostProperty(e){return typeof getComputedStyle>"u"?"":getComputedStyle(this).getPropertyValue(e).trim()}applyTheme(){if(this.scene!==null){this.theme=ep(Ho(this.scene),this.getAttribute("theme"),e=>this.hostProperty(e));for(let[e,t]of Object.entries(tp(this.theme)))this.style.setProperty(e,t);this.renderer?.setTheme(this.theme),this.invalidate()}}recall(){let e=this.scene;if(this.kiosk)return structuredClone(e.initial);try{let t=localStorage.getItem(Mh(this.sceneText));return t===null?structuredClone(e.initial):H0(e,JSON.parse(t))}catch{return structuredClone(e.initial)}}save(){this.kiosk||this.twin!==null||(window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>this.flushSave(),300))}flushSave(){if(!(this.saveTimer===0||this.store===null)){window.clearTimeout(this.saveTimer),this.saveTimer=0;try{localStorage.setItem(Mh(this.sceneText),JSON.stringify(this.store.state))}catch{}}}reset(){if(!(this.scene===null||this.store===null)){try{localStorage.removeItem(Mh(this.sceneText))}catch{}this.closeMenu(!1),this.store.set(structuredClone(this.scene.initial));for(let e of this.panelDom.keys())this.renderer?.refit(e)}}get state(){return this.store?.state??null}onChange(e){let t=this.store;if(e==="state"){let i=t.state;i.panels!==this.lastPanels&&this.syncPanels(),(i.layout!==this.lastLayout||i.panels!==this.lastPanels)&&this.layoutDom(),this.lastPanels=i.panels,this.lastLayout=i.layout,this.syncWidgets(),this.save()}else if(e==="playing"){let i=this.transport;if(i!==null){let s=t.playing?"Pause (k)":"Play (k)";i.play.replaceChildren(jn(t.playing?"pause":"play")),i.play.setAttribute("aria-label",s),i.play.title=s,i.play.classList.toggle("on",t.playing)}if(this.meter.reset(),t.playing){let s=this.scene.clock,r=s.end==="stop"&&this.heldProgress!==null&&this.heldProgress>=1-2e-9;this.anchor={index:r?0:this.heldProgress===null?t.frame:this.heldProgress*s.steps,time:performance.now()},this.heldProgress=null}else this.playProgress!==null&&(this.heldProgress=this.playProgress);this.playProgress=null,t.playing||(this.stopAt=null),i!==null&&this.showRate(null)}this.invalidate()}invalidate(){this.dirty=!0,this.schedule()}schedule(){this.raf===0&&this.renderer!==null&&this.shown&&this.twin===null&&(this.raf=requestAnimationFrame(e=>this.tick(e)))}syncShown(){let e=this.intersecting&&!document.hidden;if(e!==this.shown){if(this.shown=e,!e){cancelAnimationFrame(this.raf),this.raf=0;return}this.store?.playing&&(this.meter.reset(),this.anchor={index:this.playPosition(),time:performance.now()}),this.invalidate()}}playPosition(){return this.playProgress===null?this.store.frame:this.playProgress*this.scene.clock.steps}tick(e){this.raf=0;let t=this.store,i=this.scene.clock;if(t.playing){let s=al(this.anchor.index,e-this.anchor.time,1e3,i.steps,this.speed,Rt(i)),r=this.stopAt,a=i.end==="stop"?Math.floor(this.anchor.index/i.steps)*i.steps+i.steps*(1-1e-9):1/0,o=Math.min(r?.x??1/0,a);if(s>=o){s=o;let l=r!==null&&r.x<=a?r.index:null;t.setFrame(ya(s,i.steps)),this.playProgress=ba(s,i.steps),this.stopAt=null,this.pause(),l!==null&&this.reachStage(l)}else t.setFrame(ya(s,i.steps)),this.playProgress=ba(s,i.steps);this.dirty=!0}this.dirty&&(this.dirty=!1,this.draw(),t.playing&&this.countDraw(e)),t.playing&&this.schedule()}countDraw(e){this.meter.note(e),this.showRate(this.meter.report(e))}showRate(e){let t=this.transport;if(t===null)return;ri(t.fps,xu(e));let i=_u(e);t.fps.title!==i&&(t.fps.title=i)}measureStage(){this.stageSize={w:this.stage.clientWidth,h:this.stage.clientHeight}}draw(e=Math.min(window.devicePixelRatio||1,2)){let t=this.renderer,i=this.store,s=this.scene;if(t===null)return;let r=i.state,{w:a,h:o}=this.stageSize;if(a<1||o<1)return;let l=i.playing&&this.playProgress!==null?this.playProgress:this.heldProgress??i.frame/s.clock.steps,c=t.renderAt(r,l,a,o,e);this.paint(l,a,o,e),this.animatedLayout&&this.layoutDom(l);for(let[u,f]of this.panelDom){ri(f.error,c.get(u)??"");let d=t.offKeys?.(u)??!1;f.follow.hidden===d&&(f.follow.hidden=!d);for(let p of f.readouts)$0(p,this.pieces(u,p.parts,l));f.barsFor!==r&&(this.syncBars(u,f),f.barsFor=r)}let h=this.firstPanel();for(let u of this.captions)$0(u,h===null?[]:this.pieces(h,u.parts,l));this.transport&&(gf(this.transport.scrub,i.frame),ri(this.transport.frame,`${i.frame} / ${s.clock.steps}`))}get animatedLayout(){let e=t=>t.kind==="split"&&(t.keys!==void 0||e(t.a)||e(t.b));return this.store!==null&&e(this.store.state.layout)}paint(e,t,i,s){let r=this.paintCanvas,a=this.renderer;if(r===null||a===null||this.scene===null||this.theme===null)return;let o=Math.round(t*s),l=Math.round(i*s);(r.width!==o||r.height!==l)&&(r.width=o,r.height=l);let c=r.getContext("2d");c!==null&&(c.setTransform(1,0,0,1,0,0),c.clearRect(0,0,o,l),c.setTransform(s,0,0,s,0,0),a0(c,a,this.scene,this.store.state,this.theme,e,t,i,(h,u)=>{let f=this.pieces(h,u,e);return"error"in f?[]:f}))}pieces(e,t,i){try{let s={scene:this.scene,geometry:this.geometry,state:this.store.state,panel:e,frameIndex:this.store.frame,progress:i};return Op(s,t)}catch(s){if(s instanceof Qt)return{error:s.message};throw s}}firstPanel(){let e=t=>t.kind==="panel"?t.id:e(t.a);return this.store===null?null:e(this.store.state.layout)}hasTransport(){return(this.scene?.controls??[]).some(e=>e.kind==="transport")}get playing(){return this.store?.playing??!1}play(){this.store?.setPlaying(!0)}pause(){this.store?.setPlaying(!1)}step(e){let t=this.store;t!==null&&(this.pause(),this.heldProgress=null,t.setFrame(t.frame+e))}get stages(){return[...this.scene?.stages??[]]}get time(){return this.scene===null||this.store===null?0:(this.store.playing&&this.playProgress!==null?this.playProgress:this.heldProgress??this.store.frame/this.scene.clock.steps)*Rt(this.scene.clock)}get currentStage(){let e=this.time+1e-9,t=null;for(let i of this.stages)i.at<=e&&(t=i.id);return t}stageIndex(e){let t=this.stages,i=typeof e=="number"?e:t.findIndex(s=>s.id===e);if(!Number.isInteger(i)||i<0||i>=t.length)throw new Error(`the scene does not have a stage ${JSON.stringify(e)}`);return i}seek(e){let t=this.scene,i=this.store;if(t===null||i===null||!Number.isFinite(e))return;let s=Rt(t.clock),r=Math.min(Math.max(e/s,0),1-1e-9);this.stopAt=null,this.pause(),this.heldProgress=r,this.playProgress=null,i.setFrame(Math.min(t.clock.steps-1,Math.floor(r*t.clock.steps))),this.invalidate()}goto(e){this.seek(this.stages[this.stageIndex(e)].at)}playTo(e){let t=this.scene,i=this.store;if(t===null||i===null)return;let s=this.stageIndex(e),r=Rt(t.clock),a=t.clock.steps,o=this.time,l=this.stages[s].at;if(Math.abs(l-o)<1e-9){this.reachStage(s);return}let c=(l>o?0:1)*a+Math.min(l/r*a,a*(1-1e-9));i.playing?this.anchor={index:this.playPosition(),time:performance.now()}:this.heldProgress??=i.frame/a,i.setPlaying(!0),this.stopAt={x:c,index:s}}next(){let e=this.time+1e-6,t=this.stages.findIndex(i=>i.at>e);return t<0?null:(this.playTo(t),this.stages[t].id)}previous(){let e=this.time-1e-6,t=-1;return this.stages.forEach((i,s)=>{i.at<e&&(t=s)}),t<0?null:(this.goto(t),this.stages[t].id)}reachStage(e){let t=this.stages[e];t!==void 0&&this.dispatchEvent(new CustomEvent("tycho-stage",{detail:{id:t.id,index:e,at:t.at},bubbles:!0,composed:!0}))}seekFrame(e){let t=this.store;t.setFrame(e),this.playProgress=null,this.heldProgress=null,this.stopAt=null,t.playing&&(this.anchor={index:t.frame,time:performance.now()})}onKey(e){this.useKey(e)&&e.stopPropagation()}useKey(e){if(this.store===null||e.metaKey||e.ctrlKey||e.altKey)return!1;if(e.key==="Escape"){if(this.menu!==null)this.closeMenu(!0);else if(!this.closeExport?.())return!1;return e.preventDefault(),!0}let t=Up(e.key,e.shiftKey,this.scene.clock.steps),i=e.composedPath()[0];return i!==void 0&&["INPUT","SELECT","BUTTON","TEXTAREA"].includes(i.tagName)&&Bp(i.tagName,i.type,e.key)?!0:t===null?!1:t.kind==="fit"?(e.preventDefault(),this.fitAll(),!0):t.kind==="slider"?this.stepSlider(t.by)?(e.preventDefault(),!0):!1:!this.hasTransport()&&!this.kiosk?!1:(e.preventDefault(),t.kind==="toggle"?this.store.setPlaying(!this.store.playing):t.kind==="step"?this.step(t.by):this.seekFrame(t.frame),!0)}fitAll(){this.renderer?.refitAll(),this.invalidate()}fitPanel(e){this.renderer?.refit(e),this.invalidate()}stepSlider(e){let t=this.scene,i=this.store.state,s=this.firstPanel(),r=(t.controls??[]).find(h=>h.kind==="slider"&&at(t,h.variable)?.scope!=="panel");if(r===void 0||s===null)return!1;let a={scene:t,state:i,panel:i.panels[s]},o=rl(a,this.geometry.sets,r);if(o.length===0)return!1;let l=this.panelValue(a,r.variable),c=Math.min(o.length-1,Math.max(0,ga(o,l)+e));return this.store.update(h=>fs(t,h,r.variable,o[c])),!0}buildFooter(){let e=this.scene;if(this.footer.replaceChildren(),this.transport=null,this.hasTransport()){let r=mf("Playback","playback"),a=Yr("play","Play (k)","Play (k)","icon play");a.addEventListener("click",()=>this.store.setPlaying(!this.store.playing));let o=re("input","scrub");o.type="range",o.min="0",o.max=String(e.clock.steps-1),o.step="1",o.setAttribute("aria-label","Frame"),o.addEventListener("pointerdown",ai),o.addEventListener("input",()=>{this.pause(),this.store.setFrame(Number(o.value))});let l=re("span","frame");l.style.minWidth=`${2*String(e.clock.steps).length+3}ch`,l.title="Frame index of the loop. Left and right step, Home goes to 0";let c=re("select","speed");c.setAttribute("aria-label","Playback speed"),c.title="Playback speed";for(let f of nT){let d=re("option",void 0,`${f}\xD7`);d.value=String(f),d.selected=f===this.speed,c.appendChild(d)}c.addEventListener("change",()=>{this.speed=Number(c.value),this.anchor={index:this.playPosition(),time:performance.now()},this.refreshExport?.()}),r.append(a,o,l,c);let h=null;e.clock.channels.length>1&&(h=V0(e.clock.channels.map((f,d)=>({id:f,label:e.clock.labels?.[d]??f})),f=>this.store.update(d=>F0(d,f)),"Clock"),h.el.title="What the frame index runs along",r.append(h.el));let u=re("span","fps",xu(null));u.title=_u(null),r.append(u),this.footer.append(r),this.transport={play:a,scrub:o,frame:l,fps:u,channel:h}}let t=mf("View","view"),i=Yr("house","Reset every view","Reset every view: return each panel to its timeline's camera, or fit it to what it draws (F)");i.addEventListener("click",()=>this.fitAll());let s=Yr("rotateCcw","Reset scene","Reset scene: panels, layout, and controls as written");s.addEventListener("click",()=>this.reset()),t.append(i,s),this.footer.append(t),this.buildExport()}exportVideo(e={}){if(this.scene===null||this.store===null||this.geometry===null)return Promise.reject(new Error("the viewer has not loaded a scene"));let t=e.kiosk??this.kiosk,s={clock:this.scene.clock,stage:this.pictureSize(t),open:(r,a,o)=>this.openTwin(t?"kiosk":"picture",r,a,o)};return qp(s,{speed:this.speed,...e})}pictureSize(e){if(e)return{w:this.clientWidth,h:this.clientHeight};let t=this.kiosk?0:this.statsEl.offsetHeight;return{w:this.stage.clientWidth,h:this.stage.clientHeight+t}}async openTwin(e,t,i,s){let r=document.createElement(this.localName);r.twin=e;let a=this.getAttribute("theme");a!==null&&r.setAttribute("theme",a),r.style.cssText=`position: absolute; left: 0; top: 0; width: ${t}px; height: ${i}px; min-height: 0; visibility: hidden; pointer-events: none;`,r.tabIndex=-1,r.setAttribute("aria-hidden","true"),r.buildShell(),r.scene=this.scene,r.sceneText=this.sceneText,r.geometry=this.geometry,r.store=new mo(structuredClone(this.store.state),this.scene.clock.steps),r.choice=r.templateChoice(),r.statusEl.hidden=!0,r.titleEl.textContent=this.scene.title??"",this.root.appendChild(r);try{if(r.applyTheme(),r.buildTopBar(),r.buildFooter(),r.start(),r.renderer===null)throw new Error(r.statusEl.textContent??"the export cannot draw the stage");r.drawAt(0,0,s),await r.renderer.ready(),await document.fonts?.ready}catch(o){throw r.stop(),r.remove(),o}return{draw:(o,l,c)=>{r.drawAt(l,c,s),k0(o,r)},close:()=>{r.stop(),r.remove()}}}drawAt(e,t,i){this.store.setFrame(e),this.heldValue=t,this.heldFrame=e,this.measureStage(),this.layoutDom(t),this.draw(i)}buildExport(){let e=mf("Export","export"),t=re("button","disclose");t.type="button",t.append(jn("download"),re("span",void 0,"Export video"),jn("chevronDown","chev"));let i=re("div","exportbar");e.appendChild(t),this.footer.appendChild(e),this.closeExport=null;let s=Mu();if(s!==null){t.disabled=!0,this.footer.append(re("span","why",`video export is unavailable: ${s}`));return}let r=re("span","xprog");r.hidden=!0,t.appendChild(r),i.id="xbar",i.setAttribute("role","group"),i.setAttribute("aria-label","Export options"),i.hidden=!0,t.setAttribute("aria-expanded","false"),t.setAttribute("aria-controls","xbar");let a=v=>{i.hidden=!v,t.setAttribute("aria-expanded",String(v)),v&&(b(),_())};this.closeExport=()=>i.hidden?!1:(a(!1),t.focus(),!0),t.addEventListener("click",()=>a(i.hidden!==!1));let o=(v,w)=>{let E=re("select");E.setAttribute("aria-label",v),E.title=v;for(let[x,A]of w){let I=re("option",void 0,A);I.value=x,E.appendChild(I)}return E},l=o("Size",[["720p","1280\xD7720"],["1080p","1920\xD71080"],["stage","stage size"]]),c=o("Frame rate",ol.map(v=>[String(v),`${v} fps`]));c.value="30";let h=()=>va("stage",this.pictureSize(this.kiosk),window.devicePixelRatio||1,Number(c.value)),u=o("Loops",Vp.map(v=>[String(v),v===1?"1 loop":`${v} loops`])),f=re("span","info"),d=re("button","btn primary","Start");d.type="button";let p=re("progress");p.hidden=!0;let y=re("button","btn","Cancel");y.type="button",y.hidden=!0;let m=Yr("x","Close export options","Close (Esc)");m.addEventListener("click",()=>{a(!1),t.focus()});let g=null,b=()=>{if(g!==null)return;let v=this.scene.clock;u.value="1",c.value=String(Gp(v.steps,this.speed,Rt(v))??ol[0])},_=()=>{if(g!==null)return;let v=l.options[2],w=h();v.textContent=`stage, ${w.width}\xD7${w.height}`;let E=this.scene.clock,x=ll(E.steps,Number(c.value),Number(u.value),this.speed,0,Rt(E)),A=cl(x.count,Number(c.value));f.textContent=A??`${x.count} frames, ${x.duration.toFixed(1)} s at ${this.speed}\xD7 speed`,d.disabled=A!==null};for(let v of[l,c,u])v.addEventListener("change",_);this.refreshExport=()=>{i.hidden||(b(),_())},d.addEventListener("click",()=>{let v=new AbortController;g=v,d.disabled=!0,y.hidden=!1,p.hidden=!1,p.value=0,r.hidden=!1,r.style.width="0%";let w=l.value,E=`${(this.scene.title??"tycho").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"tycho"}.mp4`,x="";this.exportVideo({size:w,fps:Number(c.value),loops:Number(u.value),signal:v.signal,onConfig:A=>x=`${A.width}\xD7${A.height} H.264 ${A.codec}`,onProgress:(A,I)=>{p.max=I,p.value=A,r.style.width=`${I>0?100*A/I:0}%`,f.textContent=`${x}, frame ${A} of ${I}`}}).then(A=>{let I=URL.createObjectURL(A),R=re("a");R.href=I,R.download=E,this.shadowRoot.appendChild(R),R.click(),R.remove(),window.setTimeout(()=>URL.revokeObjectURL(I),6e4),f.textContent=`saved ${E}, ${x}, ${(A.size/1e6).toFixed(2)} MB`}).catch(A=>{f.textContent=A instanceof DOMException&&A.name==="AbortError"?"canceled":`export failed: ${A.message}`}).finally(()=>{g=null,d.disabled=!1,y.hidden=!0,p.hidden=!0,r.hidden=!0})}),y.addEventListener("click",()=>g?.abort()),i.append(l,c,u,f,d,p,y,m),this.footer.append(i)}makeWidget(e,t){let i=this.scene,s=at(i,e.variable);if(s===void 0)return null;let r=l=>this.store.update(c=>fs(i,c,e.variable,l,t)),a=l=>{let c=s.scope==="panel"?l.panel.variables:l.state.variables;return c!==void 0&&Object.hasOwn(c,e.variable)?c[e.variable]:s.default},o=()=>{let l=re("label","field");return l.appendChild(re("span","k",e.label)),l.addEventListener("pointerdown",ai),l};if(e.kind==="tabs"&&s.kind==="choice"&&t!==void 0&&s.values.length>3){let l=s,c=re("select");l.values.forEach((u,f)=>{let d=re("option",void 0,l.labels?.[f]??u);d.value=u,c.appendChild(d)}),c.addEventListener("change",()=>r(c.value));let h=o();return h.appendChild(c),{el:h,sync:u=>{c.value=String(a(u))}}}if(e.kind==="tabs"&&s.kind==="choice"){let l=s,c=V0(l.values.map((u,f)=>({id:u,label:l.labels?.[f]??u})),u=>r(u),e.label),h=re("span","field");return h.append(re("span","k",e.label),c.el),h.addEventListener("pointerdown",ai),{el:h,sync:u=>c.set(String(a(u)))}}if(e.kind==="toggle"&&s.kind==="toggle"){let l=re("input");l.type="checkbox",l.addEventListener("change",()=>r(l.checked));let c=o();return c.prepend(l),{el:c,sync:h=>{l.checked=a(h)===!0}}}if(e.kind==="slider"&&s.kind==="selector"){let l=re("input");l.type="range",l.min="0",l.step="1";let c=re("output"),h=[];l.addEventListener("input",()=>{gf(l,Number(l.value));let f=h[Number(l.value)];f!==void 0&&r(f)});let u=o();return u.append(l,c),{el:u,sync:f=>{h=rl(f,this.geometry.sets,e),l.disabled=h.length===0,l.max=String(Math.max(0,h.length-1));let d=a(f);gf(l,Math.max(0,ga(h,d))),c.textContent=Yi(d)}}}return null}templateChoice(){let e=this.scene,t=Object.entries(e.variables??{}).filter(([,o])=>o?.kind==="choice"&&o.scope==="panel");if(t.length===0)return null;let i=new Set(Object.values(e.views).map(o=>typeof o.frame=="string"?"":o.frame.var)),[s,r]=t.find(([o])=>i.has(o))??t[0],a=(e.controls??[]).find(o=>o.kind==="tabs"&&o.variable===s);return{id:s,def:r,label:a?.label??s}}templates(){let e=this.scene,t=Object.entries(e.views).map(([s,r])=>({kind:"view",view:s,label:r.label??s})),i=this.choice;return t.length>1||i===null?t:i.def.values.map((s,r)=>({kind:"value",variable:i.id,value:s,label:i.def.labels?.[r]??s}))}buildTopBar(){let e=this.scene;this.varsEl.replaceChildren(),this.sceneWidgets=[];for(let t of e.controls??[]){if(t.kind==="transport"||at(e,t.variable)?.scope==="panel")continue;let i=this.makeWidget(t,void 0);i&&(this.sceneWidgets.push(i),this.varsEl.appendChild(i.el))}this.buildAddGroup(),this.statsEl.replaceChildren(),this.captions=(e.readouts??[]).filter(t=>t.place==="caption").map(t=>W0(t.parts,"wide")),this.statsEl.append(...this.captions.map(t=>t.root))}buildAddGroup(){this.addEl.replaceChildren();let e=this.templates(),t=re("div","chips");t.appendChild(re("span","k","Add panel")),this.addChips=[];for(let s of e){let r=G0(s.label,"menu");r.body.setAttribute("role","button"),r.body.tabIndex=0,r.body.setAttribute("aria-roledescription","draggable"),r.body.title="Drag onto a panel: an edge splits it, the center replaces it. Click to add a panel.",r.body.addEventListener("pointerdown",o=>this.startDrag(o,s,r.body,r.root)),r.body.addEventListener("keydown",o=>{o.key!=="Enter"&&o.key!==" "||(o.preventDefault(),o.stopPropagation(),this.addPanel(s))});let a=r.button;a.addEventListener("click",()=>this.openMenu(a,this.chipEntries(s))),t.appendChild(r.root),this.addChips.push(r.root)}let i=re("button","btn");i.type="button",i.setAttribute("aria-haspopup","menu"),i.setAttribute("aria-expanded","false"),i.append(jn("plus"),re("span",void 0,"Add panel"),jn("chevronDown","chev")),i.hidden=!0,i.addEventListener("pointerdown",ai),i.addEventListener("click",()=>this.openMenu(i,e.map(s=>({label:s.label,run:()=>this.addPanel(s)})))),this.addEl.append(t,i),this.addGroup=t,this.addButton=i,this.fitAddGroup()}fitAddGroup(){let e=this.addGroup,t=this.addButton;if(e===null||t===null||this.addChips.length<2)return;let i=this.shadowRoot?.activeElement??null;e.hidden=!1,t.hidden=!0;let s=this.addChips[0],a=this.addChips[this.addChips.length-1].offsetTop>s.offsetTop+s.offsetHeight/2;e.hidden=a,t.hidden=!a,a&&i!==null&&e.contains(i)&&t.focus()}chipEntries(e){let t=this.scene;return B0(this.store.state,i=>this.panelName(i),Eh).map(i=>({label:i.label,disabled:i.disabled,group:i.group,run:()=>this.store.update(s=>z0(t,s,i.placement,e,Eh,r=>this.isTall(r)))}))}addPanel(e){this.store.update(t=>pf(this.scene,t,e,Eh,i=>this.isTall(i)))}isTall(e){let t=this.panelDom.get(e)?.host.getBoundingClientRect();return t!==void 0&&t.width<t.height}panelName(e){let t=this.panelDom.get(e);if(t===void 0)return e;let i=t.chipLabel.textContent??"";return t.title.hidden?i||e:`${t.title.textContent??e}, ${i}`}openMenu(e,t){let i=this.menu?.anchor===e;if(this.closeMenu(!1),i)return;let s=re("div","menu");s.setAttribute("role","menu");let r=[];for(let h of t){if(h.group&&r.length>0){let f=re("hr");f.setAttribute("role","separator"),s.appendChild(f)}let u=re("button",void 0,h.label);u.type="button",u.setAttribute("role","menuitem"),u.tabIndex=-1,u.disabled=h.disabled===!0,u.addEventListener("click",()=>{this.closeMenu(!0),h.run()}),s.appendChild(u),r.push(u)}let a=r.filter(h=>!h.disabled);s.addEventListener("pointerdown",ai),s.addEventListener("keydown",h=>{let u=a.indexOf(this.shadowRoot.activeElement),f=a.length,d=p=>a[(p%f+f)%f]?.focus();if(h.key==="ArrowDown")d(u+1);else if(h.key==="ArrowUp")d(u-1);else if(h.key==="Home")d(0);else if(h.key==="End")d(f-1);else if(h.key==="Escape")this.closeMenu(!0);else if(h.key==="Tab")this.closeMenu(!1);else return;h.key!=="Tab"&&h.preventDefault(),h.stopPropagation()}),this.root.appendChild(s);let o=e.getBoundingClientRect(),l=o.bottom+4+s.offsetHeight<=window.innerHeight;s.style.left=`${Math.max(4,Math.min(o.left,window.innerWidth-s.offsetWidth-4))}px`,s.style.top=`${l?o.bottom+4:Math.max(4,o.top-s.offsetHeight-4)}px`,e.setAttribute("aria-expanded","true");let c=h=>{let u=h.composedPath();!u.includes(s)&&!u.includes(e)&&this.closeMenu(!1)};window.addEventListener("pointerdown",c,!0),this.menu={anchor:e,close:h=>{s.remove(),e.setAttribute("aria-expanded","false"),window.removeEventListener("pointerdown",c,!0),h&&e.focus()}},a[0]?.focus()}closeMenu(e){let t=this.menu;this.menu=null,t?.close(e)}syncWidgets(){let e=this.store,t=this.scene,i=e.state,s=this.firstPanel();if(s!==null){let o={scene:t,state:i,panel:i.panels[s]};for(let l of this.sceneWidgets)l.sync(o)}let r=Object.keys(t.views).length,a=this.choice;for(let[o,l]of this.panelDom){let c=i.panels[o];if(c===void 0)continue;let h={scene:t,state:i,panel:c};for(let g of l.widgets)g.sync(h);let u=t.views[c.view];l.title.textContent=u.label??c.view,l.title.hidden=r<2;let f=typeof u.frame=="string"?u.frame:String(this.panelValue(h,u.frame.var)),p=(Object.hasOwn(t.frames,f)?t.frames[f]:void 0)?.label??f,y=u.frame,m=typeof y=="string"?null:y.var;if(a!==null&&l.select!==null){let g=String(this.panelValue(h,a.id));l.select.value=g,ri(l.chipLabel,a.def.labels?.[a.def.values.indexOf(g)]??g),l.meta.textContent=p,l.meta.hidden=m===a.id||m!==null&&(t.controls??[]).some(b=>b.kind!=="transport"&&b.variable===m&&at(t,m)?.scope==="panel")}else ri(l.chipLabel,p),l.meta.hidden=!0;l.close.hidden=Object.keys(i.panels).length<2}this.transport?.channel?.set(i.clock.channel)}panelValue(e,t){let i=at(e.scene,t);if(i===void 0)return"";let s=i.scope==="panel"?e.panel.variables:e.state.variables;return s!==void 0&&Object.hasOwn(s,t)?s[t]:i.default}syncPanels(){let e=this.store.state;for(let t of[...this.panelDom.keys()])Object.hasOwn(e.panels,t)||this.removePanelDom(t);for(let t of Object.keys(e.panels)){let i=this.panelDom.get(t);i!==void 0&&i.view===e.panels[t].view||(i!==void 0&&this.removePanelDom(t),this.createPanelDom(t,e.panels[t]))}}createPanelDom(e,t){let i=this.scene,s=re("div","panel");s.dataset.id=e;let r=re("div","pbody"),a=(i.readouts??[]).filter(E=>E.place==="panel").map(E=>W0(E.parts,"stack")),o=re("div","preadout");o.append(...a.map(E=>E.root));let l=re("div","perror"),c=re("div","cbars"),h=re("div","drop"),u=re("span");h.appendChild(u),h.hidden=!0;let f=re("button","btn follow");f.type="button",f.append(jn("house"),re("span",void 0,"Timeline view")),f.title="Back to the timeline's camera (F returns every panel)",f.hidden=!0,f.addEventListener("pointerdown",ai),f.addEventListener("click",()=>this.fitPanel(e)),r.append(o,l,c,h,f),r.addEventListener("dblclick",()=>this.fitPanel(e));let d=re("div","phead"),p=re("span","t"),y=this.choice,m=G0("",y===null?"none":"select");if(m.body.title="Drag to move the panel: onto an edge of another to place it there, onto its center to swap",y!==null&&m.select!==null){let E=m.select;E.setAttribute("aria-label",y.label),y.def.values.forEach((x,A)=>{let I=re("option",void 0,y.def.labels?.[A]??x);I.value=x,E.appendChild(I)}),E.addEventListener("change",()=>this.store.update(x=>fs(i,x,y.id,E.value,e)))}let g=re("span","m"),b=re("span","pc mini"),_=[];for(let E of i.controls??[]){if(E.kind==="transport"||at(i,E.variable)?.scope!=="panel"||y!==null&&E.kind==="tabs"&&E.variable===y.id)continue;let x=this.makeWidget(E,e);x&&(_.push(x),b.appendChild(x.el))}let v=Yr("house","Reset view","Reset view: fit to what this panel draws (F resets every panel)");v.addEventListener("click",()=>this.fitPanel(e));let w=Yr("x","Close panel","Close panel");w.addEventListener("click",()=>this.store.update(E=>U0(E,e))),d.append(p,m.root,g,b,re("span","sp"),v,w),d.addEventListener("pointerdown",E=>this.startDrag(E,{kind:"panel",id:e},d,m.root)),s.append(r,d),this.panelsEl.appendChild(s),this.panelDom.set(e,{host:s,body:r,head:d,title:p,chip:m.root,chipLabel:m.label,select:m.select,meta:g,close:w,readouts:a,error:l,follow:f,drop:h,dropLabel:u,bars:c,barDom:[],barsFor:null,widgets:_,view:t.view}),this.renderer?.bind(e,r)}removePanelDom(e){let t=this.panelDom.get(e);t&&(this.renderer?.bind(e,null),t.host.remove(),this.panelDom.delete(e))}layoutDom(e){if(this.store===null)return;let{w:t,h:i}=this.stageSize,s=e??this.heldProgress??this.store.frame/this.scene.clock.steps,r=uh(fo(this.store.state.layout,s*Rt(this.scene.clock)),{x:0,y:0,w:t,h:i},yh);for(let[o,l]of r.panels){let c=this.panelDom.get(o);c&&Object.assign(c.host.style,{left:`${l.x}px`,top:`${l.y}px`,width:`${l.w}px`,height:`${l.h}px`})}this.gutters=r.gutters;let a=new Set;for(let o of r.gutters){a.add(o.path);let l=this.gutterDom.get(o.path);if(!l){l=re("div","gutter");let c=o.path;l.addEventListener("pointerdown",h=>this.startResize(h,c,l)),this.gutterDom.set(o.path,l),this.panelsEl.appendChild(l)}l.className=`gutter ${o.dir}`,Object.assign(l.style,{left:`${o.rect.x}px`,top:`${o.rect.y}px`,width:`${o.rect.w}px`,height:`${o.rect.h}px`})}for(let[o,l]of[...this.gutterDom])a.has(o)||(l.remove(),this.gutterDom.delete(o))}startResize(e,t,i){let s=this.gutters.find(o=>o.path===t);if(!s||e.button!==0)return;e.preventDefault(),i.classList.add("active"),i.setPointerCapture(e.pointerId);let r=o=>{let l=this.stage.getBoundingClientRect(),c=c0(s,o.clientX-l.left,o.clientY-l.top,yh);this.store.update(h=>po(h,hh(h.layout,t,c)))},a=()=>{i.classList.remove("active"),i.removeEventListener("pointermove",r),i.removeEventListener("pointerup",a),i.removeEventListener("pointercancel",a)};i.addEventListener("pointermove",r),i.addEventListener("pointerup",a),i.addEventListener("pointercancel",a)}syncBars(e,t){let i=this.scene,s=this.renderer.colorbars(e);t.barDom.length!==s.length&&(t.barDom=s.map(()=>this.makeBar(e)),t.bars.replaceChildren(...t.barDom.map(o=>o.root)));let r=this.store.state.panels[e],a=r===void 0?void 0:i.views[r.view];s.forEach((o,l)=>{let c=t.barDom[l];ri(c.title,o.label),c.gradient!==o.gradient&&(c.gradient=o.gradient,c.grad.style.background=o.gradient);let h=Number.isInteger(o.lo)&&Number.isInteger(o.hi)?void 0:3;ri(c.hi,Yi(o.hi,h)),ri(c.lo,Yi(o.lo,h)),c.range=[o.lo,o.hi],c.mark.hidden=o.marker===null,o.marker!==null&&(c.mark.style.bottom=`${(100*o.marker).toFixed(2)}%`),c.band.hidden=o.band===null,o.band!==null&&(c.band.style.bottom=`${(100*o.band[0]).toFixed(2)}%`,c.band.style.height=`${(100*(o.band[1]-o.band[0])).toFixed(2)}%`),c.link=a===void 0?null:zp(i,a,o.label);let u=c.grad;if(u.classList.toggle("live",c.link!==null),c.link===null){for(let d of["role","tabindex","aria-orientation","aria-label","aria-valuemin","aria-valuemax","aria-valuenow","aria-valuetext","title"])u.removeAttribute(d);return}let f=this.panelValue({scene:i,state:this.store.state,panel:r},c.link.variable);u.setAttribute("role","slider"),u.setAttribute("tabindex","0"),u.setAttribute("aria-orientation","vertical"),u.setAttribute("aria-label",c.link.label),u.setAttribute("aria-valuemin",String(o.lo)),u.setAttribute("aria-valuemax",String(o.hi)),u.setAttribute("aria-valuenow",String(f)),u.setAttribute("aria-valuetext",Yi(f)),u.title=`Drag or click to set ${c.link.label}`})}makeBar(e){let t=re("div","cbar"),i=re("div","cbar-t"),s=re("div","cbar-b"),r=re("div","cbar-g"),a=re("span","cbar-k"),o=re("i");r.append(a,o);let l=re("div","cbar-n"),c=re("span"),h=re("span");l.append(c,h),s.append(r,l),t.append(i,s);let u={root:t,title:i,grad:r,band:a,mark:o,hi:c,lo:h,gradient:"",range:[0,1],link:null};return r.addEventListener("pointerdown",f=>{if(u.link===null||f.button!==0)return;f.preventDefault(),f.stopPropagation(),r.focus(),r.setPointerCapture(f.pointerId);let d=y=>{let m=r.getBoundingClientRect();this.setFromBar(e,u,m.height>0?(m.bottom-y.clientY)/m.height:0)},p=()=>{r.removeEventListener("pointermove",d),r.removeEventListener("pointerup",p),r.removeEventListener("pointercancel",p)};d(f),r.addEventListener("pointermove",d),r.addEventListener("pointerup",p),r.addEventListener("pointercancel",p)}),r.addEventListener("dblclick",ai),r.addEventListener("keydown",f=>{if(u.link===null)return;let d={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10,Home:-1/0,End:1/0};f.key in d&&(f.preventDefault(),f.stopPropagation(),this.stepBar(e,u,d[f.key]))}),u}barStops(e,t){let i=this.store.state,s=i.panels[e];if(s===void 0)return[];let r={kind:"slider",variable:t.variable,label:t.label,domain:t.domain};return rl({scene:this.scene,state:i,panel:s},this.geometry.sets,r)}setFromBar(e,t,i){if(t.link===null)return;let s=this.barStops(e,t.link),r=Hp(s,t.range[0],t.range[1],i),a=t.link.variable;r>=0&&this.store.update(o=>fs(this.scene,o,a,s[r]))}stepBar(e,t,i){if(t.link===null)return;let s=this.barStops(e,t.link),r=this.store.state;if(s.length===0||r.panels[e]===void 0)return;let a=this.panelValue({scene:this.scene,state:r,panel:r.panels[e]},t.link.variable),o=Math.min(s.length-1,Math.max(0,ga(s,a)+i)),l=t.link.variable;this.store.update(c=>fs(this.scene,c,l,s[o]))}startDrag(e,t,i,s){if(e.button!==0||this.store===null)return;e.preventDefault(),this.closeMenu(!1);let r=e.clientX,a=e.clientY,o=this.shadowRoot,l=null,c=null;i.setPointerCapture(e.pointerId);let h=()=>{for(let d of this.panelDom.values())d.drop.hidden=!0},u=d=>{if(!l){if(Math.hypot(d.clientX-r,d.clientY-a)<4)return;l=s.cloneNode(!0),l.classList.add("ghost"),this.root.appendChild(l),s.classList.add("source"),this.root.classList.add("dragging")}l.style.left=`${d.clientX}px`,l.style.top=`${d.clientY}px`,h(),c=null;let y=o.elementFromPoint(d.clientX,d.clientY)?.closest(".panel");if(!y)return;let m=y.dataset.id;if(t.kind==="panel"&&t.id===m)return;let g=this.panelDom.get(m);if(!g)return;let b=g.host.getBoundingClientRect(),_=Jp(d.clientX-b.left,d.clientY-b.top,b.width,b.height);c={id:m,zone:_},g.drop.hidden=!1,g.drop.style.inset=_==="left"?"0 50% 0 0":_==="right"?"0 0 0 50%":_==="top"?"0 0 50% 0":_==="bottom"?"50% 0 0 0":"0",ri(g.dropLabel,sT(t,_))},f=d=>{i.removeEventListener("pointermove",u),i.removeEventListener("pointerup",f),i.removeEventListener("pointercancel",f),h();let p=l!==null;if(l?.remove(),s.classList.remove("source"),this.root.classList.remove("dragging"),!p){t.kind!=="panel"&&d.type==="pointerup"&&this.addPanel(t);return}c&&this.dropOn(c.id,c.zone,t)};i.addEventListener("pointermove",u),i.addEventListener("pointerup",f),i.addEventListener("pointercancel",f)}dropOn(e,t,i){let s=this.scene;this.store.update(r=>wh(s,r,e,t,i,Eh))}};function Th(n="tycho-viewer"){typeof customElements<"u"&&!customElements.get(n)&&customElements.define(n,go)}function oT(n,e){return n.exportVideo(e)}Th();return ny(lT);})();
/**
 * @license Lucide, https://lucide.dev, ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 * All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or
 * without fee is hereby granted, provided that the above copyright notice and this permission
 * notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
 * SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
 * AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
 * OF THIS SOFTWARE.
 */
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
