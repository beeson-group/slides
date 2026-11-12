/*! TyCHO runtime 0.2.0, Apache-2.0, https://github.com/beeson-group/tycho
 * This bundle contains:
 * mp4-muxer 5.2.2, MIT, Copyright 2023 Vanilagy, https://github.com/Vanilagy/mp4-muxer
 * three 0.187.0, MIT, Copyright 2010-2026 three.js authors, https://github.com/mrdoob/three.js
 * Full license texts: https://github.com/beeson-group/tycho/blob/main/THIRD_PARTY_NOTICES.md */
"use strict";var tycho=(()=>{var Ch=Object.defineProperty;var B0=Object.getOwnPropertyDescriptor;var z0=Object.getOwnPropertyNames;var H0=Object.prototype.hasOwnProperty;var V0=(n,e)=>{for(var t in e)Ch(n,t,{get:e[t],enumerable:!0})},G0=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of z0(e))!H0.call(n,s)&&s!==t&&Ch(n,s,{get:()=>e[s],enumerable:!(i=B0(e,s))||i.enumerable});return n};var W0=n=>G0(Ch({},"__esModule",{value:!0}),n);var WE={};V0(WE,{Container:()=>Js,DATA_VERSION:()=>Ys,EXPORT_LIMITS:()=>Kr,SCENE_MAJOR:()=>ys,SCENE_MINOR:()=>ia,TychoError:()=>un,TychoViewerElement:()=>xo,colormap:()=>ws,colormapCss:()=>Yf,decodeEmbedded:()=>wo,define:()=>Eh,evaluate:()=>qf,exportVideo:()=>GE,formatNumber:()=>Yn,sizePreset:()=>go,validate:()=>Go});var un=class extends Error{rule;constructor(e,t){super(`[${e}] ${t}`),this.name="TychoError",this.rule=e}};function E(n,e){throw new un(n,e)}var Ys=1,$0=[84,89,67,68],ta=12,Af={raw:new Set(["dtype","shape","encoding","offset","length"]),"shuffle-delta-deflate":new Set(["dtype","shape","encoding","chunk_rows","chunks"])},Ks={int8:Int8Array,uint8:Uint8Array,int16:Int16Array,uint16:Uint16Array,int32:Int32Array,uint32:Uint32Array,float32:Float32Array,float64:Float64Array},Cf=new Uint8Array(new Uint16Array([1]).buffer)[0]===1;function X0(n){return typeof n=="string"&&Object.hasOwn(Ks,n)}function js(n){return Ks[n].BYTES_PER_ELEMENT}var na=n=>Number.isSafeInteger(n)&&n>=0,Rh=n=>n!==null&&typeof n=="object"&&!Array.isArray(n);function q0(n,e,t,i){let s=new Ks[i](t),r=js(i),a={int8:o=>n.getInt8(o),uint8:o=>n.getUint8(o),int16:o=>n.getInt16(o,!0),uint16:o=>n.getUint16(o,!0),int32:o=>n.getInt32(o,!0),uint32:o=>n.getUint32(o,!0),float32:o=>n.getFloat32(o,!0),float64:o=>n.getFloat64(o,!0)}[i];for(let o=0;o<t;o++)s[o]=a(e+o*r);return s}async function Y0(n,e,t){let i=e.length,s=new DecompressionStream("deflate"),r=s.writable.getWriter();r.write(n).catch(()=>{}),r.close().catch(()=>{});let a=s.readable.getReader(),o=0;try{for(;;){let{done:l,value:c}=await a.read();if(l)break;o+c.length>i&&(a.cancel().catch(()=>{}),E("D5",`${t} inflates to more than the ${i} bytes of its rows`)),e.set(c,o),o+=c.length}}catch(l){if(l instanceof un)throw l;let c=l.message;E("D5",`${t} does not inflate${c?`: ${c}`:""}`)}o!==i&&E("D5",`${t} inflates to ${o} bytes, not the ${i} of its rows`)}function j0(n,e,t,i,s,r){let a=e*t;if(i===1){let o=new Uint8Array(s,r,a);o.set(n.subarray(0,Math.min(t,a)));for(let l=t;l<a;l++)o[l]=n[l]+o[l-t]}else if(i===2){let o=new Uint16Array(s,r,a);for(let l=0;l<a;l++){let c=n[l]|n[a+l]<<8;o[l]=l<t?c:c+o[l-t]}}else if(i===4){let o=new Uint32Array(s,r,a),l=2*a,c=3*a;for(let h=0;h<a;h++){let u=(n[h]|n[a+h]<<8|n[l+h]<<16|n[c+h]<<24)>>>0;o[h]=h<t?u:u+o[h-t]}}else{let o=new Uint32Array(s,r,2*a),l=Cf?0:1,c=1-l;for(let h=0;h<a;h++){let u=(n[h]|n[a+h]<<8|n[2*a+h]<<16|n[3*a+h]<<24)>>>0,d=(n[4*a+h]|n[5*a+h]<<8|n[6*a+h]<<16|n[7*a+h]<<24)>>>0;if(h>=t){let f=2*(h-t);u+=o[f+l],d+=o[f+c]+(u>4294967295?1:0)}o[2*h+l]=u,o[2*h+c]=d}}}function J0(n){return Math.min(n.chunk_rows,n.shape[0])*n.shape.slice(1).reduce((e,t)=>e*t,1)*js(n.dtype)}async function K0(n,e,t,i){let s=js(e.dtype),r=e.shape[0],a=e.shape.slice(1).reduce((l,c)=>l*c,1),o=new ArrayBuffer(r*a*s);for(let[l,[c,h]]of e.chunks.entries()){let u=l*e.chunk_rows,d=Math.min(e.chunk_rows,r-u),f=i.subarray(0,d*a*s);await Y0(t.subarray(c,c+h),f,`chunk ${l} of view ${n}`),j0(f,d,a,s,o,u*a*s)}return new Ks[e.dtype](o,0,r*a)}function Z0(n,e,t){Rh(e)||E("1",`view ${n} is not an object`);let i=typeof e.encoding=="string"&&Object.hasOwn(Af,e.encoding)?Af[e.encoding]:null;i===null&&E("D2",`view ${n} has encoding ${JSON.stringify(e.encoding)}, which this reader does not know`);let s=Object.keys(e).filter(h=>!i.has(h));s.length>0&&E("D2",`view ${n} has keys ${s.sort().join(", ")} that this reader does not know`);let r=[...i].filter(h=>!Object.hasOwn(e,h));r.length>0&&E("D2",`view ${n} lacks the keys ${r.join(", ")}`),X0(e.dtype)||E("D1",`view ${n} has dtype ${JSON.stringify(e.dtype)}, not one of ${Object.keys(Ks).join(", ")}`);let a=e.shape;(!Array.isArray(a)||a.length===0||!a.every(na))&&E("D2",`view ${n} has shape ${JSON.stringify(a)}, not a nonempty list of counts`);let o=a.reduce((h,u)=>h*u,1)*js(e.dtype);if(Number.isSafeInteger(o)||E("D2",`view ${n} has shape [${a.join(", ")}], which is too large`),e.encoding==="raw"){(!na(e.offset)||!na(e.length))&&E("D2",`view ${n} has an offset or a length that is not a count`),e.offset%8!==0&&E("D2",`view ${n} starts at byte ${e.offset}, which is not a multiple of 8`),e.length!==o&&E("D2",`view ${n} has length ${e.length}, while shape [${a.join(", ")}] of ${e.dtype} takes ${o} bytes`),e.offset+e.length>t&&E("D2",`view ${n} runs past the end of the file, at bytes ${e.offset} to ${e.offset+e.length} of the payload`);return}let l=e.chunk_rows;(!na(l)||l<1)&&E("D5",`view ${n} has chunk_rows ${JSON.stringify(l)}, not a positive integer`),Array.isArray(e.chunks)||E("D5",`the chunks of view ${n} are not a list`);let c=Math.ceil(a[0]/l);e.chunks.length!==c&&E("D5",`view ${n} has ${e.chunks.length} chunks, while ${a[0]} rows in chunks of ${l} take ${c}`),e.chunks.forEach((h,u)=>{(!Array.isArray(h)||h.length!==2||!h.every(na))&&E("D5",`chunk ${u} of view ${n} is not an [offset, length] pair of counts`),h[0]+h[1]>t&&E("D5",`chunk ${u} of view ${n} runs past the end of the file`)})}var Js=class n{header;bytes;payloadStart;cache=new Map;constructor(e,t,i){this.header=e,this.bytes=t,this.payloadStart=i}static async parse(e){let t=ArrayBuffer.isView(e)?new DataView(e.buffer,e.byteOffset,e.byteLength):new DataView(e),i=t.byteLength;(i<ta||$0.some((u,d)=>t.getUint8(d)!==u))&&E("1",'the bytes are not a TyCHO data container, since they lack the 12-byte preamble that starts with the magic "TYCD"');let s=t.getUint32(4,!0);s!==Ys&&E("D3",`data container version ${s} is not supported, since this reader reads only version ${Ys}`);let r=t.getUint32(8,!0);ta+r>i&&E("1",`the header length ${r} runs past the end of the file`);let a;try{let u=new TextDecoder("utf-8",{fatal:!0,ignoreBOM:!0}).decode(new Uint8Array(t.buffer,t.byteOffset+ta,r));a=JSON.parse(u)}catch(u){E("1",`the header is not JSON: ${u.message}`)}(a===null||typeof a!="object")&&E("1","the header is not a JSON object"),a.format!=="tycho-data"&&E("1",`header format is ${JSON.stringify(a.format)}, not "tycho-data"`),a.version!==Ys&&E("D3",`header version ${JSON.stringify(a.version)} is not supported, since this reader reads only version ${Ys}`),a.generator!==void 0&&typeof a.generator!="string"&&E("1","the header generator is not a string"),a.meta!==void 0&&!Rh(a.meta)&&E("1","the header meta is not an object"),Rh(a.views)||E("1",'the header lacks a "views" object');let o=ta+r+(8-(ta+r)%8)%8,l=Math.max(0,i-o);for(let[u,d]of Object.entries(a.views))Z0(u,d,l);let c=new n(a,t,o),h=Object.entries(a.views).filter(u=>u[1].encoding==="shuffle-delta-deflate");if(h.length>0){typeof DecompressionStream>"u"&&E("D5","this runtime lacks DecompressionStream, which encoded views need");let u=new Uint8Array(t.buffer,t.byteOffset+o,l),d=new Uint8Array(Math.max(...h.map(([,f])=>J0(f))));for(let[f,p]of h){let y=await K0(f,p,u,d);c.cache.set(f,{name:f,dtype:p.dtype,shape:[...p.shape],data:y})}}return c}has(e){return Object.hasOwn(this.header.views,e)}names(){return Object.keys(this.header.views)}view(e){let t=this.cache.get(e);if(t)return t;this.has(e)||E("2.1",`the data container lacks view ${JSON.stringify(e)}`);let i=this.header.views[e],s=i.length/js(i.dtype),r=this.bytes.byteOffset+this.payloadStart+i.offset,a=Cf&&r%js(i.dtype)===0?new Ks[i.dtype](this.bytes.buffer,r,s):q0(this.bytes,this.payloadStart+i.offset,s,i.dtype),o={name:e,dtype:i.dtype,shape:[...i.shape],data:a};return this.cache.set(e,o),o}};function Q0(n){let e=atob(n.replace(/\s+/g,"")),t=new Uint8Array(new ArrayBuffer(e.length));for(let i=0;i<e.length;i++)t[i]=e.charCodeAt(i);return t}function wo(n,e="base64"){return e!=="base64"&&E("1",`data encoding ${e} is not base64`),Q0(n)}var ys=0,ia=4,Rf=new Set(["frames.origin_channel","layers.arrows","layers.driver_context","layers.outline","clock.keys","layers.clock","camera.keys","layers.label","layers.points"]),Pf=new Set(["format","version","requires","generator","title","theme","frames","bodies","track_sets","variables","clock","views","controls","readouts","initial","stages","overlays"]),Mo=/^[A-Za-z0-9_.-]+$/,ot="@index";var sa=8,Ph=["linear","smooth","in","out","in-out","hold"];function Ct(n){return n.seconds??sa*(n.laps??1)}function Bn(n,e){return e*Ct(n)}function Lf(n,e){switch(n??"linear"){case"linear":return e;case"smooth":return e*e*(3-2*e);case"in":return e*e*e;case"out":{let t=1-e;return 1-t*t*t}case"in-out":{if(e<.5)return 4*e*e*e;let t=2-2*e;return 1-t*t*t/2}case"hold":return 0;default:return E("K2",`the ease ${JSON.stringify(n)} is not one of ${Ph.join(", ")}`)}}function zi(n,e,t=i=>typeof i=="number"&&Number.isFinite(i)){(!Array.isArray(n)||n.length===0)&&E("K1",`${e} has keys ${JSON.stringify(n)}, not a list of at least one key`);let i=-1/0;for(let s of n){(!Array.isArray(s)||s.length<2||s.length>3)&&E("K1",`${e} has a key ${JSON.stringify(s)}, not [t, v] or [t, v, ease]`);let r=s[0];(typeof r!="number"||!Number.isFinite(r))&&E("K1",`${e} has a key at ${JSON.stringify(r)}, not a finite time`),r<i&&E("K1",`${e} has keys whose times decrease, from ${i} to ${r}`),i=r,t(s[1])||E("K1",`${e} has a key whose value is ${JSON.stringify(s[1])}`),s.length===3&&(typeof s[2]!="string"||!Ph.includes(s[2]))&&E("K2",`${e} has a key whose ease is ${JSON.stringify(s[2])}, not one of ${Ph.join(", ")}`)}return n}function If(n,e,t,i){let s=-1,r=0,a=e-1;for(;r<=a;){let l=r+a>>1;n(l)<=t?(s=l,r=l+1):a=l-1}if(s<0)return{i:0,e:null};if(s===e-1)return{i:s,e:null};let o=(t-n(s))/(n(s+1)-n(s));return{i:s,e:Lf(i(s+1),o)}}function Zs(n,e){let{i:t,e:i}=If(r=>n[r][0],n.length,e,r=>n[r][2]),s=n[t][1];return i===null?s:s+i*(n[t+1][1]-s)}function ra(n,e,t){return n===void 0?t:typeof n=="number"?n:Zs(n.keys,e)}function Xt(n,e,t=1){return Math.min(1,Math.max(0,ra(n,e,t)))}function aa(n,e,t){return Math.max(0,ra(n,e,t))}function vn(n,e,t,i="2.7"){if(n!==void 0){if(typeof n=="number"){t(n)||E(i,`${e} is ${n}`);return}(n===null||typeof n!="object"||!("keys"in n))&&E(i,`${e} is ${JSON.stringify(n)}, not a number or a tween`),zi(n.keys,e,t)}}var zn=n=>typeof n=="number"&&n>=0&&n<=1,Bi=n=>typeof n=="number"&&Number.isFinite(n)&&n>0;function Eo(n,e){if(n.keys!==void 0)return n.range!==void 0&&E("K3","the clock has both a range and keys"),Zs(n.keys,Bn(n,e));n.range===void 0&&E("C2","the clock is in value mode but does not have a range of two numbers or keys");let[t,i]=n.range;return t+e*(i-t)}function Qs(n){return n.plane==="xz"?[0,2]:n.plane==="yz"?[1,2]:[0,1]}function kf(n,e,t){let{i,e:s}=If(h=>n[h].at,n.length,e,h=>n[h].ease),r=n[i],a=t(i);if(a===null)return null;if(s===null)return{center:a,width:r.width,height:r.height??null};let o=n[i+1],l=t(i+1);if(l===null)return null;let c=(h,u)=>Math.exp((1-s)*Math.log(h)+s*Math.log(u));return{center:[(1-s)*a[0]+s*l[0],(1-s)*a[1]+s*l[1]],width:c(r.width,o.width),height:r.height!==void 0&&o.height!==void 0?c(r.height,o.height):null}}function To(n,e,t){(!Array.isArray(n)||n.length===0)&&E("K5",`${t} has keys ${JSON.stringify(n)}, not a list of at least one camera key`);let i=-1/0,s=0;for(let r of n){(r===null||typeof r!="object")&&E("K5",`${t} has a key ${JSON.stringify(r)}, not an object`),(typeof r.at!="number"||!Number.isFinite(r.at))&&E("K5",`${t} has a key at ${JSON.stringify(r.at)}, not a finite time`),r.at<i&&E("K5",`${t} has keys whose times decrease, from ${i} to ${r.at}`),i=r.at,Bi(r.width)||E("K5",`${t} has a key of width ${JSON.stringify(r.width)}, not a positive number`),r.height!==void 0&&(e||E("K5",`${t} has a key with a height, which only a camera of free aspect takes`),Bi(r.height)||E("K5",`${t} has a key of height ${JSON.stringify(r.height)}, not a positive number`),s++);for(let a of[r.center,r.offset])a!==void 0&&!(Array.isArray(a)&&a.length===2&&a.every(o=>typeof o=="number"&&Number.isFinite(o)))&&E("K5",`${t} has a key whose center or offset is ${JSON.stringify(a)}, not two finite numbers`);if(r.follow===void 0&&r.center===void 0&&E("K5",`${t} has a key with neither a center nor follow targets`),r.follow!==void 0){(!Array.isArray(r.follow)||r.follow.length===0)&&E("K5",`${t} has a key whose follow is not a list of targets`);for(let a of r.follow)(a===null||typeof a!="object"||!Number.isInteger(a.layer)||a.layer<0||!Number.isInteger(a.member)||a.member<0)&&E("K5",`${t} has a follow target ${JSON.stringify(a)}, not {layer, member} of two nonnegative integers`)}r.ease!==void 0&&Lf(r.ease,0)}s!==0&&s!==n.length&&E("K5",`${t} gives a height in some keys but not in all`)}function Df(n,e){return Number.isInteger(e)||E("2.6",`the frame index ${String(e)} is not an integer`),(!Number.isInteger(n)||n<1)&&E("2.6",`the clock has steps ${String(n)}, not a count of at least one`),(e%n+n)%n/n}var li=class{m;c0;c1;u;constructor(e,t,i){let s=e.count(t);if(this.m=s,this.u=new Float64Array(s),i===ot){this.c0=0,this.c1=s-1;for(let l=0;l<s;l++)this.u[l]=l/(s-1);return}let r=e.channel(i,"C5"),a=e.start(t);this.c0=r[a],this.c1=r[a+s-1];let o=Math.sign(r[a+1]-r[a]);for(let l=0;l<s;l++)(!Number.isFinite(r[a+l])||l>0&&!((r[a+l]-r[a+l-1])*o>0))&&E("T3",`clock channel ${i} of track set ${e.id} is not both finite and strictly monotone along track ${t}`);Number.isFinite(this.c1-this.c0)||E("T3",`clock channel ${i} of track set ${e.id} has an infinite span along track ${t}`);for(let l=0;l<s;l++)this.u[l]=(r[a+l]-this.c0)/(this.c1-this.c0)}at(e){return this.u[e]}reading(e,t){return e.mode==="fraction"?t:(Eo(e,t)-this.c0)/(this.c1-this.c0)}locate(e){let t=0,i=this.m-2;for(;t<i;){let r=t+i+1>>1;this.u[r]<=e?t=r:i=r-1}let s=t;return{k:s,w:(e-this.u[s])/(this.u[s+1]-this.u[s])}}};function Rt(n){return n.laps===void 0?1:(n.mode==="value"&&E("C6","the clock is in value mode but has laps"),(!Number.isInteger(n.laps)||n.laps<1)&&E("C6",`the clock has laps ${String(n.laps)}, not an integer of at least one`),n.laps)}function rn(n,e){let t=Math.min(Math.floor(n),e-1);return{lap:t,u:n-t}}function Xn(n,e="clamp",t="clamp"){return n<0?e==="hidden"?null:0:n>1?t==="hidden"?null:1:n}function oa(n,e){(e===null||typeof e!="object"||typeof e.channel!="string")&&E("K4",`a layer's clock is ${JSON.stringify(e)}, not {channel, range} or {channel, keys}`);let t=e.range!==void 0,i=e.keys!==void 0;t===i&&E("K4",`the clock of a layer on channel ${e.channel} has ${t?"both a range and keys":"neither a range nor keys"}`),t&&!(Array.isArray(e.range)&&e.range.length===2&&e.range.every(r=>typeof r=="number"&&Number.isFinite(r)))&&E("K4",`the clock of a layer on channel ${e.channel} has range ${JSON.stringify(e.range)}, not two finite numbers`),i&&zi(e.keys,`the clock of a layer on channel ${e.channel}`);let s={mode:"value",channels:[e.channel],steps:n.steps,seconds:Ct(n)};return t?s.range=[e.range[0],e.range[1]]:s.keys=e.keys,s}function Hi(n,e){return typeof n=="number"?(Number.isFinite(n)||E("S4",`a scalar is ${n}, not finite`),n):((n===null||typeof n!="object")&&E("2.2",`${JSON.stringify(n)} is not a scalar`),"attr"in n?(n.factor??1)*e.set.attr(n.attr)+(n.offset??0):(n.channel===ot&&E("2.2",`${ot} is not allowed in a frame edge`),e.set.channelAt(n.channel,e.track,e.sample,e.shifted,e.lap??0)))}function Lh(n,e,t=!1){if((!Array.isArray(n)||n.length!==3)&&E("F2",`${e} is three scalars, not ${JSON.stringify(n)}`),!t)for(let i of n)i!==null&&typeof i=="object"&&"channel"in i&&E("F2",`${e} takes a number or an attribute, not a channel`);return n}function Nf(n,e,t,i){let s=Math.cos(t),r=i?-Math.sin(t):Math.sin(t),[a,o,l]=n;return e==="z"?[s*a-r*o,r*a+s*o,l]:e==="x"?[a,s*o-r*l,r*o+s*l]:[s*a+r*l,o,-r*a+s*l]}var Ih=class{frames;depth=new Map;paths=new Map;root;constructor(e){this.frames=e;let t=Object.keys(e),i=t.filter(r=>e[r].parent===void 0);i.length!==1&&E("2.3",`the frames have ${i.length} roots, not one: ${JSON.stringify(i)}`),this.root=i[0];let s=e[this.root];(s.origin!==void 0||s.rotation!==void 0||s.scale!==void 0)&&E("2.3",`the root frame ${this.root} has an origin, a rotation, or a scale`);for(let r of t){let a=e[r].scale;(a===0||a!==void 0&&typeof a=="object"&&"attr"in a&&(a.factor??1)===0&&(a.offset??0)===0)&&E("F2",`the scale of frame ${r} is zero`)}for(let r of t){let a=0;for(let o=r;o!==this.root;a++){let l=e[o].parent;(l===void 0||!Object.hasOwn(e,l))&&E("2.3",`the parent ${l} of frame ${o} is not declared`),a>t.length&&E("2.3",`the parents of frame ${r} form a cycle`),o=l}this.depth.set(r,a)}}has(e){return this.depth.has(e)}frame(e){return this.has(e)||E("2.3",`frame ${JSON.stringify(e)} is not declared`),this.frames[e]}inSubtree(e,t){for(let i=e;i!==void 0;i=this.frames[i].parent)if(i===t)return!0;return!1}path(e,t){let i=this.paths.get(e),s=i?.get(t);if(s!==void 0)return s;this.frame(e),this.frame(t);let r=[],a=[],o=e,l=t;for(;this.depth.get(o)>this.depth.get(l);)r.push(o),o=this.frames[o].parent;for(;this.depth.get(l)>this.depth.get(o);)a.push(l),l=this.frames[l].parent;for(;o!==l;)r.push(o),a.push(l),o=this.frames[o].parent,l=this.frames[l].parent;let c={up:r,down:a.reverse()};return i===void 0&&this.paths.set(e,i=new Map),i.set(t,c),c}},Ao=(n,e)=>{n===void 0||typeof n=="number"||("attr"in n?e.attrs.add(n.attr):e.channels.add(n.channel))},Vi=class{tree;scene;active=new Set;edges=new Map;bodies=new Map;constructor(e){this.scene=e,this.tree=new Ih(e.frames);for(let t of Object.keys(e.frames))this.requirements(t,this.tree.root)}body(e){let t=this.bodies.get(e);if(t!==void 0)return t;let i=this.scene.bodies??{};Object.hasOwn(i,e)||E("2.4",`body ${JSON.stringify(e)} is not declared`);let s=i[e];return Object.hasOwn(this.scene.frames,s.frame)||E("2.4",`body ${e} is in frame ${JSON.stringify(s.frame)}, which is not declared`),Lh(s.position,`the position of body ${e}`),this.bodies.set(e,s),s}edgeOf(e){let t=this.edges.get(e);if(t===void 0){let i=this.tree.frame(e),s=Array.isArray(i.origin)?Lh(i.origin,`the origin of frame ${e}`,!0):i.origin;t={parent:i.parent,origin:s,rotation:i.rotation,scale:i.scale},this.edges.set(e,t)}return t}transform(e,t,i,s){let{up:r,down:a}=this.tree.path(t,i),o=e;for(let l of r)o=this.edge(l,o,s,!0);for(let l of a)o=this.edge(l,o,s,!1);return o}bodyPosition(e,t,i){let s=this.body(e),r=s.position.map(a=>Hi(a,i));return this.transform(r,s.frame,t,i)}edge(e,t,i,s){let r=this.edgeOf(e),a=[0,0,0];if(Array.isArray(r.origin))a=[Hi(r.origin[0],i),Hi(r.origin[1],i),Hi(r.origin[2],i)];else if(r.origin!==void 0){this.active.has(e)&&E("F6",`the origin of frame ${e} depends on itself`),this.active.add(e);try{a=this.bodyPosition(r.origin.body,r.parent,i)}finally{this.active.delete(e)}}let o=r.scale===void 0?1:Hi(r.scale,i);o===0&&E("F2",`the scale of frame ${e} is zero`);let l=r.rotation,c=l===void 0?0:Hi(l.angle,i);if(!s){let u=[t[0]-a[0],t[1]-a[1],t[2]-a[2]];return l!==void 0&&(u=Nf(u,l.axis,c,!1)),[o*u[0],o*u[1],o*u[2]]}let h=[t[0]/o,t[1]/o,t[2]/o];return l!==void 0&&(h=Nf(h,l.axis,c,!0)),[a[0]+h[0],a[1]+h[1],a[2]+h[2]]}requirements(e,t,i={channels:new Set,attrs:new Set}){let{up:s,down:r}=this.tree.path(e,t);for(let a of[...s,...r]){this.active.has(a)&&E("F6",`the origin of frame ${a} depends on itself`),this.active.add(a);try{let o=this.tree.frame(a);Array.isArray(o.origin)?Lh(o.origin,`the origin of frame ${a}`,!0).forEach(l=>Ao(l,i)):o.origin!==void 0&&this.bodyRequirements(o.origin.body,o.parent,i),Ao(o.rotation?.angle,i),Ao(o.scale,i)}finally{this.active.delete(a)}}return i}bodyRequirements(e,t,i={channels:new Set,attrs:new Set}){let s=this.body(e);return s.position.forEach(r=>Ao(r,i)),this.requirements(s.frame,t,i)}};function lt(n,e){return n.variables!==void 0&&Object.hasOwn(n.variables,e)?n.variables[e]:void 0}function Gi(n,e){let t=lt(n.scene,e);t===void 0&&E("2.5",`variable ${JSON.stringify(e)} is not declared`);let i=t.scope==="panel"?n.panel.variables:n.state.variables,s=i!==void 0&&Object.hasOwn(i,e)?i[e]:void 0;return s===void 0?t.default:s}function Co(n,e){return n.kind==="selector"?typeof e=="number"&&Number.isFinite(e):n.kind==="toggle"?typeof e=="boolean":typeof e=="string"&&n.values.includes(e)}function er(n,e){n.clock.channels.includes(e.clock.channel)||E("2.6",`the state's clock channel ${JSON.stringify(e.clock.channel)} is not one of the scene's clock channels`);let t=(r,a)=>{for(let[o,l]of Object.entries(r??{})){let c=lt(n,o);c!==void 0&&!Co(c,l)&&E("2.5",`${a}: ${c.kind} ${o} cannot hold ${JSON.stringify(l)}`)}};t(e.variables,"the state");let i=Object.keys(e.panels);i.length===0&&E("2.8","the state does not have a panel");for(let[r,a]of Object.entries(e.panels))Object.hasOwn(n.views,a.view)||E("2.8",`panel ${r} shows ${JSON.stringify(a.view)}, which is not a view`),t(a.variables,`panel ${r}`);let s=vs(e.layout).sort();(s.length!==i.length||s.some((r,a)=>r!==i.slice().sort()[a]))&&E("2.8",`the layout shows the panels ${s.join(", ")}, while the state has the panels ${i.slice().sort().join(", ")}`)}function vs(n,e=[]){return n.kind==="panel"?e.push(n.id):(vs(n.a,e),vs(n.b,e)),e}function ey(n,e){return typeof e=="string"?e:Gi(n,e.var)}function la(n,e){if("set"in e)return Object.hasOwn(n.scene.track_sets,e.set)||E("V2",`the set query names ${JSON.stringify(e.set)}, which is not a track set`),[e.set];(e.tags===null||typeof e.tags!="object")&&E("V2",`a tags query has tags ${JSON.stringify(e.tags)}, not an object`);let t=Object.entries(e.tags).map(([i,s])=>[i,ey(n,s)]);return Object.entries(n.scene.track_sets).filter(([,i])=>t.every(([s,r])=>Object.hasOwn(i.tags??{},s)&&i.tags[s]===r)).map(([i])=>i)}function Et(n,e){let t=la(n,e);return t.length>1&&E("V2",`the set query ${JSON.stringify(e)} matches the ${t.length} track sets ${t.join(", ")}, where one is needed`),t[0]??null}function Ro(n,e,t){let i=lt(n.scene,e.var);(i===void 0||i.kind!=="selector")&&E("V3",`variable ${e.var} is not a selector`);let s=Gi(n,e.var);if((typeof s!="number"||!Number.isFinite(s))&&E("2.5",`selector ${e.var} holds ${JSON.stringify(s)}, not a finite number`),(i.by??"nearest")==="index")return Math.min(Math.max(Math.floor(s+.5),0),t.tracks-1);let a=i.parameter;a===void 0&&E("2.5",`selector ${e.var} is by nearest but does not name a parameter`);let o=t.parameter(a,"V3"),l=0;for(let c=1;c<t.tracks;c++)Math.abs(o[c]-s)<Math.abs(o[l]-s)&&(l=c);return l}function Of(n,e){return(!Number.isInteger(n)||n<0)&&E("V3",`member index ${JSON.stringify(n)} is not a track index`),n>=e.tracks&&E("V3",`member index ${n} is not below the track count ${e.tracks} of track set ${e.id}`),n}function ty(n,e){(!Number.isInteger(e)||e<1)&&E("V3",`member count ${JSON.stringify(e)} is not an integer of at least one`);let t=e>=n?1:Math.floor(n/e+.5),i=[];for(let s=0;s<n;s+=t)i.push(s);return i[i.length-1]!==n-1&&i.push(n-1),i}function tr(n,e,t){return e==="all"?Array.from({length:t.tracks},(i,s)=>s):((e===null||typeof e!="object")&&E("V3",`a member reference is "all", {index}, {count}, or {var}, not ${JSON.stringify(e)}`),"index"in e?[Of(e.index,t)]:"count"in e?ty(t.tracks,e.count):[Ro(n,e,t)])}function nr(n,e,t){return e==="all"&&E("V3",`the driver's member is "all", but a driver resolves to one track`),(e===null||typeof e!="object")&&E("V3",`the driver's member is {index} or {var}, not ${JSON.stringify(e)}`),"count"in e&&E("V3","the driver's member is a count, but a driver resolves to one track"),"index"in e?Of(e.index,t):Ro(n,e,t)}function Po(n,e){let{scene:t,state:i}=n,s=vs(i.layout).find(r=>i.panels[r]?.view===e);return s===void 0?null:{panel:s,frame:bs({scene:t,state:i,panel:i.panels[s]},t.views[e])}}function bs(n,e){let t=typeof e.frame=="string"?e.frame:Gi(n,e.frame.var);return(typeof t!="string"||!Object.hasOwn(n.scene.frames,t))&&E("2.7",`the view displays ${JSON.stringify(t)}, which is not a frame`),t}function ir(n,e){if(e.visible===void 0)return!0;let t=lt(n.scene,e.visible.var);(t===void 0||t.kind!=="toggle")&&E("L5",`a layer's visible names ${e.visible.var}, which is not a toggle`);let i=Gi(n,e.visible.var);return typeof i!="boolean"&&E("L5",`toggle ${e.visible.var} holds ${JSON.stringify(i)}, not a boolean`),i}function Pt(n,e,t,i=0){let{k:s,w:r}=n.locate(e);return{k:s,w:r,shifted:t,lap:i}}function Lo(n,e,t,i=0){if(e===t)return[Pt(n,e,!1,i)];let s=[Pt(n,e,!1,i)];for(let r=0;r<n.m;r++){let a=n.at(r);e<a&&a<t&&s.push({sample:r,shifted:!1,lap:i})}return s.push(Pt(n,t,!1,i)),s}function Io(n,e,t,i){let s=rn(e,i),r=rn(t,i);if(s.lap===r.lap)return Lo(n,s.u,r.u,s.lap);let a=Lo(n,s.u,1,s.lap).slice(0,-1);for(let o=s.lap+1;o<r.lap;o++)a.push(...Lo(n,0,1,o).slice(0,-1));return a.push(...Lo(n,0,r.u,r.lap)),a}function Dh(n,e,t){let i=t?e:1,s=[];for(let r=0;r<i;r++)for(let a=0;a<(r===i-1?n:n-1);a++)s.push({sample:a,shifted:!1,lap:r});return s}function ko(n,e,t,i,s){let r=e-t*i;return r<0&&!s&&(r=0),Io(n,r,e,t)}function Wi(n){return n.head===!0||typeof n.head=="object"&&n.head!==null}function xs(n,e,t,i){let s=n.lap??0;if("sample"in n)return i({set:e,track:t,sample:n.sample,shifted:n.shifted,lap:s});let r=i({set:e,track:t,sample:n.k,shifted:n.shifted,lap:s}),a=i({set:e,track:t,sample:n.k+1,shifted:n.shifted,lap:s}),o=n.w;return[(1-o)*r[0]+o*a[0],(1-o)*r[1]+o*a[1],(1-o)*r[2]+o*a[2]]}function xi(n,e){if(e.clock===void 0)return n;let t=n.base??n,i=oa(t.clock,e.clock);return{...t,clock:i,channel:i.channels[0],base:t}}function _s(n,e,t){n=n.base??n,t??=new li(e.set,e.track,n.channel);let i=Rt(n.clock),s=i*Xn(t.reading(n.clock,n.q)),r=rn(s,i);return{tc:t,loopReading:s,at:Pt(t,r.u,!1,r.lap)}}function sr(n,e){let t=e.lap??0,{set:i,track:s}=n;return{a:{set:i,track:s,sample:e.k,shifted:!1,lap:t},b:{set:i,track:s,sample:e.k+1,shifted:!1,lap:t},w:e.w}}function Uf(n,e,t,i=null){if(t===null)return{kind:"track",set:null,members:[]};let s=e.reveal??"none";["none","grow","trail"].includes(s)||E("2.7",`a track layer's reveal is ${JSON.stringify(s)}, not none, grow, or trail`);for(let f of["before","after"])e[f]!==void 0&&e[f]!=="clamp"&&e[f]!=="hidden"&&E("C3",`a track layer's ${f} is ${JSON.stringify(e[f])}, not clamp or hidden`);s==="trail"&&kh(e);let r=e.context??"own";r!=="own"&&r!=="driver"&&E("L6",`a track layer's context is ${JSON.stringify(r)}, not own or driver`);let a=Rt(n.clock),o=t.def.frame,l=f=>n.frames.transform(t.position(f.track,f.sample),o,n.display,f),c=r==="driver"&&i!==null?sr(i,_s(n,i).at):null;if(c!==null){let{a:f,b:p,w:y}=c;l=m=>{let g=t.position(m.track,m.sample),v=n.frames.transform(g,o,n.display,f),_=n.frames.transform(g,o,n.display,p);return[(1-y)*v[0]+y*_[0],(1-y)*v[1]+y*_[1],(1-y)*v[2]+y*_[2]]}}let h=Wi(e),u=s!=="none"||h||n.clock.mode==="value"&&(e.before==="hidden"||e.after==="hidden");u&&a>1&&!t.periodic&&E("C6",`a reading is taken on track set ${t.id}, which is not periodic, and the clock has ${a} laps`);let d=[];for(let f of tr(n.scope,e.members,t)){let p=[],y=null,m=null;u&&(m=new li(t,f,n.channel),y=Xn(m.reading(n.clock,n.q),e.before,e.after));let g=u&&y===null||r==="driver"&&c===null,v=a*(y??0);g||(s==="none"?p.push(...Dh(t.count(f),a,t.periodic)):s==="grow"?p.push(...Io(m,0,v,a)):p.push(...ko(m,v,a,kh(e),t.periodic)));let _={index:f,line:p.map(b=>xs(b,t,f,l))};if(h){let b=rn(v,a);_.head=g?null:xs(Pt(m,b.u,!1,b.lap),t,f,l)}d.push(_)}return{kind:"track",set:t.id,members:d}}function Nh(n){let e=n.vector;(!Array.isArray(e)||e.length<2||e.length>3||!e.every(i=>typeof i=="string"))&&E("L7",`an arrow layer's vector is ${JSON.stringify(e)}, not two or three channel names`),e.includes(ot)&&E("L7",`${ot} is not allowed in the vector of an arrow layer`);let t=n.scale??1;return typeof t=="object"&&t!==null&&"channel"in t&&E("L7","the scale of an arrow layer takes a number or an attribute, not a channel"),{vector:e,scale:t}}function Do(n,e,t,i){let{vector:s,scale:r}=Nh(e);for(let h of["before","after"])e[h]!==void 0&&e[h]!=="clamp"&&e[h]!=="hidden"&&E("C3",`an arrow layer's ${h} is ${JSON.stringify(e[h])}, not clamp or hidden`);if(t===null)return{kind:"arrow",set:null,members:[]};for(let h of s)t.hasChannel(h)||E("L7",`track set ${t.id} lacks channel ${JSON.stringify(h)} of an arrow layer's vector`);let a=Rt(n.clock);a>1&&!t.periodic&&E("C6",`a reading is taken on track set ${t.id}, which is not periodic, and the clock has ${a} laps`);let o=t.def.frame,l=s.map(h=>t.channel(h)),c=[];for(let h of tr(n.scope,e.members,t)){let u=i?i(h):new li(t,h,n.channel),d=Xn(u.reading(n.clock,n.q),e.before,e.after);if(d===null){c.push({index:h,base:null,tip:null});continue}let f=Hi(r,{set:t,track:h,sample:0,shifted:!1,lap:0}),p=t.start(h),y=_=>n.frames.transform(t.position(_.track,_.sample),o,n.display,_),m=_=>{let b=t.position(_.track,_.sample);for(let M=0;M<l.length;M++)b[M]+=f*l[M][p+_.sample];return n.frames.transform(b,o,n.display,_)},g=rn(a*d,a),v=Pt(u,g.u,!1,g.lap);c.push({index:h,base:xs(v,t,h,y),tip:xs(v,t,h,m)})}return{kind:"arrow",set:t.id,members:c}}function Oh(n,e,t){let i=t.view;(typeof i!="string"||!Object.hasOwn(n.views,i))&&E("L8",`an outline layer names ${JSON.stringify(i)}, which is not a view`),i===e&&E("L8",`an outline layer of view ${e} names its own view`),(n.views[i].camera?.kind??"plane")!=="plane"&&E("L8",`an outline layer names view ${i}, whose camera is not a plane camera`)}function No(n,e,t){Oh(n.scope.scene,n.scope.panel.view,e);let i={kind:"outline",view:e.view,panel:null,frame:null,origin:null,axes:null},s=Po(n.scope,e.view);if(s===null||(i.panel=s.panel,i.frame=s.frame,t===null))return i;let{a:r,b:a,w:o}=sr(t,_s(n,t).at),l=u=>{let d=n.frames.transform(u,s.frame,n.display,r),f=n.frames.transform(u,s.frame,n.display,a);return[(1-o)*d[0]+o*f[0],(1-o)*d[1]+o*f[1],(1-o)*d[2]+o*f[2]]},c=l([0,0,0]),h=u=>{let d=l(u);return[d[0]-c[0],d[1]-c[1],d[2]-c[2]]};return i.origin=c,i.axes=[h([1,0,0]),h([0,1,0]),h([0,0,1])],i}function kh(n){n.trail===void 0&&E("2.7","a layer draws a trail but lacks a trail fraction");let e=n.trail.fraction;return(typeof e!="number"||!(e>0&&e<=1))&&E("2.7",`the trail fraction ${String(e)} is not in (0, 1]`),e}function Ff(n,e,t){let i={kind:"body",body:e.body,position:null};if(t===null)return e.trail!==void 0&&(i.trail=[]),i;let{set:s,track:r}=t,a=Rt(n.clock),{tc:o,loopReading:l,at:c}=_s(n,t),h=u=>n.frames.bodyPosition(e.body,n.display,u);return i.position=xs(c,s,r,h),e.trail!==void 0&&(i.trail=ko(o,l,a,kh(e),s.periodic).map(u=>xs(u,s,r,h))),i}function ny(n,e,t,i){let s=t.def.frame,r=c=>n.frames.transform(t.position(c.track,c.sample),s,n.display,c);if((e.context??"own")!=="driver")return{f:r,hidden:!1};if(i===null)return{f:r,hidden:!0};let{a,b:o,w:l}=sr(i,_s(n,i).at);return{hidden:!1,f:c=>{let h=t.position(c.track,c.sample),u=n.frames.transform(h,s,n.display,a),d=n.frames.transform(h,s,n.display,o);return[(1-l)*u[0]+l*d[0],(1-l)*u[1]+l*d[1],(1-l)*u[2]+l*d[2]]}}}function Bf(n,e,t,i){(!Number.isInteger(e)||e<0||e>=n.tracks)&&E(t,`${i} names member ${String(e)}, which is not a track of track set ${n.id} of ${n.tracks}`)}function zf(n,e,t,i){let s=Rt(n.clock);s>1&&!e.periodic&&E("C6",`a reading is taken on track set ${e.id}, which is not periodic, and the clock has ${s} laps`);let r=new li(e,t,n.channel),a=rn(s*Xn(r.reading(n.clock,n.q)),s);return xs(Pt(r,a.u,!1,a.lap),e,t,i)}function Hf(n,e,t,i,s){if(t===null)return null;Bf(t,i,"K5","a camera key");let r=xi(n,e),{f:a,hidden:o}=ny(r,e,t,s);return o?null:zf(r,t,i,a)}function Oo(n,e,t,i){let s=e.at;if((s===null||typeof s!="object")&&E("K6",`a label's anchor is ${JSON.stringify(s)}, not an object`),"screen"in s)return{kind:"label",position:null};if("point"in s){let c=s.point;(!Array.isArray(c)||c.length!==3||!c.every(m=>typeof m=="number"&&Number.isFinite(m)))&&E("K6",`a label's point is ${JSON.stringify(c)}, not three finite numbers`);let h=[c[0],c[1],c[2]];if(s.frame===void 0)return{kind:"label",position:h};if(i===null)return{kind:"label",position:null};let{a:u,b:d,w:f}=sr(i,_s(n,i).at),p=n.frames.transform(h,s.frame,n.display,u),y=n.frames.transform(h,s.frame,n.display,d);return{kind:"label",position:[(1-f)*p[0]+f*y[0],(1-f)*p[1]+f*y[1],(1-f)*p[2]+f*y[2]]}}if((!("sets"in s)||!("member"in s))&&E("K6",`a label's anchor is ${JSON.stringify(s)}, not a point, a member, or a place on the screen`),t===null)return{kind:"label",position:null};let r=s.member;Bf(t,r,"K6","a label");let a=xi(n,e),o=t.def.frame;return{kind:"label",position:zf(a,t,r,c=>a.frames.transform(t.position(c.track,c.sample),o,a.display,c))}}function Uo(n,e,t){let i=e.reveal??"none";i!=="none"&&i!=="grow"&&E("K8",`a points layer's reveal is ${JSON.stringify(i)}, not none or grow`);for(let h of["before","after"])e[h]!==void 0&&e[h]!=="clamp"&&e[h]!=="hidden"&&E("C3",`a points layer's ${h} is ${JSON.stringify(e[h])}, not clamp or hidden`);if(t===null)return{kind:"points",set:null,members:[]};let s=xi(n,e),r=s.clock.mode==="value"&&(e.before==="hidden"||e.after==="hidden"),a=i==="grow"||r,o=Rt(s.clock);a&&o>1&&!t.periodic&&E("C6",`a reading is taken on track set ${t.id}, which is not periodic, and the clock has ${o} laps`);let l=t.def.frame,c=[];for(let h of tr(n.scope,e.members,t)){let u=t.count(h),d=u-1;if(a){let p=new li(t,h,s.channel),y=p.reading(s.clock,s.q);if(Xn(y,e.before,e.after)===null)d=-1;else if(i==="grow")for(d=-1;d+1<u&&p.at(d+1)<=y;)d++}let f=[];for(let p=0;p<=d;p++)f.push(s.frames.transform(t.position(h,p),l,s.display,{set:t,track:h,sample:p,shifted:!1,lap:0}));c.push({index:h,points:f})}return{kind:"points",set:t.id,members:c}}var Uh=class{id;def;tracks;samples;dim;data;offsets;positions;channels=new Map;parameters=new Map;constructor(e,t,i){this.id=e,this.def=t,this.data=i,this.tracks=t.tracks;let s=i.view(t.offsets);(s.dtype!=="uint32"||s.shape.length!==1||s.shape[0]!==t.tracks+1)&&E("2.1",`track set ${e}: offsets view ${t.offsets} is ${s.dtype} of shape (${s.shape.join(", ")}), not uint32 of shape (${t.tracks+1},)`),this.offsets=s.data,this.offsets[0]!==0&&E("2.1",`track set ${e}: offsets[0] is ${this.offsets[0]}, not 0`);for(let l=0;l<t.tracks;l++){let c=this.offsets[l+1]-this.offsets[l];c<2&&E("T1",`track set ${e}: the sample count of track ${l} is ${c}, fewer than two`)}this.samples=this.offsets[t.tracks];let r=i.view(t.positions),[a,o]=r.shape;(r.shape.length!==2||a!==this.samples||o!==2&&o!==3)&&E("2.1",`track set ${e}: positions view ${t.positions} has shape (${r.shape.join(", ")}), not (${this.samples}, 2) or (${this.samples}, 3)`),this.positions=r.data,this.dim=o}get periodic(){return this.def.periodic===!0}start(e){return this.offsets[e]}count(e){return this.offsets[e+1]-this.offsets[e]}position(e,t){let i=(this.offsets[e]+t)*this.dim,s=this.positions;return[s[i],s[i+1],this.dim===3?s[i+2]:0]}hasChannel(e){return e===ot||Object.hasOwn(this.def.channels??{},e)}channel(e,t="F5"){let i=this.channels.get(e);if(i)return i;let s=this.def.channels?.[e];(s===void 0||!Object.hasOwn(this.def.channels??{},e))&&E(t,`track set ${this.id} lacks channel ${JSON.stringify(e)}`);let r=this.data.view(s.view);return(r.shape.length!==1||r.shape[0]!==this.samples)&&E("2.1",`track set ${this.id}: channel ${e} has shape (${r.shape.join(", ")}), not (${this.samples},)`),this.channels.set(e,r.data),r.data}channelAt(e,t,i,s,r=0){let a=this.count(t),o=r-(s?1:0);if(e===ot)return o===0?i:i+o*(a-1);let l=this.channel(e),c=this.offsets[t],h=l[c+i];return o===0?h:h+o*(l[c+a-1]-l[c])}parameter(e,t="2.5"){let i=this.parameters.get(e);if(i)return i;let s=this.def.parameters?.[e];(s===void 0||!Object.hasOwn(this.def.parameters??{},e))&&E(t,`track set ${this.id} lacks parameter ${JSON.stringify(e)}`);let r=this.data.view(s.view);return(r.shape.length!==1||r.shape[0]!==this.tracks)&&E("2.1",`track set ${this.id}: parameter ${e} has shape (${r.shape.join(", ")}), not (${this.tracks},)`),this.parameters.set(e,r.data),r.data}hasAttr(e){return Object.hasOwn(this.def.attrs??{},e)}attr(e){let t=this.def.attrs?.[e];return(t===void 0||!this.hasAttr(e))&&E("F5",`track set ${this.id} lacks attribute ${JSON.stringify(e)}`),t}},$i=class{scene;data;sets=new Map;constructor(e,t){this.scene=e,this.data=t}get(e){let t=this.sets.get(e);if(!t){let i=this.scene.track_sets[e];(i===void 0||!Object.hasOwn(this.scene.track_sets,e))&&E("2.1",`track set ${JSON.stringify(e)} is not declared`),t=new Uh(e,i,this.data),this.sets.set(e,t)}return t}};var iy=["track","arrow","outline","body","axes","grid","label","points"],Vf=["disc","ring","square","diamond","triangle","star","cross","plus"],sy=["slider","tabs","toggle","transport"],Fo=["viridis","plasma","cividis","blues","reds"],Fh=(n,e)=>{Mo.test(n)||E("S3",`${e} ${JSON.stringify(n)} does not match [A-Za-z0-9_.-]+`)},Mt=n=>typeof n=="number"&&Number.isFinite(n),bn=/^#[0-9a-fA-F]{6}$/;function Xi(n,e,t,i){if(!(n===null||typeof n!="object"||Array.isArray(n)))for(let s of Object.keys(n))e.includes(s)||i.push(`${t} has a key ${JSON.stringify(s)} that this reader does not know`)}var ry=["label","axes","unit","parent","origin","rotation","scale"],ay=["label","frame","position","color","image"],oy=["label","frame","tags","attrs","tracks","offsets","positions","channels","parameters","periodic"],ly=["label","frame","camera","driver","layers","opacity","margin"],cy=["kind","plane","aspect","keys"],hy=["kind","projection","up","stretch","turn"],uy=["align","baseline","size","color","weight","linespacing","box","opacity"],Gf={track:["kind","sets","members","reveal","trail","head","before","after","context","fit","color","opacity","width","highlight","visible","clock","line","flat","dash","fill"],arrow:["kind","sets","members","vector","scale","before","after","color","opacity","width","head","visible","clock"],outline:["kind","view","color","opacity","width","dash","min_size","visible"],body:["kind","body","trail","size","visible","opacity"],axes:["kind","span","visible","ticks","size","opacity","titles"],grid:["kind","labels","visible","opacity"],label:["kind","text","at","offset","leader","clock","visible",...uy],points:["kind","sets","members","marker","reveal","before","after","clock","fit","opacity","visible"]},dy=["mode","channels","labels","steps","range","laps","seconds","keys","end"],fy=["background","foreground","grid","font","gutter"];function py(n){n.format!=="tycho-scene"&&E("2",`the format is ${JSON.stringify(n.format)}, not "tycho-scene"`);let e=[],t=/^([0-9]+)\.([0-9]+)$/.exec(String(n.version));t===null?e.push(`version ${JSON.stringify(n.version)} is not "major.minor"`):Number(t[1])!==0?e.push(`major version ${t[1]} is unknown to this reader, which reads ${0}.x`):Number(t[2])>4&&e.push(`version ${t[1]}.${t[2]} is newer than this reader's ${0}.${4}, and the format is unstable until 1.0`);let i=(n.requires??[]).filter(s=>!Rf.has(s));i.length>0&&e.push(`the required features ${i.join(", ")} are not implemented`),e.length>0&&E("S1",e.join(", and "))}function qn(n,e,t,i){let s=lt(n,e);s===void 0&&E(i,`variable ${JSON.stringify(e)} is not declared`),t!==null&&s.kind!==t&&E(i,`variable ${e} is a ${s.kind}, not a ${t}`)}function Bo(n,e,t){if(n!==void 0){if(typeof n=="number"){Number.isFinite(n)||E("S4",`${e} is ${String(n)}, not finite`);return}if("attr"in n){(!Mt(n.factor??1)||!Mt(n.offset??0))&&E("S4",`${e} has a factor or offset that is not finite`);return}t&&E("F2",`${e} takes a number or an attribute, not a channel`),n.channel===ot&&E("2.2",`${e} reads channel ${ot}, which is not allowed in a frame edge`)}}function Ho(n,e){if("set"in e)Object.hasOwn(n.track_sets,e.set)||E("V2",`the set query names ${JSON.stringify(e.set)}, which is not a track set`);else for(let t of Object.values(e.tags))typeof t=="object"&&t!==null&&qn(n,t.var,"choice","V2")}var Ss=n=>typeof n=="number"&&n>=0&&n<=1;function Wf(n,e){e.fraction>0&&e.fraction<=1||E("2.7",`view ${n}: a trail fraction is ${e.fraction}, not in (0, 1]`),e.taper!==void 0&&!(Ss(e.taper.width??0)&&Ss(e.taper.opacity??0))&&E("2.7",`view ${n}: a trail taper is not in [0, 1]`)}function Bh(n,e,t){e.shape!==void 0&&!Vf.includes(e.shape)&&E(t,`view ${n}: a marker's shape is ${JSON.stringify(e.shape)}, not one of ${Vf.join(", ")}`);for(let i of["color","edge"])e[i]!==void 0&&!bn.test(e[i])&&E(t,`view ${n}: a marker's ${i} is ${JSON.stringify(e[i])}, not a #rrggbb color`);vn(e.size,`view ${n}: a marker's size`,Bi,t),vn(e.opacity,`view ${n}: a marker's opacity`,zn,t),vn(e.edge_width,`view ${n}: a marker's edge_width`,i=>typeof i=="number"&&Number.isFinite(i)&&i>=0,t)}function Vo(n,e){e!==void 0&&((e===null||typeof e!="object"||typeof e.channel!="string")&&E("K4",`view ${n}: a layer's clock is ${JSON.stringify(e)}, not {channel, range} or {channel, keys}`),e.range===void 0==(e.keys===void 0)&&E("K4",`view ${n}: a layer's clock on ${e.channel} has ${e.range===void 0?"neither a range nor keys":"both a range and keys"}`),e.range!==void 0&&!(Array.isArray(e.range)&&e.range.length===2&&e.range.every(Mt))&&E("K4",`view ${n}: a layer's clock on ${e.channel} has range ${JSON.stringify(e.range)}, not two finite numbers`),e.keys!==void 0&&zi(e.keys,`view ${n}: the clock of a layer on ${e.channel}`))}function zo(n,e,t){if(typeof e!="string"){Array.isArray(e)||E("2.9",`${t} has text ${JSON.stringify(e)}, not a string or a list of parts`);for(let i of e){if(typeof i=="string")continue;if((i===null||typeof i!="object")&&E("2.9",`${t} has a part ${JSON.stringify(i)}`),"var"in i&&qn(n,i.var,null,"2.9"),"channel"in i&&i.channel===ot&&E("2.9",`${t} has a channel part naming ${ot}, which is not allowed in a readout`),"steps"in i){Array.isArray(i.steps)||E("K7",`${t} has steps ${JSON.stringify(i.steps)}, not a list of [t, text] pairs`);let a=-1/0;for(let o of i.steps)(!Array.isArray(o)||o.length!==2||!Mt(o[0])||typeof o[1]!="string")&&E("K7",`${t} has a step ${JSON.stringify(o)}, not [t, text]`),o[0]<a&&E("K7",`${t} has steps whose times decrease`),a=o[0];continue}"keys"in i&&zi(i.keys,t),"clock"in i&&!["index","steps","value","time"].includes(i.clock)&&E("2.9",`${t} has a clock part ${JSON.stringify(i.clock)}`);let s=i;(!Mt(s.factor??1)||!Mt(s.offset??0))&&E("S4",`${t} has a part whose factor or offset is not finite`),s.digits!==void 0&&!(Number.isInteger(s.digits)&&s.digits>=1&&s.digits<=17)&&E("2.9",`${t} has digits ${String(s.digits)}, not in 1 to 17`),s.decimals!==void 0&&!(Number.isInteger(s.decimals)&&s.decimals>=0&&s.decimals<=17)&&E("K7",`${t} has decimals ${String(s.decimals)}, not in 0 to 17`),s.digits!==void 0&&s.decimals!==void 0&&E("K7",`${t} has a part with both digits and decimals`);let r=i.width;r!==void 0&&!(Number.isInteger(r)&&r>=0&&r<=40)&&E("K7",`${t} has width ${String(r)}, not in 0 to 40`)}}}function $f(n,e){e.align!==void 0&&!["start","center","end"].includes(e.align)&&E("K6",`${n}: an align is ${JSON.stringify(e.align)}`),e.baseline!==void 0&&!["top","middle","bottom","alphabetic"].includes(e.baseline)&&E("K6",`${n}: a baseline is ${JSON.stringify(e.baseline)}`),e.size!==void 0&&!Bi(e.size)&&E("K6",`${n}: a text size is ${JSON.stringify(e.size)}, not positive`),e.color!==void 0&&!bn.test(e.color)&&E("K6",`${n}: a text color is ${JSON.stringify(e.color)}, not #rrggbb`),e.weight!==void 0&&e.weight!=="normal"&&e.weight!=="bold"&&E("K6",`${n}: a weight is ${JSON.stringify(e.weight)}, not normal or bold`),e.linespacing!==void 0&&!Bi(e.linespacing)&&E("K6",`${n}: a linespacing is ${JSON.stringify(e.linespacing)}, not positive`),vn(e.opacity,`${n}: an opacity`,zn,"K6");let t=e.box;if(t!==void 0){for(let i of["fill","edge"])t[i]!==void 0&&!bn.test(t[i])&&E("K6",`${n}: a box ${i} is not #rrggbb`);t.opacity!==void 0&&!Ss(t.opacity)&&E("K6",`${n}: a box opacity is not in [0, 1]`)}}function my(n,e,t){zo(n,t.text,`view ${e}: a label`),$f(`view ${e}`,t),Vo(e,t.clock);let i=t.at;if((i===null||typeof i!="object")&&E("K6",`view ${e}: a label's anchor is ${JSON.stringify(i)}`),"point"in i){let a=i.point;(!Array.isArray(a)||a.length!==3||!a.every(Mt))&&E("K6",`view ${e}: a label's point is ${JSON.stringify(a)}, not three finite numbers`),i.frame!==void 0&&!Object.hasOwn(n.frames,i.frame)&&E("K6",`view ${e}: a label's point is in frame ${JSON.stringify(i.frame)}, which is not declared`)}else if("sets"in i)Ho(n,i.sets),(!Number.isInteger(i.member)||i.member<0)&&E("K6",`view ${e}: a label's member is ${JSON.stringify(i.member)}, not a track index`);else if("screen"in i){let a=i.screen;(!Array.isArray(a)||a.length!==2||!a.every(Mt))&&E("K6",`view ${e}: a label's screen place is ${JSON.stringify(a)}, not two fractions`)}else E("K6",`view ${e}: a label's anchor is ${JSON.stringify(i)}, not a point, a member, or a place on the screen`);let s=t.offset;s!==void 0&&!(Array.isArray(s)&&s.length===2&&s.every(Mt))&&E("K6",`view ${e}: a label's offset is ${JSON.stringify(s)}, not two lengths`);let r=t.leader;r!==void 0&&typeof r=="object"&&r.color!==void 0&&!bn.test(r.color)&&E("K6",`view ${e}: a leader's color is not #rrggbb`)}function gy(n,e,t){zh(n,e,t);let i=t.reveal??"none";i!=="none"&&i!=="grow"&&E("K8",`view ${e}: a points layer's reveal is ${JSON.stringify(i)}, not none or grow`);for(let s of["before","after"])t[s]!==void 0&&t[s]!=="clamp"&&t[s]!=="hidden"&&E("C3",`view ${e}: a points layer's ${s} is ${JSON.stringify(t[s])}, not clamp or hidden`);t.marker!==void 0&&Bh(e,t.marker,"K8"),vn(t.opacity,`view ${e}: a points layer's opacity`,zn),Vo(e,t.clock)}function zh(n,e,t){Ho(n,t.sets),typeof t.members=="object"&&"var"in t.members&&qn(n,t.members.var,"selector","V3"),typeof t.members=="object"&&"count"in t.members&&!(Number.isInteger(t.members.count)&&t.members.count>=1)&&E("V3",`view ${e}: member count ${JSON.stringify(t.members.count)} is not an integer of at least one`)}function yy(n,e,t){zh(n,e,t),Nh(t);for(let i of["before","after"])t[i]!==void 0&&t[i]!=="clamp"&&t[i]!=="hidden"&&E("C3",`view ${e}: an arrow layer's ${i} is ${JSON.stringify(t[i])}, not clamp or hidden`);t.color!==void 0&&!bn.test(t.color)&&E("L7",`view ${e}: an arrow layer's color is ${JSON.stringify(t.color)}, not a #rrggbb color`),t.head?.size!==void 0&&!(t.head.size>0)&&E("L7",`view ${e}: an arrowhead size is ${t.head.size}, not positive`),vn(t.opacity,`view ${e}: an arrow layer's opacity`,zn),t.width!==void 0&&!(t.width>0)&&E("2.7",`view ${e}: an arrow layer's width is ${t.width}, not positive`),Vo(e,t.clock)}function vy(n,e,t){Oh(n,e,t),t.color!==void 0&&!bn.test(t.color)&&E("L8",`view ${e}: an outline layer's color is ${JSON.stringify(t.color)}, not a #rrggbb color`),vn(t.opacity,`view ${e}: an outline layer's opacity`,zn),t.width!==void 0&&!(t.width>0)&&E("2.7",`view ${e}: an outline layer's width is ${t.width}, not positive`);let i=t.dash;i!==void 0&&!(Array.isArray(i)&&i.length===2&&i.every(s=>Mt(s)&&s>0))&&E("L8",`view ${e}: an outline layer's dash is ${JSON.stringify(i)}, not two positive lengths`),t.min_size!==void 0&&!(Mt(t.min_size)&&t.min_size>=0)&&E("L8",`view ${e}: an outline layer's min_size is ${t.min_size}, not a nonnegative length`)}function by(n,e,t){zh(n,e,t),t.fit!==void 0&&typeof t.fit!="boolean"&&E("2.7",`view ${e}: a track layer's fit is ${JSON.stringify(t.fit)}, not a boolean`);let i=t.highlight;if(i!==void 0&&(qn(n,i.var,"selector","2.7"),i.width!==void 0&&!(i.width>0)&&E("2.7",`view ${e}: a highlight width is ${i.width}, not positive`),i.opacity!==void 0&&!Ss(i.opacity)&&E("2.7",`view ${e}: a highlight opacity is ${i.opacity}, not in [0, 1]`),i.kernel!==void 0)){i.kernel.width>0&&i.kernel.width<=1||E("2.7",`view ${e}: a highlight kernel's width is ${i.kernel.width}, not in (0, 1]`),Ss(i.kernel.opacity)||E("2.7",`view ${e}: a highlight kernel's opacity is ${i.kernel.opacity}, not in [0, 1]`);let a=lt(n,i.var);a?.kind==="selector"&&a.by==="index"&&E("2.7",`view ${e}: a highlight kernel needs a selector by nearest, and ${i.var} is by index`)}let s=t.reveal??"none";if(["none","grow","trail"].includes(s)||E("2.7",`view ${e}: a track layer's reveal is ${JSON.stringify(s)}, not none, grow, or trail`),s==="trail"&&t.trail===void 0&&E("2.7",`view ${e}: a track layer has reveal "trail" but lacks a trail`),t.trail!==void 0&&Wf(e,t.trail),t.head!==void 0&&typeof t.head!="boolean"){(typeof t.head!="object"||t.head===null)&&E("L3",`view ${e}: a track layer's head is ${JSON.stringify(t.head)}, not a boolean or an object`),t.head.color!==void 0&&!bn.test(t.head.color)&&E("L3",`view ${e}: a head color is ${JSON.stringify(t.head.color)}, not a #rrggbb color`),Bh(e,t.head,"L3");let a=t.head.glow;a!==void 0&&((typeof a.channel!="string"||a.channel===ot)&&E("2.7",`view ${e}: a glow names channel ${JSON.stringify(a.channel)}`),a.color!==void 0&&!bn.test(a.color)&&E("2.7",`view ${e}: a glow's color is not #rrggbb`),a.size!==void 0&&!Bi(a.size)&&E("2.7",`view ${e}: a glow's size is not positive`),a.opacity!==void 0&&!Ss(a.opacity)&&E("2.7",`view ${e}: a glow's opacity is not in [0, 1]`))}t.line!==void 0&&typeof t.line!="boolean"&&E("2.7",`view ${e}: a track layer's line is ${JSON.stringify(t.line)}, not a boolean`),t.flat!==void 0&&typeof t.flat!="boolean"&&E("2.7",`view ${e}: a track layer's flat is ${JSON.stringify(t.flat)}, not a boolean`);let r=t.dash;r!==void 0&&!(Array.isArray(r)&&r.length===2&&r.every(a=>Mt(a)&&a>0))&&E("2.7",`view ${e}: a track layer's dash is ${JSON.stringify(r)}, not two positive lengths`),t.fill!==void 0&&(t.fill.base!==void 0&&!Mt(t.fill.base)&&E("S4",`view ${e}: a fill's base is not finite`),t.fill.color!==void 0&&!bn.test(t.fill.color)&&E("2.7",`view ${e}: a fill's color is not #rrggbb`),t.fill.opacity!==void 0&&!Ss(t.fill.opacity)&&E("2.7",`view ${e}: a fill's opacity is not in [0, 1]`)),Vo(e,t.clock);for(let a of["before","after"])t[a]!==void 0&&t[a]!=="clamp"&&t[a]!=="hidden"&&E("C3",`view ${e}: a track layer's ${a} is ${JSON.stringify(t[a])}, not clamp or hidden`);if(t.context!==void 0&&t.context!=="own"&&t.context!=="driver"&&E("L6",`view ${e}: a track layer's context is ${JSON.stringify(t.context)}, not own or driver`),vn(t.opacity,`view ${e}: a track layer's opacity`,zn),t.width!==void 0&&!(t.width>0)&&E("2.7",`view ${e}: a track layer's width is ${t.width}, not positive`),t.color!==void 0&&typeof t.color=="object"&&"steps"in t.color){let a=t.color;(!Array.isArray(a.steps)||a.steps.length===0||!a.steps.every(Mt)||a.steps.some((o,l)=>l>0&&!(o>a.steps[l-1])))&&E("2.7",`view ${e}: a stepped color's steps are ${JSON.stringify(a.steps)}, not increasing finite numbers`),(!Array.isArray(a.colors)||a.colors.length!==a.steps.length+1||!a.colors.every(o=>bn.test(o)))&&E("2.7",`view ${e}: a stepped color has ${JSON.stringify(a.colors)} for ${a.steps.length} steps, not one #rrggbb color more than steps`)}else if(t.color!==void 0&&typeof t.color=="object"){let a=t.color.colormap;if(typeof a=="object"&&a!==null){qn(n,a.var,"choice","2.7");let o=lt(n,a.var).values,l=Object.keys(a.map??{}),c=o.filter(u=>!Object.hasOwn(a.map,u)),h=l.filter(u=>!o.includes(u));c.length>0&&E("2.7",`view ${e}: a colormap keyed on ${a.var} does not name a colormap for ${JSON.stringify(c)}`),h.length>0&&E("2.7",`view ${e}: a colormap keyed on ${a.var} maps ${JSON.stringify(h)}, which are not its values`);for(let u of l)Fo.includes(a.map[u])||E("2.7",`view ${e}: the colormap ${JSON.stringify(a.map[u])} is not one of ${Fo.join(", ")}`)}else Fo.includes(a)||E("2.7",`view ${e}: the colormap ${JSON.stringify(a)} is not one of ${Fo.join(", ")}`);"parameter"in t.color=="channel"in t.color&&E("2.7",`view ${e}: a colormap color names both or neither of parameter and channel`)}}function Go(n,e,t){let i=[];py(n);for(let h of Object.keys(n))Pf.has(h)||i.push(`the scene has a top-level key ${JSON.stringify(h)} that this reader does not know`);Xi(n.theme,fy,"the theme",i);for(let[h,u]of Object.entries(n.theme??{}))h==="font"?typeof u!="string"&&E("2",`theme font is ${JSON.stringify(u)}, not a CSS font family`):(typeof u!="string"||!bn.test(u))&&E("2",`theme ${h} is ${JSON.stringify(u)}, not a #rrggbb color`);Xi(n.clock,dy,"the clock",i);for(let[h,u]of Object.entries(n.frames))Xi(u,ry,`frame ${h}`,i);for(let[h,u]of Object.entries(n.bodies??{}))Xi(u,ay,`body ${h}`,i),u.color!==void 0&&!bn.test(u.color)&&E("2.4",`body ${h} has color ${JSON.stringify(u.color)}, not #rrggbb`);for(let[h,u]of Object.entries(n.track_sets))Xi(u,oy,`track set ${h}`,i);for(let[h,u]of Object.entries(n.views)){Xi(u,ly,`view ${h}`,i),u.camera!==void 0&&Xi(u.camera,u.camera.kind==="orbit"?hy:cy,`the camera of view ${h}`,i);for(let d of u.layers)Object.hasOwn(Gf,d.kind)&&Xi(d,Gf[d.kind],`a ${d.kind} layer of view ${h}`,i)}for(let[h,u]of[["frame",n.frames],["body",n.bodies],["track set",n.track_sets],["variable",n.variables],["view",n.views]])for(let d of Object.keys(u??{}))Fh(d,h);let s=new Vi(n),r=h=>s.tree.has(h);for(let[h,u]of Object.entries(n.frames))Array.isArray(u.origin)&&u.origin.forEach(d=>Bo(d,`the origin of frame ${h}`,!1)),Bo(u.rotation?.angle,`the rotation of frame ${h}`,!1),Bo(u.scale,`the scale of frame ${h}`,!1),u.axes!==void 0&&u.axes.length!==3&&E("2.3",`frame ${h} has ${u.axes.length} axis labels, not three`);for(let[h,u]of Object.entries(n.bodies??{}))r(u.frame)||E("2.4",`body ${h} is in frame ${u.frame}, which is not declared`),u.position.forEach(d=>Bo(d,`the position of body ${h}`,!0));Object.keys(n.track_sets).length===0&&E("2.1","the scene does not have a track set");for(let[h,u]of Object.entries(n.track_sets)){r(u.frame)||E("2.1",`track set ${h} is in frame ${u.frame}, which is not declared`),(!Number.isInteger(u.tracks)||u.tracks<1)&&E("2.1",`track set ${h} has tracks ${String(u.tracks)}, not a count of at least one`),Object.hasOwn(u.channels??{},ot)&&E("S3",`track set ${h} declares a channel named ${ot}, which is reserved`);for(let[d,f]of Object.entries(u.attrs??{}))Mt(f)||E("S4",`attribute ${d} of track set ${h} is not finite`)}for(let[h,u]of Object.entries(n.variables??{}))if(u.kind==="selector")u.by!=="index"&&u.parameter===void 0&&E("2.5",`selector ${h} is by nearest but does not name a parameter`),Mt(u.default)||E("2.5",`selector ${h} defaults to ${String(u.default)}, not a finite number`);else if(u.kind==="choice")u.values.includes(u.default)||E("2.5",`choice ${h} defaults to ${JSON.stringify(u.default)}, which is not one of its values`),u.labels!==void 0&&u.labels.length!==u.values.length&&E("2.5",`choice ${h} has ${u.labels.length} labels for ${u.values.length} values`);else if(u.kind==="toggle"){let d=u.default;typeof d!="boolean"&&E("2.5",`toggle ${h} defaults to ${JSON.stringify(d)}, not a boolean`)}else E("2.5",`variable ${h} has kind ${JSON.stringify(u.kind)}, not selector, choice, or toggle`);let a=n.clock;a.mode!=="fraction"&&a.mode!=="value"&&E("2.6",`the clock mode is ${JSON.stringify(a.mode)}, not fraction or value`),(!Number.isInteger(a.steps)||a.steps<1)&&E("2.6",`the clock has steps ${String(a.steps)}, not a count of at least one`),a.mode==="value"?(a.range!==void 0&&a.keys!==void 0&&E("K3","the clock in value mode has both a range and keys"),a.range===void 0&&a.keys===void 0&&E("C2","the clock is in value mode but does not have a range of two numbers or keys"),a.range!==void 0&&!a.range.every(Mt)&&E("S4","the clock range is not finite"),a.keys!==void 0&&zi(a.keys,"the clock")):a.keys!==void 0&&E("K3","the clock in fraction mode has keys, which only a clock in value mode takes"),a.end!==void 0&&a.end!=="loop"&&a.end!=="stop"&&E("K9",`the clock's end is ${JSON.stringify(a.end)}, not loop or stop`);let o=Ct(a),l=-1/0,c=new Set;for(let h of n.stages??[])Fh(h.id,"stage"),c.has(h.id)&&E("K9",`stage ${h.id} is declared twice`),c.add(h.id),(!Mt(h.at)||h.at<0||h.at>o)&&E("K9",`stage ${h.id} is at ${String(h.at)}, not a time in [0, ${o}]`),h.at<l&&E("K9",`the stages are not in order of time at ${h.id}`),l=h.at;for(let[h,u]of(n.overlays??[]).entries()){let d=`overlay ${h}`;if((!Array.isArray(u.at)||u.at.length!==2||!u.at.every(Mt))&&E("2.11",`${d} is at ${JSON.stringify(u.at)}, not two fractions`),u.kind==="text")zo(n,u.text,d),$f(d,u);else if(u.kind==="legend"){vn(u.opacity,`${d}: the opacity`,zn,"2.11");for(let f of u.entries){let p=f.label,y=m=>typeof m=="string"||m!==null&&typeof m=="object"&&Object.keys(m).length===1&&(typeof m.sub=="string"||typeof m.sup=="string");typeof p=="string"||Array.isArray(p)&&p.every(y)||E("2.11",`${d} has an entry whose label is not a string or a list of strings and sub and sup parts`),f.marker!==void 0&&Bh(d,f.marker,"2.11"),f.line?.color!==void 0&&!bn.test(f.line.color)&&E("2.11",`${d} has a line color that is not #rrggbb`);for(let m of f.colors??[])bn.test(m)||E("2.11",`${d} has a color ${JSON.stringify(m)} that is not #rrggbb`)}}else E("S1",`overlay kind ${JSON.stringify(u.kind)} is not implemented`)}a.labels!==void 0&&a.labels.length!==a.channels.length&&E("2.6",`the clock has ${a.labels.length} labels for ${a.channels.length} channels`),a.seconds!==void 0&&!(Mt(a.seconds)&&a.seconds>0)&&E("2.6",`the clock seconds are ${JSON.stringify(a.seconds)}, not a positive finite number`),Rt(a);for(let[h,u]of Object.entries(n.views)){if(typeof u.frame=="string")r(u.frame)||E("2.7",`view ${h} displays ${u.frame}, which is not a frame`);else{qn(n,u.frame.var,"choice","2.7");let p=lt(n,u.frame.var);if(p.kind==="choice")for(let y of p.values)r(y)||E("2.7",`the frame of view ${h} can be ${y}, which is not a frame`)}Ho(n,u.driver.sets),u.driver.member==="all"&&E("V3",`view ${h}: the driver's member is "all", but a driver resolves to one track`),"count"in u.driver.member&&E("V3",`view ${h}: the driver's member is a count, but a driver resolves to one track`),"var"in u.driver.member&&qn(n,u.driver.member.var,"selector","V3"),u.camera!==void 0&&u.camera.kind!=="plane"&&u.camera.kind!=="orbit"&&E("2.7",`view ${h}: a camera kind is ${JSON.stringify(u.camera.kind)}, not plane or orbit`);let d=u.camera?.aspect;if(u.camera?.kind==="plane"&&d!==void 0&&d!=="equal"&&d!=="free"&&E("2.7",`view ${h}: a plane camera's aspect is ${JSON.stringify(d)}, not equal or free`),u.camera?.kind==="plane"&&u.camera.keys!==void 0){To(u.camera.keys,d==="free",`the camera of view ${h}`);for(let p of u.camera.keys)for(let y of p.follow??[])u.layers[y.layer]?.kind!=="track"&&E("K5",`view ${h}: a camera key follows layer ${y.layer}, which is not a track layer of the view`)}vn(u.opacity,`view ${h}: the opacity`,zn);let f=u.margin;if(f!==void 0){for(let p of["top","right","bottom","left"]){let y=f[p];y!==void 0&&!(Mt(y)&&y>=0&&y<1)&&E("2.11",`view ${h}: the ${p} margin is ${String(y)}, not a fraction in [0, 1)`)}((f.top??0)+(f.bottom??0)>=1||(f.left??0)+(f.right??0)>=1)&&E("2.11",`view ${h}: the margins leave nothing to draw in`)}if(u.camera?.kind==="orbit"){let{stretch:p,turn:y}=u.camera;p!==void 0&&!(Array.isArray(p)&&p.length===3&&p.every(m=>Mt(m)&&m>0))&&E("2.7",`view ${h}: an orbit camera's stretch is ${JSON.stringify(p)}, not three positive finite factors`),y!==void 0&&!Mt(y)&&E("2.7",`view ${h}: an orbit camera's turn is ${JSON.stringify(y)}, not a finite number of degrees`)}for(let p of u.layers)if(iy.includes(p.kind)||E("S1",`view ${h}: layer kind ${JSON.stringify(p.kind)} is not implemented`),p.visible!==void 0&&qn(n,p.visible.var,"toggle","L5"),p.kind==="track")by(n,h,p);else if(p.kind==="arrow")yy(n,h,p);else if(p.kind==="outline")vy(n,h,p);else if(p.kind==="label")my(n,h,p);else if(p.kind==="points")gy(n,h,p);else if(p.kind==="body")Object.hasOwn(n.bodies??{},p.body)||E("L4",`view ${h} draws ${p.body}, which is not a body`),p.trail!==void 0&&Wf(h,p.trail),p.size!==void 0&&!(p.size>0)&&E("2.7",`view ${h}: a body layer's size is ${p.size}, not positive`),vn(p.opacity,`view ${h}: a body layer's opacity`,zn);else if(p.kind==="axes"){p.span!==void 0&&p.span!=="full"&&p.span!=="positive"&&p.span!=="box"&&E("2.7",`view ${h}: an axes layer's span is ${JSON.stringify(p.span)}, not full, positive, or box`),p.ticks!==void 0&&!(Array.isArray(p.ticks)&&p.ticks.every(m=>m==="x"||m==="y"))&&E("2.11",`view ${h}: an axes layer's ticks are ${JSON.stringify(p.ticks)}, not a list of x and y`),p.size!==void 0&&!Bi(p.size)&&E("2.11",`view ${h}: an axes layer's size is not positive`);let y=p.titles;if(y!==void 0){(!Array.isArray(y)||y.length!==2)&&E("2.11",`view ${h}: an axes layer's titles are ${JSON.stringify(y)}, not two texts`);for(let m of y)zo(n,m,`view ${h}: an axes title`)}vn(p.opacity,`view ${h}: an axes layer's opacity`,zn)}else p.kind==="grid"&&(p.labels!==void 0&&typeof p.labels!="boolean"&&E("2.7",`view ${h}: a grid layer's labels is ${JSON.stringify(p.labels)}, not a boolean`),vn(p.opacity,`view ${h}: a grid layer's opacity`,zn))}for(let h of n.controls??[])if(sy.includes(h.kind)||E("S1",`control kind ${JSON.stringify(h.kind)} is not implemented`),h.kind==="slider"){qn(n,h.variable,"selector","2.9");let u=lt(n,h.variable);u?.kind==="selector"&&u.by==="index"&&E("2.9",`the slider over ${h.variable} needs a selector by nearest, and the selector is by index`),Ho(n,h.domain)}else h.kind==="tabs"?qn(n,h.variable,"choice","2.9"):h.kind==="toggle"&&qn(n,h.variable,"toggle","2.9");for(let h of n.readouts??[])h.place!=="caption"&&h.place!=="panel"&&E("2.9",`readout place ${JSON.stringify(h.place)} is not caption or panel`),zo(n,h.parts,"a readout");if(e!==void 0){for(let[d,f]of Object.entries(n.bodies??{}))f.image!==void 0&&(e.has(f.image)||E("2.4",`body ${d} has image ${JSON.stringify(f.image)}, which the data container does not hold`),e.view(f.image).dtype!=="uint8"&&E("2.4",`body ${d} has image ${f.image}, which is not a view of uint8 bytes`));let h=new $i(n,e),u=new Set;for(let d of Object.values(n.views))for(let f of d.layers)"clock"in f&&f.clock!==void 0&&f.clock.channel!==ot&&u.add(f.clock.channel);for(let d of Object.keys(n.track_sets)){let f=h.get(d);for(let p of Object.keys(f.def.channels??{}))f.channel(p);for(let p of Object.keys(f.def.parameters??{})){let y=f.parameter(p);for(let m=0;m<f.tracks;m++)Number.isFinite(y[m])||E("2.1",`parameter ${p} of track set ${d} is not finite at track ${m}`)}for(let p of new Set([...n.clock.channels,...u])){if(p===ot||!f.hasChannel(p))continue;let y=f.channel(p);for(let m=0;m<f.tracks;m++){let g=f.start(m),v=f.count(m),_=Math.sign(y[g+1]-y[g]);for(let b=0;b<v;b++)Number.isFinite(y[g+b])||E("T3",`clock channel ${p} of track set ${d} is not finite along track ${m} at sample ${b}`),b+1<v&&!((y[g+b+1]-y[g+b])*_>0)&&E("T3",`clock channel ${p} of track set ${d} is not strictly monotone along track ${m} at sample ${b}`);Number.isFinite(y[g+v-1]-y[g])||E("T3",`clock channel ${p} of track set ${d} has an infinite span along track ${m}`)}}}}for(let h of t===void 0?[n.initial]:[n.initial,t])xy(n,s,h,i);return i}function xy(n,e,t,i){er(n,t);for(let l of vs(t.layout))Fh(l,"panel");let s=l=>{l.kind!=="panel"&&(l.ratio>0&&l.ratio<1||E("2.8",`a split ratio is ${String(l.ratio)}, not in (0, 1)`),l.keys!==void 0&&zi(l.keys,"a split",c=>typeof c=="number"&&c>=0&&c<=1),s(l.a),s(l.b))};s(t.layout);let r=Rt(n.clock),a=(n.readouts??[]).map(l=>({place:l.place,parts:l.parts.filter(c=>typeof c!="string"&&("member"in c||"attr"in c||"channel"in c))})).filter(l=>l.parts.length>0),o=vs(t.layout)[0];for(let[l,c]of Object.entries(t.panels)){for(let v of Object.keys(c.variables??{})){let _=lt(n,v);_!==void 0&&_.scope!=="panel"&&i.push(`panel ${l} sets ${v}, which is scene-scoped and never read there`)}let h=n.views[c.view],u={scene:n,state:t,panel:c},d=bs(u,h),f=(v,_,b,M=e.requirements(_,d))=>{let T=n.track_sets[v],x=[...M.channels].filter(k=>k!==ot&&!Object.hasOwn(T.channels??{},k)),A=[...M.attrs].filter(k=>!Object.hasOwn(T.attrs??{},k));x.length+A.length>0&&E("F5",`panel ${l}: track set ${v} lacks ${[...x.map(k=>`channel ${k}`),...A.map(k=>`attribute ${k}`)].join(", ")} for ${b} in frame ${d}`);for(let k of Xf(e,n,_,d)){let R=n.frames[k].scale;R!==void 0&&typeof R=="object"&&"attr"in R&&(R.factor??1)*(T.attrs?.[R.attr]??NaN)+(R.offset??0)===0&&E("F2",`panel ${l}: the scale of frame ${k} is zero for track set ${v}`)}},p=(v,_,b)=>{let M=n.track_sets[v],x=(b===void 0?n.clock.channels:[b.channel]).filter(A=>A!==ot&&!Object.hasOwn(M.channels??{},A));x.length>0&&E("C5",`panel ${l}: track set ${v}, ${_}, lacks clock channels ${x.join(", ")}`),b===void 0&&r>1&&M.periodic!==!0&&E("C6",`panel ${l}: track set ${v}, ${_}, is not periodic, and the clock has ${r} laps`)},y=(v,_)=>{let b=n.track_sets[v];if(_==="all"||"count"in _)return;if("index"in _){_.index>=b.tracks&&E("V3",`panel ${l}: member index ${_.index} is not below the track count ${b.tracks} of track set ${v}`);return}let M=lt(n,_.var);M?.kind==="selector"&&M.by!=="index"&&M.parameter!==void 0&&!Object.hasOwn(b.parameters??{},M.parameter)&&E("V3",`panel ${l}: track set ${v} lacks parameter ${M.parameter} for selector ${_.var}`)},m=Et(u,h.driver.sets);if(m!==null){f(m,n.track_sets[m].frame,"the driver"),p(m,"the driver"),y(m,h.driver.member);let v=n.track_sets[m];for(let _ of a)if(_.place==="panel"||l===o)for(let b of _.parts)"member"in b&&!Object.hasOwn(v.parameters??{},b.member)&&E("2.9",`the ${_.place} readout through panel ${l} names parameter ${b.member}, which track set ${m} lacks`),"attr"in b&&!Object.hasOwn(v.attrs??{},b.attr)&&E("2.9",`the ${_.place} readout through panel ${l} names attribute ${b.attr}, which track set ${m} lacks`),"channel"in b&&!Object.hasOwn(v.channels??{},b.channel)&&E("2.9",`the ${_.place} readout through panel ${l} names channel ${b.channel}, which track set ${m} lacks`)}for(let v of h.layers)if(ir(u,v))if(v.kind==="track"){let _=Et(u,v.sets);if(_===null)continue;v.context!=="driver"?f(_,n.track_sets[_].frame,"its tracks"):m!==null&&f(m,n.track_sets[_].frame,`a layer of track set ${_} in the driver's context`),y(_,v.members),v.highlight!==void 0&&y(_,{var:v.highlight.var});let b=n.track_sets[_];v.color!==void 0&&typeof v.color=="object"&&("channel"in v.color&&!Object.hasOwn(b.channels??{},v.color.channel)&&E("2.7",`panel ${l}: track set ${_} lacks channel ${v.color.channel} for a layer's color`),"parameter"in v.color&&!Object.hasOwn(b.parameters??{},v.color.parameter)&&E("2.7",`panel ${l}: track set ${_} lacks parameter ${v.color.parameter} for a layer's color`)),typeof v.color=="object"&&"steps"in v.color&&!Object.hasOwn(b.channels??{},v.color.channel)&&E("2.7",`panel ${l}: track set ${_} lacks channel ${v.color.channel} for a layer's color`);let M=typeof v.head=="object"?v.head.glow:void 0;M!==void 0&&!Object.hasOwn(b.channels??{},M.channel)&&E("2.7",`panel ${l}: track set ${_} lacks channel ${M.channel} for a head's glow`);let T=(v.clock!==void 0||n.clock.mode==="value")&&(v.before==="hidden"||v.after==="hidden");((v.reveal??"none")!=="none"||Wi(v)||T)&&p(_,"on which a reading is taken",v.clock)}else if(v.kind==="arrow"){let _=Et(u,v.sets);if(_===null)continue;f(_,n.track_sets[_].frame,"its arrows"),y(_,v.members);let b=n.track_sets[_];for(let T of v.vector)T!==ot&&!Object.hasOwn(b.channels??{},T)&&E("L7",`panel ${l}: track set ${_} lacks channel ${T} of an arrow layer's vector`);let M=v.scale;typeof M=="object"&&"attr"in M&&!Object.hasOwn(b.attrs??{},M.attr)&&E("F5",`panel ${l}: track set ${_} lacks attribute ${M.attr} for an arrow layer's scale`),p(_,"on which a reading is taken",v.clock)}else if(v.kind==="points"){let _=Et(u,v.sets);if(_===null)continue;f(_,n.track_sets[_].frame,"its points"),y(_,v.members);let b=(v.clock!==void 0||n.clock.mode==="value")&&(v.before==="hidden"||v.after==="hidden");((v.reveal??"none")==="grow"||b)&&p(_,"on which a reading is taken",v.clock)}else if(v.kind==="label"){let _=v.at;if(_.sets!==void 0){let b=Et(u,_.sets);if(b===null)continue;f(b,n.track_sets[b].frame,"a label"),_.member>=n.track_sets[b].tracks&&E("K6",`panel ${l}: a label names member ${_.member}, which is not a track of track set ${b}`),p(b,"on which a label reads",v.clock)}else _.frame!==void 0&&m!==null&&f(m,_.frame,"a label in another frame")}else if(v.kind==="outline"&&m!==null){let _=Po(u,v.view);_!==null&&f(m,_.frame,`the outline of view ${v.view}`)}else v.kind==="body"&&m!==null&&f(m,n.track_sets[m].frame,`body ${v.body}`,e.bodyRequirements(v.body,d));let g=h.camera;if(g?.kind==="plane"&&g.keys!==void 0)for(let v of g.keys)for(let _ of v.follow??[]){let b=h.layers[_.layer];if(b?.kind!=="track")continue;let M=Et(u,b.sets);M!==null&&(_.member>=n.track_sets[M].tracks&&E("K5",`panel ${l}: a camera key follows member ${_.member}, which is not a track of track set ${M}`),p(M,"which a camera follows",b.clock))}if(l===o)for(let v of n.controls??[]){if(v.kind!=="slider")continue;let _=lt(n,v.variable);if(!(_?.kind!=="selector"||_.parameter===void 0))for(let b of la(u,v.domain))Object.hasOwn(n.track_sets[b].parameters??{},_.parameter)||E("2.9",`the slider over ${v.variable} has track set ${b} in its domain, which lacks parameter ${_.parameter}`)}}}function Xf(n,e,t,i,s=[]){let{up:r,down:a}=n.tree.path(t,i),o=new Set;for(let l of[...r,...a]){if(s.includes(l))continue;o.add(l);let c=e.frames[l].origin;if(c!==void 0&&!Array.isArray(c)){let h=e.bodies[c.body];for(let u of Xf(n,e,h.frame,e.frames[l].parent,[...s,l]))o.add(u)}}return o}function qf(n,e,t,i){let s=new $i(n,e),r=new Vi(n);er(n,t);let a=Rt(n.clock),o=t.clock.channel,l=Df(n.clock.steps,i),c=Object.create(null);for(let[h,u]of Object.entries(t.panels)){let d=n.views[u.view],f={scene:n,state:t,panel:u},p=bs(f,d),y=Et(f,d.driver.sets),m=y===null?null:{set:s.get(y),track:0};if(m){m.track=nr(f,d.driver.member,m.set);let b=n.clock.channels.filter(M=>M!==ot&&!m.set.hasChannel(M));b.length>0&&E("C5",`the driver's track set ${m.set.id} lacks clock channels ${b.join(", ")}`),a>1&&!m.set.periodic&&E("C6",`the driver's track set ${m.set.id} is not periodic, and the clock has ${a} laps`)}let g={scope:f,frames:r,clock:n.clock,channel:o,q:l,display:p},v=[];for(let b of d.layers)if(_y.includes(b.kind)||E("S1",`layer kind ${JSON.stringify(b.kind)} is not implemented`),!!ir(f,b))if(b.kind==="track"){let M=Et(f,b.sets);v.push(Uf(xi(g,b),b,M===null?null:s.get(M),m))}else if(b.kind==="arrow"){let M=Et(f,b.sets);v.push(Do(xi(g,b),b,M===null?null:s.get(M)))}else if(b.kind==="outline")v.push(No(g,b,m));else if(b.kind==="body")v.push(Ff(g,b,m));else if(b.kind==="points"){let M=Et(f,b.sets);v.push(Uo(g,b,M===null?null:s.get(M)))}else if(b.kind==="label"){let M=b.at,T=M!==null&&typeof M=="object"&&"sets"in M?Et(f,M.sets):null;v.push(Oo(g,b,T===null?null:s.get(T),m))}else v.push({kind:b.kind});let _={frame:p,layers:v};d.camera?.kind==="plane"&&d.camera.keys!==void 0&&(_.camera=Hh(g,d,s,m)),c[h]=_}return{panels:c}}var _y=["track","arrow","outline","body","axes","grid","label","points"];function Hh(n,e,t,i){let s=e.camera;To(s.keys,s.aspect==="free","the camera");let r=s.keys,[a,o]=Qs(s),l=Bn(n.clock,n.q);return kf(r,l,h=>{let u=r[h];if(u.follow===void 0)return u.center??null;let d=0,f=0,p=0;for(let m of u.follow){let g=e.layers[m.layer];(g===void 0||g.kind!=="track")&&E("K5",`a camera key follows layer ${m.layer}, which is not a track layer of the view`);let v=Et(n.scope,g.sets),_=Hf(n,g,v===null?null:t.get(v),m.member,i);_!==null&&(f+=_[a],p+=_[o],d++)}if(d===0)return u.center??null;let y=u.offset??[0,0];return[f/d+y[0],p/d+y[1]]})}var Sy={viridis:[[.267,.005,.329],[.283,.141,.458],[.254,.265,.53],[.207,.372,.553],[.164,.471,.558],[.128,.567,.551],[.135,.659,.518],[.267,.749,.441],[.478,.821,.318],[.741,.873,.15],[.993,.906,.144]],plasma:[[.05,.03,.528],[.294,.012,.615],[.492,.012,.658],[.665,.139,.586],[.798,.28,.47],[.902,.418,.36],[.973,.585,.252],[.993,.771,.155],[.94,.975,.131]],cividis:[[0,.135,.304],[.086,.218,.396],[.243,.301,.42],[.365,.383,.432],[.478,.466,.448],[.588,.55,.437],[.702,.638,.402],[.822,.73,.343],[.945,.827,.244],[.996,.91,.149]],blues:[[.19,.42,.71],[.33,.6,.8],[.53,.76,.87],[.7,.85,.92],[.85,.93,.98]],reds:[[.72,.1,.1],[.89,.27,.2],[.98,.5,.36],[.99,.7,.58],[1,.86,.78]]};function ws(n,e,t=[0,0,0]){let i=Sy[n],s=Math.max(0,Math.min(1,e))*(i.length-1),r=Math.min(i.length-2,Math.floor(s)),a=s-r;for(let o=0;o<3;o++)t[o]=i[r][o]+(i[r+1][o]-i[r][o])*a;return t}function Yf(n,e){let[t,i,s]=ws(n,e);return`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(s*255)})`}function qt(n,e){let t=n.toLowerCase();return e.sceneForeground!==void 0&&t===e.sceneForeground.toLowerCase()?e.foreground:e.sceneBackground!==void 0&&t===e.sceneBackground.toLowerCase()?e.background:n}function Jf(n,e){return n===void 0?n:typeof n=="string"?qt(n,e):ha(n)?{...n,colors:n.colors.map(t=>qt(t,e))}:n}function ca(n,e){return{...n,...n.color!==void 0?{color:qt(n.color,e)}:{},...n.edge!==void 0?{edge:qt(n.edge,e)}:{}}}var wy={background:"#000000",foreground:"#d8d8d8",grid:"#262626"};function Es(n){return{...wy,...n.theme??{}}}var My={dark:{background:"#050505",foreground:"#f2f2ef",grid:"#232320"},light:{background:"#faf8f3",foreground:"#141413",grid:"#e3e0d8"}};function Vh(n){let e=n.trim();if(/^#[0-9a-fA-F]{6}$/.test(e))return e.toLowerCase();if(/^#[0-9a-fA-F]{3}$/.test(e))return`#${[...e.slice(1)].map(o=>o+o).join("")}`.toLowerCase();if(e==="")return null;let t=document.createElement("canvas").getContext?.("2d",{willReadFrequently:!0});if(t==null)return null;let i=o=>(t.fillStyle=o,t.fillStyle=e,t.fillStyle);if(i("#000000")!==i("#ffffff"))return null;t.fillRect(0,0,1,1);let[s,r,a]=t.getImageData(0,0,1,1).data;return`#${[s,r,a].map(o=>o.toString(16).padStart(2,"0")).join("")}`}function Kf(n,e,t){let i=e==="dark"||e==="light",s=i?My[e]:n,r={background:Vh(t("--tycho-background"))??s.background,foreground:Vh(t("--tycho-foreground"))??s.foreground,grid:Vh(t("--tycho-grid"))??s.grid},a=t("--tycho-font")||n.font;return a&&(r.font=a),r.sceneForeground=n.foreground,r.sceneBackground=n.background,n.gutter!==void 0&&(r.gutter=i&&n.gutter.toLowerCase()===n.background.toLowerCase()?r.background:n.gutter),r}var Ms={accent:"#f0a050",hover:"#ffb366",press:"#d98a3a",violet:"#c050f0",violetText:"#d98cff",error:"#ff7a7a"};function Zf(n){let e=Ut(n.background,n.background,0),t=Ut(n.foreground,n.foreground,0),i=Ut(t,e,.95),s=mt(e).reduce((r,a)=>r+a,0)<1.5;return{"--bg":e,"--fg":t,"--surface":i,"--raised":Ut(t,e,.82),"--line":Ut(t,e,.8),"--dim":Ut(t,e,.287),"--track":Ut(t,e,.574),"--gutter":n.gutter??Ut(t,e,.9),"--head":`${i}cc`,"--accent":Ms.accent,"--accent-hover":Ms.hover,"--accent-press":Ms.press,"--accent-tint":Ut(Ms.accent,i,.84),"--accent-2":Ms.violet,"--accent-2-text":Ms.violetText,"--accent-2-tint":"rgba(192, 80, 240, 0.16)","--error":Ms.error,"--highlight":s?"#ffffff":"#000000"}}function mt(n){let e=/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(n);return e===null?[1,1,1]:[parseInt(e[1],16)/255,parseInt(e[2],16)/255,parseInt(e[3],16)/255]}function Ut(n,e,t){let i=mt(n),s=mt(e),r=a=>Math.round(255*((1-t)*i[a]+t*s[a])).toString(16).padStart(2,"0");return`#${r(0)}${r(1)}${r(2)}`}function jf(n,e,t=[0,1]){let[i,s]=e,r=s===i?.5:Math.min(1,Math.max(0,(n-i)/(s-i)));return t[0]+r*(t[1]-t[0])}function Ey(n){let e=1/0,t=-1/0;for(let i=0;i<n.length;i++){let s=n[i];s<e&&(e=s),s>t&&(t=s)}return e<=t?[e,t]:[0,1]}function Ty(n,e){if(typeof n=="string")return n;let t=e?.(n.var);return(t!==void 0&&Object.hasOwn(n.map,t)?n.map[t]:void 0)??Object.values(n.map).find(s=>s!==void 0)??"viridis"}var ha=n=>typeof n=="object"&&n!==null&&"steps"in n;function Ay(n,e){let t=0;for(;t<n.length&&n[t]<e;)t++;return t}function Gh(n,e,t){let i="parameter"in n,s="parameter"in n?n.parameter:n.channel,r="parameter"in n?e.parameter(n.parameter,"2.7"):e.channel(n.channel,"2.7");return{id:Ty(n.colormap,t),name:s,perTrack:i,values:r,range:n.range??Ey(r),clip:n.clip??[0,1]}}function Qf(n,e,t,i){if(n===void 0)return{kind:"constant",rgb:t};if(typeof n=="string")return{kind:"constant",rgb:mt(n)};if(ha(n)){let o=e.channel(n.channel,"2.7"),l=n.colors.map(mt),c=new Float32Array(3*e.samples);for(let h=0;h<e.samples;h++)c.set(l[Ay(n.steps,o[h])],3*h);return{kind:"sample",rgb:c}}let s=Gh(n,e,i),r=new Float32Array(3*e.samples),a=[0,0,0];if(s.perTrack)for(let o=0;o<e.tracks;o++){ws(s.id,jf(s.values[o],s.range,s.clip),a);for(let l=e.start(o);l<e.start(o)+e.count(o);l++)r.set(a,3*l)}else for(let o=0;o<e.samples;o++)r.set(ws(s.id,jf(s.values[o],s.range,s.clip),a),3*o);return{kind:"sample",rgb:r}}function Wh(n,e=12){let t=[],i=[0,0,0];for(let s=0;s<e;s++){let r=s/(e-1);ws(n.id,n.clip[0]+r*(n.clip[1]-n.clip[0]),i),t.push([r,`rgb(${i.map(a=>Math.round(255*a)).join(",")})`])}return t}function ep(n,e=12){return`linear-gradient(to top, ${Wh(n,e).map(([t,i])=>`${i} ${(100*t).toFixed(1)}%`).join(", ")})`}var tu=(n,e,t)=>{if(!e.has(n))throw TypeError("Cannot "+t)},N=(n,e,t)=>(tu(n,e,"read from private field"),t?t.call(n):e.get(n)),$e=(n,e,t)=>{if(e.has(n))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(n):e.set(n,t)},jt=(n,e,t,i)=>(tu(n,e,"write to private field"),i?i.call(n,t):e.set(n,t),t),Cy=(n,e,t,i)=>({set _(s){jt(n,e,s,t)},get _(){return N(n,e,i)}}),Qe=(n,e,t)=>(tu(n,e,"access private method"),t),et=new Uint8Array(8),di=new DataView(et.buffer),Ft=n=>[(n%256+256)%256],it=n=>(di.setUint16(0,n,!1),[et[0],et[1]]),Ry=n=>(di.setInt16(0,n,!1),[et[0],et[1]]),np=n=>(di.setUint32(0,n,!1),[et[1],et[2],et[3]]),we=n=>(di.setUint32(0,n,!1),[et[0],et[1],et[2],et[3]]),Py=n=>(di.setInt32(0,n,!1),[et[0],et[1],et[2],et[3]]),Ls=n=>(di.setUint32(0,Math.floor(n/2**32),!1),di.setUint32(4,n,!1),[et[0],et[1],et[2],et[3],et[4],et[5],et[6],et[7]]),nu=n=>(di.setInt16(0,2**8*n,!1),[et[0],et[1]]),hi=n=>(di.setInt32(0,2**16*n,!1),[et[0],et[1],et[2],et[3]]),$h=n=>(di.setInt32(0,2**30*n,!1),[et[0],et[1],et[2],et[3]]),Hn=(n,e=!1)=>{let t=Array(n.length).fill(null).map((i,s)=>n.charCodeAt(s));return e&&t.push(0),t},jo=n=>n&&n[n.length-1],iu=n=>{let e;for(let t of n)(!e||t.presentationTimestamp>e.presentationTimestamp)&&(e=t);return e},ui=(n,e,t=!0)=>{let i=n*e;return t?Math.round(i):i},ip=n=>{let e=n*(Math.PI/180),t=Math.cos(e),i=Math.sin(e);return[t,i,0,-i,t,0,0,0,1]},sp=ip(0),rp=n=>[hi(n[0]),hi(n[1]),$h(n[2]),hi(n[3]),hi(n[4]),$h(n[5]),hi(n[6]),hi(n[7]),$h(n[8])],fa=n=>!n||typeof n!="object"?n:Array.isArray(n)?n.map(fa):Object.fromEntries(Object.entries(n).map(([e,t])=>[e,fa(t)])),lr=n=>n>=0&&n<2**32,Lt=(n,e,t)=>({type:n,contents:e&&new Uint8Array(e.flat(10)),children:t}),gt=(n,e,t,i,s)=>Lt(n,[Ft(e),np(t),i??[]],s),Ly=n=>{let e=512;return n.fragmented?Lt("ftyp",[Hn("iso5"),we(e),Hn("iso5"),Hn("iso6"),Hn("mp41")]):Lt("ftyp",[Hn("isom"),we(e),Hn("isom"),n.holdsAvc?Hn("avc1"):[],Hn("mp41")])},Xh=n=>({type:"mdat",largeSize:n}),Iy=n=>({type:"free",size:n}),Wo=(n,e,t=!1)=>Lt("moov",null,[ky(e,n),...n.map(i=>Dy(i,e)),t?uv(n):null]),ky=(n,e)=>{let t=ui(Math.max(0,...e.filter(a=>a.samples.length>0).map(a=>{let o=iu(a.samples);return o.presentationTimestamp+o.duration})),jh),i=Math.max(...e.map(a=>a.id))+1,s=!lr(n)||!lr(t),r=s?Ls:we;return gt("mvhd",+s,0,[r(n),r(n),we(jh),r(t),hi(1),nu(1),Array(10).fill(0),rp(sp),Array(24).fill(0),we(i)])},Dy=(n,e)=>Lt("trak",null,[Ny(n,e),Oy(n,e)]),Ny=(n,e)=>{let t=iu(n.samples),i=ui(t?t.presentationTimestamp+t.duration:0,jh),s=!lr(e)||!lr(i),r=s?Ls:we,a;return n.info.type==="video"?a=typeof n.info.rotation=="number"?ip(n.info.rotation):n.info.rotation:a=sp,gt("tkhd",+s,3,[r(e),r(e),we(n.id),we(0),r(i),Array(8).fill(0),it(0),it(0),nu(n.info.type==="audio"?1:0),it(0),rp(a),hi(n.info.type==="video"?n.info.width:0),hi(n.info.type==="video"?n.info.height:0)])},Oy=(n,e)=>Lt("mdia",null,[Uy(n,e),Fy(n.info.type==="video"?"vide":"soun"),By(n)]),Uy=(n,e)=>{let t=iu(n.samples),i=ui(t?t.presentationTimestamp+t.duration:0,n.timescale),s=!lr(e)||!lr(i),r=s?Ls:we;return gt("mdhd",+s,0,[r(e),r(e),we(n.timescale),r(i),it(21956),it(0)])},Fy=n=>gt("hdlr",0,0,[Hn("mhlr"),Hn(n),we(0),we(0),we(0),Hn("mp4-muxer-hdlr",!0)]),By=n=>Lt("minf",null,[n.info.type==="video"?zy():Hy(),Vy(),$y(n)]),zy=()=>gt("vmhd",0,1,[it(0),it(0),it(0),it(0)]),Hy=()=>gt("smhd",0,0,[it(0),it(0)]),Vy=()=>Lt("dinf",null,[Gy()]),Gy=()=>gt("dref",0,0,[we(1)],[Wy()]),Wy=()=>gt("url ",0,1),$y=n=>{let e=n.compositionTimeOffsetTable.length>1||n.compositionTimeOffsetTable.some(t=>t.sampleCompositionTimeOffset!==0);return Lt("stbl",null,[Xy(n),rv(n),av(n),ov(n),lv(n),cv(n),e?hv(n):null])},Xy=n=>gt("stsd",0,0,[we(1)],[n.info.type==="video"?qy(_v[n.info.codec],n):nv(wv[n.info.codec],n)]),qy=(n,e)=>Lt(n,[Array(6).fill(0),it(1),it(0),it(0),Array(12).fill(0),it(e.info.width),it(e.info.height),we(4718592),we(4718592),we(0),it(1),Array(32).fill(0),it(24),Ry(65535)],[Sv[e.info.codec](e),e.info.decoderConfig.colorSpace?Ky(e):null]),Yy={bt709:1,bt470bg:5,smpte170m:6},jy={bt709:1,smpte170m:6,"iec61966-2-1":13},Jy={rgb:0,bt709:1,bt470bg:5,smpte170m:6},Ky=n=>Lt("colr",[Hn("nclx"),it(Yy[n.info.decoderConfig.colorSpace.primaries]),it(jy[n.info.decoderConfig.colorSpace.transfer]),it(Jy[n.info.decoderConfig.colorSpace.matrix]),Ft((n.info.decoderConfig.colorSpace.fullRange?1:0)<<7)]),Zy=n=>n.info.decoderConfig&&Lt("avcC",[...new Uint8Array(n.info.decoderConfig.description)]),Qy=n=>n.info.decoderConfig&&Lt("hvcC",[...new Uint8Array(n.info.decoderConfig.description)]),ev=n=>{if(!n.info.decoderConfig)return null;let e=n.info.decoderConfig;if(!e.colorSpace)throw new Error("'colorSpace' is required in the decoder config for VP9.");let t=e.codec.split("."),i=Number(t[1]),s=Number(t[2]),o=(Number(t[3])<<4)+(0<<1)+Number(e.colorSpace.fullRange);return gt("vpcC",1,0,[Ft(i),Ft(s),Ft(o),Ft(2),Ft(2),Ft(2),it(0)])},tv=()=>{let t=(1<<7)+1;return Lt("av1C",[t,0,0,0])},nv=(n,e)=>Lt(n,[Array(6).fill(0),it(1),it(0),it(0),we(0),it(e.info.numberOfChannels),it(16),it(0),it(0),hi(e.info.sampleRate)],[Mv[e.info.codec](e)]),iv=n=>{let e=new Uint8Array(n.info.decoderConfig.description);return gt("esds",0,0,[we(58753152),Ft(32+e.byteLength),it(1),Ft(0),we(75530368),Ft(18+e.byteLength),Ft(64),Ft(21),np(0),we(130071),we(130071),we(92307584),Ft(e.byteLength),...e,we(109084800),Ft(1),Ft(2)])},sv=n=>{let e=3840,t=0,i=n.info.decoderConfig?.description;if(i){if(i.byteLength<18)throw new TypeError("Invalid decoder description provided for Opus; must be at least 18 bytes long.");let s=ArrayBuffer.isView(i)?new DataView(i.buffer,i.byteOffset,i.byteLength):new DataView(i);e=s.getUint16(10,!0),t=s.getInt16(14,!0)}return Lt("dOps",[Ft(0),Ft(n.info.numberOfChannels),it(e),we(n.info.sampleRate),nu(t),Ft(0)])},rv=n=>gt("stts",0,0,[we(n.timeToSampleTable.length),n.timeToSampleTable.map(e=>[we(e.sampleCount),we(e.sampleDelta)])]),av=n=>{if(n.samples.every(t=>t.type==="key"))return null;let e=[...n.samples.entries()].filter(([,t])=>t.type==="key");return gt("stss",0,0,[we(e.length),e.map(([t])=>we(t+1))])},ov=n=>gt("stsc",0,0,[we(n.compactlyCodedChunkTable.length),n.compactlyCodedChunkTable.map(e=>[we(e.firstChunk),we(e.samplesPerChunk),we(1)])]),lv=n=>gt("stsz",0,0,[we(0),we(n.samples.length),n.samples.map(e=>we(e.size))]),cv=n=>n.finalizedChunks.length>0&&jo(n.finalizedChunks).offset>=2**32?gt("co64",0,0,[we(n.finalizedChunks.length),n.finalizedChunks.map(e=>Ls(e.offset))]):gt("stco",0,0,[we(n.finalizedChunks.length),n.finalizedChunks.map(e=>we(e.offset))]),hv=n=>gt("ctts",0,0,[we(n.compositionTimeOffsetTable.length),n.compositionTimeOffsetTable.map(e=>[we(e.sampleCount),we(e.sampleCompositionTimeOffset)])]),uv=n=>Lt("mvex",null,n.map(dv)),dv=n=>gt("trex",0,0,[we(n.id),we(1),we(0),we(0),we(0)]),tp=(n,e)=>Lt("moof",null,[fv(n),...e.map(pv)]),fv=n=>gt("mfhd",0,0,[we(n)]),ap=n=>{let e=0,t=0,i=0,s=0,r=n.type==="delta";return t|=+r,r?e|=1:e|=2,e<<24|t<<16|i<<8|s},pv=n=>Lt("traf",null,[mv(n),gv(n),yv(n)]),mv=n=>{let e=0;e|=8,e|=16,e|=32,e|=131072;let t=n.currentChunk.samples[1]??n.currentChunk.samples[0],i={duration:t.timescaleUnitsToNextSample,size:t.size,flags:ap(t)};return gt("tfhd",0,e,[we(n.id),we(i.duration),we(i.size),we(i.flags)])},gv=n=>gt("tfdt",1,0,[Ls(ui(n.currentChunk.startTimestamp,n.timescale))]),yv=n=>{let e=n.currentChunk.samples.map(y=>y.timescaleUnitsToNextSample),t=n.currentChunk.samples.map(y=>y.size),i=n.currentChunk.samples.map(ap),s=n.currentChunk.samples.map(y=>ui(y.presentationTimestamp-y.decodeTimestamp,n.timescale)),r=new Set(e),a=new Set(t),o=new Set(i),l=new Set(s),c=o.size===2&&i[0]!==i[1],h=r.size>1,u=a.size>1,d=!c&&o.size>1,f=l.size>1||[...l].some(y=>y!==0),p=0;return p|=1,p|=4*+c,p|=256*+h,p|=512*+u,p|=1024*+d,p|=2048*+f,gt("trun",1,p,[we(n.currentChunk.samples.length),we(n.currentChunk.offset-n.currentChunk.moofOffset||0),c?we(i[0]):[],n.currentChunk.samples.map((y,m)=>[h?we(e[m]):[],u?we(t[m]):[],d?we(i[m]):[],f?Py(s[m]):[]])])},vv=n=>Lt("mfra",null,[...n.map(bv),xv()]),bv=(n,e)=>gt("tfra",1,0,[we(n.id),we(63),we(n.finalizedChunks.length),n.finalizedChunks.map(i=>[Ls(ui(i.startTimestamp,n.timescale)),Ls(i.moofOffset),we(e+1),we(1),we(1)])]),xv=()=>gt("mfro",0,0,[we(0)]),_v={avc:"avc1",hevc:"hvc1",vp9:"vp09",av1:"av01"},Sv={avc:Zy,hevc:Qy,vp9:ev,av1:tv},wv={aac:"mp4a",opus:"Opus"},Mv={aac:iv,opus:sv};var tl=class{},su=class extends tl{constructor(){super(...arguments),this.buffer=null}},op=class extends tl{constructor(n){if(super(),this.options=n,typeof n!="object")throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");if(n.onData){if(typeof n.onData!="function")throw new TypeError("options.onData, when provided, must be a function.");if(n.onData.length<2)throw new TypeError("options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs.")}if(n.chunked!==void 0&&typeof n.chunked!="boolean")throw new TypeError("options.chunked, when provided, must be a boolean.");if(n.chunkSize!==void 0&&(!Number.isInteger(n.chunkSize)||n.chunkSize<1024))throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.")}},Ev=class extends tl{constructor(n,e){if(super(),this.stream=n,this.options=e,!(n instanceof FileSystemWritableFileStream))throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");if(e!==void 0&&typeof e!="object")throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");if(e&&e.chunkSize!==void 0&&(!Number.isInteger(e.chunkSize)||e.chunkSize<=0))throw new TypeError("options.chunkSize, when provided, must be a positive integer")}},Ts,rr,lp=class{constructor(){this.pos=0,$e(this,Ts,new Uint8Array(8)),$e(this,rr,new DataView(N(this,Ts).buffer)),this.offsets=new WeakMap}seek(n){this.pos=n}writeU32(n){N(this,rr).setUint32(0,n,!1),this.write(N(this,Ts).subarray(0,4))}writeU64(n){N(this,rr).setUint32(0,Math.floor(n/2**32),!1),N(this,rr).setUint32(4,n,!1),this.write(N(this,Ts).subarray(0,8))}writeAscii(n){for(let e=0;e<n.length;e++)N(this,rr).setUint8(e%8,n.charCodeAt(e)),e%8===7&&this.write(N(this,Ts));n.length%8!==0&&this.write(N(this,Ts).subarray(0,n.length%8))}writeBox(n){if(this.offsets.set(n,this.pos),n.contents&&!n.children)this.writeBoxHeader(n,n.size??n.contents.byteLength+8),this.write(n.contents);else{let e=this.pos;if(this.writeBoxHeader(n,0),n.contents&&this.write(n.contents),n.children)for(let s of n.children)s&&this.writeBox(s);let t=this.pos,i=n.size??t-e;this.seek(e),this.writeBoxHeader(n,i),this.seek(t)}}writeBoxHeader(n,e){this.writeU32(n.largeSize?1:e),this.writeAscii(n.type),n.largeSize&&this.writeU64(e)}measureBoxHeader(n){return 8+(n.largeSize?8:0)}patchBox(n){let e=this.pos;this.seek(this.offsets.get(n)),this.writeBox(n),this.seek(e)}measureBox(n){if(n.contents&&!n.children)return this.measureBoxHeader(n)+n.contents.byteLength;{let e=this.measureBoxHeader(n);if(n.contents&&(e+=n.contents.byteLength),n.children)for(let t of n.children)t&&(e+=this.measureBox(t));return e}}};Ts=new WeakMap;rr=new WeakMap;var $o,Ps,va,ua,Xo,qh,Tv=class extends lp{constructor(n){super(),$e(this,Xo),$e(this,$o,void 0),$e(this,Ps,new ArrayBuffer(2**16)),$e(this,va,new Uint8Array(N(this,Ps))),$e(this,ua,0),jt(this,$o,n)}write(n){Qe(this,Xo,qh).call(this,this.pos+n.byteLength),N(this,va).set(n,this.pos),this.pos+=n.byteLength,jt(this,ua,Math.max(N(this,ua),this.pos))}finalize(){Qe(this,Xo,qh).call(this,this.pos),N(this,$o).buffer=N(this,Ps).slice(0,Math.max(N(this,ua),this.pos))}};$o=new WeakMap;Ps=new WeakMap;va=new WeakMap;ua=new WeakMap;Xo=new WeakSet;qh=function(n){let e=N(this,Ps).byteLength;for(;e<n;)e*=2;if(e===N(this,Ps).byteLength)return;let t=new ArrayBuffer(e),i=new Uint8Array(t);i.set(N(this,va),0),jt(this,Ps,t),jt(this,va,i)};var Av=2**24,Cv=2,pa,As,da,Si,Sn,Jo,Yh,ru,cp,au,hp,ma,Ko,ou=class extends lp{constructor(n){super(),$e(this,Jo),$e(this,ru),$e(this,au),$e(this,ma),$e(this,pa,void 0),$e(this,As,[]),$e(this,da,void 0),$e(this,Si,void 0),$e(this,Sn,[]),jt(this,pa,n),jt(this,da,n.options?.chunked??!1),jt(this,Si,n.options?.chunkSize??Av)}write(n){N(this,As).push({data:n.slice(),start:this.pos}),this.pos+=n.byteLength}flush(){if(N(this,As).length===0)return;let n=[],e=[...N(this,As)].sort((t,i)=>t.start-i.start);n.push({start:e[0].start,size:e[0].data.byteLength});for(let t=1;t<e.length;t++){let i=n[n.length-1],s=e[t];s.start<=i.start+i.size?i.size=Math.max(i.size,s.start+s.data.byteLength-i.start):n.push({start:s.start,size:s.data.byteLength})}for(let t of n){t.data=new Uint8Array(t.size);for(let i of N(this,As))t.start<=i.start&&i.start<t.start+t.size&&t.data.set(i.data,i.start-t.start);N(this,da)?(Qe(this,Jo,Yh).call(this,t.data,t.start),Qe(this,ma,Ko).call(this)):N(this,pa).options.onData?.(t.data,t.start)}N(this,As).length=0}finalize(){N(this,da)&&Qe(this,ma,Ko).call(this,!0)}};pa=new WeakMap;As=new WeakMap;da=new WeakMap;Si=new WeakMap;Sn=new WeakMap;Jo=new WeakSet;Yh=function(n,e){let t=N(this,Sn).findIndex(o=>o.start<=e&&e<o.start+N(this,Si));t===-1&&(t=Qe(this,au,hp).call(this,e));let i=N(this,Sn)[t],s=e-i.start,r=n.subarray(0,Math.min(N(this,Si)-s,n.byteLength));i.data.set(r,s);let a={start:s,end:s+r.byteLength};if(Qe(this,ru,cp).call(this,i,a),i.written[0].start===0&&i.written[0].end===N(this,Si)&&(i.shouldFlush=!0),N(this,Sn).length>Cv){for(let o=0;o<N(this,Sn).length-1;o++)N(this,Sn)[o].shouldFlush=!0;Qe(this,ma,Ko).call(this)}r.byteLength<n.byteLength&&Qe(this,Jo,Yh).call(this,n.subarray(r.byteLength),e+r.byteLength)};ru=new WeakSet;cp=function(n,e){let t=0,i=n.written.length-1,s=-1;for(;t<=i;){let r=Math.floor(t+(i-t+1)/2);n.written[r].start<=e.start?(t=r+1,s=r):i=r-1}for(n.written.splice(s+1,0,e),(s===-1||n.written[s].end<e.start)&&s++;s<n.written.length-1&&n.written[s].end>=n.written[s+1].start;)n.written[s].end=Math.max(n.written[s].end,n.written[s+1].end),n.written.splice(s+1,1)};au=new WeakSet;hp=function(n){let t={start:Math.floor(n/N(this,Si))*N(this,Si),data:new Uint8Array(N(this,Si)),written:[],shouldFlush:!1};return N(this,Sn).push(t),N(this,Sn).sort((i,s)=>i.start-s.start),N(this,Sn).indexOf(t)};ma=new WeakSet;Ko=function(n=!1){for(let e=0;e<N(this,Sn).length;e++){let t=N(this,Sn)[e];if(!(!t.shouldFlush&&!n)){for(let i of t.written)N(this,pa).options.onData?.(t.data.subarray(i.start,i.end),t.start+i.start);N(this,Sn).splice(e--,1)}}};var Rv=class extends ou{constructor(n){super(new op({onData:(e,t)=>n.stream.write({type:"write",data:e,position:t}),chunked:!0,chunkSize:n.options?.chunkSize}))}},jh=1e3,Pv=["avc","hevc","vp9","av1"],Lv=["aac","opus"],Iv=2082844800,kv=["strict","offset","cross-track-offset"],Pe,Oe,Zo,_n,en,Yt,ar,or,lu,Cs,Rs,ga,Jh,up,Kh,dp,cu,fp,Zh,pp,hu,mp,qo,Qh,ci,_i,uu,gp,ya,Qo,el,du,cr,ba,Yo,eu,yp=class{constructor(n){if($e(this,Jh),$e(this,Kh),$e(this,cu),$e(this,Zh),$e(this,hu),$e(this,qo),$e(this,ci),$e(this,uu),$e(this,ya),$e(this,el),$e(this,cr),$e(this,Yo),$e(this,Pe,void 0),$e(this,Oe,void 0),$e(this,Zo,void 0),$e(this,_n,void 0),$e(this,en,null),$e(this,Yt,null),$e(this,ar,Math.floor(Date.now()/1e3)+Iv),$e(this,or,[]),$e(this,lu,1),$e(this,Cs,[]),$e(this,Rs,[]),$e(this,ga,!1),Qe(this,Jh,up).call(this,n),n.video=fa(n.video),n.audio=fa(n.audio),n.fastStart=fa(n.fastStart),this.target=n.target,jt(this,Pe,{firstTimestampBehavior:"strict",...n}),n.target instanceof su)jt(this,Oe,new Tv(n.target));else if(n.target instanceof op)jt(this,Oe,new ou(n.target));else if(n.target instanceof Ev)jt(this,Oe,new Rv(n.target));else throw new Error(`Invalid target: ${n.target}`);Qe(this,Zh,pp).call(this),Qe(this,Kh,dp).call(this)}addVideoChunk(n,e,t,i){if(!(n instanceof EncodedVideoChunk))throw new TypeError("addVideoChunk's first argument (sample) must be of type EncodedVideoChunk.");if(e&&typeof e!="object")throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");if(t!==void 0&&(!Number.isFinite(t)||t<0))throw new TypeError("addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number.");if(i!==void 0&&!Number.isFinite(i))throw new TypeError("addVideoChunk's fourth argument (compositionTimeOffset), when provided, must be a real number.");let s=new Uint8Array(n.byteLength);n.copyTo(s),this.addVideoChunkRaw(s,n.type,t??n.timestamp,n.duration,e,i)}addVideoChunkRaw(n,e,t,i,s,r){if(!(n instanceof Uint8Array))throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");if(e!=="key"&&e!=="delta")throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(t)||t<0)throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(i)||i<0)throw new TypeError("addVideoChunkRaw's fourth argument (duration) must be a non-negative real number.");if(s&&typeof s!="object")throw new TypeError("addVideoChunkRaw's fifth argument (meta), when provided, must be an object.");if(r!==void 0&&!Number.isFinite(r))throw new TypeError("addVideoChunkRaw's sixth argument (compositionTimeOffset), when provided, must be a real number.");if(Qe(this,Yo,eu).call(this),!N(this,Pe).video)throw new Error("No video track declared.");if(typeof N(this,Pe).fastStart=="object"&&N(this,en).samples.length===N(this,Pe).fastStart.expectedVideoChunks)throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${N(this,Pe).fastStart.expectedVideoChunks}).`);let a=Qe(this,qo,Qh).call(this,N(this,en),n,e,t,i,s,r);if(N(this,Pe).fastStart==="fragmented"&&N(this,Yt)){for(;N(this,Rs).length>0&&N(this,Rs)[0].decodeTimestamp<=a.decodeTimestamp;){let o=N(this,Rs).shift();Qe(this,ci,_i).call(this,N(this,Yt),o)}a.decodeTimestamp<=N(this,Yt).lastDecodeTimestamp?Qe(this,ci,_i).call(this,N(this,en),a):N(this,Cs).push(a)}else Qe(this,ci,_i).call(this,N(this,en),a)}addAudioChunk(n,e,t){if(!(n instanceof EncodedAudioChunk))throw new TypeError("addAudioChunk's first argument (sample) must be of type EncodedAudioChunk.");if(e&&typeof e!="object")throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");if(t!==void 0&&(!Number.isFinite(t)||t<0))throw new TypeError("addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number.");let i=new Uint8Array(n.byteLength);n.copyTo(i),this.addAudioChunkRaw(i,n.type,t??n.timestamp,n.duration,e)}addAudioChunkRaw(n,e,t,i,s){if(!(n instanceof Uint8Array))throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");if(e!=="key"&&e!=="delta")throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(t)||t<0)throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(i)||i<0)throw new TypeError("addAudioChunkRaw's fourth argument (duration) must be a non-negative real number.");if(s&&typeof s!="object")throw new TypeError("addAudioChunkRaw's fifth argument (meta), when provided, must be an object.");if(Qe(this,Yo,eu).call(this),!N(this,Pe).audio)throw new Error("No audio track declared.");if(typeof N(this,Pe).fastStart=="object"&&N(this,Yt).samples.length===N(this,Pe).fastStart.expectedAudioChunks)throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${N(this,Pe).fastStart.expectedAudioChunks}).`);let r=Qe(this,qo,Qh).call(this,N(this,Yt),n,e,t,i,s);if(N(this,Pe).fastStart==="fragmented"&&N(this,en)){for(;N(this,Cs).length>0&&N(this,Cs)[0].decodeTimestamp<=r.decodeTimestamp;){let a=N(this,Cs).shift();Qe(this,ci,_i).call(this,N(this,en),a)}r.decodeTimestamp<=N(this,en).lastDecodeTimestamp?Qe(this,ci,_i).call(this,N(this,Yt),r):N(this,Rs).push(r)}else Qe(this,ci,_i).call(this,N(this,Yt),r)}finalize(){if(N(this,ga))throw new Error("Cannot finalize a muxer more than once.");if(N(this,Pe).fastStart==="fragmented"){for(let e of N(this,Cs))Qe(this,ci,_i).call(this,N(this,en),e);for(let e of N(this,Rs))Qe(this,ci,_i).call(this,N(this,Yt),e);Qe(this,el,du).call(this,!1)}else N(this,en)&&Qe(this,ya,Qo).call(this,N(this,en)),N(this,Yt)&&Qe(this,ya,Qo).call(this,N(this,Yt));let n=[N(this,en),N(this,Yt)].filter(Boolean);if(N(this,Pe).fastStart==="in-memory"){let e;for(let i=0;i<2;i++){let s=Wo(n,N(this,ar)),r=N(this,Oe).measureBox(s);e=N(this,Oe).measureBox(N(this,_n));let a=N(this,Oe).pos+r+e;for(let o of N(this,or)){o.offset=a;for(let{data:l}of o.samples)a+=l.byteLength,e+=l.byteLength}if(a<2**32)break;e>=2**32&&(N(this,_n).largeSize=!0)}let t=Wo(n,N(this,ar));N(this,Oe).writeBox(t),N(this,_n).size=e,N(this,Oe).writeBox(N(this,_n));for(let i of N(this,or))for(let s of i.samples)N(this,Oe).write(s.data),s.data=null}else if(N(this,Pe).fastStart==="fragmented"){let e=N(this,Oe).pos,t=vv(n);N(this,Oe).writeBox(t);let i=N(this,Oe).pos-e;N(this,Oe).seek(N(this,Oe).pos-4),N(this,Oe).writeU32(i)}else{let e=N(this,Oe).offsets.get(N(this,_n)),t=N(this,Oe).pos-e;N(this,_n).size=t,N(this,_n).largeSize=t>=2**32,N(this,Oe).patchBox(N(this,_n));let i=Wo(n,N(this,ar));if(typeof N(this,Pe).fastStart=="object"){N(this,Oe).seek(N(this,Zo)),N(this,Oe).writeBox(i);let s=e-N(this,Oe).pos;N(this,Oe).writeBox(Iy(s))}else N(this,Oe).writeBox(i)}Qe(this,cr,ba).call(this),N(this,Oe).finalize(),jt(this,ga,!0)}};Pe=new WeakMap;Oe=new WeakMap;Zo=new WeakMap;_n=new WeakMap;en=new WeakMap;Yt=new WeakMap;ar=new WeakMap;or=new WeakMap;lu=new WeakMap;Cs=new WeakMap;Rs=new WeakMap;ga=new WeakMap;Jh=new WeakSet;up=function(n){if(typeof n!="object")throw new TypeError("The muxer requires an options object to be passed to its constructor.");if(!(n.target instanceof tl))throw new TypeError("The target must be provided and an instance of Target.");if(n.video){if(!Pv.includes(n.video.codec))throw new TypeError(`Unsupported video codec: ${n.video.codec}`);if(!Number.isInteger(n.video.width)||n.video.width<=0)throw new TypeError(`Invalid video width: ${n.video.width}. Must be a positive integer.`);if(!Number.isInteger(n.video.height)||n.video.height<=0)throw new TypeError(`Invalid video height: ${n.video.height}. Must be a positive integer.`);let e=n.video.rotation;if(typeof e=="number"&&![0,90,180,270].includes(e))throw new TypeError(`Invalid video rotation: ${e}. Has to be 0, 90, 180 or 270.`);if(Array.isArray(e)&&(e.length!==9||e.some(t=>typeof t!="number")))throw new TypeError(`Invalid video transformation matrix: ${e.join()}`);if(n.video.frameRate!==void 0&&(!Number.isInteger(n.video.frameRate)||n.video.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${n.video.frameRate}. Must be a positive integer.`)}if(n.audio){if(!Lv.includes(n.audio.codec))throw new TypeError(`Unsupported audio codec: ${n.audio.codec}`);if(!Number.isInteger(n.audio.numberOfChannels)||n.audio.numberOfChannels<=0)throw new TypeError(`Invalid number of audio channels: ${n.audio.numberOfChannels}. Must be a positive integer.`);if(!Number.isInteger(n.audio.sampleRate)||n.audio.sampleRate<=0)throw new TypeError(`Invalid audio sample rate: ${n.audio.sampleRate}. Must be a positive integer.`)}if(n.firstTimestampBehavior&&!kv.includes(n.firstTimestampBehavior))throw new TypeError(`Invalid first timestamp behavior: ${n.firstTimestampBehavior}`);if(typeof n.fastStart=="object"){if(n.video){if(n.fastStart.expectedVideoChunks===void 0)throw new TypeError("'fastStart' is an object but is missing property 'expectedVideoChunks'.");if(!Number.isInteger(n.fastStart.expectedVideoChunks)||n.fastStart.expectedVideoChunks<0)throw new TypeError("'expectedVideoChunks' must be a non-negative integer.")}if(n.audio){if(n.fastStart.expectedAudioChunks===void 0)throw new TypeError("'fastStart' is an object but is missing property 'expectedAudioChunks'.");if(!Number.isInteger(n.fastStart.expectedAudioChunks)||n.fastStart.expectedAudioChunks<0)throw new TypeError("'expectedAudioChunks' must be a non-negative integer.")}}else if(![!1,"in-memory","fragmented"].includes(n.fastStart))throw new TypeError("'fastStart' option must be false, 'in-memory', 'fragmented' or an object.");if(n.minFragmentDuration!==void 0&&(!Number.isFinite(n.minFragmentDuration)||n.minFragmentDuration<0))throw new TypeError("'minFragmentDuration' must be a non-negative number.")};Kh=new WeakSet;dp=function(){if(N(this,Oe).writeBox(Ly({holdsAvc:N(this,Pe).video?.codec==="avc",fragmented:N(this,Pe).fastStart==="fragmented"})),jt(this,Zo,N(this,Oe).pos),N(this,Pe).fastStart==="in-memory")jt(this,_n,Xh(!1));else if(N(this,Pe).fastStart!=="fragmented"){if(typeof N(this,Pe).fastStart=="object"){let n=Qe(this,cu,fp).call(this);N(this,Oe).seek(N(this,Oe).pos+n)}jt(this,_n,Xh(!0)),N(this,Oe).writeBox(N(this,_n))}Qe(this,cr,ba).call(this)};cu=new WeakSet;fp=function(){if(typeof N(this,Pe).fastStart!="object")return;let n=0,e=[N(this,Pe).fastStart.expectedVideoChunks,N(this,Pe).fastStart.expectedAudioChunks];for(let t of e)t&&(n+=8*Math.ceil(2/3*t),n+=4*t,n+=12*Math.ceil(2/3*t),n+=4*t,n+=8*t);return n+=4096,n};Zh=new WeakSet;pp=function(){if(N(this,Pe).video&&jt(this,en,{id:1,info:{type:"video",codec:N(this,Pe).video.codec,width:N(this,Pe).video.width,height:N(this,Pe).video.height,rotation:N(this,Pe).video.rotation??0,decoderConfig:null},timescale:N(this,Pe).video.frameRate??57600,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),N(this,Pe).audio&&(jt(this,Yt,{id:N(this,Pe).video?2:1,info:{type:"audio",codec:N(this,Pe).audio.codec,numberOfChannels:N(this,Pe).audio.numberOfChannels,sampleRate:N(this,Pe).audio.sampleRate,decoderConfig:null},timescale:N(this,Pe).audio.sampleRate,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),N(this,Pe).audio.codec==="aac")){let n=Qe(this,hu,mp).call(this,2,N(this,Pe).audio.sampleRate,N(this,Pe).audio.numberOfChannels);N(this,Yt).info.decoderConfig={codec:N(this,Pe).audio.codec,description:n,numberOfChannels:N(this,Pe).audio.numberOfChannels,sampleRate:N(this,Pe).audio.sampleRate}}};hu=new WeakSet;mp=function(n,e,t){let s=[96e3,88200,64e3,48e3,44100,32e3,24e3,22050,16e3,12e3,11025,8e3,7350].indexOf(e),r=t,a="";a+=n.toString(2).padStart(5,"0"),a+=s.toString(2).padStart(4,"0"),s===15&&(a+=e.toString(2).padStart(24,"0")),a+=r.toString(2).padStart(4,"0");let o=Math.ceil(a.length/8)*8;a=a.padEnd(o,"0");let l=new Uint8Array(a.length/8);for(let c=0;c<a.length;c+=8)l[c/8]=parseInt(a.slice(c,c+8),2);return l};qo=new WeakSet;Qh=function(n,e,t,i,s,r,a){let o=i/1e6,l=(i-(a??0))/1e6,c=s/1e6,h=Qe(this,uu,gp).call(this,o,l,n);return o=h.presentationTimestamp,l=h.decodeTimestamp,r?.decoderConfig&&(n.info.decoderConfig===null?n.info.decoderConfig=r.decoderConfig:Object.assign(n.info.decoderConfig,r.decoderConfig)),{presentationTimestamp:o,decodeTimestamp:l,duration:c,data:e,size:e.byteLength,type:t,timescaleUnitsToNextSample:ui(c,n.timescale)}};ci=new WeakSet;_i=function(n,e){N(this,Pe).fastStart!=="fragmented"&&n.samples.push(e);let t=ui(e.presentationTimestamp-e.decodeTimestamp,n.timescale);if(n.lastTimescaleUnits!==null){let s=ui(e.decodeTimestamp,n.timescale,!1),r=Math.round(s-n.lastTimescaleUnits);if(n.lastTimescaleUnits+=r,n.lastSample.timescaleUnitsToNextSample=r,N(this,Pe).fastStart!=="fragmented"){let a=jo(n.timeToSampleTable);a.sampleCount===1?(a.sampleDelta=r,a.sampleCount++):a.sampleDelta===r?a.sampleCount++:(a.sampleCount--,n.timeToSampleTable.push({sampleCount:2,sampleDelta:r}));let o=jo(n.compositionTimeOffsetTable);o.sampleCompositionTimeOffset===t?o.sampleCount++:n.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:t})}}else n.lastTimescaleUnits=0,N(this,Pe).fastStart!=="fragmented"&&(n.timeToSampleTable.push({sampleCount:1,sampleDelta:ui(e.duration,n.timescale)}),n.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:t}));n.lastSample=e;let i=!1;if(!n.currentChunk)i=!0;else{let s=e.presentationTimestamp-n.currentChunk.startTimestamp;if(N(this,Pe).fastStart==="fragmented"){let r=N(this,en)??N(this,Yt),a=N(this,Pe).minFragmentDuration??1;n===r&&e.type==="key"&&s>=a&&(i=!0,Qe(this,el,du).call(this))}else i=s>=.5}i&&(n.currentChunk&&Qe(this,ya,Qo).call(this,n),n.currentChunk={startTimestamp:e.presentationTimestamp,samples:[]}),n.currentChunk.samples.push(e)};uu=new WeakSet;gp=function(n,e,t){let i=N(this,Pe).firstTimestampBehavior==="strict",s=t.lastDecodeTimestamp===-1;if(i&&s&&e!==0)throw new Error(`The first chunk for your media track must have a timestamp of 0 (received DTS=${e}).Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of thedocument, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
`);if(N(this,Pe).firstTimestampBehavior==="offset"||N(this,Pe).firstTimestampBehavior==="cross-track-offset"){t.firstDecodeTimestamp===void 0&&(t.firstDecodeTimestamp=e);let a;N(this,Pe).firstTimestampBehavior==="offset"?a=t.firstDecodeTimestamp:a=Math.min(N(this,en)?.firstDecodeTimestamp??1/0,N(this,Yt)?.firstDecodeTimestamp??1/0),e-=a,n-=a}if(e<t.lastDecodeTimestamp)throw new Error(`Timestamps must be monotonically increasing (DTS went from ${t.lastDecodeTimestamp*1e6} to ${e*1e6}).`);return t.lastDecodeTimestamp=e,{presentationTimestamp:n,decodeTimestamp:e}};ya=new WeakSet;Qo=function(n){if(N(this,Pe).fastStart==="fragmented")throw new Error("Can't finalize individual chunks if 'fastStart' is set to 'fragmented'.");if(n.currentChunk){if(n.finalizedChunks.push(n.currentChunk),N(this,or).push(n.currentChunk),(n.compactlyCodedChunkTable.length===0||jo(n.compactlyCodedChunkTable).samplesPerChunk!==n.currentChunk.samples.length)&&n.compactlyCodedChunkTable.push({firstChunk:n.finalizedChunks.length,samplesPerChunk:n.currentChunk.samples.length}),N(this,Pe).fastStart==="in-memory"){n.currentChunk.offset=0;return}n.currentChunk.offset=N(this,Oe).pos;for(let e of n.currentChunk.samples)N(this,Oe).write(e.data),e.data=null;Qe(this,cr,ba).call(this)}};el=new WeakSet;du=function(n=!0){if(N(this,Pe).fastStart!=="fragmented")throw new Error("Can't finalize a fragment unless 'fastStart' is set to 'fragmented'.");let e=[N(this,en),N(this,Yt)].filter(o=>o&&o.currentChunk);if(e.length===0)return;let t=Cy(this,lu)._++;if(t===1){let o=Wo(e,N(this,ar),!0);N(this,Oe).writeBox(o)}let i=N(this,Oe).pos,s=tp(t,e);N(this,Oe).writeBox(s);{let o=Xh(!1),l=0;for(let h of e)for(let u of h.currentChunk.samples)l+=u.size;let c=N(this,Oe).measureBox(o)+l;c>=2**32&&(o.largeSize=!0,c=N(this,Oe).measureBox(o)+l),o.size=c,N(this,Oe).writeBox(o)}for(let o of e){o.currentChunk.offset=N(this,Oe).pos,o.currentChunk.moofOffset=i;for(let l of o.currentChunk.samples)N(this,Oe).write(l.data),l.data=null}let r=N(this,Oe).pos;N(this,Oe).seek(N(this,Oe).offsets.get(s));let a=tp(t,e);N(this,Oe).writeBox(a),N(this,Oe).seek(r);for(let o of e)o.finalizedChunks.push(o.currentChunk),N(this,or).push(o.currentChunk),o.currentChunk=null;n&&Qe(this,cr,ba).call(this)};cr=new WeakSet;ba=function(){N(this,Oe)instanceof ou&&N(this,Oe).flush()};Yo=new WeakSet;eu=function(){if(N(this,ga))throw new Error("Cannot add new video or audio chunks after the file has been finalized.")};function gu(n){return(n.lap??0)-(n.shifted?1:0)}var fu=class{set;frame;laps;top;invariant;frames;stores=new Map;box=null;constructor(e,t,i,s=1){this.set=e,this.frame=t,this.frames=i,this.laps=e.periodic?s:1,this.top=this.laps-1,this.invariant=i.requirements(e.def.frame,t).channels.size===0}storeLap(e){return this.invariant?0:e}lapKey(e){return this.invariant?e<this.top?"joined":"top":String(e)}store(e){let t=this.storeLap(e),i=this.stores.get(t);return i===void 0&&(i={buf:new Float64Array(3*this.set.samples),done:new Uint8Array(this.set.tracks),all:!1},this.stores.set(t,i)),i}ensure(e,t){let i=Dv(t),s=this.store(i);if(s.done[e]===1)return s.buf;let r=this.set,a=this.storeLap(i),o=r.start(e);for(let l=0;l<r.count(e);l++)s.buf.set(this.frames.transform(r.position(e,l),r.def.frame,this.frame,{set:r,track:e,sample:l,shifted:!1,lap:a}),3*(o+l));return s.done[e]=1,s.buf}lapPositions(e){let t=this.store(e);if(!t.all){for(let i=0;i<this.set.tracks;i++)this.ensure(i,e);t.all=!0}return t.buf}get positions(){return this.lapPositions(0)}get shifted(){return this.set.periodic?this.lapPositions(-1):null}track(e,t){let i=this.ensure(e,t),s=this.set.start(e);return i.subarray(3*s,3*(s+this.set.count(e)))}gpuSample(e,t,i,s,r=0){let a=i===this.set.count(e)-1&&t<this.top,o=this.ensure(e,a?t+1:t),l=3*(this.set.start(e)+(a?0:i));s[r]=o[l],s[r+1]=o[l+1],s[r+2]=o[l+2]}bounds(e){if(e===void 0&&this.box!==null)return this.box;let t=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let i=0;i<=(this.invariant?0:this.top);i++){let s=e===void 0?this.lapPositions(i):this.track(e,i);for(let r=0;r<s.length;r+=3)for(let a=0;a<3;a++){let o=s[r+a];o<t[a]&&(t[a]=o),o>t[a+3]&&(t[a+3]=o)}}return e===void 0&&(this.box=t),t}vertex(e,t,i,s=0){let r=this.ensure(e,gu(t)),a=this.set.start(e);if("sample"in t){let c=3*(a+t.sample);i[s]=r[c],i[s+1]=r[c+1],i[s+2]=r[c+2];return}let o=3*(a+t.k),l=t.w;for(let c=0;c<3;c++)i[s+c]=(1-l)*r[o+c]+l*r[o+3+c]}},Dv=n=>n===!0?-1:n===!1?0:n,pu=class{channel;clocks;u;constructor(e,t){this.channel=t,this.clocks=[],this.u=new Float64Array(e.samples);for(let i=0;i<e.tracks;i++){let s=new li(e,i,t),r=e.start(i);for(let a=0;a<s.m;a++)this.u[r+a]=s.at(a);this.clocks.push(s)}}},nl=class{scene;sets;frames;geometries=new Map;readingsBy=new Map;bodyTrails=new Map;data;constructor(e,t){this.scene=e,this.data=t,this.sets=new $i(e,t),this.frames=new Vi(e)}bytes(e){this.data.has(e)||E("2.4",`the data container does not hold view ${JSON.stringify(e)}`);let t=this.data.view(e);return t.dtype!=="uint8"&&E("2.4",`view ${e} holds ${t.dtype}, not the uint8 bytes of an image`),t.data}geometry(e,t){let i=`${e}\0${t}`,s=this.geometries.get(i);return s||(s=new fu(this.sets.get(e),t,this.frames,Rt(this.scene.clock)),this.geometries.set(i,s)),s}hasChannel(e,t){return t===ot||this.sets.get(e).hasChannel(t)}readings(e,t){let i=`${e}\0${t}`,s=this.readingsBy.get(i);return s||(s=new pu(this.sets.get(e),t),this.readingsBy.set(i,s)),s}bodyTrail(e,t,i,s){let r=`${e}\0${t}\0${i}\0${s}`,a=this.bodyTrails.get(r);return a||(a=new mu(this.frames,e,t,this.sets.get(i),s),this.bodyTrails.set(r,a)),a}};function bp(n,e,t,i,s,r,a=!1){let o=Rt(s),l=rn(o*Xn(e.reading(s,r)),o),{k:c,w:h}=e.locate(l.u);return a?n.channelAt(i,t,h>=1?c+1:c,!1,l.lap):(1-h)*n.channelAt(i,t,c,!1,l.lap)+h*n.channelAt(i,t,c+1,!1,l.lap)}var il=n=>n,vp=1<<20,xa=[vp,0,-vp,0],Nv=n=>[0,-1,n,2];function sl(n,e,t,i){let s=0,r=n.m;for(;s<r;){let a=s+r>>1,o=i(n.at(a));o>e||t&&o===e?r=a:s=a+1}return s}function Ov(n,e,t,i,s=il){if(e===t)return{range:[...xa],laps:null,pieces:[]};let r=i-1,a=rn(e,i),o=rn(t,i),l=Pt(n,a.u,!1,a.lap),c=Pt(n,o.u,!1,o.lap),h=a.lap,u=s(a.u),d=o.lap,f=s(o.u);f===0&&(d--,f=1);let p=[h,u,d,f],y=k=>s(n.at(k)),m=k=>k<r?n.m-2:n.m-1,g=(k,R)=>k<d||k===d&&R<f,v=(k,R)=>k>h||k===h&&u<R,_=sl(n,u,!1,s),b=_<=m(h)?[h,_]:h<r?[h+1,0]:null;b!==null&&!g(b[0],y(b[1]))&&(b=null);let M=Math.min(sl(n,f,!0,s)-1,m(d)),T=M>=0?[d,M]:null;if(T!==null&&!v(T[0],y(T[1]))&&(T=null),b===null||T===null||b[0]>T[0]||b[0]===T[0]&&b[1]>T[1])return{range:p,laps:null,pieces:[[l,c]]};let x=[[l,{sample:b[1],shifted:!1,lap:b[0]}],[{sample:T[1],shifted:!1,lap:T[0]},c]],A=b[0]===T[0]&&b[1]===T[1];return{range:p,laps:A?null:[b[0],T[1]===0?T[0]-1:T[0]],pieces:x}}function xp(n,e){return(n.reveal??"none")!=="none"||Wi(n)||e.mode==="value"&&(n.before==="hidden"||n.after==="hidden")}function _p(n,e,t=1){return{reveal:n.reveal??"none",fraction:n.trail?.fraction??1,before:n.before,after:n.after,head:Wi(n),periodic:e,laps:e?t:1}}function Sp(n,e,t,i,s=il){let r=i.laps,a={range:Nv(r-1),laps:[0,r-1],pieces:[]};if(n===null)return{hidden:!1,reading:null,loop:null,head:null,...a};let o=Xn(n.reading(e,t),i.before,i.after);if(o===null)return{hidden:!0,reading:null,loop:null,head:null,range:[...xa],laps:null,pieces:[]};let l=r*o,c=rn(l,r),h=i.head?Pt(n,c.u,!1,c.lap):null;if(i.reveal==="none")return{hidden:!1,reading:o,loop:l,head:h,...a};let u=i.reveal==="grow"?0:l-r*i.fraction;return u<0&&!i.periodic&&(u=0),{hidden:!1,reading:o,loop:l,head:h,...Ov(n,u,l,r,s)}}function rl(n){return n.samples-n.tracks}function Uv(n,e){return n.start(e)-e}function wp(n,e){let t=0;for(let i=0;i<n.tracks;i++){let s=n.start(i),r=n.count(i);for(let a=0;a+1<r;a++)e(t++,s+a)}}function yu(n,e,t){let i=new Float32Array(2*t*rl(n));return wp(n,(s,r)=>{for(let a=0;a<t;a++)i[2*t*s+a]=e[t*r+a],i[2*t*s+t+a]=e[t*(r+1)+a]}),i}function vu(n,e,t,i){let s=new Float32Array(2*e*(i-1));for(let r=0;r+1<i;r++)for(let a=0;a<e;a++)s[2*e*r+a]=n[e*(t+r)+a],s[2*e*r+e+a]=n[e*(t+r+1)+a];return s}function Mp(n,e,t,i,s){let r=n.set.count(e),a=n.track(e,t),o=[0,0,0];t<n.top&&n.gpuSample(e,t,r-1,o);for(let l=0;l+1<r;l++,s++)for(let c=0;c<3;c++)i[6*s+c]=a[3*l+c],i[6*s+3+c]=l+2===r&&t<n.top?o[c]:a[3*(l+1)+c]}function Ep(n,e){let t=new Float32Array(6*rl(n.set));for(let i=0;i<n.set.tracks;i++)Mp(n,i,e,t,Uv(n.set,i));return t}function Tp(n,e,t){let i=new Float32Array(6*(n.set.count(e)-1));return Mp(n,e,t,i,0),i}function Ap(n,e){return("sample"in e?n.at(e.sample):(1-e.w)*n.at(e.k)+e.w*n.at(e.k+1))+gu(e)}function Cp(n,e){let t=new Float32Array(4*rl(n));return wp(n,(i,s)=>{t[4*i]=t[4*i+2]=e[s],t[4*i+1]=t[4*i+3]=e[s+1]}),t}function Rp(n,e,t){let i=new Float32Array(4*(t-1));for(let s=0;s+1<t;s++)i[4*s]=i[4*s+2]=n[e+s],i[4*s+1]=i[4*s+3]=n[e+s+1];return i}function Pp(n){let e=new Float32Array(2*rl(n)),t=0;for(let i=0;i<n.tracks;i++)for(let s=0;s+1<n.count(i);s++,t++)e[2*t]=e[2*t+1]=i;return e}var mu=class{constructor(e,t,i,s,r){this.frames=e;this.body=t;this.display=i;this.set=s;this.track=r;this.m=s.count(r),this.invariant=e.bodyRequirements(t,i).channels.size===0}frames;body;display;set;track;m;invariant;laps=new Map;lap(e){let t=this.invariant?0:e,i=this.laps.get(t);if(i===void 0){i=new Float64Array(3*this.m);let{set:s,track:r}=this;for(let a=0;a<this.m;a++)i.set(this.frames.bodyPosition(this.body,this.display,{set:s,track:r,sample:a,shifted:!1,lap:t}),3*a);this.laps.set(t,i)}return i}vertex(e,t,i=0){let s=this.lap(gu(e));if("sample"in e){let o=3*e.sample;t[i]=s[o],t[i+1]=s[o+1],t[i+2]=s[o+2];return}let r=3*e.k,a=e.w;for(let o=0;o<3;o++)t[i+o]=(1-a)*s[r+o]+a*s[r+3+o]}polyline(e,t,i,s,r){let a=0,o=u=>{this.vertex(u,r,3*a),a++},l=rn(t,s);if(t===i)return o(Pt(e,l.u,!1,l.lap)),a;let c=rn(i,s),h=(u,d,f)=>{let p=sl(e,d,!1,il),y=sl(e,f,!0,il);y>p&&(r.set(this.lap(u).subarray(3*p,3*y),3*a),a+=y-p)};if(l.lap===c.lap)return o(Pt(e,l.u,!1,l.lap)),h(l.lap,l.u,c.u),o(Pt(e,c.u,!1,c.lap)),a;o(Pt(e,l.u,!1,l.lap)),h(l.lap,l.u,1);for(let u=l.lap+1;u<c.lap;u++)o(Pt(e,0,!1,u)),h(u,0,1);return o(Pt(e,0,!1,c.lap)),c.u===0||(h(c.lap,0,c.u),o(Pt(e,c.u,!1,c.lap))),a}};function Lp(n,e,t){return(Math.ceil(e*t)+2)*(n+1)+2}var Ip="\u2212";function Yn(n,e,t,i=!1){if(!Number.isFinite(n))return Number.isNaN(n)?"NaN":n>0?"\u221E":`${Ip}\u221E`;n===0&&(n=0);let s;if(t!==void 0)s=n.toFixed(t),/^-0(\.0*)?$/.test(s)&&(s=s.slice(1));else if(e!==void 0)s=n.toPrecision(e);else if(Number.isInteger(n)&&Math.abs(n)<1e21)s=String(n);else{s=n.toPrecision(6);let[r,a]=s.split("e"),o=r.includes(".")?r.replace(/0+$/,"").replace(/\.$/,""):r;s=a===void 0?o:`${o}e${a}`}return i&&!s.includes("e")&&(s=s.replace(/^(-?)(\d+)/,(r,a,o)=>a+o.replace(/\B(?=(\d{3})+(?!\d))/g,","))),s.replace("e+","e").replace(/-/g,Ip)}function qi(n,e){return Yn((e.factor??1)*n+(e.offset??0),e.digits,e.decimals,e.grouping??!1).padStart(e.width??0," ")}function ol(n,e,t){let i=lt(n.scene,t.variable);if(i?.kind!=="selector"||i.parameter===void 0)return[];let s=[];for(let r of la(n,t.domain)){let a=e.get(r);if(!Object.hasOwn(a.def.parameters??{},i.parameter))continue;let o=a.parameter(i.parameter,"2.9");for(let l=0;l<o.length;l++)s.push(o[l])}return s.sort((r,a)=>r-a),s.filter((r,a)=>a===0||r!==s[a-1])}function _a(n,e){let t=-1;for(let i=0;i<n.length;i++)(t<0||Math.abs(n[i]-e)<Math.abs(n[t]-e))&&(t=i);return t}function ll(n,e,t,i,s,r){return n+Math.max(0,e)*i*s/(t*r)}function Sa(n,e){return(Math.floor(n)%e+e)%e}function wa(n,e){let t=(n%e+e)%e/e;return t<1?t:0}function kp(n,e){return Ma(n,e).join("")}function Ma(n,e){let{scene:t,geometry:i,state:s}=n,r=s.panels[n.panel];if(r===void 0||!Object.hasOwn(s.panels,n.panel))return[];let a={scene:t,state:s,panel:r},o=t.views[r.view],l=t.clock.steps,c=(n.frameIndex%l+l)%l,h=n.progress??c/l,u,d=()=>{if(u===void 0){let y=Et(a,o.driver.sets);u=y===null?null:{setId:y,track:nr(a,o.driver.member,i.sets.get(y))}}return u},f=[],p=Bn(t.clock,h);for(let y of e)if(typeof y=="string")f.push(y);else if("sub"in y)f.push(y.sub);else if("sup"in y)f.push(y.sup);else if("steps"in y){let m="";for(let[g,v]of y.steps)g<=p&&(m=String(v));f.push(m)}else if("keys"in y)f.push(qi(Zs(y.keys,p),y));else if("clock"in y)if(y.clock==="index"||y.clock==="steps"){let m=y.clock==="index"?c:l,g=y.factor!==void 0||y.offset!==void 0||y.decimals!==void 0||y.grouping;f.push(g?qi(m,y):String(m).padStart(y.width??0," "))}else y.clock==="time"?f.push(qi(p,y)):f.push(qi(t.clock.mode==="fraction"?h:Eo(t.clock,h),y));else if("var"in y){let m=Gi(a,y.var),g=lt(t,y.var);typeof m=="number"?f.push(qi(m,y)):typeof m=="boolean"?f.push(m?"on":"off"):g?.kind==="choice"&&g.labels!==void 0?f.push(g.labels[g.values.indexOf(m)]??m):f.push(m)}else{let m=d();if(m===null){f.push("\u2014");continue}let g=i.sets.get(m.setId);if("member"in y)f.push(qi(g.parameter(y.member,"2.9")[m.track],y));else if("attr"in y)f.push(qi(g.attr(y.attr),y));else if("channel"in y){let v=i.readings(m.setId,s.clock.channel).clocks[m.track];g.hasChannel(y.channel)||E("2.9",`track set ${m.setId} lacks channel ${JSON.stringify(y.channel)}`);let _=g.def.channels?.[y.channel]?.interp==="hold";f.push(qi(bp(g,v,m.track,y.channel,t.clock,h,_),y))}}return f}function Dp(n){let e=[""],t=[];if(n.forEach((a,o)=>{typeof a=="string"?e[e.length-1]+=a:(t.push(o),e.push(""))}),t.length===0)return null;let i=a=>a.every(o=>o.trim()===""),s=[];for(let a=0;a<t.length;a++){let o=e[a].split(","),l=e[a+1].split(",");if((a>0?o.length<2||!i(o.slice(1,-1)):!i(o.slice(0,-1)))||a===t.length-1&&!i(l.slice(1)))return null;let c=o[o.length-1].replace(/\s*[=:]\s*$/,"").trim();if(c==="")return null;let h=n[t[a]],u="clock"in h||"keys"in h?5:"channel"in h?(h.digits??6)+5:null;s.push({label:c,part:t[a],unit:l[0].trim(),width:u})}let r=a=>"attr"in n[a.part];return[...s.filter(a=>!r(a)),...s.filter(r)]}var al=class{times=[];reset(){this.times.length=0}note(e){this.times.push(e);let t=0;for(;t<this.times.length&&this.times[t]<e-1e3;)t++;t>0&&this.times.splice(0,t)}report(e){let t=this.times;if(t.length<2||e-t[0]<900||e-t[t.length-1]>1e3)return null;let i=[];for(let o=1;o<t.length;o++)i.push(t[o]-t[o-1]);let s=[...i].sort((o,l)=>o-l),r=s[Math.floor(s.length/10)],a=i.filter(o=>o>1.5*r).length;return{drawn:t.length,late:a,refresh:r}}};function bu(n){return n===null?"\u2013\u2013 fps":`${n.drawn} fps`}function xu(n){if(n===null)return"Frames drawn per second during playback";let e=Math.round(1e3/n.refresh);return`${n.drawn} frames drawn in the last second, ${n.late} late, on a display refreshing about ${e} times a second`}function Np(n,e,t){let i=e?10:1;switch(n){case" ":case"k":case"K":return{kind:"toggle"};case"ArrowRight":case".":return{kind:"step",by:i};case"ArrowLeft":case",":return{kind:"step",by:-i};case">":return{kind:"step",by:10};case"<":return{kind:"step",by:-10};case"Home":return{kind:"seek",frame:0};case"f":case"F":return{kind:"fit"};case"ArrowUp":return{kind:"slider",by:i};case"ArrowDown":return{kind:"slider",by:-i}}return/^[0-9]$/.test(n)?{kind:"seek",frame:Math.round(t*Number(n)/10)%t}:null}function Op(n,e,t){let i=t.startsWith("Arrow")||t==="Home"||t==="End"||t==="PageUp"||t==="PageDown";return n==="BUTTON"||n==="INPUT"&&e==="checkbox"?t===" "||t==="Enter":n==="INPUT"&&e==="range"?i:n==="SELECT"?i||t==="Enter"||t.length===1:n==="TEXTAREA"||n==="INPUT"}function Fv(n,e){let t=new Set([e]);for(let i of Object.values(n.track_sets)){let s=i?.parameters;if(s===void 0||!Object.hasOwn(s,e))continue;let r=s[e],a=r.label??e;t.add(r.unit?`${a}, ${r.unit}`:a)}return t}function Up(n,e,t){for(let i of e.layers){if(i.kind!=="track"||i.color===void 0||typeof i.color=="string"||!("parameter"in i.color))continue;let s=i.color.parameter;if(Fv(n,s).has(t))for(let[r,a]of Object.entries(n.variables??{})){if(a===void 0||a.kind!=="selector"||a.scope==="panel"||a.by==="index"||a.parameter!==s)continue;let o=(n.controls??[]).find(l=>l.kind==="slider"&&l.variable===r);return{variable:r,label:o?.label??r,domain:o?.domain??i.sets}}}return null}function Fp(n,e,t,i){return _a(n,e+Math.min(1,Math.max(0,i))*(t-e))}var Wn={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},ei={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},mm=0,Yu=1,gm=2;var ja=1,ym=2,Br=3,os=0,gn=1,Ln=2,Ii=0,zr=1,ju=2,Ju=3,Ku=4,vm=5;var Gs=100,bm=101,xm=102,_m=103,Sm=104,wm=200,Mm=201,Em=202,Tm=203,Zu=204,Qu=205,Am=206,Cm=207,Rm=208,Pm=209,Lm=210,Im=211,km=212,Dm=213,Nm=214,Dl=0,Nl=1,Ol=2,Mr=3,Ul=4,Fl=5,Bl=6,zl=7,ed=0,Om=1,Um=2,mi=0,td=1,nd=2,id=3,sd=4,rd=5,ad=6,od=7;var ld=300,Ws=301,Hr=302,uc=303,dc=304,Hl=1e3,pi=1001,Vl=1002,xt=1003,Fm=1004;var Ja=1005;var pn=1006,fc=1007;var ki=1008;var In=1009,cd=1010,hd=1011,Vr=1012,pc=1013,ti=1014,kn=1015,ni=1016,mc=1017,gc=1018,$s=1020,ud=35902,dd=35899,fd=1021,pd=1022,Dn=1023,Ri=1026,Di=1027,md=1028,yc=1029,ls=1030,vc=1031;var bc=1033,Ka=33776,Za=33777,Qa=33778,eo=33779,xc=35840,_c=35841,Sc=35842,wc=35843,Mc=36196,Ec=37492,Tc=37496,Ac=37488,Cc=37489,to=37490,Rc=37491,Pc=37808,Lc=37809,Ic=37810,kc=37811,Dc=37812,Nc=37813,Oc=37814,Uc=37815,Fc=37816,Bc=37817,zc=37818,Hc=37819,Vc=37820,Gc=37821,Wc=36492,$c=36494,Xc=36495,qc=36283,Yc=36284,no=36285,jc=36286;var ka=2300,Gl=2301,kl=2302,Hu=2303,Vu=2400,Gu=2401,Wu=2402;var Bm=3200;var gd=0,zm=1,ii="",En="srgb",Us="srgb-linear",Da="linear",ct="srgb";var Os=7680,yd=7681;var vd=517;var Hm=519,Vm=512,Gm=513,Wm=514,bd=515,$m=516,Xm=517,xd=518,_d=519,Sd=35044,gi=35048;var io="300 es",Gn=2e3,Na=2001;function Bv(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function zv(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function Oa(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function qm(){let n=Oa("canvas");return n.style.display="block",n}var Bp={},Er=null;function Ua(...n){let e="THREE."+n.shift();Er?Er("log",e,...n):console.log(e,...n)}function Ym(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function De(...n){n=Ym(n);let e="THREE."+n.shift();if(Er)Er("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Ue(...n){n=Ym(n);let e="THREE."+n.shift();if(Er)Er("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function Pa(...n){let e=n.join(" ");e in Bp||(Bp[e]=!0,De(...n))}function jm(n,e,t){return new Promise(function(i,s){function r(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:s();break;case n.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:i()}}setTimeout(r,t)})}var Jm={[Dl]:Dl,[Ol]:Bl,[Ul]:Ul,[Mr]:Fl,[Nl]:Nl,[Bl]:Ol,[zl]:zl,[Fl]:Mr},Zn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let s=i[e];if(s!==void 0){let r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let s=i.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}},an=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],zp=1234567,La=Math.PI/180,Tr=180/Math.PI;function cs(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(an[n&255]+an[n>>8&255]+an[n>>16&255]+an[n>>24&255]+"-"+an[e&255]+an[e>>8&255]+"-"+an[e>>16&15|64]+an[e>>24&255]+"-"+an[t&63|128]+an[t>>8&255]+"-"+an[t>>16&255]+an[t>>24&255]+an[i&255]+an[i>>8&255]+an[i>>16&255]+an[i>>24&255]).toLowerCase()}function Je(n,e,t){return Math.max(e,Math.min(t,n))}function wd(n,e){return(n%e+e)%e}function Hv(n,e,t,i,s){return i+(n-e)*(s-i)/(t-e)}function Vv(n,e,t){return n!==e?(t-n)/(e-n):0}function Ia(n,e,t){return(1-t)*n+t*e}function Gv(n,e,t,i){return Ia(n,e,1-Math.exp(-t*i))}function Wv(n,e=1){return e-Math.abs(wd(n,e*2)-e)}function $v(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function Xv(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function qv(n,e){return n+Math.floor(Math.random()*(e-n+1))}function Yv(n,e){return n+Math.random()*(e-n)}function jv(n){return n*(.5-Math.random())}function Jv(n){n!==void 0&&(zp=n);let e=zp+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Kv(n){return n*La}function Zv(n){return n*Tr}function Qv(n){return n>0&&Number.isInteger(n)&&2**Math.round(Math.log2(n))===n}function eb(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function Md(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function tb(n,e,t,i,s){let r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+i)/2),h=a((e+i)/2),u=r((e-i)/2),d=a((e-i)/2),f=r((i-e)/2),p=a((i-e)/2);switch(s){case"XYX":n.set(o*h,l*u,l*d,o*c);break;case"YZY":n.set(l*d,o*h,l*u,o*c);break;case"ZXZ":n.set(l*u,l*d,o*h,o*c);break;case"XZX":n.set(o*h,l*p,l*f,o*c);break;case"YXY":n.set(l*f,o*h,l*p,o*c);break;case"ZYZ":n.set(l*p,l*f,o*h,o*c);break;default:De("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Jc(n){switch(n.constructor){case Uint32Array:return 4294967295;case Uint16Array:return 65535;case Uint8Array:case Uint8ClampedArray:return 255;case Int32Array:return 2147483647;case Int16Array:return 32767;case Int8Array:return 127;default:return}}function Ed(n,e){if(e.constructor===Float32Array)return n;let t=Jc(e);if(t===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.max(n/t,-1)}function Td(n,e){if(e.constructor===Float32Array)return n;let t=Jc(e);if(t===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.round(n*t)}var Ad={DEG2RAD:La,RAD2DEG:Tr,generateUUID:cs,clamp:Je,euclideanModulo:wd,mapLinear:Hv,inverseLerp:Vv,lerp:Ia,damp:Gv,pingpong:Wv,smoothstep:$v,smootherstep:Xv,randInt:qv,randFloat:Yv,randFloatSpread:jv,seededRandom:Jv,degToRad:Kv,radToDeg:Zv,isPowerOfTwo:Qv,ceilPowerOfTwo:eb,floorPowerOfTwo:Md,setQuaternionFromProperEuler:tb,normalize:Td,denormalize:Ed},Ie=class{static{this.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6],this.y=s[1]*t+s[4]*i+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Je(this.x,e.x,t.x),this.y=Je(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Je(this.x,e,t),this.y=Je(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*i-a*s+e.x,this.y=r*s+a*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},An=class{constructor(e=0,t=0,i=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=s}static slerpFlat(e,t,i,s,r,a,o){let l=i[s+0],c=i[s+1],h=i[s+2],u=i[s+3],d=r[a+0],f=r[a+1],p=r[a+2],y=r[a+3];if(u!==y||l!==d||c!==f||h!==p){let m=l*d+c*f+h*p+u*y;m<0&&(d=-d,f=-f,p=-p,y=-y,m=-m);let g=1-o;if(m<.9995){let v=Math.acos(m),_=Math.sin(v);g=Math.sin(g*v)/_,o=Math.sin(o*v)/_,l=l*g+d*o,c=c*g+f*o,h=h*g+p*o,u=u*g+y*o}else{l=l*g+d*o,c=c*g+f*o,h=h*g+p*o,u=u*g+y*o;let v=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=v,c*=v,h*=v,u*=v}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,i,s,r,a){let o=i[s],l=i[s+1],c=i[s+2],h=i[s+3],u=r[a],d=r[a+1],f=r[a+2],p=r[a+3];return e[t]=o*p+h*u+l*f-c*d,e[t+1]=l*p+h*d+c*u-o*f,e[t+2]=c*p+h*f+o*d-l*u,e[t+3]=h*p-o*u-l*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,s){return this._x=e,this._y=t,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(i/2),h=o(s/2),u=o(r/2),d=l(i/2),f=l(s/2),p=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*f*p,this._y=c*f*u-d*h*p,this._z=c*h*p+d*f*u,this._w=c*h*u-d*f*p;break;case"YXZ":this._x=d*h*u+c*f*p,this._y=c*f*u-d*h*p,this._z=c*h*p-d*f*u,this._w=c*h*u+d*f*p;break;case"ZXY":this._x=d*h*u-c*f*p,this._y=c*f*u+d*h*p,this._z=c*h*p+d*f*u,this._w=c*h*u-d*f*p;break;case"ZYX":this._x=d*h*u-c*f*p,this._y=c*f*u+d*h*p,this._z=c*h*p-d*f*u,this._w=c*h*u+d*f*p;break;case"YZX":this._x=d*h*u+c*f*p,this._y=c*f*u+d*h*p,this._z=c*h*p-d*f*u,this._w=c*h*u-d*f*p;break;case"XZY":this._x=d*h*u-c*f*p,this._y=c*f*u-d*h*p,this._z=c*h*p+d*f*u,this._w=c*h*u+d*f*p;break;default:De("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,s=Math.sin(i);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],u=t[10],d=i+o+u;if(d>0){let f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(a-s)*f}else if(i>o&&i>u){let f=2*Math.sqrt(1+i-o-u);this._w=(h-l)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+c)/f}else if(o>u){let f=2*Math.sqrt(1+o-i-u);this._w=(r-c)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+u-i-o);this._w=(a-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Je(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let s=Math.min(1,t/i);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=i*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-i*c,this._z=r*h+a*c+i*l-s*o,this._w=a*h-i*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(i=-i,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},O=class{static{this.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Hp.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Hp.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6]*s,this.y=r[1]*t+r[4]*i+r[7]*s,this.z=r[2]*t+r[5]*i+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*i+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*i+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*i+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*i+r[10]*s+r[14])*a,this}applyQuaternion(e){let t=this.x,i=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*i),h=2*(o*t-r*s),u=2*(r*i-a*t);return this.x=t+l*c+a*u-o*h,this.y=i+l*h+o*c-r*u,this.z=s+l*u+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*i+r[8]*s,this.y=r[1]*t+r[5]*i+r[9]*s,this.z=r[2]*t+r[6]*i+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Je(this.x,e.x,t.x),this.y=Je(this.y,e.y,t.y),this.z=Je(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Je(this.x,e,t),this.y=Je(this.y,e,t),this.z=Je(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-i*l,this.z=i*o-s*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return _u.copy(this).projectOnVector(e),this.sub(_u)}reflect(e){return this.sub(_u.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,s=this.z-e.z;return t*t+i*i+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let s=Math.sin(t)*e;return this.x=s*Math.sin(i),this.y=Math.cos(t)*e,this.z=s*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},_u=new O,Hp=new An,Be=class{static{this.prototype.isMatrix3=!0}constructor(e,t,i,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c)}set(e,t,i,s,r,a,o,l,c){let h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=i,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],h=i[4],u=i[7],d=i[2],f=i[5],p=i[8],y=s[0],m=s[3],g=s[6],v=s[1],_=s[4],b=s[7],M=s[2],T=s[5],x=s[8];return r[0]=a*y+o*v+l*M,r[3]=a*m+o*_+l*T,r[6]=a*g+o*b+l*x,r[1]=c*y+h*v+u*M,r[4]=c*m+h*_+u*T,r[7]=c*g+h*b+u*x,r[2]=d*y+f*v+p*M,r[5]=d*m+f*_+p*T,r[8]=d*g+f*b+p*x,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-i*r*h+i*o*l+s*r*c-s*a*l}invert(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=h*a-o*c,d=o*l-h*r,f=c*r-a*l,p=t*u+i*d+s*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let y=1/p;return e[0]=u*y,e[1]=(s*c-h*i)*y,e[2]=(o*i-s*a)*y,e[3]=d*y,e[4]=(h*t-s*l)*y,e[5]=(s*r-o*t)*y,e[6]=f*y,e[7]=(i*l-c*t)*y,e[8]=(a*t-i*r)*y,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return Pa("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Su.makeScale(e,t)),this}rotate(e){return Pa("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Su.makeRotation(-e)),this}translate(e,t){return Pa("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Su.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let s=0;s<9;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Su=new Be,Vp=new Be().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Gp=new Be().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function nb(){let n={enabled:!0,workingColorSpace:Us,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===ct&&(s.r=Ci(s.r),s.g=Ci(s.g),s.b=Ci(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ct&&(s.r=wr(s.r),s.g=wr(s.g),s.b=wr(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===ii?Da:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[a].fromXYZ).multiply(this.spaces[r].toXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[Us]:{primaries:e,whitePoint:i,transfer:Da,toXYZ:Vp,fromXYZ:Gp,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:En},outputColorSpaceConfig:{drawingBufferColorSpace:En}},[En]:{primaries:e,whitePoint:i,transfer:ct,toXYZ:Vp,fromXYZ:Gp,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:En}}}),n}var je=nb();function Ci(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function wr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var hr,Wl=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{hr===void 0&&(hr=Oa("canvas")),hr.width=e.width,hr.height=e.height;let s=hr.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),i=hr}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Oa("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let s=i.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Ci(r[a]/255)*255;return i.putImageData(s,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Ci(t[i]/255)*255):t[i]=Ci(t[i]);return{data:t,width:e.width,height:e.height}}else return De("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},ib=0,Ar=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:ib++}),this.uuid=cs(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width||0,t.height||0,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(wu(s[a].image)):r.push(wu(s[a]))}else r=wu(s);i.url=r}return t||(e.images[this.uuid]=i),i}};function wu(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Wl.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(De("Texture: Unable to serialize Texture."),{})}var sb=0,Mu=new O,tn=class n extends Zn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=pi,s=pi,r=pn,a=ki,o=Dn,l=In,c=n.DEFAULT_ANISOTROPY,h=ii){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:sb++}),this.uuid=cs(),this.name="",this.source=new Ar(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Ie(0,0),this.repeat=new Ie(1,1),this.center=new Ie(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Be,this.generateMipmaps=!0,this.mipmapsAutoUpdate=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.isPMREMTexture=!1,this.normalized=!1}get width(){return this.source.getSize(Mu).x}get height(){return this.source.getSize(Mu).y}get depth(){return this.source.getSize(Mu).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.mipmapsAutoUpdate=e.mipmapsAutoUpdate,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isPMREMTexture=e.isPMREMTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){De(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){De(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,mipmapsAutoUpdate:this.mipmapsAutoUpdate,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ld)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Hl:e.x=e.x-Math.floor(e.x);break;case pi:e.x=e.x<0?0:1;break;case Vl:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Hl:e.y=e.y-Math.floor(e.y);break;case pi:e.y=e.y<0?0:1;break;case Vl:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};tn.DEFAULT_IMAGE=null;tn.DEFAULT_MAPPING=ld;tn.DEFAULT_ANISOTROPY=1;var ht=class{static{this.prototype.isVector4=!0}constructor(e=0,t=0,i=0,s=1){this.x=e,this.y=t,this.z=i,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,s){return this.x=e,this.y=t,this.z=i,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*i+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*i+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*i+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,s,r,l=e.elements,c=l[0],h=l[4],u=l[8],d=l[1],f=l[5],p=l[9],y=l[2],m=l[6],g=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-y)<.01&&Math.abs(p-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+y)<.1&&Math.abs(p+m)<.1&&Math.abs(c+f+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let _=(c+1)/2,b=(f+1)/2,M=(g+1)/2,T=(h+d)/4,x=(u+y)/4,A=(p+m)/4;return _>b&&_>M?_<.01?(i=0,s=.707106781,r=.707106781):(i=Math.sqrt(_),s=T/i,r=x/i):b>M?b<.01?(i=.707106781,s=0,r=.707106781):(s=Math.sqrt(b),i=T/s,r=A/s):M<.01?(i=.707106781,s=.707106781,r=0):(r=Math.sqrt(M),i=x/r,s=A/r),this.set(i,s,r,t),this}let v=Math.sqrt((m-p)*(m-p)+(u-y)*(u-y)+(d-h)*(d-h));return Math.abs(v)<.001&&(v=1),this.x=(m-p)/v,this.y=(u-y)/v,this.z=(d-h)/v,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Je(this.x,e.x,t.x),this.y=Je(this.y,e.y,t.y),this.z=Je(this.z,e.z,t.z),this.w=Je(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Je(this.x,e,t),this.y=Je(this.y,e,t),this.z=Je(this.z,e,t),this.w=Je(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},$l=class extends Zn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:pn,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new ht(0,0,e,t),this.scissorTest=!1,this.viewport=new ht(0,0,e,t),this.textures=[];let s=i.count;for(let r=0;r<s;r++)this.textures[r]=new tn({width:e,height:t,depth:i.depth}),this.textures[r].isRenderTargetTexture=!0,this.textures[r].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveColorBuffer=i.resolveColorBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.storeMultisampledColorBuffer=i.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=i.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=i.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:pn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.mipmapsAutoUpdate!==void 0&&(t.mipmapsAutoUpdate=e.mipmapsAutoUpdate),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let s=Object.assign({},e.textures[t].image);this.textures[t].source=new Ar(s)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;else this.depthTexture=null;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},mn=class extends $l{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},Fa=class extends tn{constructor(e=null,t=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=xt,this.minFilter=xt,this.wrapR=pi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var Xl=class extends tn{constructor(e=null,t=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=xt,this.minFilter=xt,this.wrapR=pi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var ft=class n{static{this.prototype.isMatrix4=!0}constructor(e,t,i,s,r,a,o,l,c,h,u,d,f,p,y,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c,h,u,d,f,p,y,m)}set(e,t,i,s,r,a,o,l,c,h,u,d,f,p,y,m){let g=this.elements;return g[0]=e,g[4]=t,g[8]=i,g[12]=s,g[1]=r,g[5]=a,g[9]=o,g[13]=l,g[2]=c,g[6]=h,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=y,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,s=1/ur.setFromMatrixColumn(e,0).length(),r=1/ur.setFromMatrixColumn(e,1).length(),a=1/ur.setFromMatrixColumn(e,2).length();return t[0]=i[0]*s,t[1]=i[1]*s,t[2]=i[2]*s,t[3]=0,t[4]=i[4]*r,t[5]=i[5]*r,t[6]=i[6]*r,t[7]=0,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,s=e.y,r=e.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){let d=a*h,f=a*u,p=o*h,y=o*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=f+p*c,t[5]=d-y*c,t[9]=-o*l,t[2]=y-d*c,t[6]=p+f*c,t[10]=a*l}else if(e.order==="YXZ"){let d=l*h,f=l*u,p=c*h,y=c*u;t[0]=d+y*o,t[4]=p*o-f,t[8]=a*c,t[1]=a*u,t[5]=a*h,t[9]=-o,t[2]=f*o-p,t[6]=y+d*o,t[10]=a*l}else if(e.order==="ZXY"){let d=l*h,f=l*u,p=c*h,y=c*u;t[0]=d-y*o,t[4]=-a*u,t[8]=p+f*o,t[1]=f+p*o,t[5]=a*h,t[9]=y-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){let d=a*h,f=a*u,p=o*h,y=o*u;t[0]=l*h,t[4]=p*c-f,t[8]=d*c+y,t[1]=l*u,t[5]=y*c+d,t[9]=f*c-p,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){let d=a*l,f=a*c,p=o*l,y=o*c;t[0]=l*h,t[4]=y-d*u,t[8]=p*u+f,t[1]=u,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=f*u+p,t[10]=d-y*u}else if(e.order==="XZY"){let d=a*l,f=a*c,p=o*l,y=o*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=d*u+y,t[5]=a*h,t[9]=f*u-p,t[2]=p*u-f,t[6]=o*h,t[10]=y*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(rb,e,ab)}lookAt(e,t,i){let s=this.elements;return wn.subVectors(e,t),wn.lengthSq()===0&&(wn.z=1),wn.normalize(),Yi.crossVectors(i,wn),Yi.lengthSq()===0&&(Math.abs(i.z)===1?wn.x+=1e-4:wn.z+=1e-4,wn.normalize(),Yi.crossVectors(i,wn)),Yi.normalize(),cl.crossVectors(wn,Yi),s[0]=Yi.x,s[4]=cl.x,s[8]=wn.x,s[1]=Yi.y,s[5]=cl.y,s[9]=wn.y,s[2]=Yi.z,s[6]=cl.z,s[10]=wn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],h=i[1],u=i[5],d=i[9],f=i[13],p=i[2],y=i[6],m=i[10],g=i[14],v=i[3],_=i[7],b=i[11],M=i[15],T=s[0],x=s[4],A=s[8],k=s[12],R=s[1],D=s[5],H=s[9],j=s[13],L=s[2],G=s[6],V=s[10],W=s[14],te=s[3],Y=s[7],q=s[11],ne=s[15];return r[0]=a*T+o*R+l*L+c*te,r[4]=a*x+o*D+l*G+c*Y,r[8]=a*A+o*H+l*V+c*q,r[12]=a*k+o*j+l*W+c*ne,r[1]=h*T+u*R+d*L+f*te,r[5]=h*x+u*D+d*G+f*Y,r[9]=h*A+u*H+d*V+f*q,r[13]=h*k+u*j+d*W+f*ne,r[2]=p*T+y*R+m*L+g*te,r[6]=p*x+y*D+m*G+g*Y,r[10]=p*A+y*H+m*V+g*q,r[14]=p*k+y*j+m*W+g*ne,r[3]=v*T+_*R+b*L+M*te,r[7]=v*x+_*D+b*G+M*Y,r[11]=v*A+_*H+b*V+M*q,r[15]=v*k+_*j+b*W+M*ne,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],u=e[6],d=e[10],f=e[14],p=e[3],y=e[7],m=e[11],g=e[15],v=l*f-c*d,_=o*f-c*u,b=o*d-l*u,M=a*f-c*h,T=a*d-l*h,x=a*u-o*h;return t*(y*v-m*_+g*b)-i*(p*v-m*M+g*T)+s*(p*_-y*M+g*x)-r*(p*b-y*T+m*x)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],s=e[8],r=e[1],a=e[5],o=e[9],l=e[2],c=e[6],h=e[10];return t*(a*h-o*c)-i*(r*h-o*l)+s*(r*c-a*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=e[9],d=e[10],f=e[11],p=e[12],y=e[13],m=e[14],g=e[15],v=t*o-i*a,_=t*l-s*a,b=t*c-r*a,M=i*l-s*o,T=i*c-r*o,x=s*c-r*l,A=h*y-u*p,k=h*m-d*p,R=h*g-f*p,D=u*m-d*y,H=u*g-f*y,j=d*g-f*m,L=v*j-_*H+b*D+M*R-T*k+x*A;if(L===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let G=1/L;return e[0]=(o*j-l*H+c*D)*G,e[1]=(s*H-i*j-r*D)*G,e[2]=(y*x-m*T+g*M)*G,e[3]=(d*T-u*x-f*M)*G,e[4]=(l*R-a*j-c*k)*G,e[5]=(t*j-s*R+r*k)*G,e[6]=(m*b-p*x-g*_)*G,e[7]=(h*x-d*b+f*_)*G,e[8]=(a*H-o*R+c*A)*G,e[9]=(i*R-t*H-r*A)*G,e[10]=(p*T-y*b+g*v)*G,e[11]=(u*b-h*T-f*v)*G,e[12]=(o*k-a*D-l*A)*G,e[13]=(t*D-i*k+s*A)*G,e[14]=(y*_-p*M-m*v)*G,e[15]=(h*M-u*_+d*v)*G,this}scale(e){let t=this.elements,i=e.x,s=e.y,r=e.z;return t[0]*=i,t[4]*=s,t[8]*=r,t[1]*=i,t[5]*=s,t[9]*=r,t[2]*=i,t[6]*=s,t[10]*=r,t[3]*=i,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,s))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),s=Math.sin(t),r=1-i,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+i,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+i,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,s,r,a){return this.set(1,i,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,i){let s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,u=o+o,d=r*c,f=r*h,p=r*u,y=a*h,m=a*u,g=o*u,v=l*c,_=l*h,b=l*u,M=i.x,T=i.y,x=i.z;return s[0]=(1-(y+g))*M,s[1]=(f+b)*M,s[2]=(p-_)*M,s[3]=0,s[4]=(f-b)*T,s[5]=(1-(d+g))*T,s[6]=(m+v)*T,s[7]=0,s[8]=(p+_)*x,s[9]=(m-v)*x,s[10]=(1-(d+y))*x,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,i){let s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];let r=this.determinantAffine();if(r===0)return i.set(1,1,1),t.identity(),this;let a=ur.set(s[0],s[1],s[2]).length(),o=ur.set(s[4],s[5],s[6]).length(),l=ur.set(s[8],s[9],s[10]).length();r<0&&(a=-a),jn.copy(this);let c=1/a,h=1/o,u=1/l;return jn.elements[0]*=c,jn.elements[1]*=c,jn.elements[2]*=c,jn.elements[4]*=h,jn.elements[5]*=h,jn.elements[6]*=h,jn.elements[8]*=u,jn.elements[9]*=u,jn.elements[10]*=u,t.setFromRotationMatrix(jn),i.x=a,i.y=o,i.z=l,this}makePerspective(e,t,i,s,r,a,o=Gn,l=!1){let c=this.elements,h=2*r/(t-e),u=2*r/(i-s),d=(t+e)/(t-e),f=(i+s)/(i-s),p,y;if(l)p=r/(a-r),y=a*r/(a-r);else if(o===Gn)p=-(a+r)/(a-r),y=-2*a*r/(a-r);else if(o===Na)p=-a/(a-r),y=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=y,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,s,r,a,o=Gn,l=!1){let c=this.elements,h=2/(t-e),u=2/(i-s),d=-(t+e)/(t-e),f=-(i+s)/(i-s),p,y;if(l)p=1/(a-r),y=a/(a-r);else if(o===Gn)p=-2/(a-r),y=-(a+r)/(a-r);else if(o===Na)p=-1/(a-r),y=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=y,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let s=0;s<16;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},ur=new O,jn=new ft,rb=new O(0,0,0),ab=new O(1,1,1),Yi=new O,cl=new O,wn=new O,Wp=new ft,$p=new An,es=class n{constructor(e=0,t=0,i=0,s=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,s=this._order){return this._x=e,this._y=t,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],f=s[10];switch(t){case"XYZ":this._y=Math.asin(Je(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Je(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Je(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Je(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Je(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-Je(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:De("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Wp.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Wp,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return $p.setFromEuler(this),this.setFromQuaternion($p,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};es.DEFAULT_ORDER="XYZ";var Ba=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},ob=0,Xp=new O,dr=new An,wi=new ft,hl=new O,Ea=new O,lb=new O,cb=new An,qp=new O(1,0,0),Yp=new O(0,1,0),jp=new O(0,0,1),Jp={type:"added"},hb={type:"removed"},fr={type:"childadded",child:null},Eu={type:"childremoved",child:null},Kt=class n extends Zn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:ob++}),this.uuid=cs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new O,t=new es,i=new An,s=new O(1,1,1);function r(){i.setFromEuler(t,!1)}function a(){t.setFromQuaternion(i,void 0,!1)}t._onChange(r),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ft},normalMatrix:{value:new Be}}),this.matrix=new ft,this.matrixWorld=new ft,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ba,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale),this.pivot!==null&&this.position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return dr.setFromAxisAngle(e,t),this.quaternion.multiply(dr),this}rotateOnWorldAxis(e,t){return dr.setFromAxisAngle(e,t),this.quaternion.premultiply(dr),this}rotateX(e){return this.rotateOnAxis(qp,e)}rotateY(e){return this.rotateOnAxis(Yp,e)}rotateZ(e){return this.rotateOnAxis(jp,e)}translateOnAxis(e,t){return Xp.copy(e).applyQuaternion(this.quaternion),this.position.add(Xp.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(qp,e)}translateY(e){return this.translateOnAxis(Yp,e)}translateZ(e){return this.translateOnAxis(jp,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(wi.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?hl.copy(e):hl.set(e,t,i);let s=this.parent;this.updateWorldMatrix(!0,!1),Ea.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?wi.lookAt(Ea,hl,this.up):wi.lookAt(hl,Ea,this.up),this.quaternion.setFromRotationMatrix(wi),s&&(wi.extractRotation(s.matrixWorld),dr.setFromRotationMatrix(wi),this.quaternion.premultiply(dr.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ue("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Jp),fr.child=e,this.dispatchEvent(fr),fr.child=null):Ue("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(hb),Eu.child=e,this.dispatchEvent(Eu),Eu.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),wi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),wi.multiply(e.parent.matrixWorld)),e.applyMatrix4(wi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Jp),fr.child=e,this.dispatchEvent(fr),fr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,s=this.children.length;i<s;i++){let a=this.children[i].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ea,e,lb),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ea,cb,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){return!0}traverse(e){e(this);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*i-r[8]*s,r[13]+=i-r[1]*t-r[5]*i-r[9]*s,r[14]+=s-r[2]*t-r[6]*i-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let u=l[c];r(e.shapes,u)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){let o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),u=a(e.shapes),d=a(e.skeletons),f=a(e.animations),p=a(e.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),u.length>0&&(i.shapes=u),d.length>0&&(i.skeletons=d),f.length>0&&(i.animations=f),p.length>0&&(i.nodes=p)}return i.object=s,i;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let s=e.children[i];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Kt.DEFAULT_UP=new O(0,1,0);Kt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Kt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var fn=class extends Kt{constructor(){super(),this.isGroup=!0,this.type="Group"}},ub={type:"move"},Cr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new fn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new fn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new O,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new O),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new fn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new O,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new O,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(let y of e.hand.values()){let m=t.getJointPose(y,i),g=this._getHandJoint(c,y);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.quaternion,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}let h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,p=.005;c.inputState.pinching&&d>f+p?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=f-p&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.quaternion,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,i),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(ub)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new fn;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},Km={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ji={h:0,s:0,l:0},ul={h:0,s:0,l:0};function Tu(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var Xe=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=En){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,je.colorSpaceToWorking(this,t),this}setRGB(e,t,i,s=je.workingColorSpace){return this.r=e,this.g=t,this.b=i,je.colorSpaceToWorking(this,s),this}setHSL(e,t,i,s=je.workingColorSpace){if(e=wd(e,1),t=Je(t,0,1),i=Je(i,0,1),t===0)this.r=this.g=this.b=i;else{let r=i<=.5?i*(1+t):i+t-i*t,a=2*i-r;this.r=Tu(a,r,e+1/3),this.g=Tu(a,r,e),this.b=Tu(a,r,e-1/3)}return je.colorSpaceToWorking(this,s),this}setStyle(e,t=En){function i(r){r!==void 0&&parseFloat(r)<1&&De("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(100,parseFloat(r[1]))/100,Math.min(100,parseFloat(r[2]))/100,Math.min(100,parseFloat(r[3]))/100,t);break;case"hsl":case"hsla":if(r=/^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:De("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);De("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=En){let i=Km[e.toLowerCase()];return i!==void 0?this.setHex(i,t):De("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Ci(e.r),this.g=Ci(e.g),this.b=Ci(e.b),this}copyLinearToSRGB(e){return this.r=wr(e.r),this.g=wr(e.g),this.b=wr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=En){return je.workingToColorSpace(on.copy(this),e),Math.round(Je(on.r*255,0,255))*65536+Math.round(Je(on.g*255,0,255))*256+Math.round(Je(on.b*255,0,255))}getHexString(e=En){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=je.workingColorSpace){je.workingToColorSpace(on.copy(this),t);let i=on.r,s=on.g,r=on.b,a=Math.max(i,s,r),o=Math.min(i,s,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case i:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-i)/u+2;break;case r:l=(i-s)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=je.workingColorSpace){return je.workingToColorSpace(on.copy(this),t),e.r=on.r,e.g=on.g,e.b=on.b,e}getStyle(e=En){je.workingToColorSpace(on.copy(this),e);let t=on.r,i=on.g,s=on.b;return e!==En?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(e,t,i){return this.getHSL(ji),this.setHSL(ji.h+e,ji.s+t,ji.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(ji),e.getHSL(ul);let i=Ia(ji.h,ul.h,t),s=Ia(ji.s,ul.s,t),r=Ia(ji.l,ul.l,t);return this.setHSL(i,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*i+r[6]*s,this.g=r[1]*t+r[4]*i+r[7]*s,this.b=r[2]*t+r[5]*i+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},on=new Xe;Xe.NAMES=Km;var Fs=class extends Kt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new es,this.environmentIntensity=1,this.environmentRotation=new es,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),this.background=e.background!==null?e.background.clone():null,this.environment=e.environment!==null?e.environment.clone():null,this.fog=e.fog!==null?e.fog.clone():null,this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),this.overrideMaterial=e.overrideMaterial!==null?e.overrideMaterial.clone():null,this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Jn=new O,Mi=new O,Au=new O,Ei=new O,pr=new O,mr=new O,Kp=new O,Cu=new O,Ru=new O,Pu=new O,Lu=new ht,Iu=new ht,ku=new ht,Qi=class n{constructor(e=new O,t=new O,i=new O){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,s){s.subVectors(i,t),Jn.subVectors(e,t),s.cross(Jn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,i,s,r){Jn.subVectors(s,t),Mi.subVectors(i,t),Au.subVectors(e,t);let a=Jn.dot(Jn),o=Jn.dot(Mi),l=Jn.dot(Au),c=Mi.dot(Mi),h=Mi.dot(Au),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;let d=1/u,f=(c*l-o*h)*d,p=(a*h-o*l)*d;return r.set(1-f-p,p,f)}static containsPoint(e,t,i,s){return this.getBarycoord(e,t,i,s,Ei)===null?!1:Ei.x>=0&&Ei.y>=0&&Ei.x+Ei.y<=1}static getInterpolation(e,t,i,s,r,a,o,l){return this.getBarycoord(e,t,i,s,Ei)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ei.x),l.addScaledVector(a,Ei.y),l.addScaledVector(o,Ei.z),l)}static getInterpolatedAttribute(e,t,i,s,r,a){return Lu.setScalar(0),Iu.setScalar(0),ku.setScalar(0),Lu.fromBufferAttribute(e,t),Iu.fromBufferAttribute(e,i),ku.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Lu,r.x),a.addScaledVector(Iu,r.y),a.addScaledVector(ku,r.z),a}static isFrontFacing(e,t,i,s){return Jn.subVectors(i,t),Mi.subVectors(e,t),Jn.cross(Mi).dot(s)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,s){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,i,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Jn.subVectors(this.c,this.b),Mi.subVectors(this.a,this.b),Jn.cross(Mi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,s,r){return n.getInterpolation(e,this.a,this.b,this.c,t,i,s,r)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,s=this.b,r=this.c,a,o;pr.subVectors(s,i),mr.subVectors(r,i),Cu.subVectors(e,i);let l=pr.dot(Cu),c=mr.dot(Cu);if(l<=0&&c<=0)return t.copy(i);Ru.subVectors(e,s);let h=pr.dot(Ru),u=mr.dot(Ru);if(h>=0&&u<=h)return t.copy(s);let d=l*u-h*c;if(d<=0&&l>=0&&h<=0&&l-h>0)return a=l/(l-h),t.copy(i).addScaledVector(pr,a);Pu.subVectors(e,r);let f=pr.dot(Pu),p=mr.dot(Pu);if(p>=0&&f<=p)return t.copy(r);let y=f*c-l*p;if(y<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(i).addScaledVector(mr,o);let m=h*p-f*u;if(m<=0&&u-h>=0&&f-p>=0)return Kp.subVectors(r,s),o=(u-h)/(u-h+(f-p)),t.copy(s).addScaledVector(Kp,o);let g=1/(m+y+d);return a=y*g,o=d*g,t.copy(i).addScaledVector(pr,a).addScaledVector(mr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Qn=class{constructor(e=new O(1/0,1/0,1/0),t=new O(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(Kn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(Kn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=Kn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let r=i.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0&&e.isBatchedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Kn):Kn.fromBufferAttribute(r,a),Kn.applyMatrix4(e.matrixWorld),this.expandByPoint(Kn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),dl.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),dl.copy(i.boundingBox)),dl.applyMatrix4(e.matrixWorld),this.union(dl)}let s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Kn),Kn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ta),fl.subVectors(this.max,Ta),gr.subVectors(e.a,Ta),yr.subVectors(e.b,Ta),vr.subVectors(e.c,Ta),Ji.subVectors(yr,gr),Ki.subVectors(vr,yr),Is.subVectors(gr,vr);let t=[0,-Ji.z,Ji.y,0,-Ki.z,Ki.y,0,-Is.z,Is.y,Ji.z,0,-Ji.x,Ki.z,0,-Ki.x,Is.z,0,-Is.x,-Ji.y,Ji.x,0,-Ki.y,Ki.x,0,-Is.y,Is.x,0];return!Du(t,gr,yr,vr,fl)||(t=[1,0,0,0,1,0,0,0,1],!Du(t,gr,yr,vr,fl))?!1:(pl.crossVectors(Ji,Ki),t=[pl.x,pl.y,pl.z],Du(t,gr,yr,vr,fl))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Kn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Kn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ti[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ti[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ti[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ti[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ti[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ti[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ti[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ti[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ti),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Ti=[new O,new O,new O,new O,new O,new O,new O,new O],Kn=new O,dl=new Qn,gr=new O,yr=new O,vr=new O,Ji=new O,Ki=new O,Is=new O,Ta=new O,fl=new O,pl=new O,ks=new O;function Du(n,e,t,i,s){for(let r=0,a=n.length-3;r<=a;r+=3){ks.fromArray(n,r);let o=s.x*Math.abs(ks.x)+s.y*Math.abs(ks.y)+s.z*Math.abs(ks.z),l=e.dot(ks),c=t.dot(ks),h=i.dot(ks);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var It=new O,ml=new Ie,db=0,kt=class extends Zn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:db++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Sd,this.updateRanges=[],this.gpuType=kn,this.version=0,this._normalizationScale=e!==void 0?Jc(e):void 0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this._normalizationScale=e._normalizationScale,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[i+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)ml.fromBufferAttribute(this,t),ml.applyMatrix3(e),this.setXY(t,ml.x,ml.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.applyMatrix3(e),this.setXYZ(t,It.x,It.y,It.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.applyMatrix4(e),this.setXYZ(t,It.x,It.y,It.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.applyNormalMatrix(e),this.setXYZ(t,It.x,It.y,It.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.transformDirection(e),this.setXYZ(t,It.x,It.y,It.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=this._denormalize(i)),i}setComponent(e,t,i){return this.normalized&&(i=this._normalize(i)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=this._denormalize(t)),t}setX(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=this._denormalize(t)),t}setY(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=this._denormalize(t)),t}setZ(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=this._denormalize(t)),t}setW(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),i=this._normalize(i)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,s){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s),r=this._normalize(r)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}_denormalize(e){let t=this._normalizationScale;return t!==void 0?Math.max(e/t,-1):Ed(e,this.array)}_normalize(e){let t=this._normalizationScale;return t!==void 0?Math.round(e*t):Td(e,this.array)}};var za=class extends kt{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var Ha=class extends kt{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var Bt=class extends kt{constructor(e,t,i){super(new Float32Array(e),t,i)}},fb=new Qn,Aa=new O,Nu=new O,ts=class{constructor(e=new O,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):fb.setFromPoints(e).getCenter(i);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,i.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Aa.subVectors(e,this.center);let t=Aa.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),s=(i-this.radius)*.5;this.center.addScaledVector(Aa,s/i),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Nu.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Aa.copy(e.center).add(Nu)),this.expandByPoint(Aa.copy(e.center).sub(Nu))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},pb=0,Vn=new ft,Ou=new Kt,br=new O,Mn=new Qn,Ca=new Qn,Jt=new O,_t=class n extends Zn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:pb++}),this.uuid=cs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Bv(e)?Ha:za)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let r=new Be().getNormalMatrix(e);i.applyNormalMatrix(r),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Vn.makeRotationFromQuaternion(e),this.applyMatrix4(Vn),this}rotateX(e){return Vn.makeRotationX(e),this.applyMatrix4(Vn),this}rotateY(e){return Vn.makeRotationY(e),this.applyMatrix4(Vn),this}rotateZ(e){return Vn.makeRotationZ(e),this.applyMatrix4(Vn),this}translate(e,t,i){return Vn.makeTranslation(e,t,i),this.applyMatrix4(Vn),this}scale(e,t,i){return Vn.makeScale(e,t,i),this.applyMatrix4(Vn),this}lookAt(e){return Ou.lookAt(e),Ou.updateMatrix(),this.applyMatrix4(Ou.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(br).negate(),this.translate(br.x,br.y,br.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let s=0,r=e.length;s<r;s++){let a=e[s];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Bt(i,3))}else{let i=Math.min(e.length,t.count);for(let s=0;s<i;s++){let r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&De("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Qn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ue("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new O(-1/0,-1/0,-1/0),new O(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,s=t.length;i<s;i++){let r=t[i];Mn.setFromBufferAttribute(r),this.morphTargetsRelative?(Jt.addVectors(this.boundingBox.min,Mn.min),this.boundingBox.expandByPoint(Jt),Jt.addVectors(this.boundingBox.max,Mn.max),this.boundingBox.expandByPoint(Jt)):(this.boundingBox.expandByPoint(Mn.min),this.boundingBox.expandByPoint(Mn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ue('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ts);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ue("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new O,1/0);return}if(e){let i=this.boundingSphere.center;if(Mn.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){let o=t[r];Ca.setFromBufferAttribute(o),this.morphTargetsRelative?(Jt.addVectors(Mn.min,Ca.min),Mn.expandByPoint(Jt),Jt.addVectors(Mn.max,Ca.max),Mn.expandByPoint(Jt)):(Mn.expandByPoint(Ca.min),Mn.expandByPoint(Ca.max))}Mn.getCenter(i);let s=0;for(let r=0,a=e.count;r<a;r++)Jt.fromBufferAttribute(e,r),s=Math.max(s,i.distanceToSquared(Jt));if(t)for(let r=0,a=t.length;r<a;r++){let o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Jt.fromBufferAttribute(o,c),l&&(br.fromBufferAttribute(e,c),Jt.add(br)),s=Math.max(s,i.distanceToSquared(Jt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ue('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ue("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,s=t.normal,r=t.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==i.count)&&(a=new kt(new Float32Array(4*i.count),4),this.setAttribute("tangent",a));let o=[],l=[],c=new Uint8Array(i.count);for(let k=0;k<i.count;k++)o[k]=new O,l[k]=new O;let h=new O,u=new O,d=new O,f=new Ie,p=new Ie,y=new Ie,m=new O,g=new O;function v(k,R,D){c[k]=c[R]=c[D]=1,h.fromBufferAttribute(i,k),u.fromBufferAttribute(i,R),d.fromBufferAttribute(i,D),f.fromBufferAttribute(r,k),p.fromBufferAttribute(r,R),y.fromBufferAttribute(r,D),u.sub(h),d.sub(h),p.sub(f),y.sub(f);let H=1/(p.x*y.y-y.x*p.y);isFinite(H)&&(m.copy(u).multiplyScalar(y.y).addScaledVector(d,-p.y).multiplyScalar(H),g.copy(d).multiplyScalar(p.x).addScaledVector(u,-y.x).multiplyScalar(H),o[k].add(m),o[R].add(m),o[D].add(m),l[k].add(g),l[R].add(g),l[D].add(g))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let k=0,R=_.length;k<R;++k){let D=_[k],H=D.start,j=D.count;for(let L=H,G=H+j;L<G;L+=3)v(e.getX(L+0),e.getX(L+1),e.getX(L+2))}let b=new O,M=new O,T=new O,x=new O;function A(k){T.fromBufferAttribute(s,k),x.copy(T);let R=o[k];b.copy(R),b.sub(T.multiplyScalar(T.dot(R))).normalize(),M.crossVectors(x,R);let H=M.dot(l[k])<0?-1:1;a.setXYZW(k,b.x,b.y,b.z,H)}for(let k=0,R=i.count;k<R;++k)c[k]&&A(k);this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new kt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let d=0,f=i.count;d<f;d++)i.setXYZ(d,0,0,0);let s=new O,r=new O,a=new O,o=new O,l=new O,c=new O,h=new O,u=new O;if(e)for(let d=0,f=e.count;d<f;d+=3){let p=e.getX(d+0),y=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,p),r.fromBufferAttribute(t,y),a.fromBufferAttribute(t,m),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(i,p),l.fromBufferAttribute(i,y),c.fromBufferAttribute(i,m),o.add(h),l.add(h),c.add(h),i.setXYZ(p,o.x,o.y,o.z),i.setXYZ(y,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,f=t.count;d<f;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),i.setXYZ(d+0,h.x,h.y,h.z),i.setXYZ(d+1,h.x,h.y,h.z),i.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Jt.fromBufferAttribute(e,t),Jt.normalize(),e.setXYZ(t,Jt.x,Jt.y,Jt.z)}toNonIndexed(){function e(o,l){let c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h),f=0,p=0;for(let y=0,m=l.length;y<m;y++){o.isInterleavedBufferAttribute?f=l[y]*o.data.stride+o.offset:f=l[y]*h;for(let g=0;g<h;g++)d[p++]=c[f++]}return new kt(d,h,u)}if(this.index===null)return De("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=e(l,i);t.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){let d=c[h],f=e(d,i);l.push(f)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){let f=c[u];h.push(f.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let s=e.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(t))}let r=e.morphAttributes;for(let c in r){let h=[],u=r[c];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let c=0,h=a.length;c<h;c++){let u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},ql=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Sd,this.updateRanges=[],this.version=0,this.uuid=cs()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let s=0,r=this.stride;s<r;s++)this.array[e+s]=t.array[i+s];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={});let t=Zp(this.array);e.arrayBuffers[t]===void 0&&(e.arrayBuffers[t]=this.array.slice(0).buffer);let i=new this.array.constructor(e.arrayBuffers[t]),s=new this.constructor(i,this.stride);return s.setUsage(this.usage),s}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={});let t=Zp(this.array);e.arrayBuffers[t]===void 0&&(e.arrayBuffers[t]=Array.from(new Uint32Array(this.array.slice(0).buffer)));let i={uuid:this.uuid,buffer:t,type:this.array.constructor.name,stride:this.stride};return i.usage=this.usage,i}};function Zp(n){return n.buffer._uuid===void 0&&(n.buffer._uuid=cs()),n.byteOffset===0&&n.byteLength===n.buffer.byteLength?n.buffer._uuid:n.buffer._uuid+":"+n.byteOffset+":"+n.byteLength}var dn=new O,Tt=class n{constructor(e,t,i,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=s,this._normalizationScale=e!==void 0?Jc(e.array):void 0}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)dn.fromBufferAttribute(this,t),dn.applyMatrix4(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)dn.fromBufferAttribute(this,t),dn.applyNormalMatrix(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)dn.fromBufferAttribute(this,t),dn.transformDirection(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=this._denormalize(i)),i}setComponent(e,t,i){return this.normalized&&(i=this._normalize(i)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=this._denormalize(t)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=this._denormalize(t)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=this._denormalize(t)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=this._denormalize(t)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),i=this._normalize(i)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),i=this._normalize(i),s=this._normalize(s),r=this._normalize(r)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=s,this.data.array[e+3]=r,this}clone(e){if(e===void 0){Ua("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return new kt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new n(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Ua("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}_denormalize(e){let t=this._normalizationScale;return t!==void 0?Math.max(e/t,-1):Ed(e,this.data.array)}_normalize(e){let t=this._normalizationScale;return t!==void 0?Math.round(e*t):Td(e,this.data.array)}},Uu=new O,mb=new O,gb=new Be,Tn=class{constructor(e=new O(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,s){return this.normal.set(e,t,i),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let s=Uu.subVectors(i,t).cross(mb.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let s=e.delta(Uu),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/r;return i===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||gb.getNormalMatrix(e),s=this.coplanarPoint(Uu).applyMatrix4(e),r=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},yb=0,Pi=class extends Zn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:yb++}),this.uuid=cs(),this.name="",this.type="Material",this.blending=zr,this.side=os,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Zu,this.blendDst=Qu,this.blendEquation=Gs,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Xe(0,0,0),this.blendAlpha=0,this.depthFunc=Mr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Hm,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Os,this.stencilZFail=Os,this.stencilZPass=Os,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){De(`Material: parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){De(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,i.blending=this.blending,i.side=this.side,i.shadowSide=this.shadowSide,i.vertexColors=this.vertexColors,i.opacity=this.opacity,i.transparent=this.transparent,i.blendSrc=this.blendSrc,i.blendDst=this.blendDst,i.blendEquation=this.blendEquation,i.blendSrcAlpha=this.blendSrcAlpha,i.blendDstAlpha=this.blendDstAlpha,i.blendEquationAlpha=this.blendEquationAlpha,i.blendColor=this.blendColor.getHex(),i.blendAlpha=this.blendAlpha,i.depthFunc=this.depthFunc,i.depthTest=this.depthTest,i.depthWrite=this.depthWrite,i.colorWrite=this.colorWrite,i.clipIntersection=this.clipIntersection,i.clipShadows=this.clipShadows,i.stencilWriteMask=this.stencilWriteMask,i.stencilFunc=this.stencilFunc,i.stencilRef=this.stencilRef,i.stencilFuncMask=this.stencilFuncMask,i.stencilFail=this.stencilFail,i.stencilZFail=this.stencilZFail,i.stencilZPass=this.stencilZPass,i.stencilWrite=this.stencilWrite,i.polygonOffset=this.polygonOffset,i.polygonOffsetFactor=this.polygonOffsetFactor,i.polygonOffsetUnits=this.polygonOffsetUnits,i.dithering=this.dithering,i.alphaTest=this.alphaTest,i.alphaHash=this.alphaHash,i.alphaToCoverage=this.alphaToCoverage,i.premultipliedAlpha=this.premultipliedAlpha,i.forceSinglePass=this.forceSinglePass,i.allowOverride=this.allowOverride,i.visible=this.visible,i.toneMapped=this.toneMapped,i.name=this.name,this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.diffuseRoughness!==void 0&&(i.diffuseRoughness=this.diffuseRoughness),this.diffuseRoughnessMap&&this.diffuseRoughnessMap.isTexture&&(i.diffuseRoughnessMap=this.diffuseRoughnessMap.toJSON(e).uuid),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(i.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessMinimum!==void 0&&(i.iridescenceThicknessMinimum=this.iridescenceThicknessMinimum),this.iridescenceThicknessMaximum!==void 0&&(i.iridescenceThicknessMaximum=this.iridescenceThicknessMaximum),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(i.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(i.rotation=this.rotation),this.depthPacking!==void 0&&(i.depthPacking=this.depthPacking),this.linewidth!==void 0&&(i.linewidth=this.linewidth),this.linecap!==void 0&&(i.linecap=this.linecap),this.linejoin!==void 0&&(i.linejoin=this.linejoin),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.wireframe!==void 0&&(i.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(i.flatShading=this.flatShading),this.fog!==void 0&&(i.fog=this.fog),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(t){let r=s(e.textures),a=s(e.images);r.length>0&&(i.textures=r),a.length>0&&(i.images=a)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Xe().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.diffuseRoughness!==void 0&&(this.diffuseRoughness=e.diffuseRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessMinimum!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessMinimum),e.iridescenceThicknessMaximum!==void 0&&(this.iridescenceThicknessMaximum=e.iridescenceThicknessMaximum),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessRange[0],this.iridescenceThicknessMaximum=e.iridescenceThicknessRange[1]),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(i=>new Tn().fromJSON(i))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Ie().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Ie().fromArray(e.clearcoatNormalScale)),e.diffuseRoughnessMap!==void 0&&(this.diffuseRoughnessMap=t[e.diffuseRoughnessMap]||null),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let s=t.length;i=new Array(s);for(let r=0;r!==s;++r)i[r]=t[r].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Ai=new O,Fu=new O,gl=new O,yl=new O,ns=class{constructor(e=new O,t=new O(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ai)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Ai.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ai.copy(this.origin).addScaledVector(this.direction,t),Ai.distanceToSquared(e))}distanceSqToSegment(e,t,i,s){Fu.copy(e).add(t).multiplyScalar(.5),gl.copy(t).sub(e).normalize(),yl.copy(this.origin).sub(Fu);let r=e.distanceTo(t)*.5,a=-this.direction.dot(gl),o=yl.dot(this.direction),l=-yl.dot(gl),c=yl.lengthSq(),h=Math.abs(1-a*a),u,d,f,p;if(h>0)if(u=a*l-o,d=a*o-l,p=r*h,u>=0)if(d>=-p)if(d<=p){let y=1/h;u*=y,d*=y,f=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d<=-p?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c):d<=p?(u=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(Fu).addScaledVector(gl,d),f}intersectSphere(e,t){if(e.radius<0)return null;Ai.subVectors(e.center,this.origin);let i=Ai.dot(this.direction),s=Ai.dot(Ai)-i*i,r=e.radius*e.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,s,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(i=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(i=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),h>=0?(r=(e.min.y-d.y)*h,a=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,a=(e.min.y-d.y)*h),i>a||r>s||((r>i||isNaN(i))&&(i=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(e.min.z-d.z)*u,l=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,l=(e.min.z-d.z)*u),i>l||o>s)||((o>i||i!==i)&&(i=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,t)}intersectsBox(e){return this.intersectBox(e,Ai)!==null}intersectTriangle(e,t,i,s,r){let a=this.origin,o=this.direction,l=o.x,c=o.y,h=o.z,u=e.x-a.x,d=e.y-a.y,f=e.z-a.z,p=t.x-a.x,y=t.y-a.y,m=t.z-a.z,g=i.x-a.x,v=i.y-a.y,_=i.z-a.z,b=Math.abs(l),M=Math.abs(c),T=Math.abs(h),x,A,k,R,D,H,j,L,G,V,W,te;if(b>=M&&b>=T?(k=l,H=u,G=p,te=g,l>=0?(x=c,A=h,R=d,D=f,j=y,L=m,V=v,W=_):(x=h,A=c,R=f,D=d,j=m,L=y,V=_,W=v)):M>=T?(k=c,H=d,G=y,te=v,c>=0?(x=h,A=l,R=f,D=u,j=m,L=p,V=_,W=g):(x=l,A=h,R=u,D=f,j=p,L=m,V=g,W=_)):(k=h,H=f,G=m,te=_,h>=0?(x=l,A=c,R=u,D=d,j=p,L=y,V=g,W=v):(x=c,A=l,R=d,D=u,j=y,L=p,V=v,W=g)),k===0)return null;let Y=x/k,q=A/k,ne=1/k,ye=R-Y*H,ke=D-q*H,$=j-Y*G,oe=L-q*G,ve=V-Y*te,Ce=W-q*te,me=ve*oe-Ce*$,Fe=ye*Ce-ke*ve,Ye=$*ke-oe*ye;if(s){if(me<0||Fe<0||Ye<0)return null}else if((me<0||Fe<0||Ye<0)&&(me>0||Fe>0||Ye>0))return null;let Se=me+Fe+Ye;if(Se===0)return null;let rt=ne*(me*H+Fe*G+Ye*te);return(Se>0?rt<0:rt>0)?null:this.at(rt/Se,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Rr=class extends Pi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Xe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new es,this.combine=ed,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Qp=new ft,Ds=new ns,vl=new ts,em=new O,bl=new O,xl=new O,_l=new O,Bu=new O,Sl=new O,tm=new O,wl=new O,Zt=class extends Kt{constructor(e=new _t,t=new Rr){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0?this.morphTargetInfluences=e.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,e.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let i=this.geometry,s=i.attributes.position,r=i.morphAttributes.position,a=i.morphTargetsRelative;t.fromBufferAttribute(s,e);let o=this.morphTargetInfluences;if(r&&o){Sl.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],u=r[l];h!==0&&(Bu.fromBufferAttribute(u,e),a?Sl.addScaledVector(Bu,h):Sl.addScaledVector(Bu.sub(t),h))}t.add(Sl)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),vl.copy(i.boundingSphere),vl.applyMatrix4(r),Ds.copy(e.ray).recast(e.near),!(vl.containsPoint(Ds.origin)===!1&&(Ds.intersectSphere(vl,em)===null||Ds.origin.distanceToSquared(em)>(e.far-e.near)**2))&&(Qp.copy(r).invert(),Ds.copy(e.ray).applyMatrix4(Qp),!(i.boundingBox!==null&&Ds.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Ds)))}_computeIntersections(e,t,i){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let p=0,y=d.length;p<y;p++){let m=d[p],g=a[m.materialIndex],v=Math.max(m.start,f.start),_=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let b=v,M=_;b<M;b+=3){let T=o.getX(b),x=o.getX(b+1),A=o.getX(b+2);s=Ml(this,g,e,i,c,h,u,T,x,A),s&&(s.faceIndex=Math.floor(b/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let p=Math.max(0,f.start),y=Math.min(o.count,f.start+f.count);for(let m=p,g=y;m<g;m+=3){let v=o.getX(m),_=o.getX(m+1),b=o.getX(m+2);s=Ml(this,a,e,i,c,h,u,v,_,b),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let p=0,y=d.length;p<y;p++){let m=d[p],g=a[m.materialIndex],v=Math.max(m.start,f.start),_=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let b=v,M=_;b<M;b+=3){let T=b,x=b+1,A=b+2;s=Ml(this,g,e,i,c,h,u,T,x,A),s&&(s.faceIndex=Math.floor(b/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let p=Math.max(0,f.start),y=Math.min(l.count,f.start+f.count);for(let m=p,g=y;m<g;m+=3){let v=m,_=m+1,b=m+2;s=Ml(this,a,e,i,c,h,u,v,_,b),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}};function vb(n,e,t,i,s,r,a,o){let l;if(e.side===gn?l=i.intersectTriangle(a,r,s,!0,o):l=i.intersectTriangle(s,r,a,e.side===os,o),l===null)return null;wl.copy(o),wl.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(wl);return c<t.near||c>t.far?null:{distance:c,point:wl.clone(),object:n}}function Ml(n,e,t,i,s,r,a,o,l,c){n.getVertexPosition(o,bl),n.getVertexPosition(l,xl),n.getVertexPosition(c,_l);let h=vb(n,e,t,i,bl,xl,_l,tm);if(h){let u=new O;Qi.getBarycoord(tm,bl,xl,_l,u),s&&(h.uv=Qi.getInterpolatedAttribute(s,o,l,c,u,new Ie)),r&&(h.uv1=Qi.getInterpolatedAttribute(r,o,l,c,u,new Ie)),a&&(h.normal=Qi.getInterpolatedAttribute(a,o,l,c,u,new O),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:l,c,normal:new O,materialIndex:0};Qi.getNormal(bl,xl,_l,d.normal),h.face=d,h.barycoord=u}return h}var Pr=class extends tn{constructor(e=null,t=1,i=1,s,r,a,o,l,c=xt,h=xt,u,d){super(null,a,o,l,c,h,s,r,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ns=new ts,bb=new Ie(.5,.5),El=new O,Bs=class{constructor(e=new Tn,t=new Tn,i=new Tn,s=new Tn,r=new Tn,a=new Tn){this.planes=[e,t,i,s,r,a]}set(e,t,i,s,r,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=Gn,i=!1){let s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],u=r[5],d=r[6],f=r[7],p=r[8],y=r[9],m=r[10],g=r[11],v=r[12],_=r[13],b=r[14],M=r[15];if(s[0].setComponents(c-a,f-h,g-p,M-v).normalize(),s[1].setComponents(c+a,f+h,g+p,M+v).normalize(),s[2].setComponents(c+o,f+u,g+y,M+_).normalize(),s[3].setComponents(c-o,f-u,g-y,M-_).normalize(),i)s[4].setComponents(l,d,m,b).normalize(),s[5].setComponents(c-l,f-d,g-m,M-b).normalize();else if(s[4].setComponents(c-l,f-d,g-m,M-b).normalize(),t===Gn)s[5].setComponents(c+l,f+d,g+m,M+b).normalize();else if(t===Na)s[5].setComponents(l,d,m,b).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Ns.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Ns.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Ns)}intersectsSprite(e){Ns.center.set(0,0,0);let t=bb.distanceTo(e.center);return Ns.radius=.7071067811865476+t,Ns.applyMatrix4(e.matrixWorld),this.intersectsSphere(Ns)}intersectsSphere(e){let t=this.planes,i=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(i)<s)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let s=t[i];if(El.x=s.normal.x>0?e.max.x:e.min.x,El.y=s.normal.y>0?e.max.y:e.min.y,El.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(El)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},nm=new ft,Yl=class n{constructor(){this.coordinateSystem=Gn,this._frustums=[],this._count=0}setFromArrayCamera(e){let t=e.cameras,i=this._frustums;for(let s=0;s<t.length;s++){let r=t[s];nm.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),i[s]===void 0&&(i[s]=new Bs),i[s].setFromProjectionMatrix(nm,r.coordinateSystem,r.reversedDepth)}return this._count=t.length,this}getFrustum(e){return this._frustums[e]}intersectsObject(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsObject(e))return!0;return!1}intersectsSprite(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsSprite(e))return!0;return!1}intersectsSphere(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsSphere(e))return!0;return!1}intersectsBox(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].intersectsBox(e))return!0;return!1}containsPoint(e){let t=this._frustums;for(let i=0;i<this._count;i++)if(t[i].containsPoint(e))return!0;return!1}copy(e){this.coordinateSystem=e.coordinateSystem;let t=this._frustums,i=e._frustums;for(let s=0;s<e._count;s++)t[s]===void 0&&(t[s]=new Bs),t[s].copy(i[s]);return this._count=e._count,this}clone(){return new n().copy(this)}};var zs=class extends Pi{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Xe(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},jl=new O,Jl=new O,im=new ft,Ra=new ns,Tl=new ts,zu=new O,sm=new O,Lr=class extends Kt{constructor(e=new _t,t=new zs){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0?this.morphTargetInfluences=e.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,e.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[0];for(let s=1,r=t.count;s<r;s++)jl.fromBufferAttribute(t,s-1),Jl.fromBufferAttribute(t,s),i[s]=i[s-1],i[s]+=jl.distanceTo(Jl);e.setAttribute("lineDistance",new Bt(i,1))}else De("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Tl.copy(i.boundingSphere),Tl.applyMatrix4(s),Tl.radius+=r,e.ray.intersectsSphere(Tl)===!1)return;im.copy(s).invert(),Ra.copy(e.ray).applyMatrix4(im);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=i.index,d=i.attributes.position;if(h!==null){let f=Math.max(0,a.start),p=Math.min(h.count,a.start+a.count);for(let y=f,m=p-1;y<m;y+=c){let g=h.getX(y),v=h.getX(y+1),_=Al(this,e,Ra,l,g,v,y);_&&t.push(_)}if(this.isLineLoop){let y=h.getX(p-1),m=h.getX(f),g=Al(this,e,Ra,l,y,m,p-1);g&&t.push(g)}}else{let f=Math.max(0,a.start),p=Math.min(d.count,a.start+a.count);for(let y=f,m=p-1;y<m;y+=c){let g=Al(this,e,Ra,l,y,y+1,y);g&&t.push(g)}if(this.isLineLoop){let y=Al(this,e,Ra,l,p-1,f,p-1);y&&t.push(y)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function Al(n,e,t,i,s,r,a){let o=n.geometry.attributes.position;if(jl.fromBufferAttribute(o,s),Jl.fromBufferAttribute(o,r),t.distanceSqToSegment(jl,Jl,zu,sm)>i)return;zu.applyMatrix4(n.matrixWorld);let c=e.ray.origin.distanceTo(zu);if(!(c<e.near||c>e.far))return{distance:c,point:sm.clone().applyMatrix4(n.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:n}}var rm=new O,am=new O,Ir=class extends Lr{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[];for(let s=0,r=t.count;s<r;s+=2)rm.fromBufferAttribute(t,s),am.fromBufferAttribute(t,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+rm.distanceTo(am);e.setAttribute("lineDistance",new Bt(i,1))}else De("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var Hs=class extends Pi{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Xe(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},om=new ft,$u=new ns,Cl=new ts,Rl=new O,kr=class extends Kt{constructor(e=new _t,t=new Hs){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0?this.morphTargetInfluences=e.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,e.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Cl.copy(i.boundingSphere),Cl.applyMatrix4(s),Cl.radius+=r,e.ray.intersectsSphere(Cl)===!1)return;om.copy(s).invert(),$u.copy(e.ray).applyMatrix4(om);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=i.index,u=i.attributes.position;if(c!==null){let d=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let p=d,y=f;p<y;p++){let m=c.getX(p);Rl.fromBufferAttribute(u,m),lm(Rl,m,l,s,e,t,this)}}else{let d=Math.max(0,a.start),f=Math.min(u.count,a.start+a.count);for(let p=d,y=f;p<y;p++)Rl.fromBufferAttribute(u,p),lm(Rl,p,l,s,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function lm(n,e,t,i,s,r,a){let o=$u.distanceSqToPoint(n);if(o<t){let l=new O;$u.closestPointToPoint(n,l),l.applyMatrix4(i);let c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}var Va=class extends tn{constructor(e=[],t=Ws,i,s,r,a,o,l,c,h){super(e,t,i,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Dr=class extends tn{constructor(e,t,i,s,r,a,o,l,c){super(e,t,i,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Li=class extends tn{constructor(e,t,i=ti,s,r,a,o=xt,l=xt,c,h=Ri,u=1){if(h!==Ri&&h!==Di)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let d={width:e,height:t,depth:u};super(d,s,r,a,o,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Ar(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},Ga=class extends Li{constructor(e,t=ti,i=Ws,s,r,a=xt,o=xt,l,c=Ri){let h={width:e,height:e,depth:1},u=[h,h,h,h,h,h];super(e,e,t,i,s,r,a,o,l,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Wa=class extends tn{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Nr=class n extends _t{constructor(e=1,t=1,i=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],u=[],d=0,f=0;p("z","y","x",-1,-1,i,t,e,a,r,0),p("z","y","x",1,-1,i,t,-e,a,r,1),p("x","z","y",1,1,e,i,t,s,a,2),p("x","z","y",1,-1,e,i,-t,s,a,3),p("x","y","z",1,-1,e,t,i,s,r,4),p("x","y","z",-1,-1,e,t,-i,s,r,5),this.setIndex(l),this.setAttribute("position",new Bt(c,3)),this.setAttribute("normal",new Bt(h,3)),this.setAttribute("uv",new Bt(u,2));function p(y,m,g,v,_,b,M,T,x,A,k){let R=b/x,D=M/A,H=b/2,j=M/2,L=T/2,G=x+1,V=A+1,W=0,te=0,Y=new O;for(let q=0;q<V;q++){let ne=q*D-j;for(let ye=0;ye<G;ye++){let ke=ye*R-H;Y[y]=ke*v,Y[m]=ne*_,Y[g]=L,c.push(Y.x,Y.y,Y.z),Y[y]=0,Y[m]=0,Y[g]=T>0?1:-1,h.push(Y.x,Y.y,Y.z),u.push(ye/x),u.push(1-q/A),W+=1}}for(let q=0;q<A;q++)for(let ne=0;ne<x;ne++){let ye=d+ne+G*q,ke=d+ne+G*(q+1),$=d+(ne+1)+G*(q+1),oe=d+(ne+1)+G*q;l.push(ye,ke,oe),l.push(ke,$,oe),te+=6}o.addGroup(f,te,k),f+=te,d+=W}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var Vs=class n extends _t{constructor(e=1,t=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:s};let r=e/2,a=t/2,o=Math.floor(i),l=Math.floor(s),c=o+1,h=l+1,u=e/o,d=t/l,f=[],p=[],y=[],m=[];for(let g=0;g<h;g++){let v=g*d-a;for(let _=0;_<c;_++){let b=_*u-r;p.push(b,-v,0),y.push(0,0,1),m.push(_/o),m.push(1-g/l)}}for(let g=0;g<l;g++)for(let v=0;v<o;v++){let _=v+c*g,b=v+c*(g+1),M=v+1+c*(g+1),T=v+1+c*g;f.push(_,b,T),f.push(b,M,T)}this.setIndex(f),this.setAttribute("position",new Bt(p,3)),this.setAttribute("normal",new Bt(y,3)),this.setAttribute("uv",new Bt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function Xs(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let s=n[t][i];if(cm(s))s.isRenderTargetTexture?(De("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=s.clone();else if(Array.isArray(s))if(cm(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][i]=r}else e[t][i]=s.slice();else e[t][i]=s}}return e}function cn(n){let e={};for(let t=0;t<n.length;t++){let i=Xs(n[t]);for(let s in i)e[s]=i[s]}return e}function cm(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function xb(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Cd(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:je.workingColorSpace}var Zm={clone:Xs,merge:cn},_b=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Sb=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Cn=class extends Pi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=_b,this.fragmentShader=Sb,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Xs(e.uniforms),this.uniformsGroups=xb(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let s=e.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=t[s.value]||null;break;case"c":this.uniforms[i].value=new Xe().setHex(s.value);break;case"v2":this.uniforms[i].value=new Ie().fromArray(s.value);break;case"v3":this.uniforms[i].value=new O().fromArray(s.value);break;case"v4":this.uniforms[i].value=new ht().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Be().fromArray(s.value);break;case"m4":this.uniforms[i].value=new ft().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Kl=class extends Cn{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var Zl=class extends Pi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Bm,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Ql=class extends Pi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function xr(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}function Pl(n){return n!==void 0&&n.inTangents!==void 0&&n.outTangents!==void 0}var is=class{constructor(e,t,i,s){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,s=t[i],r=t[i-1];n:{e:{let a;t:{i:if(!(e<s)){for(let o=i+2;;){if(s===void 0){if(e<r)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(r=s,s=t[++i],e<s)break e}a=t.length;break t}if(!(e>=r)){let o=t[1];e<o&&(i=2,r=o);for(let l=i-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(s=r,r=t[--i-1],e>=r)break e}a=i,i=0;break t}break n}for(;i<a;){let o=i+a>>>1;e<t[o]?a=o:i=o+1}if(s=t[i],r=t[i-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,r,s)}return this.interpolate_(i,r,e,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,s=this.valueSize,r=e*s;for(let a=0;a!==s;++a)t[a]=i[r+a];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},ec=class extends is{constructor(e,t,i,s){super(e,t,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Vu,endingEnd:Vu}}intervalChanged_(e,t,i){let s=this.parameterPositions,r=e-2,a=e+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case Gu:r=e,o=2*t-i;break;case Wu:r=s.length-2,o=t+s[r]-s[r+1];break;default:r=e,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Gu:a=e,l=2*i-t;break;case Wu:a=1,l=i+s[1]-s[0];break;default:a=e-1,l=t}let c=(i-t)*.5,h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-i),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(i-t)/(s-t),y=p*p,m=y*p,g=-d*m+2*d*y-d*p,v=(1+d)*m+(-1.5-2*d)*y+(-.5+d)*p+1,_=(-1-f)*m+(1.5+f)*y+.5*p,b=f*m-f*y;for(let M=0;M!==o;++M)r[M]=g*a[h+M]+v*a[c+M]+_*a[l+M]+b*a[u+M];return r}},tc=class extends is{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(i-t)/(s-t),u=1-h;for(let d=0;d!==o;++d)r[d]=a[c+d]*u+a[l+d]*h;return r}},nc=class extends is{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e){return this.copySampleValue_(e-1)}},ic=class extends is{interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this.inTangents,u=this.outTangents;if(!h||!u){let p=(i-t)/(s-t),y=1-p;for(let m=0;m!==o;++m)r[m]=a[c+m]*y+a[l+m]*p;return r}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let y=a[c+p],m=a[l+p],g=f*d+p*2,v=u[g],_=u[g+1],b=e*d+p*2,M=h[b],T=h[b+1],x=Mb(i,t,v,M,s);r[p]=Qm(x,y,_,T,m)}return r}};function Qm(n,e,t,i,s){let r=1-n;return r*r*r*e+3*r*r*n*t+3*r*n*n*i+n*n*n*s}function wb(n,e,t,i,s){let r=1-n;return 3*r*r*(t-e)+6*r*n*(i-t)+3*n*n*(s-i)}function Mb(n,e,t,i,s){let r=(n-e)/(s-e);for(let a=0;a<8;a++){let o=Qm(r,e,t,i,s)-n;if(Math.abs(o)<1e-10)break;let l=wb(r,e,t,i,s);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-o/l))}return r}var Rn=class{constructor(e,t,i,s){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=xr(t,this.TimeBufferType),this.values=xr(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:xr(e.times,Array),values:xr(e.values,Array)};let s=e.getInterpolation();s!==e.DefaultInterpolation&&(i.interpolation=s),Pl(e.settings)&&(i.settings={inTangents:xr(e.settings.inTangents,Array),outTangents:xr(e.settings.outTangents,Array)})}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new nc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new tc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ec(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new ic(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case ka:t=this.InterpolantFactoryMethodDiscrete;break;case Gl:t=this.InterpolantFactoryMethodLinear;break;case kl:t=this.InterpolantFactoryMethodSmooth;break;case Hu:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return De("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ka;case this.InterpolantFactoryMethodLinear:return Gl;case this.InterpolantFactoryMethodSmooth:return kl;case this.InterpolantFactoryMethodBezier:return Hu}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]+=e;Pl(this.settings)&&(hm(this.settings.inTangents,e),hm(this.settings.outTangents,e))}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]*=e;Pl(this.settings)&&(um(this.settings.inTangents,e),um(this.settings.outTangents,e))}return this}trim(e,t){let i=this.times,s=i.length,r=0,a=s-1;for(;r!==s&&i[r]<e;)++r;for(;a!==-1&&i[a]>t;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=i.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ue("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,s=this.values,r=i.length;r===0&&(Ue("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==r;o++){let l=i[o];if(typeof l=="number"&&isNaN(l)){Ue("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Ue("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(s!==void 0&&zv(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){Ue("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===kl,r=e.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=e[o],h=e[o+1];if(c!==h&&(o!==1||c!==e[0]))if(s)l=!0;else{let u=o*i,d=u-i,f=u+i;for(let p=0;p!==i;++p){let y=t[u+p];if(y!==t[d+p]||y!==t[f+p]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];let u=o*i,d=a*i;for(let f=0;f!==i;++f)t[d+f]=t[u+f]}++a}}if(r>0){e[a]=e[r];for(let o=r*i,l=a*i,c=0;c!==i;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,s=new i(this.name,e,t);return s.createInterpolant=this.createInterpolant,Pl(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function hm(n,e){for(let t=0,i=n.length;t!==i;t+=2)n[t]+=e}function um(n,e){for(let t=0,i=n.length;t!==i;t+=2)n[t]*=e}Rn.prototype.ValueTypeName="";Rn.prototype.TimeBufferType=Float32Array;Rn.prototype.ValueBufferType=Float32Array;Rn.prototype.DefaultInterpolation=Gl;var ss=class extends Rn{constructor(e,t,i){super(e,t,i)}};ss.prototype.ValueTypeName="bool";ss.prototype.ValueBufferType=Array;ss.prototype.DefaultInterpolation=ka;ss.prototype.InterpolantFactoryMethodLinear=void 0;ss.prototype.InterpolantFactoryMethodSmooth=void 0;var sc=class extends Rn{constructor(e,t,i,s){super(e,t,i,s)}};sc.prototype.ValueTypeName="color";var rc=class extends Rn{constructor(e,t,i,s){super(e,t,i,s)}};rc.prototype.ValueTypeName="number";var ac=class extends is{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(i-t)/(s-t),c=e*o;for(let h=c+o;c!==h;c+=4)An.slerpFlat(r,0,a,c-o,a,c,l);return r}},$a=class extends Rn{constructor(e,t,i,s){super(e,t,i,s)}InterpolantFactoryMethodLinear(e){return new ac(this.times,this.values,this.getValueSize(),e)}};$a.prototype.ValueTypeName="quaternion";$a.prototype.InterpolantFactoryMethodSmooth=void 0;var rs=class extends Rn{constructor(e,t,i){super(e,t,i)}};rs.prototype.ValueTypeName="string";rs.prototype.ValueBufferType=Array;rs.prototype.DefaultInterpolation=ka;rs.prototype.InterpolantFactoryMethodLinear=void 0;rs.prototype.InterpolantFactoryMethodSmooth=void 0;var oc=class extends Rn{constructor(e,t,i,s){super(e,t,i,s)}};oc.prototype.ValueTypeName="vector";var lc=class{constructor(e,t,i){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){let u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){let f=c[u],p=c[u+1];if(f.global&&(f.lastIndex=0),f.test(h))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},eg=new lc,cc=class{constructor(e){this.manager=e!==void 0?e:eg,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},this.priority="auto",this.cache="default",typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(s,r){i.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}setPriority(e){return this.priority=e,this}setCache(e){return this.cache=e,this}abort(){return this}};cc.DEFAULT_MATERIAL_NAME="__DEFAULT";var Ll=new O,Il=new An,fi=new O,Xa=class extends Kt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ft,this.projectionMatrix=new ft,this.projectionMatrixInverse=new ft,this.coordinateSystem=Gn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Ll,Il,fi),fi.x===1&&fi.y===1&&fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ll,Il,fi.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(Ll,Il,fi),fi.x===1&&fi.y===1&&fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ll,Il,fi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Zi=new O,dm=new Ie,fm=new Ie,ln=class extends Xa{constructor(e=50,t=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Tr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(La*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Tr*2*Math.atan(Math.tan(La*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){Zi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Zi.x,Zi.y).multiplyScalar(-e/Zi.z),Zi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Zi.x,Zi.y).multiplyScalar(-e/Zi.z)}getViewSize(e,t){return this.getViewBounds(e,dm,fm),t.subVectors(fm,dm)}setViewOffset(e,t,i,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(La*.5*this.fov)/this.zoom,i=2*t,s=this.aspect*i,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*i/c,s*=a.width/l,i*=a.height/c}let o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Pn=class extends Xa{constructor(e=-1,t=1,i=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=i-e,a=i+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}};var Or=class extends _t{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}};var _r=-90,Sr=1,Ur=class extends Kt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new ln(_r,Sr,e,t);s.layers=this.layers,this.add(s);let r=new ln(_r,Sr,e,t);r.layers=this.layers,this.add(r);let a=new ln(_r,Sr,e,t);a.layers=this.layers,this.add(a);let o=new ln(_r,Sr,e,t);o.layers=this.layers,this.add(o);let l=new ln(_r,Sr,e,t);l.layers=this.layers,this.add(l);let c=new ln(_r,Sr,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,s,r,a,o,l]=t;for(let c of t)this.remove(c);if(e===Gn)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Na)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let y=i.texture.mipmapsAutoUpdate;i.texture.mipmapsAutoUpdate=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(i,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(i,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.mipmapsAutoUpdate=y,e.setRenderTarget(i,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(u,d,f),e.xr.enabled=p,i.texture.needsPMREMUpdate=!0}},hc=class extends ln{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e,this.perCameraFrustumCulled=!1}};var Rd="\\[\\]\\.:\\/",Eb=new RegExp("["+Rd+"]","g"),Pd="[^"+Rd+"]",Tb="[^"+Rd.replace("\\.","")+"]",Ab=/((?:WC+[\/:])*)/.source.replace("WC",Pd),Cb=/(WCOD+)?/.source.replace("WCOD",Tb),Rb=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Pd),Pb=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Pd),Lb=new RegExp("^"+Ab+Cb+Rb+Pb+"$"),Ib=["material","materials","bones","map"],Xu=class{constructor(e,t,i){let s=i||yt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,s)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=i.length;s!==r;++s)i[s].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},yt=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Eb,"")}static parseTrackName(e){let t=Lb.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=i.nodeName.substring(s+1);Ib.indexOf(r)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=r)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===t||o.uuid===t)return o;let l=i(o.children);if(l)return l}return null},s=i(e.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)e[t++]=i[s]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,s=t.propertyName,r=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){De("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Ue("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ue("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ue("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ue("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ue("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Ue("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Ue("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let a=e[s];if(a===void 0){let c=t.nodeName;Ue("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!e.geometry){Ue("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ue("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};yt.Composite=Xu;yt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};yt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};yt.prototype.GetterByBindingType=[yt.prototype._getValue_direct,yt.prototype._getValue_array,yt.prototype._getValue_arrayElement,yt.prototype._getValue_toArray];yt.prototype.SetterByBindingTypeAndVersioning=[[yt.prototype._setValue_direct,yt.prototype._setValue_direct_setNeedsUpdate,yt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_array,yt.prototype._setValue_array_setNeedsUpdate,yt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_arrayElement,yt.prototype._setValue_arrayElement_setNeedsUpdate,yt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_fromArray,yt.prototype._setValue_fromArray_setNeedsUpdate,yt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var a1=new Float32Array(1);var as=class extends ql{constructor(e,t,i=1){super(e,t),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){let t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){let t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}};var Fr=class{constructor(e=1,t=0,i=0){this.radius=e,this.phi=t,this.theta=i}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Je(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(Je(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var qu=class{static{this.prototype.isMatrix2=!0}constructor(e,t,i,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,s){let r=this.elements;return r[0]=e,r[2]=t,r[1]=i,r[3]=s,this}},pm=new Ie,qa=class{constructor(e=new Ie(1/0,1/0),t=new Ie(-1/0,-1/0)){this.isBox2=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=pm.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(e){return this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,pm).distanceTo(e)}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}};var Ya=class extends Zn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Ld(n,e,t,i){let s=kb(i);switch(t){case fd:return n*e;case md:return n*e/s.components*s.byteLength;case yc:return n*e/s.components*s.byteLength;case ls:return n*e*2/s.components*s.byteLength;case vc:return n*e*2/s.components*s.byteLength;case pd:return n*e*3/s.components*s.byteLength;case Dn:return n*e*4/s.components*s.byteLength;case bc:return n*e*4/s.components*s.byteLength;case Ka:case Za:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Qa:case eo:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case _c:case wc:return Math.max(n,16)*Math.max(e,8)/4;case xc:case Sc:return Math.max(n,8)*Math.max(e,8)/2;case Mc:case Ec:case Ac:case Cc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Tc:case to:case Rc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Pc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Lc:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case Ic:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case kc:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Dc:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Nc:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Oc:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Uc:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Fc:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Bc:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case zc:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Hc:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Vc:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Gc:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Wc:case $c:case Xc:return Math.ceil(n/4)*Math.ceil(e/4)*16;case qc:case Yc:return Math.ceil(n/4)*Math.ceil(e/4)*8;case no:case jc:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function kb(n){switch(n){case In:case cd:return{byteLength:1,components:1};case Vr:case hd:case ni:return{byteLength:2,components:1};case mc:case gc:return{byteLength:2,components:4};case ti:case pc:case kn:return{byteLength:4,components:1};case ud:case dd:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"187"}}));typeof window<"u"&&(window.__THREE__?De("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="187");function Sg(){let n=null,e=!1,t=null,i=null;function s(r,a){i=n.requestAnimationFrame(s),t(r,a)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(s),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){n=r}}}function Nb(n){let e=new WeakMap;function t(o,l){let c=o.array,h=o.usage,u=c.byteLength,d=n.createBuffer();n.bindBuffer(l,d),n.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=n.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=n.HALF_FLOAT:f=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=n.SHORT;else if(c instanceof Uint32Array)f=n.UNSIGNED_INT;else if(c instanceof Int32Array)f=n.INT;else if(c instanceof Int8Array)f=n.BYTE;else if(c instanceof Uint8Array)f=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function i(o,l,c){let h=l.array,u=l.updateRanges;if(n.bindBuffer(c,o),u.length===0)n.bufferSubData(c,0,h);else{u.sort((f,p)=>f.start-p.start);let d=0;for(let f=1;f<u.length;f++){let p=u[d],y=u[f];y.start<=p.start+p.count+1?p.count=Math.max(p.count,y.start+y.count-p.start):(++d,u[d]=y)}u.length=d+1;for(let f=0,p=u.length;f<p;f++){let y=u[f];n.bufferSubData(c,y.start*h.BYTES_PER_ELEMENT,h,y.start,y.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=e.get(o);l&&(n.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var Ob=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Ub=`#ifdef USE_ALPHAHASH
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
#endif`,Fb=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Bb=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,zb=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Hb=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Vb=`#ifdef USE_AOMAP
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
#endif`,Gb=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Wb=`#ifdef USE_BATCHING
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
#endif`,$b=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Xb=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,qb=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Yb=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,jb=`#ifdef USE_IRIDESCENCE
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
#endif`,Jb=`#ifdef USE_BUMPMAP
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
#endif`,Kb=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Zb=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Qb=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,ex=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,tx=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,nx=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,ix=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,sx=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,rx=`#define PI 3.141592653589793
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
} // validated`,ax=`vec3 transformedNormal = objectNormal;
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
#endif`,ox=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,lx=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,cx=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,hx=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ux="gl_FragColor = linearToOutputTexel( gl_FragColor );",dx=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,fx=`#ifdef USE_ENVMAP
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
#endif`,px=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif`,mx=`#ifdef USE_ENVMAP
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
#endif`,gx=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,yx=`#ifdef USE_ENVMAP
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
#endif`,vx=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,bx=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,xx=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,_x=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Sx=`#ifdef USE_GRADIENTMAP
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
}`,wx=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Mx=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Ex=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Tx=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,Ax=`#ifdef USE_ENVMAP
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
#endif`,Cx=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Rx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Px=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Lx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Ix=`PhysicalMaterial material;
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
#endif`,kx=`uniform sampler2D dfgLUT;
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
}`,Dx=`
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
#endif`,Nx=`#if defined( RE_IndirectDiffuse )
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
#endif`,Ox=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Ux=`#if NUM_LIGHT_PROBE_GRIDS > 0
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
#endif`,Fx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Bx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,zx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Hx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Vx=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Gx=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Wx=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,$x=`#if defined( USE_POINTS_UV )
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
#endif`,Xx=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,qx=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Yx=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,jx=`#if defined( USE_MORPHCOLORS )
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
#endif`,Jx=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Kx=`#ifdef USE_MORPHTARGETS
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
#endif`,Zx=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Qx=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,e_=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,t_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,n_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,i_=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,s_=`#ifdef USE_NORMALMAP
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
#endif`,r_=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,a_=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,o_=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,l_=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,c_=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,h_=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,u_=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,d_=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,f_=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,p_=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,m_=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,g_=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,y_=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,v_=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,b_=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,x_=`float getShadowMask() {
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
}`,__=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,S_=`#ifdef USE_SKINNING
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
#endif`,w_=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,M_=`#ifdef USE_SKINNING
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
#endif`,E_=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,T_=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,A_=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,C_=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,R_=`#ifdef USE_TRANSMISSION
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
#endif`,P_=`#ifdef USE_TRANSMISSION
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
#endif`,L_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,I_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,k_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,D_=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,N_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,O_=`uniform sampler2D t2D;
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
}`,U_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,F_=`uniform float backgroundBlurriness;
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
}`,B_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,z_=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,H_=`#include <common>
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
}`,V_=`#if DEPTH_PACKING == 3200
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
}`,G_=`#define DISTANCE
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
}`,W_=`#define DISTANCE
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
}`,$_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,X_=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,q_=`uniform float scale;
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
}`,Y_=`uniform vec3 diffuse;
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
}`,j_=`#include <common>
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
}`,J_=`uniform vec3 diffuse;
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
}`,K_=`#define LAMBERT
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
}`,Z_=`#define LAMBERT
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
}`,Q_=`#define MATCAP
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
}`,eS=`#define MATCAP
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
}`,tS=`#define NORMAL
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
}`,nS=`#define NORMAL
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
}`,iS=`#define PHONG
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
}`,sS=`#define PHONG
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
}`,rS=`#define STANDARD
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
}`,aS=`#define STANDARD
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
}`,oS=`#define TOON
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
}`,lS=`#define TOON
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
}`,cS=`uniform float size;
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
}`,hS=`uniform vec3 diffuse;
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
}`,uS=`#include <common>
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
}`,dS=`uniform vec3 color;
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
}`,fS=`uniform float rotation;
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
}`,pS=`uniform vec3 diffuse;
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
}`,qe={alphahash_fragment:Ob,alphahash_pars_fragment:Ub,alphamap_fragment:Fb,alphamap_pars_fragment:Bb,alphatest_fragment:zb,alphatest_pars_fragment:Hb,aomap_fragment:Vb,aomap_pars_fragment:Gb,batching_pars_vertex:Wb,batching_vertex:$b,begin_vertex:Xb,beginnormal_vertex:qb,bsdfs:Yb,iridescence_fragment:jb,bumpmap_pars_fragment:Jb,clipping_planes_fragment:Kb,clipping_planes_pars_fragment:Zb,clipping_planes_pars_vertex:Qb,clipping_planes_vertex:ex,color_fragment:tx,color_pars_fragment:nx,color_pars_vertex:ix,color_vertex:sx,common:rx,defaultnormal_vertex:ax,displacementmap_pars_vertex:ox,displacementmap_vertex:lx,emissivemap_fragment:cx,emissivemap_pars_fragment:hx,colorspace_fragment:ux,colorspace_pars_fragment:dx,envmap_fragment:fx,envmap_common_pars_fragment:px,envmap_pars_fragment:mx,envmap_pars_vertex:gx,envmap_physical_pars_fragment:Ax,envmap_vertex:yx,fog_vertex:vx,fog_pars_vertex:bx,fog_fragment:xx,fog_pars_fragment:_x,gradientmap_pars_fragment:Sx,lightmap_pars_fragment:wx,lights_lambert_fragment:Mx,lights_lambert_pars_fragment:Ex,lights_pars_begin:Tx,lights_toon_fragment:Cx,lights_toon_pars_fragment:Rx,lights_phong_fragment:Px,lights_phong_pars_fragment:Lx,lights_physical_fragment:Ix,lights_physical_pars_fragment:kx,lights_fragment_begin:Dx,lights_fragment_maps:Nx,lights_fragment_end:Ox,lightprobes_pars_fragment:Ux,logdepthbuf_fragment:Fx,logdepthbuf_pars_fragment:Bx,logdepthbuf_pars_vertex:zx,logdepthbuf_vertex:Hx,map_fragment:Vx,map_pars_fragment:Gx,map_particle_fragment:Wx,map_particle_pars_fragment:$x,metalnessmap_fragment:Xx,metalnessmap_pars_fragment:qx,morphinstance_vertex:Yx,morphcolor_vertex:jx,morphnormal_vertex:Jx,morphtarget_pars_vertex:Kx,morphtarget_vertex:Zx,normal_fragment_begin:Qx,normal_fragment_maps:e_,normal_pars_fragment:t_,normal_pars_vertex:n_,normal_vertex:i_,normalmap_pars_fragment:s_,clearcoat_normal_fragment_begin:r_,clearcoat_normal_fragment_maps:a_,clearcoat_pars_fragment:o_,iridescence_pars_fragment:l_,opaque_fragment:c_,packing:h_,premultiplied_alpha_fragment:u_,project_vertex:d_,dithering_fragment:f_,dithering_pars_fragment:p_,roughnessmap_fragment:m_,roughnessmap_pars_fragment:g_,shadowmap_pars_fragment:y_,shadowmap_pars_vertex:v_,shadowmap_vertex:b_,shadowmask_pars_fragment:x_,skinbase_vertex:__,skinning_pars_vertex:S_,skinning_vertex:w_,skinnormal_vertex:M_,specularmap_fragment:E_,specularmap_pars_fragment:T_,tonemapping_fragment:A_,tonemapping_pars_fragment:C_,transmission_fragment:R_,transmission_pars_fragment:P_,uv_pars_fragment:L_,uv_pars_vertex:I_,uv_vertex:k_,worldpos_vertex:D_,background_vert:N_,background_frag:O_,backgroundCube_vert:U_,backgroundCube_frag:F_,cube_vert:B_,cube_frag:z_,depth_vert:H_,depth_frag:V_,distance_vert:G_,distance_frag:W_,equirect_vert:$_,equirect_frag:X_,linedashed_vert:q_,linedashed_frag:Y_,meshbasic_vert:j_,meshbasic_frag:J_,meshlambert_vert:K_,meshlambert_frag:Z_,meshmatcap_vert:Q_,meshmatcap_frag:eS,meshnormal_vert:tS,meshnormal_frag:nS,meshphong_vert:iS,meshphong_frag:sS,meshphysical_vert:rS,meshphysical_frag:aS,meshtoon_vert:oS,meshtoon_frag:lS,points_vert:cS,points_frag:hS,shadow_vert:uS,shadow_frag:dS,sprite_vert:fS,sprite_frag:pS},xe={common:{diffuse:{value:new Xe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Be},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Be}},envmap:{envMap:{value:null},envMapRotation:{value:new Be},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Be}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Be}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Be},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Be},normalScale:{value:new Ie(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Be},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Be}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Be}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Be}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Xe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new Xe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0},uvTransform:{value:new Be}},sprite:{diffuse:{value:new Xe(16777215)},opacity:{value:1},center:{value:new Ie(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Be},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0}}},vi={basic:{uniforms:cn([xe.common,xe.specularmap,xe.envmap,xe.aomap,xe.lightmap,xe.fog]),vertexShader:qe.meshbasic_vert,fragmentShader:qe.meshbasic_frag},lambert:{uniforms:cn([xe.common,xe.specularmap,xe.envmap,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.fog,xe.lights,{emissive:{value:new Xe(0)},envMapIntensity:{value:1}}]),vertexShader:qe.meshlambert_vert,fragmentShader:qe.meshlambert_frag},phong:{uniforms:cn([xe.common,xe.specularmap,xe.envmap,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.fog,xe.lights,{emissive:{value:new Xe(0)},specular:{value:new Xe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:qe.meshphong_vert,fragmentShader:qe.meshphong_frag},standard:{uniforms:cn([xe.common,xe.envmap,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.roughnessmap,xe.metalnessmap,xe.fog,xe.lights,{emissive:{value:new Xe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:qe.meshphysical_vert,fragmentShader:qe.meshphysical_frag},toon:{uniforms:cn([xe.common,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.gradientmap,xe.fog,xe.lights,{emissive:{value:new Xe(0)}}]),vertexShader:qe.meshtoon_vert,fragmentShader:qe.meshtoon_frag},matcap:{uniforms:cn([xe.common,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.fog,{matcap:{value:null}}]),vertexShader:qe.meshmatcap_vert,fragmentShader:qe.meshmatcap_frag},points:{uniforms:cn([xe.points,xe.fog]),vertexShader:qe.points_vert,fragmentShader:qe.points_frag},dashed:{uniforms:cn([xe.common,xe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:qe.linedashed_vert,fragmentShader:qe.linedashed_frag},depth:{uniforms:cn([xe.common,xe.displacementmap]),vertexShader:qe.depth_vert,fragmentShader:qe.depth_frag},normal:{uniforms:cn([xe.common,xe.bumpmap,xe.normalmap,xe.displacementmap,{opacity:{value:1}}]),vertexShader:qe.meshnormal_vert,fragmentShader:qe.meshnormal_frag},sprite:{uniforms:cn([xe.sprite,xe.fog]),vertexShader:qe.sprite_vert,fragmentShader:qe.sprite_frag},background:{uniforms:{uvTransform:{value:new Be},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:qe.background_vert,fragmentShader:qe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Be}},vertexShader:qe.backgroundCube_vert,fragmentShader:qe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:qe.cube_vert,fragmentShader:qe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:qe.equirect_vert,fragmentShader:qe.equirect_frag},distance:{uniforms:cn([xe.common,xe.displacementmap,{referencePosition:{value:new O},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:qe.distance_vert,fragmentShader:qe.distance_frag},shadow:{uniforms:cn([xe.lights,xe.fog,{color:{value:new Xe(0)},opacity:{value:1}}]),vertexShader:qe.shadow_vert,fragmentShader:qe.shadow_frag}};vi.physical={uniforms:cn([vi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Be},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Be},clearcoatNormalScale:{value:new Ie(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Be},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new Be},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Be},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Be},sheen:{value:0},sheenColor:{value:new Xe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Be},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Be},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Be},transmissionSamplerSize:{value:new Ie},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Be},attenuationDistance:{value:0},attenuationColor:{value:new Xe(0)},specularColor:{value:new Xe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Be},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Be},anisotropyVector:{value:new Ie},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Be}}]),vertexShader:qe.meshphysical_vert,fragmentShader:qe.meshphysical_frag};var Kc={r:0,b:0,g:0},mS=new ft,wg=new Be;wg.set(-1,0,0,0,1,0,0,0,1);function gS(n,e,t,i,s,r){let a=new Xe(0),o=s===!0?0:1,l,c,h=null,u=0,d=null;function f(v){let _=v.isScene===!0?v.background:null;if(_&&_.isTexture){let b=v.backgroundBlurriness>0;_=e.get(_,b)}return _}function p(v){let _=!1,b=f(v);b===null?m(a,o):b&&b.isColor&&(m(b,1),_=!0);let M=n.xr.getEnvironmentBlendMode();M==="additive"?t.buffers.color.setClear(0,0,0,1,r):M==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(n.autoClear||_)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function y(v,_){let b=f(_);b&&b.isCubeTexture?(c===void 0&&(c=new Zt(new Nr(1,1,1),new Cn({name:"BackgroundCubeMaterial",uniforms:Xs(vi.backgroundCube.uniforms),vertexShader:vi.backgroundCube.vertexShader,fragmentShader:vi.backgroundCube.fragmentShader,side:gn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(M,T,x){this.matrixWorld.copyPosition(x.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=b,c.material.uniforms.backgroundBlurriness.value=_.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(mS.makeRotationFromEuler(_.backgroundRotation)).transpose(),b.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(wg),c.material.toneMapped=je.getTransfer(b.colorSpace)!==ct,(h!==b||u!==b.version||d!==n.toneMapping)&&(c.material.needsUpdate=!0,h=b,u=b.version,d=n.toneMapping),c.layers.enableAll(),v.unshift(c,c.geometry,c.material,0,0,null)):b&&b.isTexture&&(l===void 0&&(l=new Zt(new Vs(2,2),new Cn({name:"BackgroundMaterial",uniforms:Xs(vi.background.uniforms),vertexShader:vi.background.vertexShader,fragmentShader:vi.background.fragmentShader,side:os,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=b,l.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,l.material.toneMapped=je.getTransfer(b.colorSpace)!==ct,b.matrixAutoUpdate===!0&&b.updateMatrix(),l.material.uniforms.uvTransform.value.copy(b.matrix),(h!==b||u!==b.version||d!==n.toneMapping)&&(l.material.needsUpdate=!0,h=b,u=b.version,d=n.toneMapping),l.layers.enableAll(),v.unshift(l,l.geometry,l.material,0,0,null))}function m(v,_){v.getRGB(Kc,Cd(n)),t.buffers.color.setClear(Kc.r,Kc.g,Kc.b,_,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(v,_=1){a.set(v),o=_,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(v){o=v,m(a,o)},render:p,addToRenderList:y,dispose:g}}function yS(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},s=d(null),r=s,a=!1;function o(D,H,j,L,G){let V=!1,W=u(D,L,j,H);r!==W&&(r=W,c(r.object)),V=f(D,L,j,G),V&&p(D,L,j,G),G!==null&&e.update(G,n.ELEMENT_ARRAY_BUFFER),(V||a)&&(a=!1,b(D,H,j,L),G!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(G).buffer))}function l(){return n.createVertexArray()}function c(D){return n.bindVertexArray(D)}function h(D){return n.deleteVertexArray(D)}function u(D,H,j,L){let G=L.wireframe===!0,V=i[H.id];V===void 0&&(V={},i[H.id]=V);let W=D.isInstancedMesh===!0?D.id:0,te=V[W];te===void 0&&(te={},V[W]=te);let Y=te[j.id];Y===void 0&&(Y={},te[j.id]=Y);let q=Y[G];return q===void 0&&(q=d(l()),Y[G]=q),q}function d(D){let H=[],j=[],L=[];for(let G=0;G<t;G++)H[G]=0,j[G]=0,L[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:H,enabledAttributes:j,attributeDivisors:L,object:D,attributes:{},index:null}}function f(D,H,j,L){let G=r.attributes,V=H.attributes,W=0,te=j.getAttributes();for(let Y in te)if(te[Y].location>=0){let ne=G[Y],ye=V[Y];if(ye===void 0&&(Y==="instanceMatrix"&&D.instanceMatrix&&(ye=D.instanceMatrix),Y==="instanceColor"&&D.instanceColor&&(ye=D.instanceColor)),ne===void 0||ne.attribute!==ye||ye&&ne.data!==ye.data)return!0;W++}return r.attributesNum!==W||r.index!==L}function p(D,H,j,L){let G={},V=H.attributes,W=0,te=j.getAttributes();for(let Y in te)if(te[Y].location>=0){let ne=V[Y];ne===void 0&&(Y==="instanceMatrix"&&D.instanceMatrix&&(ne=D.instanceMatrix),Y==="instanceColor"&&D.instanceColor&&(ne=D.instanceColor));let ye={};ye.attribute=ne,ne&&ne.data&&(ye.data=ne.data),G[Y]=ye,W++}r.attributes=G,r.attributesNum=W,r.index=L}function y(){let D=r.newAttributes;for(let H=0,j=D.length;H<j;H++)D[H]=0}function m(D){g(D,0)}function g(D,H){let j=r.newAttributes,L=r.enabledAttributes,G=r.attributeDivisors;j[D]=1,L[D]===0&&(n.enableVertexAttribArray(D),L[D]=1),G[D]!==H&&(n.vertexAttribDivisor(D,H),G[D]=H)}function v(){let D=r.newAttributes,H=r.enabledAttributes;for(let j=0,L=H.length;j<L;j++)H[j]!==D[j]&&(n.disableVertexAttribArray(j),H[j]=0)}function _(D,H,j,L,G,V,W){W===!0?n.vertexAttribIPointer(D,H,j,G,V):n.vertexAttribPointer(D,H,j,L,G,V)}function b(D,H,j,L){y();let G=L.attributes,V=j.getAttributes(),W=H.defaultAttributeValues;for(let te in V){let Y=V[te];if(Y.location>=0){let q=G[te];if(q===void 0&&(te==="instanceMatrix"&&D.instanceMatrix&&(q=D.instanceMatrix),te==="instanceColor"&&D.instanceColor&&(q=D.instanceColor)),q!==void 0){let ne=q.normalized,ye=q.itemSize,ke=e.get(q);if(ke===void 0)continue;let $=ke.buffer,oe=ke.type,ve=ke.bytesPerElement,Ce=oe===n.INT||oe===n.UNSIGNED_INT||q.gpuType===pc;if(q.isInterleavedBufferAttribute){let me=q.data,Fe=me.isInterleavedBuffer===!0?me.stride:me.itemSize,Ye=q.offset;if(me.isInstancedInterleavedBuffer||me.isInstancedBufferAttribute){for(let Se=0;Se<Y.locationSize;Se++)g(Y.location+Se,me.meshPerAttribute);D.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=me.meshPerAttribute*me.count)}else for(let Se=0;Se<Y.locationSize;Se++)m(Y.location+Se);n.bindBuffer(n.ARRAY_BUFFER,$);for(let Se=0;Se<Y.locationSize;Se++)_(Y.location+Se,ye/Y.locationSize,oe,ne,Fe*ve,(Ye+ye/Y.locationSize*Se)*ve,Ce)}else{if(q.isInstancedBufferAttribute){for(let me=0;me<Y.locationSize;me++)g(Y.location+me,q.meshPerAttribute);D.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=q.meshPerAttribute*q.count)}else for(let me=0;me<Y.locationSize;me++)m(Y.location+me);n.bindBuffer(n.ARRAY_BUFFER,$);for(let me=0;me<Y.locationSize;me++)_(Y.location+me,ye/Y.locationSize,oe,ne,ye*ve,ye/Y.locationSize*me*ve,Ce)}}else if(W!==void 0){let ne=W[te];if(ne!==void 0)switch(ne.length){case 2:n.vertexAttrib2fv(Y.location,ne);break;case 3:n.vertexAttrib3fv(Y.location,ne);break;case 4:n.vertexAttrib4fv(Y.location,ne);break;default:n.vertexAttrib1fv(Y.location,ne)}}}}v()}function M(){k();for(let D in i){let H=i[D];for(let j in H){let L=H[j];for(let G in L){let V=L[G];for(let W in V)h(V[W].object),delete V[W];delete L[G]}}delete i[D]}}function T(D){if(i[D.id]===void 0)return;let H=i[D.id];for(let j in H){let L=H[j];for(let G in L){let V=L[G];for(let W in V)h(V[W].object),delete V[W];delete L[G]}}delete i[D.id]}function x(D){for(let H in i){let j=i[H];for(let L in j){let G=j[L];if(G[D.id]===void 0)continue;let V=G[D.id];for(let W in V)h(V[W].object),delete V[W];delete G[D.id]}}}function A(D){for(let H in i){let j=i[H],L=D.isInstancedMesh===!0?D.id:0,G=j[L];if(G!==void 0){for(let V in G){let W=G[V];for(let te in W)h(W[te].object),delete W[te];delete G[V]}delete j[L],Object.keys(j).length===0&&delete i[H]}}}function k(){R(),a=!0,r!==s&&(r=s,c(r.object))}function R(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:k,resetDefaultState:R,dispose:M,releaseStatesOfGeometry:T,releaseStatesOfObject:A,releaseStatesOfProgram:x,initAttributes:y,enableAttribute:m,disableUnusedAttributes:v}}function vS(n,e,t){let i;function s(l){i=l}function r(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function a(l,c,h){h!==0&&(n.drawArraysInstanced(i,l,c,h),t.update(c,i,h))}function o(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let d=0;for(let f=0;f<h;f++)d+=c[f];t.update(d,i,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function bS(n,e,t,i){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){let x=e.get("EXT_texture_filter_anisotropic");s=n.getParameter(x.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(x){return!(x!==Dn&&i.convert(x)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(x){let A=x===ni&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(x!==In&&x!==kn&&!A&&i.convert(x)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE))}function l(x){if(x==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";x="mediump"}return x==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(De("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),d=t.logarithmicDepthBuffer===!0&&u===!1;t.reversedDepthBuffer===!0&&u===!1&&De("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer."),t.logarithmicDepthBuffer===!0&&u===!0&&De("WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.");let f=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),p=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=n.getParameter(n.MAX_TEXTURE_SIZE),m=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),g=n.getParameter(n.MAX_VERTEX_ATTRIBS),v=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),_=n.getParameter(n.MAX_VARYING_VECTORS),b=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),M=n.getParameter(n.MAX_SAMPLES),T=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:p,maxTextureSize:y,maxCubemapSize:m,maxAttributes:g,maxVertexUniforms:v,maxVaryings:_,maxFragmentUniforms:b,maxSamples:M,samples:T}}function xS(n){let e=this,t=null,i=0,s=!1,r=!1,a=new Tn,o=new Be,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){let f=u.length!==0||d||i!==0||s;return s=d,i=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){t=h(u,d,0)},this.setState=function(u,d,f){let p=u.clippingPlanes,y=u.clipIntersection,m=u.clipShadows,g=n.get(u);if(!s||p===null||p.length===0||r&&!m)r?h(null):c();else{let v=r?0:i,_=v*4,b=g.clippingState||null;l.value=b,b=h(p,d,_,f);for(let M=0;M!==_;++M)b[M]=t[M];g.clippingState=b,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=v}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function h(u,d,f,p){let y=u!==null?u.length:0,m=null;if(y!==0){if(m=l.value,p!==!0||m===null){let g=f+y*4,v=d.matrixWorldInverse;o.getNormalMatrix(v),(m===null||m.length<g)&&(m=new Float32Array(g));for(let _=0,b=f;_!==y;++_,b+=4)a.copy(u[_]).applyMatrix4(v,o),a.normal.toArray(m,b),m[b+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=y,e.numIntersection=0,m}}var ao=class extends mn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},s=[i,i,i,i,i,i];this.texture=new Va(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Nr(5,5,5),r=new Cn({name:"CubemapFromEquirect",uniforms:Xs(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:gn,blending:Ii});r.uniforms.tEquirect.value=t;let a=new Zt(s,r),o=t.minFilter;return t.minFilter===ki&&(t.minFilter=pn),new Ur(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,i=!0,s=!0){let r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,i,s);e.setRenderTarget(r)}},tg=256,_S=3,SS=20,Mg=256,Eg=16,wS=3,MS=new O,ES=new Xe,Qc=class n{constructor(e){this._renderer=e,this._cubeSize=0,this._sourceTarget=null,this._cubeCamera=new Ur(1,10,null),this._boxMesh=new Zt(new Nr(5,5,5),null),this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null,this._integrationMaterial=null}fromScene(e,t=0,i=.1,s=100,r={}){let{size:a=256,position:o=MS}=r,l=this._renderer;this._setSize(a);let c=this._allocateTarget(),h=this._getSourceTarget(!0);t>0&&(h.texture.mipmapsAutoUpdate=!1);let u=l.autoClear,d=l.autoClearColor,f=l.autoClearDepth,p=l.autoClearStencil,y=e.background;l.autoClear=!0,l.autoClearColor=!0,l.autoClearDepth=!0,l.autoClearStencil=!0,y===null&&(e.background=l.getClearColor(ES));let m=new Ur(i,s,h);return m.position.copy(o),m.update(l,e),l.autoClear=u,l.autoClearColor=d,l.autoClearDepth=f,l.autoClearStencil=p,e.background=y,t>0&&(h.texture.mipmapsAutoUpdate=!0,this._blur(c,t)),this._applyPMREM(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=sg(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ig(),this._compileMaterial(this._equirectMaterial))}dispose(){this._sourceTarget!==null&&this._sourceTarget.dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._integrationMaterial!==null&&this._integrationMaterial.dispose(),this._boxMesh.geometry.dispose()}static lodToRoughness(e,t){return t>0?1-Math.sqrt(1-e/t):0}_setSize(e){this._cubeSize=Math.max(tg,Md(e))}_fromTexture(e,t){e.mapping===Ws||e.mapping===Hr?this._setSize(e.image.length===0?tg:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4);let i=t||this._allocateTarget();return this._textureToCubemap(e),this._applyPMREM(i),i}_allocateTarget(){let e=this._cubeSize,t=ng(e,!1,!1),i=Math.log2(e)-_S;for(let s=0;s<=i;s++)t.texture.mipmaps.push({width:e>>s,height:e>>s});return t.texture.name="PMREM",t.texture.isPMREMTexture=!0,t}_getSourceTarget(e=!1){let t=this._cubeSize,i=this._sourceTarget;return(i===null||i.width!==t||e&&i.depthBuffer===!1)&&(i!==null&&i.dispose(),this._sourceTarget=ng(t,!0,e)),this._sourceTarget}_compileMaterial(e){this._boxMesh.material=e,this._renderer.compile(this._boxMesh,this._cubeCamera.children[0])}_renderCube(e,t,i){let s=this._boxMesh,r=this._cubeCamera;s.material=i,r.renderTarget=e,r.activeMipmapLevel=t;let a=e.width>>t;e.viewport.set(0,0,a,a),r.update(this._renderer,s),e.viewport.set(0,0,e.width,e.height)}_textureToCubemap(e){let t;e.mapping===Ws||e.mapping===Hr?(this._cubemapMaterial===null&&(this._cubemapMaterial=sg()),t=this._cubemapMaterial,t.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):(this._equirectMaterial===null&&(this._equirectMaterial=ig()),t=this._equirectMaterial),t.uniforms.envMap.value=e,this._renderCube(this._getSourceTarget(),0,t)}_applyPMREM(e){this._ggxMaterial===null&&(this._ggxMaterial=TS(),this._integrationMaterial=AS());let t=this._cubeSize,i=e.texture.mipmaps.length-1,s=this._ggxMaterial.uniforms;s.envMap.value=this._sourceTarget.texture;let r=this._integrationMaterial.uniforms;r.envMap.value=this._sourceTarget.texture,r.sourceLod.value=Math.log2(t/Eg);for(let a=0;a<=i;a++){let o=n.lodToRoughness(a,i);if(a>i-wS)r.roughness.value=o,this._renderCube(e,a,this._integrationMaterial);else{let l=o>0?Math.log2(t)+.5*Math.log2(6/(Mg*Math.pow(o,4)))+.5:0;s.roughness.value=o,s.lodBias.value=l,this._renderCube(e,a,this._ggxMaterial)}}}_blur(e,t){this._blurMaterial===null&&(this._blurMaterial=CS());let i=this._blurMaterial,s=i.uniforms,r=this._sourceTarget;s.sigma.value=Math.min(t,Math.PI)/Math.SQRT2,s.envMap.value=r.texture,this._renderCube(e,0,i),s.envMap.value=e.texture,this._renderCube(r,0,i)}};function ng(n,e,t){return new ao(n,{minFilter:ki,generateMipmaps:e,type:ni,colorSpace:Us,depthBuffer:t})}function oo(n,e,t){return new Cn({name:n,uniforms:e,vertexShader:qe.cube_vert,fragmentShader:t,side:gn,blending:Ii,depthTest:!1,depthWrite:!1})}function TS(){return oo("PMREMGGXConvolution",{envMap:{value:null},roughness:{value:0},lodBias:{value:0}},`

		#define GGX_SAMPLES ${Mg}u

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
	`)}function AS(){return oo("PMREMGGXIntegration",{envMap:{value:null},roughness:{value:0},sourceLod:{value:0},sourceSize:{value:Eg}},`

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
	`)}function CS(){return oo("PMREMSphericalGaussianBlur",{envMap:{value:null},sigma:{value:0}},`

		#define SAMPLES ${SS}
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
	`)}function ig(){return oo("PMREMEquirectangularToCubemap",{envMap:{value:null}},`

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
	`)}function sg(){return oo("PMREMCubemapToCubemap",{envMap:{value:null},flipEnvMap:{value:-1}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`)}function RS(n){let e=new WeakMap,t=new WeakMap,i=null;function s(d,f=!1){return d==null?null:f?a(d):r(d)}function r(d){if(d&&d.isTexture){let f=d.mapping;if(f===uc||f===dc)if(e.has(d)){let p=e.get(d).texture;return o(p,d.mapping)}else{let p=d.image;if(p&&p.height>0){let y=new ao(p.height);return y.fromEquirectangularTexture(n,d),e.set(d,y),d.addEventListener("dispose",c),o(y.texture,d.mapping)}else return null}}return d}function a(d){if(d&&d.isTexture&&d.isPMREMTexture!==!0){let f=d.mapping,p=f===uc||f===dc,y=f===Ws||f===Hr;if(p||y){let m=t.get(d),g=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==g)return i===null&&(i=new Qc(n)),m=p?i.fromEquirectangular(d,m):i.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{let v=d.image;return p&&v&&v.height>0||y&&v&&l(v)?(i===null&&(i=new Qc(n)),m=p?i.fromEquirectangular(d):i.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",h),m.texture):null}}}return d}function o(d,f){return f===uc?d.mapping=Ws:f===dc&&(d.mapping=Hr),d}function l(d){let f=0,p=6;for(let y=0;y<p;y++)d[y]!==void 0&&f++;return f===p}function c(d){let f=d.target;f.removeEventListener("dispose",c);let p=e.get(f);p!==void 0&&(e.delete(f),p.dispose())}function h(d){let f=d.target;f.removeEventListener("dispose",h);let p=t.get(f);p!==void 0&&(t.delete(f),p.dispose())}function u(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:u}}function PS(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let s=n.getExtension(i);return e[i]=s,s}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let s=t(i);return s===null&&Pa("WebGLRenderer: "+i+" extension not supported."),s}}}function LS(n,e,t,i){let s={},r=new WeakMap,a=new FinalizationRegistry(p=>delete s[p]);function o(p){l(p.target)}function l(p){p.index!==null&&e.remove(p.index);for(let m in p.attributes)e.remove(p.attributes[m]);p.removeEventListener("dispose",o),delete s[p.id],a.unregister(p);let y=r.get(p);y&&(e.remove(y),r.delete(p)),i.releaseStatesOfGeometry(p),p.isInstancedBufferGeometry===!0&&delete p._maxInstanceCount,t.memory.geometries--}function c(p,y){return s[y.id]!==void 0||(y.addEventListener("dispose",o),s[y.id]=new WeakRef(y),a.register(y,y.id,y),t.memory.geometries++),y}function h(p){let y=p.attributes;for(let m in y)e.update(y[m],n.ARRAY_BUFFER)}function u(p){let y=p.index,m=p.attributes.position,g=0;if(m===void 0)return;let v=y!==null?y.array.length:m.array.length/3-1,_=m.count>=65535?Ha:za,b=new _(Math.ceil(v/3)*6,1),M=b.array;if(y!==null){let x=y.array;g=y.version;for(let A=0,k=0;A<v;A+=3){let R=x[A+0],D=x[A+1],H=x[A+2];M[k++]=R,M[k++]=D,M[k++]=D,M[k++]=H,M[k++]=H,M[k++]=R}}else{g=m.version;for(let x=0,A=0;x<v;x+=3){let k=x+0,R=x+1,D=x+2;M[A++]=k,M[A++]=R,M[A++]=R,M[A++]=D,M[A++]=D,M[A++]=k}}b.version=g;let T=r.get(p);T&&e.remove(T),r.set(p,b)}function d(p){let y=r.get(p);if(y){let m=p.index;m!==null&&y.version<m.version&&u(p)}else u(p);return r.get(p)}function f(){for(let p in s){let y=s[p].deref();y!==void 0&&l(y)}}return{get:c,update:h,getWireframeAttribute:d,dispose:f}}function IS(n,e,t){let i;function s(u){i=u}let r,a;function o(u){r=u.type,a=u.bytesPerElement}function l(u,d){n.drawElements(i,d,r,u*a),t.update(d,i,1)}function c(u,d,f){f!==0&&(n.drawElementsInstanced(i,d,r,u*a,f),t.update(d,i,f))}function h(u,d,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,d,0,r,u,0,f);let y=0;for(let m=0;m<f;m++)y+=d[m];t.update(y,i,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function kS(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,a,o){switch(t.calls++,a){case n.TRIANGLES:t.triangles+=o*(r/3);break;case n.LINES:t.lines+=o*(r/2);break;case n.LINE_STRIP:t.lines+=o*(r-1);break;case n.LINE_LOOP:t.lines+=o*r;break;case n.POINTS:t.points+=o*r;break;default:Ue("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:i}}function DS(n,e,t){let i=new WeakMap,s=new ht;function r(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0,d=i.get(o);if(d===void 0||d.count!==u){let k=function(){x.dispose(),i.delete(o),o.removeEventListener("dispose",k)};d!==void 0&&d.texture.dispose();let f=o.morphAttributes.position!==void 0,p=o.morphAttributes.normal!==void 0,y=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],g=o.morphAttributes.normal||[],v=o.morphAttributes.color||[],_=0;f===!0&&(_=1),p===!0&&(_=2),y===!0&&(_=3);let b=o.attributes.position.count*_,M=1;b>e.maxTextureSize&&(M=Math.ceil(b/e.maxTextureSize),b=e.maxTextureSize);let T=new Float32Array(b*M*4*u),x=new Fa(T,b,M,u);x.type=kn,x.needsUpdate=!0;let A=_*4;for(let R=0;R<u;R++){let D=m[R],H=g[R],j=v[R],L=b*M*4*R;for(let G=0;G<D.count;G++){let V=G*A;f===!0&&(s.fromBufferAttribute(D,G),T[L+V+0]=s.x,T[L+V+1]=s.y,T[L+V+2]=s.z,T[L+V+3]=0),p===!0&&(s.fromBufferAttribute(H,G),T[L+V+4]=s.x,T[L+V+5]=s.y,T[L+V+6]=s.z,T[L+V+7]=0),y===!0&&(s.fromBufferAttribute(j,G),T[L+V+8]=s.x,T[L+V+9]=s.y,T[L+V+10]=s.z,T[L+V+11]=j.itemSize===4?s.w:1)}}d={count:u,texture:x,size:new Ie(b,M)},i.set(o,d),o.addEventListener("dispose",k)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",a.morphTexture,t);else{let f=0;for(let y=0;y<c.length;y++)f+=c[y];let p=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(n,"morphTargetBaseInfluence",p),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",d.size)}return{update:r}}function NS(n,e,t,i,s){let r=new WeakMap;function a(c){let h=s.render.frame,u=c.geometry,d=e.get(c,u);if(r.get(d)!==h&&(e.update(d),r.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return d}function o(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:a,dispose:o}}var OS={[td]:"LINEAR_TONE_MAPPING",[nd]:"REINHARD_TONE_MAPPING",[id]:"CINEON_TONE_MAPPING",[sd]:"ACES_FILMIC_TONE_MAPPING",[ad]:"AGX_TONE_MAPPING",[od]:"NEUTRAL_TONE_MAPPING",[rd]:"CUSTOM_TONE_MAPPING"};function US(n,e,t,i,s,r){let a=new mn(e,t,{type:n,depthBuffer:s,stencilBuffer:r,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),o=null,l=null,c=null,h=new _t;h.setAttribute("position",new Bt([-1,3,0,-1,-1,0,3,-1,0],3)),h.setAttribute("uv",new Bt([0,2,0,0,2,0],2));let u=new Kl({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),d=new Zt(h,u),f=new Pn(-1,1,1,-1,0,1),p=null,y=null,m=!1,g,v=null,_=[],b=!1;this.setSize=function(M,T){a.setSize(M,T),o!==null&&o.setSize(M,T),l!==null&&l.setSize(M,T);for(let x=0;x<_.length;x++){let A=_[x];A.setSize&&A.setSize(M,T)}},this.setEffects=function(M){_=M,b=_.length>0&&_[0].isRenderPass===!0;let T=a.width,x=a.height;_.length>0&&o===null&&(o=new mn(T,x,{type:ni,depthBuffer:!1,stencilBuffer:!1}),l=new mn(T,x,{type:ni,depthBuffer:!1,stencilBuffer:!1}));let A=s===!0&&_.some(k=>k.needsDepthTexture===!0);A!==(a.depthTexture!==null)&&(A===!0&&c===null&&(c=new Li(T,x),r===!0&&(c.format=Di,c.type=$s)),a.dispose(),a.depthTexture=A?c:null,a.resolveDepthBuffer=A,a.storeMultisampledDepthBuffer=A);for(let k=0;k<_.length;k++){let R=_[k];R.setSize&&R.setSize(T,x),A&&R.needsDepthTexture===!0&&R.setDepthTexture&&R.setDepthTexture(c)}},this.begin=function(M,T){if(m||M.toneMapping===mi&&_.length===0)return!1;if(v=T,T!==null){let x=T.width,A=T.height;(a.width!==x||a.height!==A)&&this.setSize(x,A)}return b===!1&&M.setRenderTarget(a),g=M.toneMapping,M.toneMapping=mi,!0},this.hasRenderPass=function(){return b},this.end=function(M,T){M.toneMapping=g,m=!0;let x=a,A=o;for(let k=0;k<_.length;k++){let R=_[k];R.enabled!==!1&&(R.render(M,A,x,T),R.needsSwap!==!1&&(x=A,A=A===o?l:o))}if(p!==M.outputColorSpace||y!==M.toneMapping){p=M.outputColorSpace,y=M.toneMapping,u.defines={},je.getTransfer(p)===ct&&(u.defines.SRGB_TRANSFER="");let k=OS[y];k&&(u.defines[k]=""),u.needsUpdate=!0}u.uniforms.tDiffuse.value=x.texture,M.setRenderTarget(v),M.render(d,f),v=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),l!==null&&l.dispose(),h.dispose(),u.dispose()}}var Tg=new tn,Ag=new Li(1,1),Cg=new Ga(1),Rg=new Fa,Pg=new Xl,Lg=new Va,rg=[],ag=[],og=new Float32Array(16),lg=new Float32Array(9),cg=new Float32Array(4);function Wr(n,e,t){let i=n[0];if(i<=0||i>0)return n;let s=e*t,r=rg[s];if(r===void 0&&(r=new Float32Array(s),rg[s]=r),e!==0){i.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,n[a].toArray(r,o)}return r}function zt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Ht(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function th(n,e){let t=ag[e];t===void 0&&(t=new Int32Array(e),ag[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function FS(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function BS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;n.uniform2fv(this.addr,e),Ht(t,e)}}function zS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(zt(t,e))return;n.uniform3fv(this.addr,e),Ht(t,e)}}function HS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;n.uniform4fv(this.addr,e),Ht(t,e)}}function VS(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(zt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Ht(t,e)}else{if(zt(t,i))return;cg.set(i),n.uniformMatrix2fv(this.addr,!1,cg),Ht(t,i)}}function GS(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(zt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Ht(t,e)}else{if(zt(t,i))return;lg.set(i),n.uniformMatrix3fv(this.addr,!1,lg),Ht(t,i)}}function WS(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(zt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Ht(t,e)}else{if(zt(t,i))return;og.set(i),n.uniformMatrix4fv(this.addr,!1,og),Ht(t,i)}}function $S(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function XS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;n.uniform2iv(this.addr,e),Ht(t,e)}}function qS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;n.uniform3iv(this.addr,e),Ht(t,e)}}function YS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;n.uniform4iv(this.addr,e),Ht(t,e)}}function jS(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function JS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;n.uniform2uiv(this.addr,e),Ht(t,e)}}function KS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;n.uniform3uiv(this.addr,e),Ht(t,e)}}function ZS(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;n.uniform4uiv(this.addr,e),Ht(t,e)}}function nh(n){return n.version===0&&(n.compareFunction=_d,n.needsUpdate=!0),n}function QS(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_2D_SHADOW?r=nh(Ag):r=Tg,t.setTexture2D(e||r,s)}function ew(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture3D(e||Pg,s)}function tw(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_CUBE_SHADOW?r=nh(Cg):r=Lg,t.setTextureCube(e||r,s)}function nw(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture2DArray(e||Rg,s)}function iw(n){switch(n){case 5126:return FS;case 35664:return BS;case 35665:return zS;case 35666:return HS;case 35674:return VS;case 35675:return GS;case 35676:return WS;case 5124:case 35670:return $S;case 35667:case 35671:return XS;case 35668:case 35672:return qS;case 35669:case 35673:return YS;case 5125:return jS;case 36294:return JS;case 36295:return KS;case 36296:return ZS;case 35678:case 36198:case 36298:case 36306:case 35682:return QS;case 35679:case 36299:case 36307:return ew;case 35680:case 36300:case 36308:case 36293:return tw;case 36289:case 36303:case 36311:case 36292:return nw}}function sw(n,e){n.uniform1fv(this.addr,e)}function rw(n,e){let t=Wr(e,this.size,2);n.uniform2fv(this.addr,t)}function aw(n,e){let t=Wr(e,this.size,3);n.uniform3fv(this.addr,t)}function ow(n,e){let t=Wr(e,this.size,4);n.uniform4fv(this.addr,t)}function lw(n,e){let t=Wr(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function cw(n,e){let t=Wr(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function hw(n,e){let t=Wr(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function uw(n,e){n.uniform1iv(this.addr,e)}function dw(n,e){n.uniform2iv(this.addr,e)}function fw(n,e){n.uniform3iv(this.addr,e)}function pw(n,e){n.uniform4iv(this.addr,e)}function mw(n,e){n.uniform1uiv(this.addr,e)}function gw(n,e){n.uniform2uiv(this.addr,e)}function yw(n,e){n.uniform3uiv(this.addr,e)}function vw(n,e){n.uniform4uiv(this.addr,e)}function bw(n,e,t){let i=this.cache,s=e.length,r=th(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Ht(i,r));let a;this.type===n.SAMPLER_2D_SHADOW?a=nh(Ag):a=Tg;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function xw(n,e,t){let i=this.cache,s=e.length,r=th(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Ht(i,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||Pg,r[a])}function _w(n,e,t){let i=this.cache,s=e.length,r=th(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Ht(i,r));let a;this.type===n.SAMPLER_CUBE_SHADOW?a=nh(Cg):a=Lg;for(let o=0;o!==s;++o)t.setTextureCube(e[o]||a,r[o])}function Sw(n,e,t){let i=this.cache,s=e.length,r=th(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Ht(i,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Rg,r[a])}function ww(n){switch(n){case 5126:return sw;case 35664:return rw;case 35665:return aw;case 35666:return ow;case 35674:return lw;case 35675:return cw;case 35676:return hw;case 5124:case 35670:return uw;case 35667:case 35671:return dw;case 35668:case 35672:return fw;case 35669:case 35673:return pw;case 5125:return mw;case 36294:return gw;case 36295:return yw;case 36296:return vw;case 35678:case 36198:case 36298:case 36306:case 35682:return bw;case 35679:case 36299:case 36307:return xw;case 35680:case 36300:case 36308:case 36293:return _w;case 36289:case 36303:case 36311:case 36292:return Sw}}var Dd=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=iw(t.type)}},Nd=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=ww(t.type)}},Od=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(e,t[o.id],i)}}},Id=/(\w+)(\])?(\[|\.)?/g;function hg(n,e){n.seq.push(e),n.map[e.id]=e}function Mw(n,e,t){let i=n.name,s=i.length;for(Id.lastIndex=0;;){let r=Id.exec(i),a=Id.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){hg(t,c===void 0?new Dd(o,n,e):new Nd(o,n,e));break}else{let u=t.map[o];u===void 0&&(u=new Od(o),hg(t,u)),t=u}}}var Gr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<i;++a){let o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);Mw(o,l,this)}let s=[],r=[];for(let a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,i,s){let r=this.map[t];r!==void 0&&r.setValue(e,i,s)}setOptional(e,t,i){let s=t[i];s!==void 0&&this.setValue(e,i,s)}static upload(e,t,i,s){for(let r=0,a=t.length;r!==a;++r){let o=t[r],l=i[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){let i=[];for(let s=0,r=e.length;s!==r;++s){let a=e[s];a.id in t&&i.push(a)}return i}};function ug(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var Ew=37297,Tw=0;function Aw(n,e){let t=n.split(`
`),i=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){let o=a+1;i.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return i.join(`
`)}var dg=new Be;function Cw(n){je._getMatrix(dg,je.workingColorSpace,n);let e=`mat3( ${dg.elements.map(t=>t.toFixed(4))} )`;switch(je.getTransfer(n)){case Da:return[e,"LinearTransferOETF"];case ct:return[e,"sRGBTransferOETF"];default:return De("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function fg(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),r=(n.getShaderInfoLog(e)||"").trim();if(i&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+Aw(n.getShaderSource(e),o)}else return r}function Rw(n,e){let t=Cw(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( ${t[0]} * value.rgb, value.a ) );`,"}"].join(`
`)}var Pw={[td]:"Linear",[nd]:"Reinhard",[id]:"Cineon",[sd]:"ACESFilmic",[ad]:"AgX",[od]:"Neutral",[rd]:"Custom"};function Lw(n,e){let t=Pw[e];return t===void 0?(De("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Zc=new O;function Iw(){je.getLuminanceCoefficients(Zc);let n=Zc.x.toFixed(4),e=Zc.y.toFixed(4),t=Zc.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function kw(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ro).join(`
`)}function Dw(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function Nw(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let r=n.getActiveAttrib(e,s),a=r.name,o=1;r.type===n.FLOAT_MAT2&&(o=2),r.type===n.FLOAT_MAT3&&(o=3),r.type===n.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:n.getAttribLocation(e,a),locationSize:o}}return t}function ro(n){return n!==""}function pg(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows).replace(/NUM_LIGHT_PROBE_GRIDS/g,e.numLightProbeGrids)}function mg(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var Ow=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ud(n){return n.replace(Ow,Uw)}function Uw(n,e){let t=qe[e];if(t===void 0)throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">");return Ud(t)}var Fw=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function gg(n){return n.replace(Fw,Bw)}function Bw(n,e,t,i){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function yg(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}var zw={[ja]:"SHADOWMAP_TYPE_PCF",[Br]:"SHADOWMAP_TYPE_VSM"};function Hw(n){return zw[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Vw={[Hr]:"ENVMAP_MODE_REFRACTION"};function Gw(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":Vw[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Ww={[ed]:"ENVMAP_BLENDING_MULTIPLY",[Om]:"ENVMAP_BLENDING_MIX",[Um]:"ENVMAP_BLENDING_ADD"};function $w(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":Ww[n.combine]||"ENVMAP_BLENDING_NONE"}function Xw(n,e,t,i){let s=n.getContext(),r=t.defines,a=t.vertexShader,o=t.fragmentShader,l=Hw(t),c=t.envMapPMREM===!0?"ENVMAP_TYPE_PMREM":"ENVMAP_TYPE_CUBE",h=Gw(t),u=$w(t),d=kw(t),f=Dw(r),p=s.createProgram(),y,m,g=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(y=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f].filter(ro).join(`
`),y.length>0&&(y+=`
`),m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f].filter(ro).join(`
`),m.length>0&&(m+=`
`)):(y=[yg(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.diffuseRoughnessMapUv?"#define DIFFUSE_ROUGHNESSMAP_UV "+t.diffuseRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ro).join(`
`),m=[yg(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",t.envMapPMREM?"#define ENVMAP_MAX_LOD "+t.envMapMaxLod+".0":"",t.envMapPMREM?"#define ENVMAP_SIZE "+t.envMapSize+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughness?"#define USE_DIFFUSE_ROUGHNESS":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==mi?"#define TONE_MAPPING":"",t.toneMapping!==mi?qe.tonemapping_pars_fragment:"",t.toneMapping!==mi?Lw("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",qe.colorspace_pars_fragment,Rw("linearToOutputTexel",t.outputColorSpace),Iw(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ro).join(`
`)),a=Ud(a),a=pg(a,t),a=mg(a,t),o=Ud(o),o=pg(o,t),o=mg(o,t),a=gg(a),o=gg(o),t.isRawShaderMaterial!==!0&&(g=`#version 300 es
`,y=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+y,m=["#define varying in",t.glslVersion===io?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===io?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let v=g+y+a,_=g+m+o,b=ug(s,s.VERTEX_SHADER,v),M=ug(s,s.FRAGMENT_SHADER,_);s.attachShader(p,b),s.attachShader(p,M),t.index0AttributeName!==void 0?s.bindAttribLocation(p,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(p,0,"position"),s.linkProgram(p);function T(R){if(n.debug.checkShaderErrors){let D=s.getProgramInfoLog(p)||"",H=s.getShaderInfoLog(b)||"",j=s.getShaderInfoLog(M)||"",L=D.trim(),G=H.trim(),V=j.trim(),W=!0,te=!0;if(s.getProgramParameter(p,s.LINK_STATUS)===!1)if(W=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(s,p,b,M);else{let Y=fg(s,b,"vertex"),q=fg(s,M,"fragment");Ue("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(p,s.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+L+`
`+Y+`
`+q)}else L!==""?De("WebGLProgram: Program Info Log:",L):(G===""||V==="")&&(te=!1);te&&(R.diagnostics={runnable:W,programLog:L,vertexShader:{log:G,prefix:y},fragmentShader:{log:V,prefix:m}})}s.deleteShader(b),s.deleteShader(M),x=new Gr(s,p),A=Nw(s,p)}let x;this.getUniforms=function(){return x===void 0&&T(this),x};let A;this.getAttributes=function(){return A===void 0&&T(this),A};let k=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return k===!1&&(k=s.getProgramParameter(p,Ew)),k},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(p),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Tw++,this.cacheKey=e,this.usedTimes=1,this.program=p,this.vertexShader=b,this.fragmentShader=M,this}var qw=0,Fd=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Bd(e),t.set(e,i)),i}},Bd=class{constructor(e){this.id=qw++,this.code=e,this.usedTimes=0}};function Yw(n){return n===ls||n===to||n===no}function jw(n,e,t,i,s,r){let a=new Ba,o=new Fd,l=new Set,c=[],h=new Map,u=i.logarithmicDepthBuffer,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function f(x){return l.add(x),x===0?"uv":`uv${x}`}function p(x,A,k,R,D,H){let j=R.fog,L=D.geometry,G=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?R.environment:null,V=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,W=e.get(x.envMap||G,V),te=d[x.type],Y=i.precision;x.precision!==null&&(Y=i.getMaxPrecision(x.precision),Y!==x.precision&&De("WebGLProgram.getParameters:",x.precision,"not supported, using",Y,"instead."));let q=L.morphAttributes.position||L.morphAttributes.normal||L.morphAttributes.color,ne=q!==void 0?q.length:0,ye=0;L.morphAttributes.position!==void 0&&(ye=1),L.morphAttributes.normal!==void 0&&(ye=2),L.morphAttributes.color!==void 0&&(ye=3);let ke,$,oe,ve;if(te){let be=vi[te];ke=be.vertexShader,$=be.fragmentShader}else{ke=x.vertexShader,$=x.fragmentShader;let be=o.getVertexShaderStage(x),ut=o.getFragmentShaderStage(x);o.update(x,be,ut),oe=be.id,ve=ut.id}let Ce=n.getRenderTarget(),me=n.state.buffers.depth.getReversed(),Fe=D.isInstancedMesh===!0,Ye=D.isBatchedMesh===!0,Se=!!x.map,rt=!!x.matcap,at=!!W,He=at&&W.isPMREMTexture===!0,Dt=!!x.aoMap,Nt=!!x.lightMap,yn=!!x.bumpMap&&x.wireframe===!1,St=!!x.normalMap,oi=!!x.displacementMap,Gt=!!x.emissiveMap,Nn=!!x.metalnessMap,On=!!x.roughnessMap,Un=x.anisotropy>0,U=x.clearcoat>0,Fn=x.diffuseRoughness>0,vt=x.dispersion>0,bt=x.retroreflectivity>0,ge=x.iridescence>0,Ot=x.sheen>0,Ne=x.transmission>0,ze=Un&&!!x.anisotropyMap,C=U&&!!x.clearcoatMap,S=U&&!!x.clearcoatNormalMap,B=U&&!!x.clearcoatRoughnessMap,ie=Fn&&!!x.diffuseRoughnessMap,ee=ge&&!!x.iridescenceMap,le=ge&&!!x.iridescenceThicknessMap,fe=Ot&&!!x.sheenColorMap,K=Ot&&!!x.sheenRoughnessMap,Z=!!x.specularMap,he=!!x.specularColorMap,P=!!x.specularIntensityMap,Q=Ne&&!!x.transmissionMap,J=Ne&&!!x.thicknessMap,ue=!!x.gradientMap,ae=!!x.alphaMap,ce=x.alphaTest>0,Re=!!x.alphaHash,We=!!x.extensions,se=mi;x.toneMapped&&(Ce===null||Ce.isXRRenderTarget===!0)&&(se=n.toneMapping);let Le=He?W.isCompressedCubeTexture?W.image[0].mipmaps:W.mipmaps:null,Ge={shaderID:te,shaderType:x.type,shaderName:x.name,vertexShader:ke,fragmentShader:$,defines:x.defines,customVertexShaderID:oe,customFragmentShaderID:ve,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:Y,batching:Ye,batchingColor:Ye&&D._colorsTexture!==null,instancing:Fe,instancingColor:Fe&&D.instanceColor!==null,instancingMorph:Fe&&D.morphTexture!==null,outputColorSpace:Ce===null?n.outputColorSpace:Ce.isXRRenderTarget===!0?Ce.texture.colorSpace:je.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Se,matcap:rt,envMap:at,envMapMode:at&&W.mapping,envMapPMREM:He,envMapMaxLod:He?Le.length-1:null,envMapSize:He?Le[0].width:null,aoMap:Dt,lightMap:Nt,bumpMap:yn,normalMap:St,displacementMap:oi,emissiveMap:Gt,normalMapObjectSpace:St&&x.normalMapType===zm,normalMapTangentSpace:St&&x.normalMapType===gd,packedNormalMap:St&&x.normalMapType===gd&&Yw(x.normalMap.format),metalnessMap:Nn,roughnessMap:On,anisotropy:Un,anisotropyMap:ze,clearcoat:U,clearcoatMap:C,clearcoatNormalMap:S,clearcoatRoughnessMap:B,diffuseRoughness:Fn,diffuseRoughnessMap:ie,dispersion:vt,retroreflection:bt,iridescence:ge,iridescenceMap:ee,iridescenceThicknessMap:le,sheen:Ot,sheenColorMap:fe,sheenRoughnessMap:K,specularMap:Z,specularColorMap:he,specularIntensityMap:P,transmission:Ne,transmissionMap:Q,thicknessMap:J,gradientMap:ue,opaque:x.transparent===!1&&x.blending===zr&&x.alphaToCoverage===!1,alphaMap:ae,alphaTest:ce,alphaHash:Re,combine:x.combine,mapUv:Se&&f(x.map.channel),aoMapUv:Dt&&f(x.aoMap.channel),lightMapUv:Nt&&f(x.lightMap.channel),bumpMapUv:yn&&f(x.bumpMap.channel),normalMapUv:St&&f(x.normalMap.channel),displacementMapUv:oi&&f(x.displacementMap.channel),emissiveMapUv:Gt&&f(x.emissiveMap.channel),metalnessMapUv:Nn&&f(x.metalnessMap.channel),roughnessMapUv:On&&f(x.roughnessMap.channel),anisotropyMapUv:ze&&f(x.anisotropyMap.channel),clearcoatMapUv:C&&f(x.clearcoatMap.channel),clearcoatNormalMapUv:S&&f(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:B&&f(x.clearcoatRoughnessMap.channel),diffuseRoughnessMapUv:ie&&f(x.diffuseRoughnessMap.channel),iridescenceMapUv:ee&&f(x.iridescenceMap.channel),iridescenceThicknessMapUv:le&&f(x.iridescenceThicknessMap.channel),sheenColorMapUv:fe&&f(x.sheenColorMap.channel),sheenRoughnessMapUv:K&&f(x.sheenRoughnessMap.channel),specularMapUv:Z&&f(x.specularMap.channel),specularColorMapUv:he&&f(x.specularColorMap.channel),specularIntensityMapUv:P&&f(x.specularIntensityMap.channel),transmissionMapUv:Q&&f(x.transmissionMap.channel),thicknessMapUv:J&&f(x.thicknessMap.channel),alphaMapUv:ae&&f(x.alphaMap.channel),vertexTangents:!!L.attributes.tangent&&(St||Un),vertexNormals:!!L.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!L.attributes.color&&L.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!L.attributes.uv&&(Se||ae),fog:!!j,useFog:x.fog===!0,fogExp2:!!j&&j.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||L.attributes.normal===void 0&&St===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:me,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:L.attributes.position!==void 0,morphTargets:L.morphAttributes.position!==void 0,morphNormals:L.morphAttributes.normal!==void 0,morphColors:L.morphAttributes.color!==void 0,morphTargetsCount:ne,morphTextureStride:ye,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:H.filter(be=>be.texture!==null).length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:x.dithering,shadowMapEnabled:n.shadowMap.enabled&&k.length>0,shadowMapType:n.shadowMap.type,toneMapping:se,decodeVideoTexture:Se&&x.map.isVideoTexture===!0&&je.getTransfer(x.map.colorSpace)===ct,decodeVideoTextureEmissive:Gt&&x.emissiveMap.isVideoTexture===!0&&je.getTransfer(x.emissiveMap.colorSpace)===ct,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Ln,flipSided:x.side===gn,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:We&&x.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(We&&x.extensions.multiDraw===!0||Ye)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return Ge.vertexUv1s=l.has(1),Ge.vertexUv2s=l.has(2),Ge.vertexUv3s=l.has(3),l.clear(),Ge}function y(x){let A=[];if(x.shaderID?A.push(x.shaderID):(A.push(x.customVertexShaderID),A.push(x.customFragmentShaderID)),x.defines!==void 0)for(let k in x.defines)A.push(k),A.push(x.defines[k]);return x.isRawShaderMaterial===!1&&(m(A,x),g(A,x),A.push(n.outputColorSpace)),A.push(x.customProgramCacheKey),A.join()}function m(x,A){x.push(A.precision),x.push(A.outputColorSpace),x.push(A.envMapMode),x.push(A.envMapPMREM),x.push(A.envMapMaxLod),x.push(A.envMapSize),x.push(A.mapUv),x.push(A.alphaMapUv),x.push(A.lightMapUv),x.push(A.aoMapUv),x.push(A.bumpMapUv),x.push(A.normalMapUv),x.push(A.displacementMapUv),x.push(A.emissiveMapUv),x.push(A.metalnessMapUv),x.push(A.roughnessMapUv),x.push(A.anisotropyMapUv),x.push(A.clearcoatMapUv),x.push(A.clearcoatNormalMapUv),x.push(A.clearcoatRoughnessMapUv),x.push(A.diffuseRoughnessMapUv),x.push(A.iridescenceMapUv),x.push(A.iridescenceThicknessMapUv),x.push(A.sheenColorMapUv),x.push(A.sheenRoughnessMapUv),x.push(A.specularMapUv),x.push(A.specularColorMapUv),x.push(A.specularIntensityMapUv),x.push(A.transmissionMapUv),x.push(A.thicknessMapUv),x.push(A.combine),x.push(A.fogExp2),x.push(A.sizeAttenuation),x.push(A.morphTargetsCount),x.push(A.numSunLights),x.push(A.numDirLights),x.push(A.numPointLights),x.push(A.numSpotLights),x.push(A.numSpotLightMaps),x.push(A.numHemiLights),x.push(A.numRectAreaLights),x.push(A.numSunLightShadows),x.push(A.numDirLightShadows),x.push(A.numPointLightShadows),x.push(A.numSpotLightShadows),x.push(A.numSpotLightShadowsWithMaps),x.push(A.numLightProbes),x.push(A.numLightProbeGrids),x.push(A.shadowMapType),x.push(A.toneMapping),x.push(A.numClippingPlanes),x.push(A.numClipIntersection),x.push(A.depthPacking)}function g(x,A){a.disableAll(),A.instancing&&a.enable(0),A.instancingColor&&a.enable(1),A.instancingMorph&&a.enable(2),A.matcap&&a.enable(3),A.envMap&&a.enable(4),A.normalMapObjectSpace&&a.enable(5),A.normalMapTangentSpace&&a.enable(6),A.clearcoat&&a.enable(7),A.iridescence&&a.enable(8),A.alphaTest&&a.enable(9),A.vertexColors&&a.enable(10),A.vertexAlphas&&a.enable(11),A.vertexUv1s&&a.enable(12),A.vertexUv2s&&a.enable(13),A.vertexUv3s&&a.enable(14),A.vertexTangents&&a.enable(15),A.anisotropy&&a.enable(16),A.alphaHash&&a.enable(17),A.batching&&a.enable(18),A.dispersion&&a.enable(19),A.retroreflection&&a.enable(24),A.diffuseRoughness&&a.enable(25),A.batchingColor&&a.enable(20),A.gradientMap&&a.enable(21),A.packedNormalMap&&a.enable(22),A.vertexNormals&&a.enable(23),x.push(a.mask),a.disableAll(),A.fog&&a.enable(0),A.useFog&&a.enable(1),A.flatShading&&a.enable(2),A.logarithmicDepthBuffer&&a.enable(3),A.reversedDepthBuffer&&a.enable(4),A.skinning&&a.enable(5),A.morphTargets&&a.enable(6),A.morphNormals&&a.enable(7),A.morphColors&&a.enable(8),A.premultipliedAlpha&&a.enable(9),A.shadowMapEnabled&&a.enable(10),A.doubleSided&&a.enable(11),A.flipSided&&a.enable(12),A.useDepthPacking&&a.enable(13),A.dithering&&a.enable(14),A.transmission&&a.enable(15),A.sheen&&a.enable(16),A.opaque&&a.enable(17),A.pointsUvs&&a.enable(18),A.decodeVideoTexture&&a.enable(19),A.decodeVideoTextureEmissive&&a.enable(20),A.alphaToCoverage&&a.enable(21),A.numLightProbeGrids>0&&a.enable(22),A.hasPositionAttribute&&a.enable(23),x.push(a.mask)}function v(x){let A=d[x.type],k;if(A){let R=vi[A];k=Zm.clone(R.uniforms)}else k=x.uniforms;return k}function _(x,A){let k=h.get(A);return k!==void 0?++k.usedTimes:(k=new Xw(n,A,x,s),c.push(k),h.set(A,k)),k}function b(x){if(--x.usedTimes===0){let A=c.indexOf(x);c[A]=c[c.length-1],c.pop(),h.delete(x.cacheKey),x.destroy()}}function M(x){o.remove(x)}function T(){o.dispose()}return{getParameters:p,getProgramCacheKey:y,getUniforms:v,acquireProgram:_,releaseProgram:b,releaseShaderCache:M,programs:c,dispose:T}}function Jw(){let n=new WeakMap;function e(a){return n.has(a)}function t(a){let o=n.get(a);return o===void 0&&(o={},n.set(a,o)),o}function i(a){n.delete(a)}function s(a,o,l){n.get(a)[o]=l}function r(){n=new WeakMap}return{has:e,get:t,remove:i,update:s,dispose:r}}function Kw(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function vg(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function bg(){let n=[],e=0,t=[],i=[],s=[];function r(){e=0,t.length=0,i.length=0,s.length=0}function a(d){let f=0;return d.isInstancedMesh&&(f+=2),d.isSkinnedMesh&&(f+=1),f}function o(d,f,p,y,m,g){let v=n[e];return v===void 0?(v={id:d.id,object:d,geometry:f,material:p,materialVariant:a(d),groupOrder:y,renderOrder:d.renderOrder,z:m,group:g},n[e]=v):(v.id=d.id,v.object=d,v.geometry=f,v.material=p,v.materialVariant=a(d),v.groupOrder=y,v.renderOrder=d.renderOrder,v.z=m,v.group=g),e++,v}function l(d,f,p,y,m,g,v){v.reversedDepth===!0&&(m=-m);let _=o(d,f,p,y,m,g);p.transmission>0?i.push(_):p.transparent===!0?s.push(_):t.push(_)}function c(d,f,p,y,m,g){let v=o(d,f,p,y,m,g);p.transmission>0?i.unshift(v):p.transparent===!0?s.unshift(v):t.unshift(v)}function h(d,f){t.length>1&&t.sort(d||Kw),i.length>1&&i.sort(f||vg),s.length>1&&s.sort(f||vg)}function u(){for(let d=e,f=n.length;d<f;d++){let p=n[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:i,transparent:s,init:r,push:l,unshift:c,finish:u,sort:h}}function Zw(){let n=new WeakMap;function e(i,s){let r=n.get(i),a;return r===void 0?(a=new bg,n.set(i,[a])):s>=r.length?(a=new bg,r.push(a)):a=r[s],a}function t(){n=new WeakMap}return{get:e,dispose:t}}function Qw(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new O,color:new Xe};break;case"SpotLight":t={position:new O,direction:new O,color:new Xe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new O,color:new Xe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new O,skyColor:new Xe,groundColor:new Xe};break;case"RectAreaLight":t={color:new Xe,position:new O,halfWidth:new O,halfHeight:new O};break}return n[e.id]=t,t}}}function eM(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ie};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ie};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ie,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var tM=0;function nM(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function iM(n){let e=new Qw,t=eM(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new O);let s=new O,r=new ft,a=new ft;function o(c){let h=0,u=0,d=0;for(let H=0;H<9;H++)i.probe[H].set(0,0,0);let f=0,p=0,y=0,m=0,g=0,v=0,_=0,b=0,M=0,T=0,x=0,A=0,k=0,R=0;c.sort(nM);for(let H=0,j=c.length;H<j;H++){let L=c[H],G=L.color,V=L.intensity,W=L.distance,te=null;if(L.shadow&&L.shadow.map&&(L.shadow.map.texture.format===ls?te=L.shadow.map.texture:te=L.shadow.map.depthTexture||L.shadow.map.texture),L.isAmbientLight)h+=G.r*V,u+=G.g*V,d+=G.b*V;else if(L.isLightProbe){for(let Y=0;Y<9;Y++)i.probe[Y].addScaledVector(L.sh.coefficients[Y],V);R++}else if(L.isSunLight){let Y=e.get(L);if(Y.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){let q=L.shadow,ne=t.get(L);ne.shadowIntensity=q.intensity,ne.shadowBias=q.bias,ne.shadowNormalBias=q.normalBias,ne.shadowRadius=q.radius,ne.shadowMapSize.copy(q.mapSize).multiply(q.getFrameExtents()),i.sunShadow[p]=ne,i.sunShadowMap[p]=te;let ye=q.getViewportCount();for(let ke=0;ke<ye;ke++)i.sunShadowMatrix[y+ke]=q.getMatrix(ke),i.sunShadowCascade[y+ke]=q._cascadeData[ke];y+=ye,p++}i.sun[f]=Y,f++}else if(L.isDirectionalLight){let Y=e.get(L);if(Y.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){let q=L.shadow,ne=t.get(L);ne.shadowIntensity=q.intensity,ne.shadowBias=q.bias,ne.shadowNormalBias=q.normalBias,ne.shadowRadius=q.radius,ne.shadowMapSize=q.mapSize,i.directionalShadow[m]=ne,i.directionalShadowMap[m]=te,i.directionalShadowMatrix[m]=L.shadow.matrix,M++}i.directional[m]=Y,m++}else if(L.isSpotLight){let Y=e.get(L);Y.position.setFromMatrixPosition(L.matrixWorld),Y.color.copy(G).multiplyScalar(V),Y.distance=W,Y.coneCos=Math.cos(L.angle),Y.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),Y.decay=L.decay,i.spot[v]=Y;let q=L.shadow;if(L.map&&(i.spotLightMap[A]=L.map,A++,q.updateMatrices(L),L.castShadow&&k++),i.spotLightMatrix[v]=q.matrix,L.castShadow){let ne=t.get(L);ne.shadowIntensity=q.intensity,ne.shadowBias=q.bias,ne.shadowNormalBias=q.normalBias,ne.shadowRadius=q.radius,ne.shadowMapSize=q.mapSize,i.spotShadow[v]=ne,i.spotShadowMap[v]=te,x++}v++}else if(L.isRectAreaLight){let Y=e.get(L);Y.color.copy(G).multiplyScalar(V),Y.halfWidth.set(L.width*.5,0,0),Y.halfHeight.set(0,L.height*.5,0),i.rectArea[_]=Y,_++}else if(L.isPointLight){let Y=e.get(L);if(Y.color.copy(L.color).multiplyScalar(L.intensity),Y.distance=L.distance,Y.decay=L.decay,L.castShadow){let q=L.shadow,ne=t.get(L);ne.shadowIntensity=q.intensity,ne.shadowBias=q.bias,ne.shadowNormalBias=q.normalBias,ne.shadowRadius=q.radius,ne.shadowMapSize=q.mapSize,ne.shadowCameraNear=q.camera.near,ne.shadowCameraFar=q.camera.far,i.pointShadow[g]=ne,i.pointShadowMap[g]=te,i.pointShadowMatrix[g]=L.shadow.matrix,T++}i.point[g]=Y,g++}else if(L.isHemisphereLight){let Y=e.get(L);Y.skyColor.copy(L.color).multiplyScalar(V),Y.groundColor.copy(L.groundColor).multiplyScalar(V),i.hemi[b]=Y,b++}}_>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=xe.LTC_FLOAT_1,i.rectAreaLTC2=xe.LTC_FLOAT_2):(i.rectAreaLTC1=xe.LTC_HALF_1,i.rectAreaLTC2=xe.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=u,i.ambient[2]=d;let D=i.hash;(D.sunLength!==f||D.directionalLength!==m||D.pointLength!==g||D.spotLength!==v||D.rectAreaLength!==_||D.hemiLength!==b||D.numSunShadows!==p||D.numDirectionalShadows!==M||D.numPointShadows!==T||D.numSpotShadows!==x||D.numSpotMaps!==A||D.numLightProbes!==R)&&(i.sun.length=f,i.directional.length=m,i.spot.length=v,i.rectArea.length=_,i.point.length=g,i.hemi.length=b,i.sunShadow.length=p,i.sunShadowMap.length=p,i.sunShadowMatrix.length=y,i.sunShadowCascade.length=y,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.directionalShadowMatrix.length=M,i.pointShadow.length=T,i.pointShadowMap.length=T,i.pointShadowMatrix.length=T,i.spotShadow.length=x,i.spotShadowMap.length=x,i.spotLightMatrix.length=x+A-k,i.spotLightMap.length=A,i.numSpotLightShadowsWithMaps=k,i.numLightProbes=R,D.sunLength=f,D.directionalLength=m,D.pointLength=g,D.spotLength=v,D.rectAreaLength=_,D.hemiLength=b,D.numSunShadows=p,D.numDirectionalShadows=M,D.numPointShadows=T,D.numSpotShadows=x,D.numSpotMaps=A,D.numLightProbes=R,i.version=tM++)}function l(c,h){let u=0,d=0,f=0,p=0,y=0,m=0,g=h.matrixWorldInverse;for(let v=0,_=c.length;v<_;v++){let b=c[v];if(b.isSunLight){let M=i.sun[u];M.direction.setFromMatrixPosition(b.matrixWorld),M.direction.transformDirection(g),u++}else if(b.isDirectionalLight){let M=i.directional[d];M.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(g),d++}else if(b.isSpotLight){let M=i.spot[p];M.position.setFromMatrixPosition(b.matrixWorld),M.position.applyMatrix4(g),M.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(g),p++}else if(b.isRectAreaLight){let M=i.rectArea[y];M.position.setFromMatrixPosition(b.matrixWorld),M.position.applyMatrix4(g),a.identity(),r.copy(b.matrixWorld),r.premultiply(g),a.extractRotation(r),M.halfWidth.set(b.width*.5,0,0),M.halfHeight.set(0,b.height*.5,0),M.halfWidth.applyMatrix4(a),M.halfHeight.applyMatrix4(a),y++}else if(b.isPointLight){let M=i.point[f];M.position.setFromMatrixPosition(b.matrixWorld),M.position.applyMatrix4(g),f++}else if(b.isHemisphereLight){let M=i.hemi[m];M.direction.setFromMatrixPosition(b.matrixWorld),M.direction.transformDirection(g),m++}}}return{setup:o,setupView:l,state:i}}function xg(n){let e=new iM(n),t=[],i=[],s=[];function r(u){h.camera=u,t.length=0,i.length=0,s.length=0}function a(u){u.isLightProbeGrid?s.push(u):t.push(u)}function o(u){i.push(u)}function l(){e.setup(t),s.sort((u,d)=>u.priority-d.priority||u.id-d.id)}function c(u){e.setupView(t,u)}let h={lightsArray:t,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:h,setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function sM(n){let e=new WeakMap;function t(s,r=0){let a=e.get(s),o;return a===void 0?(o=new xg(n),e.set(s,[o])):r>=a.length?(o=new xg(n),a.push(o)):o=a[r],o}function i(){e=new WeakMap}return{get:t,dispose:i}}var rM=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,aM=`uniform sampler2D shadow_pass;
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
}`,oM=[new O(1,0,0),new O(-1,0,0),new O(0,1,0),new O(0,-1,0),new O(0,0,1),new O(0,0,-1)],lM=[new O(0,-1,0),new O(0,-1,0),new O(0,0,1),new O(0,0,-1),new O(0,-1,0),new O(0,-1,0)],_g=new ft,so=new O,kd=new O;function cM(n,e,t){let i=new Bs,s=new Ie,r=new Ie,a=new ht,o=new Zl,l=new Ql,c={},h=t.maxTextureSize,u={[os]:gn,[gn]:os,[Ln]:Ln},d=new Cn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ie},radius:{value:4}},vertexShader:rM,fragmentShader:aM}),f=d.clone();f.defines.HORIZONTAL_PASS=1;let p=new _t;p.setAttribute("position",new kt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let y=new Zt(p,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ja;let g=this.type;this.render=function(T,x,A){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;this.type===ym&&(De("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=ja);let k=n.getRenderTarget(),R=n.getActiveCubeFace(),D=n.getActiveMipmapLevel(),H=n.state;H.setBlending(Ii),H.buffers.depth.getReversed()===!0?H.buffers.color.setClear(0,0,0,0):H.buffers.color.setClear(1,1,1,1),H.buffers.depth.setTest(!0),H.setScissorTest(!1);let j=g!==this.type;j&&x.traverse(function(L){L.material&&(Array.isArray(L.material)?L.material.forEach(G=>G.needsUpdate=!0):L.material.needsUpdate=!0)});for(let L=0,G=T.length;L<G;L++){let V=T[L],W=V.shadow;if(W===void 0){De("WebGLShadowMap:",V,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;s.copy(W.mapSize);let te=W.getFrameExtents();s.multiply(te),r.copy(W.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/te.x),s.x=r.x*te.x,W.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/te.y),s.y=r.y*te.y,W.mapSize.y=r.y));let Y=n.state.buffers.depth.getReversed();if(W.camera._reversedDepth=Y,W.map===null||j===!0){if(W.map!==null&&(W.map.depthTexture!==null&&(W.map.depthTexture.dispose(),W.map.depthTexture=null),W.map.dispose()),this.type===Br){if(V.isPointLight){De("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}W.map=new mn(s.x,s.y,{format:ls,type:ni,minFilter:pn,magFilter:pn,generateMipmaps:!1}),W.map.texture.name=V.name+".shadowMap",W.map.depthTexture=new Li(s.x,s.y,kn),W.map.depthTexture.name=V.name+".shadowMapDepth",W.map.depthTexture.format=Ri,W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=xt,W.map.depthTexture.magFilter=xt}else V.isPointLight?(W.map=new ao(s.x),W.map.depthTexture=new Ga(s.x,ti)):(W.map=new mn(s.x,s.y),W.map.depthTexture=new Li(s.x,s.y,ti)),W.map.depthTexture.name=V.name+".shadowMap",W.map.depthTexture.format=Ri,this.type===ja?(W.map.depthTexture.compareFunction=Y?xd:bd,W.map.depthTexture.minFilter=pn,W.map.depthTexture.magFilter=pn):(W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=xt,W.map.depthTexture.magFilter=xt);W.camera.updateProjectionMatrix()}W.map.isWebGLCubeRenderTarget!==!0&&(W.map.width!==s.x||W.map.height!==s.y)&&W.map.setSize(s.x,s.y);let q=W.map.isWebGLCubeRenderTarget?6:W.getViewportCount();V.isPointLight!==!0&&W.updateMatrices(V,A);let ne=(W.camera.layers.mask&4294967294)!==0?W.camera.layers:A.layers;for(let ye=0;ye<q;ye++){let ke=W.getCamera(ye);if(V.isPointLight){let $=W.camera,oe=W.matrix,ve=V.distance||$.far;ve!==$.far&&($.far=ve,$.updateProjectionMatrix()),so.setFromMatrixPosition(V.matrixWorld),$.position.copy(so),kd.copy($.position),kd.add(oM[ye]),$.up.copy(lM[ye]),$.lookAt(kd),$.updateMatrixWorld(),oe.makeTranslation(-so.x,-so.y,-so.z),_g.multiplyMatrices($.projectionMatrix,$.matrixWorldInverse),W._frustum.setFromProjectionMatrix(_g,$.coordinateSystem,$.reversedDepth)}if(W.map.isWebGLCubeRenderTarget)n.setRenderTarget(W.map,ye),n.clear();else{ye===0&&(n.setRenderTarget(W.map),n.clear());let $=W.getViewport(ye);a.set(r.x*$.x,r.y*$.y,r.x*$.z,r.y*$.w),H.viewport(a)}i=W.getFrustum(ye),b(x,A,ke,V,ne,this.type)}W.isPointLightShadow!==!0&&this.type===Br&&v(W,A),W.needsUpdate=!1}g=this.type,m.needsUpdate=!1,n.setRenderTarget(k,R,D)};function v(T,x){let A=e.update(y);d.defines.VSM_SAMPLES!==T.blurSamples&&(d.defines.VSM_SAMPLES=T.blurSamples,f.defines.VSM_SAMPLES=T.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),T.mapPass===null?T.mapPass=new mn(s.x,s.y,{format:ls,type:ni}):(T.mapPass.width!==T.map.width||T.mapPass.height!==T.map.height)&&T.mapPass.setSize(T.map.width,T.map.height),d.uniforms.shadow_pass.value=T.map.depthTexture,d.uniforms.resolution.value.set(T.map.width,T.map.height),d.uniforms.radius.value=T.radius,n.setRenderTarget(T.mapPass),n.clear(),n.renderBufferDirect(x,null,A,d,y,null),f.uniforms.shadow_pass.value=T.mapPass.texture,f.uniforms.resolution.value.set(T.map.width,T.map.height),f.uniforms.radius.value=T.radius,n.setRenderTarget(T.map),n.clear(),n.renderBufferDirect(x,null,A,f,y,null)}function _(T,x,A,k){let R=null,D=A.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(D!==void 0)R=D;else if(R=A.isPointLight===!0?l:o,n.localClippingEnabled&&x.clipShadows===!0&&Array.isArray(x.clippingPlanes)&&x.clippingPlanes.length!==0||x.displacementMap&&x.displacementScale!==0||x.alphaMap&&x.alphaTest>0||x.map&&x.alphaTest>0||x.alphaToCoverage===!0){let H=R.uuid,j=x.uuid,L=c[H];L===void 0&&(L={},c[H]=L);let G=L[j];G===void 0&&(G=R.clone(),L[j]=G,x.addEventListener("dispose",M)),R=G}if(R.visible=x.visible,R.wireframe=x.wireframe,k===Br?R.side=x.shadowSide!==null?x.shadowSide:x.side:R.side=x.shadowSide!==null?x.shadowSide:u[x.side],R.alphaMap=x.alphaMap,R.alphaTest=x.alphaToCoverage===!0?.5:x.alphaTest,R.map=x.map,R.clipShadows=x.clipShadows,R.clippingPlanes=x.clippingPlanes,R.clipIntersection=x.clipIntersection,R.displacementMap=x.displacementMap,R.displacementScale=x.displacementScale,R.displacementBias=x.displacementBias,R.wireframeLinewidth=x.wireframeLinewidth,R.linewidth=x.linewidth,A.isPointLight===!0&&R.isMeshDistanceMaterial===!0){let H=n.properties.get(R);H.light=A}return R}function b(T,x,A,k,R,D){if(T.visible===!1)return;if(T.layers.test(R)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&D===Br)&&(!T.frustumCulled||T.intersectsFrustum(i))){T.modelViewMatrix.multiplyMatrices(A.matrixWorldInverse,T.matrixWorld);let L=e.update(T),G=T.material;if(Array.isArray(G)){let V=L.groups;for(let W=0,te=V.length;W<te;W++){let Y=V[W],q=G[Y.materialIndex];if(q&&q.visible){let ne=_(T,q,k,D);T.onBeforeShadow(n,T,x,A,L,ne,Y),n.renderBufferDirect(A,null,L,ne,T,Y),T.onAfterShadow(n,T,x,A,L,ne,Y)}}}else if(G.visible){let V=_(T,G,k,D);T.onBeforeShadow(n,T,x,A,L,V,null),n.renderBufferDirect(A,null,L,V,T,null),T.onAfterShadow(n,T,x,A,L,V,null)}}let j=T.children;for(let L=0,G=j.length;L<G;L++)b(j[L],x,A,k,R,D)}function M(T){T.target.removeEventListener("dispose",M);for(let A in c){let k=c[A],R=T.target.uuid;R in k&&(k[R].dispose(),delete k[R])}}}function hM(n,e){function t(){let P=!1,Q=new ht,J=null,ue=new ht(0,0,0,0);return{setMask:function(ae){J!==ae&&!P&&(n.colorMask(ae,ae,ae,ae),J=ae)},setLocked:function(ae){P=ae},setClear:function(ae,ce,Re,We,se){se===!0&&(ae*=We,ce*=We,Re*=We),Q.set(ae,ce,Re,We),ue.equals(Q)===!1&&(n.clearColor(ae,ce,Re,We),ue.copy(Q))},reset:function(){P=!1,J=null,ue.set(-1,0,0,0)}}}function i(){let P=!1,Q=!1,J=null,ue=null,ae=null;return{setReversed:function(ce){if(Q!==ce){let Re=e.get("EXT_clip_control");ce?Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.ZERO_TO_ONE_EXT):Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.NEGATIVE_ONE_TO_ONE_EXT),Q=ce;let We=ae;ae=null,this.setClear(We)}},getReversed:function(){return Q},setTest:function(ce){ce?me(n.DEPTH_TEST):Fe(n.DEPTH_TEST)},setMask:function(ce){J!==ce&&!P&&(n.depthMask(ce),J=ce)},setFunc:function(ce){if(Q&&(ce=Jm[ce]),ue!==ce){switch(ce){case Dl:n.depthFunc(n.NEVER);break;case Nl:n.depthFunc(n.ALWAYS);break;case Ol:n.depthFunc(n.LESS);break;case Mr:n.depthFunc(n.LEQUAL);break;case Ul:n.depthFunc(n.EQUAL);break;case Fl:n.depthFunc(n.GEQUAL);break;case Bl:n.depthFunc(n.GREATER);break;case zl:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}ue=ce}},setLocked:function(ce){P=ce},setClear:function(ce){ae!==ce&&(ae=ce,Q&&(ce=1-ce),n.clearDepth(ce))},reset:function(){P=!1,J=null,ue=null,ae=null,Q=!1}}}function s(){let P=!1,Q=null,J=null,ue=null,ae=null,ce=null,Re=null,We=null,se=null;return{setTest:function(Le){P||(Le?me(n.STENCIL_TEST):Fe(n.STENCIL_TEST))},setMask:function(Le){Q!==Le&&!P&&(n.stencilMask(Le),Q=Le)},setFunc:function(Le,Ge,be){(J!==Le||ue!==Ge||ae!==be)&&(n.stencilFunc(Le,Ge,be),J=Le,ue=Ge,ae=be)},setOp:function(Le,Ge,be){(ce!==Le||Re!==Ge||We!==be)&&(n.stencilOp(Le,Ge,be),ce=Le,Re=Ge,We=be)},setLocked:function(Le){P=Le},setClear:function(Le){se!==Le&&(n.clearStencil(Le),se=Le)},reset:function(){P=!1,Q=null,J=null,ue=null,ae=null,ce=null,Re=null,We=null,se=null}}}let r=new t,a=new i,o=new s,l={},c=new WeakMap,h={},u={},d={},f=new WeakMap,p=[],y=null,m=!1,g=null,v=null,_=null,b=null,M=null,T=null,x=null,A=new Xe(0,0,0),k=0,R=!1,D=null,H=null,j=null,L=null,G=null,V=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),W=!1,te=0,Y=n.getParameter(n.VERSION);Y.indexOf("WebGL")!==-1?(te=parseFloat(/^WebGL (\d)/.exec(Y)[1]),W=te>=1):Y.indexOf("OpenGL ES")!==-1&&(te=parseFloat(/^OpenGL ES (\d)/.exec(Y)[1]),W=te>=2);let q=null,ne={},ye=n.getParameter(n.SCISSOR_BOX),ke=n.getParameter(n.VIEWPORT),$=new ht().fromArray(ye),oe=new ht().fromArray(ke);function ve(P,Q,J,ue){let ae=new Uint8Array(4),ce=n.createTexture();n.bindTexture(P,ce),n.texParameteri(P,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(P,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Re=0;Re<J;Re++)P===n.TEXTURE_3D||P===n.TEXTURE_2D_ARRAY?n.texImage3D(Q,0,n.RGBA,1,1,ue,0,n.RGBA,n.UNSIGNED_BYTE,ae):n.texImage2D(Q+Re,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ae);return ce}let Ce={};Ce[n.TEXTURE_2D]=ve(n.TEXTURE_2D,n.TEXTURE_2D,1),Ce[n.TEXTURE_CUBE_MAP]=ve(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),Ce[n.TEXTURE_2D_ARRAY]=ve(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),Ce[n.TEXTURE_3D]=ve(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),me(n.DEPTH_TEST),a.setFunc(Mr),yn(!1),St(Yu),me(n.CULL_FACE),Dt(Ii);function me(P){h[P]!==!0&&(n.enable(P),h[P]=!0)}function Fe(P){h[P]!==!1&&(n.disable(P),h[P]=!1)}function Ye(P,Q){return d[P]!==Q?(n.bindFramebuffer(P,Q),d[P]=Q,P===n.DRAW_FRAMEBUFFER&&(d[n.FRAMEBUFFER]=Q),P===n.FRAMEBUFFER&&(d[n.DRAW_FRAMEBUFFER]=Q),!0):!1}function Se(P,Q){let J=p,ue=!1;if(P){J=f.get(Q),J===void 0&&(J=[],f.set(Q,J));let ae=P.textures;if(J.length!==ae.length||J[0]!==n.COLOR_ATTACHMENT0){for(let ce=0,Re=ae.length;ce<Re;ce++)J[ce]=n.COLOR_ATTACHMENT0+ce;J.length=ae.length,ue=!0}}else J[0]!==n.BACK&&(J[0]=n.BACK,ue=!0);ue&&n.drawBuffers(J)}function rt(P){return y!==P?(n.useProgram(P),y=P,!0):!1}let at={[Gs]:n.FUNC_ADD,[bm]:n.FUNC_SUBTRACT,[xm]:n.FUNC_REVERSE_SUBTRACT};at[_m]=n.MIN,at[Sm]=n.MAX;let He={[wm]:n.ZERO,[Mm]:n.ONE,[Em]:n.SRC_COLOR,[Zu]:n.SRC_ALPHA,[Lm]:n.SRC_ALPHA_SATURATE,[Rm]:n.DST_COLOR,[Am]:n.DST_ALPHA,[Tm]:n.ONE_MINUS_SRC_COLOR,[Qu]:n.ONE_MINUS_SRC_ALPHA,[Pm]:n.ONE_MINUS_DST_COLOR,[Cm]:n.ONE_MINUS_DST_ALPHA,[Im]:n.CONSTANT_COLOR,[km]:n.ONE_MINUS_CONSTANT_COLOR,[Dm]:n.CONSTANT_ALPHA,[Nm]:n.ONE_MINUS_CONSTANT_ALPHA};function Dt(P,Q,J,ue,ae,ce,Re,We,se,Le){if(P===Ii){m===!0&&(Fe(n.BLEND),m=!1);return}if(m===!1&&(me(n.BLEND),m=!0),P!==vm){if(P!==g||Le!==R){if((v!==Gs||M!==Gs)&&(n.blendEquation(n.FUNC_ADD),v=Gs,M=Gs),Le)switch(P){case zr:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case ju:n.blendFunc(n.ONE,n.ONE);break;case Ju:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Ku:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Ue("WebGLState: Invalid blending: ",P);break}else switch(P){case zr:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case ju:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case Ju:Ue("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Ku:Ue("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ue("WebGLState: Invalid blending: ",P);break}_=null,b=null,T=null,x=null,A.set(0,0,0),k=0,g=P,R=Le}return}ae=ae||Q,ce=ce||J,Re=Re||ue,(Q!==v||ae!==M)&&(n.blendEquationSeparate(at[Q],at[ae]),v=Q,M=ae),(J!==_||ue!==b||ce!==T||Re!==x)&&(n.blendFuncSeparate(He[J],He[ue],He[ce],He[Re]),_=J,b=ue,T=ce,x=Re),(We.equals(A)===!1||se!==k)&&(n.blendColor(We.r,We.g,We.b,se),A.copy(We),k=se),g=P,R=!1}function Nt(P,Q){P.side===Ln?Fe(n.CULL_FACE):me(n.CULL_FACE);let J=P.side===gn;Q&&(J=!J),yn(J),P.blending===zr&&P.transparent===!1?Dt(Ii):Dt(P.blending,P.blendEquation,P.blendSrc,P.blendDst,P.blendEquationAlpha,P.blendSrcAlpha,P.blendDstAlpha,P.blendColor,P.blendAlpha,P.premultipliedAlpha),a.setFunc(P.depthFunc),a.setTest(P.depthTest),a.setMask(P.depthWrite),r.setMask(P.colorWrite);let ue=P.stencilWrite;o.setTest(ue),ue&&(o.setMask(P.stencilWriteMask),o.setFunc(P.stencilFunc,P.stencilRef,P.stencilFuncMask),o.setOp(P.stencilFail,P.stencilZFail,P.stencilZPass)),Gt(P.polygonOffset,P.polygonOffsetFactor,P.polygonOffsetUnits),P.alphaToCoverage===!0?me(n.SAMPLE_ALPHA_TO_COVERAGE):Fe(n.SAMPLE_ALPHA_TO_COVERAGE)}function yn(P){D!==P&&(P?n.frontFace(n.CW):n.frontFace(n.CCW),D=P)}function St(P){P!==mm?(me(n.CULL_FACE),P!==H&&(P===Yu?n.cullFace(n.BACK):P===gm?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):Fe(n.CULL_FACE),H=P}function oi(P){P!==j&&(W&&n.lineWidth(P),j=P)}function Gt(P,Q,J){P?(me(n.POLYGON_OFFSET_FILL),(L!==Q||G!==J)&&(L=Q,G=J,a.getReversed()&&(Q=-Q,J=-J),n.polygonOffset(Q,J))):Fe(n.POLYGON_OFFSET_FILL)}function Nn(P){P?me(n.SCISSOR_TEST):Fe(n.SCISSOR_TEST)}function On(P){P===void 0&&(P=n.TEXTURE0+V-1),q!==P&&(n.activeTexture(P),q=P)}function Un(P,Q,J){J===void 0&&(q===null?J=n.TEXTURE0+V-1:J=q);let ue=ne[J];ue===void 0&&(ue={type:void 0,texture:void 0},ne[J]=ue),(ue.type!==P||ue.texture!==Q)&&(q!==J&&(n.activeTexture(J),q=J),n.bindTexture(P,Q||Ce[P]),ue.type=P,ue.texture=Q)}function U(){let P=ne[q];P!==void 0&&P.type!==void 0&&(n.bindTexture(P.type,null),P.type=void 0,P.texture=void 0)}function Fn(){try{n.compressedTexImage2D(...arguments)}catch(P){Ue("WebGLState:",P)}}function vt(){try{n.compressedTexImage3D(...arguments)}catch(P){Ue("WebGLState:",P)}}function bt(){try{n.texSubImage2D(...arguments)}catch(P){Ue("WebGLState:",P)}}function ge(){try{n.texSubImage3D(...arguments)}catch(P){Ue("WebGLState:",P)}}function Ot(){try{n.compressedTexSubImage2D(...arguments)}catch(P){Ue("WebGLState:",P)}}function Ne(){try{n.compressedTexSubImage3D(...arguments)}catch(P){Ue("WebGLState:",P)}}function ze(){try{n.texStorage2D(...arguments)}catch(P){Ue("WebGLState:",P)}}function C(){try{n.texStorage3D(...arguments)}catch(P){Ue("WebGLState:",P)}}function S(){try{n.texImage2D(...arguments)}catch(P){Ue("WebGLState:",P)}}function B(){try{n.texImage3D(...arguments)}catch(P){Ue("WebGLState:",P)}}function ie(P){return u[P]!==void 0?u[P]:n.getParameter(P)}function ee(P,Q){u[P]!==Q&&(n.pixelStorei(P,Q),u[P]=Q)}function le(P){$.equals(P)===!1&&(n.scissor(P.x,P.y,P.z,P.w),$.copy(P))}function fe(P){oe.equals(P)===!1&&(n.viewport(P.x,P.y,P.z,P.w),oe.copy(P))}function K(P,Q){let J=c.get(Q);J===void 0&&(J=new WeakMap,c.set(Q,J));let ue=J.get(P);ue===void 0&&(ue=n.getUniformBlockIndex(Q,P.name),n.uniformBlockBinding(Q,ue,ue),J.set(P,ue))}function Z(P,Q,J){let ae=c.get(Q).get(P);l[ae]!==J&&(n.bindBufferBase(n.UNIFORM_BUFFER,ae,J),l[ae]=J)}function he(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),a.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),h={},u={},q=null,ne={},d={},l={},f=new WeakMap,p=[],y=null,m=!1,g=null,v=null,_=null,b=null,M=null,T=null,x=null,A=new Xe(0,0,0),k=0,R=!1,D=null,H=null,j=null,L=null,G=null,$.set(0,0,n.canvas.width,n.canvas.height),oe.set(0,0,n.canvas.width,n.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:me,disable:Fe,bindFramebuffer:Ye,drawBuffers:Se,useProgram:rt,setBlending:Dt,setMaterial:Nt,setFlipSided:yn,setCullFace:St,setLineWidth:oi,setPolygonOffset:Gt,setScissorTest:Nn,activeTexture:On,bindTexture:Un,unbindTexture:U,compressedTexImage2D:Fn,compressedTexImage3D:vt,texImage2D:S,texImage3D:B,pixelStorei:ee,getParameter:ie,updateUBOMapping:K,uniformBlockBinding:Z,texStorage2D:ze,texStorage3D:C,texSubImage2D:bt,texSubImage3D:ge,compressedTexSubImage2D:Ot,compressedTexSubImage3D:Ne,scissor:le,viewport:fe,reset:he}}function uM(n,e,t,i,s,r,a){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ie,h=new WeakMap,u=new Set,d,f=new WeakMap,p=new Set,y=new FinalizationRegistry(C=>p.delete(C)),m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(C,S){return m?new OffscreenCanvas(C,S):Oa("canvas")}function v(C,S,B){let ie=1,ee=ze(C);if((ee.width>B||ee.height>B)&&(ie=B/Math.max(ee.width,ee.height)),ie<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let le=Math.floor(ie*ee.width),fe=Math.floor(ie*ee.height);d===void 0&&(d=g(le,fe));let K=S?g(le,fe):d;return K.width=le,K.height=fe,K.getContext("2d").drawImage(C,0,0,le,fe),De("WebGLRenderer: Texture has been resized from ("+ee.width+"x"+ee.height+") to ("+le+"x"+fe+")."),K}else return"data"in C&&De("WebGLRenderer: Image in DataTexture is too big ("+ee.width+"x"+ee.height+")."),C;return C}function _(C){return C.generateMipmaps}function b(C){n.generateMipmap(C)}function M(C){return C.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?n.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function T(C,S,B,ie,ee,le=!1){if(C!==null){if(n[C]!==void 0)return n[C];De("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let fe;ie&&(fe=e.get("EXT_texture_norm16"),fe||De("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let K=S;if(S===n.RED&&(B===n.FLOAT&&(K=n.R32F),B===n.HALF_FLOAT&&(K=n.R16F),B===n.UNSIGNED_BYTE&&(K=n.R8),B===n.UNSIGNED_SHORT&&fe&&(K=fe.R16_EXT),B===n.SHORT&&fe&&(K=fe.R16_SNORM_EXT)),S===n.RED_INTEGER&&(B===n.UNSIGNED_BYTE&&(K=n.R8UI),B===n.UNSIGNED_SHORT&&(K=n.R16UI),B===n.UNSIGNED_INT&&(K=n.R32UI),B===n.BYTE&&(K=n.R8I),B===n.SHORT&&(K=n.R16I),B===n.INT&&(K=n.R32I)),S===n.RG&&(B===n.FLOAT&&(K=n.RG32F),B===n.HALF_FLOAT&&(K=n.RG16F),B===n.UNSIGNED_BYTE&&(K=n.RG8),B===n.UNSIGNED_SHORT&&fe&&(K=fe.RG16_EXT),B===n.SHORT&&fe&&(K=fe.RG16_SNORM_EXT)),S===n.RG_INTEGER&&(B===n.UNSIGNED_BYTE&&(K=n.RG8UI),B===n.UNSIGNED_SHORT&&(K=n.RG16UI),B===n.UNSIGNED_INT&&(K=n.RG32UI),B===n.BYTE&&(K=n.RG8I),B===n.SHORT&&(K=n.RG16I),B===n.INT&&(K=n.RG32I)),S===n.RGB_INTEGER&&(B===n.UNSIGNED_BYTE&&(K=n.RGB8UI),B===n.UNSIGNED_SHORT&&(K=n.RGB16UI),B===n.UNSIGNED_INT&&(K=n.RGB32UI),B===n.BYTE&&(K=n.RGB8I),B===n.SHORT&&(K=n.RGB16I),B===n.INT&&(K=n.RGB32I)),S===n.RGBA_INTEGER&&(B===n.UNSIGNED_BYTE&&(K=n.RGBA8UI),B===n.UNSIGNED_SHORT&&(K=n.RGBA16UI),B===n.UNSIGNED_INT&&(K=n.RGBA32UI),B===n.BYTE&&(K=n.RGBA8I),B===n.SHORT&&(K=n.RGBA16I),B===n.INT&&(K=n.RGBA32I)),S===n.RGB&&(B===n.UNSIGNED_SHORT&&fe&&(K=fe.RGB16_EXT),B===n.SHORT&&fe&&(K=fe.RGB16_SNORM_EXT),B===n.UNSIGNED_INT_5_9_9_9_REV&&(K=n.RGB9_E5),B===n.UNSIGNED_INT_10F_11F_11F_REV&&(K=n.R11F_G11F_B10F)),S===n.RGBA){let Z=le?Da:je.getTransfer(ee);B===n.FLOAT&&(K=n.RGBA32F),B===n.HALF_FLOAT&&(K=n.RGBA16F),B===n.UNSIGNED_BYTE&&(K=Z===ct?n.SRGB8_ALPHA8:n.RGBA8),B===n.UNSIGNED_SHORT&&fe&&(K=fe.RGBA16_EXT),B===n.SHORT&&fe&&(K=fe.RGBA16_SNORM_EXT),B===n.UNSIGNED_SHORT_4_4_4_4&&(K=n.RGBA4),B===n.UNSIGNED_SHORT_5_5_5_1&&(K=n.RGB5_A1)}return(K===n.R16F||K===n.R32F||K===n.RG16F||K===n.RG32F||K===n.RGBA16F||K===n.RGBA32F)&&e.get("EXT_color_buffer_float"),K}function x(C,S){let B;return C?S===null||S===ti||S===$s?B=n.DEPTH24_STENCIL8:S===kn?B=n.DEPTH32F_STENCIL8:S===Vr&&(B=n.DEPTH24_STENCIL8,De("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===ti||S===$s?B=n.DEPTH_COMPONENT24:S===kn?B=n.DEPTH_COMPONENT32F:S===Vr&&(B=n.DEPTH_COMPONENT16),B}function A(C,S){return _(C)===!0||C.isFramebufferTexture&&C.minFilter!==xt&&C.minFilter!==pn?Math.log2(Math.max(S.width,S.height))+1:C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?S.mipmaps.length:1}function k(C){let S=new WeakRef(C);i.get(C).__ref=S,p.add(S),y.register(C,S,S)}function R(C){let S=i.get(C).__ref;S!==void 0&&(p.delete(S),y.unregister(S))}function D(C){j(C.target)}function H(C){L(C.target)}function j(C){C.removeEventListener("dispose",D),R(C),V(C),C.isVideoTexture&&h.delete(C),C.isHTMLTexture&&u.delete(C)}function L(C){C.removeEventListener("dispose",H),R(C),te(C)}function G(){for(let C of p){let S=C.deref();S!==void 0&&(S.isRenderTarget===!0?L(S):j(S))}p.clear(),u.clear()}function V(C){let S=i.get(C);if(S.__webglInit===void 0)return;let B=C.source,ie=f.get(B);if(ie){let ee=ie[S.__cacheKey];ee.usedTimes--,ee.usedTimes===0&&W(C),Object.keys(ie).length===0&&f.delete(B)}i.remove(C)}function W(C){let S=i.get(C);n.deleteTexture(S.__webglTexture);let B=C.source,ie=f.get(B);delete ie[S.__cacheKey],a.memory.textures--}function te(C){let S=i.get(C);S.__depthDisposeCallback&&S.__depthDisposeCallback();let B=C.depthTexture;if(B&&B.renderTarget===C&&j(B),C.isWebGLCubeRenderTarget)for(let ee=0;ee<6;ee++){if(Array.isArray(S.__webglFramebuffer[ee]))for(let le=0;le<S.__webglFramebuffer[ee].length;le++)n.deleteFramebuffer(S.__webglFramebuffer[ee][le]);else n.deleteFramebuffer(S.__webglFramebuffer[ee]);S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer[ee])}else{if(Array.isArray(S.__webglFramebuffer))for(let ee=0;ee<S.__webglFramebuffer.length;ee++)n.deleteFramebuffer(S.__webglFramebuffer[ee]);else n.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&n.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let ee=0;ee<S.__webglColorRenderbuffer.length;ee++)S.__webglColorRenderbuffer[ee]&&n.deleteRenderbuffer(S.__webglColorRenderbuffer[ee]);S.__webglDepthRenderbuffer&&n.deleteRenderbuffer(S.__webglDepthRenderbuffer)}let ie=C.textures;for(let ee=0,le=ie.length;ee<le;ee++){let fe=i.get(ie[ee]);fe.__webglTexture&&(n.deleteTexture(fe.__webglTexture),a.memory.textures--),i.remove(ie[ee])}i.remove(C)}let Y=0;function q(){Y=0}function ne(){return Y}function ye(C){Y=C}function ke(){let C=Y;return C>=s.maxTextures&&De("WebGLTextures: Trying to use "+(C+1)+" texture units while this GPU supports only "+s.maxTextures),Y+=1,C}function $(C){let S=[];return S.push(C.wrapS),S.push(C.wrapT),S.push(C.wrapR||0),S.push(C.magFilter),S.push(C.minFilter),S.push(C.anisotropy),S.push(C.internalFormat),S.push(C.format),S.push(C.type),S.push(C.generateMipmaps),S.push(C.mipmapsAutoUpdate),S.push(C.premultiplyAlpha),S.push(C.flipY),S.push(C.unpackAlignment),S.push(C.colorSpace),S.join()}function oe(C,S){let B=i.get(C);if(C.isVideoTexture&&Ot(C),C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&B.__version!==C.version){let ie=C.image;if(ie===null)De("WebGLRenderer: Texture marked for update but no image data found.");else if(ie.complete===!1)De("WebGLRenderer: Texture marked for update but image is incomplete");else{Nt(B,C,S);return}}else C.isExternalTexture&&(B.__webglTexture=C.sourceTexture?C.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,B.__webglTexture,n.TEXTURE0+S)}function ve(C,S){let B=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&B.__version!==C.version){Nt(B,C,S);return}else C.isExternalTexture&&(B.__webglTexture=C.sourceTexture?C.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,B.__webglTexture,n.TEXTURE0+S)}function Ce(C,S){let B=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&B.__version!==C.version){Nt(B,C,S);return}t.bindTexture(n.TEXTURE_3D,B.__webglTexture,n.TEXTURE0+S)}function me(C,S){let B=i.get(C);if(C.version>0&&B.__version!==C.version){yn(B,C,S);return}t.bindTexture(n.TEXTURE_CUBE_MAP,B.__webglTexture,n.TEXTURE0+S)}let Fe={[Hl]:n.REPEAT,[pi]:n.CLAMP_TO_EDGE,[Vl]:n.MIRRORED_REPEAT},Ye={[xt]:n.NEAREST,[Fm]:n.NEAREST_MIPMAP_NEAREST,[Ja]:n.NEAREST_MIPMAP_LINEAR,[pn]:n.LINEAR,[fc]:n.LINEAR_MIPMAP_NEAREST,[ki]:n.LINEAR_MIPMAP_LINEAR},Se={[Vm]:n.NEVER,[_d]:n.ALWAYS,[Gm]:n.LESS,[bd]:n.LEQUAL,[Wm]:n.EQUAL,[xd]:n.GEQUAL,[$m]:n.GREATER,[Xm]:n.NOTEQUAL};function rt(C,S){if(S.type===kn&&e.has("OES_texture_float_linear")===!1&&(S.magFilter===pn||S.magFilter===fc||S.magFilter===Ja||S.magFilter===ki||S.minFilter===pn||S.minFilter===fc||S.minFilter===Ja||S.minFilter===ki)&&De("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(C,n.TEXTURE_WRAP_S,Fe[S.wrapS]),n.texParameteri(C,n.TEXTURE_WRAP_T,Fe[S.wrapT]),(C===n.TEXTURE_3D||C===n.TEXTURE_2D_ARRAY)&&n.texParameteri(C,n.TEXTURE_WRAP_R,Fe[S.wrapR]),n.texParameteri(C,n.TEXTURE_MAG_FILTER,Ye[S.magFilter]),n.texParameteri(C,n.TEXTURE_MIN_FILTER,Ye[S.minFilter]),S.compareFunction&&(n.texParameteri(C,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(C,n.TEXTURE_COMPARE_FUNC,Se[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===xt||S.minFilter!==Ja&&S.minFilter!==ki||S.type===kn&&e.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||i.get(S).__currentAnisotropy){let B=e.get("EXT_texture_filter_anisotropic");n.texParameterf(C,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,s.getMaxAnisotropy())),i.get(S).__currentAnisotropy=S.anisotropy}}}function at(C,S){let B=!1;C.__webglInit===void 0&&(C.__webglInit=!0,S.addEventListener("dispose",D),k(S));let ie=S.source,ee=f.get(ie);ee===void 0&&(ee={},f.set(ie,ee));let le=$(S);if(le!==C.__cacheKey){ee[le]===void 0&&(ee[le]={texture:n.createTexture(),usedTimes:0},a.memory.textures++,B=!0),ee[le].usedTimes++;let fe=ee[C.__cacheKey];fe!==void 0&&(ee[C.__cacheKey].usedTimes--,fe.usedTimes===0&&W(S)),C.__cacheKey=le,C.__webglTexture=ee[le].texture}return B}function He(C,S,B){return Math.floor(Math.floor(C/B)/S)}function Dt(C,S,B,ie){let le=C.updateRanges;if(le.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,S.width,S.height,B,ie,S.data);else{le.sort((P,Q)=>P.start-Q.start);let fe=0;for(let P=1;P<le.length;P++){let Q=le[fe],J=le[P],ue=Q.start+Q.count,ae=He(J.start,S.width,4),ce=He(Q.start,S.width,4);J.start<=ue+1&&ae===ce&&He(J.start+J.count-1,S.width,4)===ae?Q.count=Math.max(Q.count,J.start+J.count-Q.start):(++fe,le[fe]=J)}le.length=fe+1;let K=t.getParameter(n.UNPACK_ROW_LENGTH),Z=t.getParameter(n.UNPACK_SKIP_PIXELS),he=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,S.width);for(let P=0,Q=le.length;P<Q;P++){let J=le[P],ue=Math.floor(J.start/4),ae=Math.ceil(J.count/4),ce=ue%S.width,Re=Math.floor(ue/S.width),We=ae,se=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,ce),t.pixelStorei(n.UNPACK_SKIP_ROWS,Re),t.texSubImage2D(n.TEXTURE_2D,0,ce,Re,We,se,B,ie,S.data)}C.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,K),t.pixelStorei(n.UNPACK_SKIP_PIXELS,Z),t.pixelStorei(n.UNPACK_SKIP_ROWS,he)}}function Nt(C,S,B){let ie=n.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(ie=n.TEXTURE_2D_ARRAY),S.isData3DTexture&&(ie=n.TEXTURE_3D);let ee=at(C,S),le=S.source;t.bindTexture(ie,C.__webglTexture,n.TEXTURE0+B);let fe=i.get(le);if(le.version!==fe.__version||ee===!0){if(t.activeTexture(n.TEXTURE0+B),(typeof ImageBitmap<"u"&&S.image instanceof ImageBitmap)===!1){let se=je.getPrimaries(je.workingColorSpace),Le=S.colorSpace===ii?null:je.getPrimaries(S.colorSpace),Ge=S.colorSpace===ii||se===Le?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ge)}t.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment);let Z=v(S.image,!1,s.maxTextureSize);Z=Ne(S,Z);let he=r.convert(S.format,S.colorSpace),P=r.convert(S.type),Q=T(S.internalFormat,he,P,S.normalized,S.colorSpace,S.isVideoTexture);rt(ie,S);let J,ue=S.mipmaps,ae=S.isVideoTexture!==!0,ce=fe.__version===void 0||ee===!0,Re=le.dataReady,We=A(S,Z);if(S.isDepthTexture)Q=x(S.format===Di,S.type),ce&&(ae?t.texStorage2D(n.TEXTURE_2D,1,Q,Z.width,Z.height):t.texImage2D(n.TEXTURE_2D,0,Q,Z.width,Z.height,0,he,P,null));else if(S.isDataTexture)if(ue.length>0){ae&&ce&&t.texStorage2D(n.TEXTURE_2D,We,Q,ue[0].width,ue[0].height);for(let se=0,Le=ue.length;se<Le;se++)J=ue[se],ae?Re&&t.texSubImage2D(n.TEXTURE_2D,se,0,0,J.width,J.height,he,P,J.data):t.texImage2D(n.TEXTURE_2D,se,Q,J.width,J.height,0,he,P,J.data);S.generateMipmaps=!1}else ae?(ce&&t.texStorage2D(n.TEXTURE_2D,We,Q,Z.width,Z.height),Re&&Dt(S,Z,he,P)):t.texImage2D(n.TEXTURE_2D,0,Q,Z.width,Z.height,0,he,P,Z.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){ae&&ce&&t.texStorage3D(n.TEXTURE_2D_ARRAY,We,Q,ue[0].width,ue[0].height,Z.depth);for(let se=0,Le=ue.length;se<Le;se++)if(J=ue[se],S.format!==Dn)if(he!==null)if(ae){if(Re)if(S.layerUpdates.size>0){let Ge=Ld(J.width,J.height,S.format,S.type);for(let be of S.layerUpdates){let ut=J.data.subarray(be*Ge/J.data.BYTES_PER_ELEMENT,(be+1)*Ge/J.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,se,0,0,be,J.width,J.height,1,he,ut)}}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,se,0,0,0,J.width,J.height,Z.depth,he,J.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,se,Q,J.width,J.height,Z.depth,0,J.data,0,0);else De("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else ae?Re&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,se,0,0,0,J.width,J.height,Z.depth,he,P,J.data):t.texImage3D(n.TEXTURE_2D_ARRAY,se,Q,J.width,J.height,Z.depth,0,he,P,J.data);S.layerUpdates.size>0&&S.clearLayerUpdates()}else{ae&&ce&&t.texStorage2D(n.TEXTURE_2D,We,Q,ue[0].width,ue[0].height);for(let se=0,Le=ue.length;se<Le;se++)J=ue[se],S.format!==Dn?he!==null?ae?Re&&t.compressedTexSubImage2D(n.TEXTURE_2D,se,0,0,J.width,J.height,he,J.data):t.compressedTexImage2D(n.TEXTURE_2D,se,Q,J.width,J.height,0,J.data):De("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):ae?Re&&t.texSubImage2D(n.TEXTURE_2D,se,0,0,J.width,J.height,he,P,J.data):t.texImage2D(n.TEXTURE_2D,se,Q,J.width,J.height,0,he,P,J.data)}else if(S.isDataArrayTexture)if(ae){if(ce&&t.texStorage3D(n.TEXTURE_2D_ARRAY,We,Q,Z.width,Z.height,Z.depth),Re)if(S.layerUpdates.size>0){let se=Ld(Z.width,Z.height,S.format,S.type);for(let Le of S.layerUpdates){let Ge=Z.data.subarray(Le*se/Z.data.BYTES_PER_ELEMENT,(Le+1)*se/Z.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,Le,Z.width,Z.height,1,he,P,Ge)}S.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,Z.width,Z.height,Z.depth,he,P,Z.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,Q,Z.width,Z.height,Z.depth,0,he,P,Z.data);else if(S.isData3DTexture)ae?(ce&&t.texStorage3D(n.TEXTURE_3D,We,Q,Z.width,Z.height,Z.depth),Re&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,Z.width,Z.height,Z.depth,he,P,Z.data)):t.texImage3D(n.TEXTURE_3D,0,Q,Z.width,Z.height,Z.depth,0,he,P,Z.data);else if(S.isFramebufferTexture){if(ce)if(ae)t.texStorage2D(n.TEXTURE_2D,We,Q,Z.width,Z.height);else{let se=Z.width,Le=Z.height;for(let Ge=0;Ge<We;Ge++)t.texImage2D(n.TEXTURE_2D,Ge,Q,se,Le,0,he,P,null),se>>=1,Le>>=1}}else if(S.isHTMLTexture){if("texElementImage2D"in n){let se=n.canvas;if(se.hasAttribute("layoutsubtree")||se.setAttribute("layoutsubtree","true"),Z.parentNode!==se){se.appendChild(Z),u.add(S),se.onpaint=Le=>{let Ge=Le.changedElements;for(let be of u)Ge.includes(be.image)&&(be.needsUpdate=!0)},se.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,Z);else{let Ge=n.RGBA,be=n.RGBA,ut=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,Ge,be,ut,Z)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(ue.length>0){if(ae&&ce){let se=ze(ue[0]);t.texStorage2D(n.TEXTURE_2D,We,Q,se.width,se.height)}for(let se=0,Le=ue.length;se<Le;se++)J=ue[se],ae?Re&&t.texSubImage2D(n.TEXTURE_2D,se,0,0,he,P,J):t.texImage2D(n.TEXTURE_2D,se,Q,he,P,J);S.generateMipmaps=!1}else if(ae){if(ce){let se=ze(Z);t.texStorage2D(n.TEXTURE_2D,We,Q,se.width,se.height)}Re&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,he,P,Z)}else t.texImage2D(n.TEXTURE_2D,0,Q,he,P,Z);_(S)&&S.mipmapsAutoUpdate===!0&&b(ie),fe.__version=le.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function yn(C,S,B){if(S.image.length!==6)return;let ie=at(C,S),ee=S.source;t.bindTexture(n.TEXTURE_CUBE_MAP,C.__webglTexture,n.TEXTURE0+B);let le=i.get(ee);if(ee.version!==le.__version||ie===!0){t.activeTexture(n.TEXTURE0+B);let fe=je.getPrimaries(je.workingColorSpace),K=S.colorSpace===ii?null:je.getPrimaries(S.colorSpace),Z=S.colorSpace===ii||fe===K?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Z);let he=S.isCompressedTexture||S.image[0].isCompressedTexture,P=S.image[0]&&S.image[0].isDataTexture,Q=[];for(let be=0;be<6;be++)!he&&!P?Q[be]=v(S.image[be],!0,s.maxCubemapSize):Q[be]=P?S.image[be].image:S.image[be],Q[be]=Ne(S,Q[be]);let J=Q[0],ue=r.convert(S.format,S.colorSpace),ae=r.convert(S.type),ce=T(S.internalFormat,ue,ae,S.normalized,S.colorSpace),Re=S.isVideoTexture!==!0,We=le.__version===void 0||ie===!0,se=ee.dataReady,Le=A(S,J);rt(n.TEXTURE_CUBE_MAP,S);let Ge;if(S.isDepthTexture){if(ce=x(S.format===Di,S.type),We)if(Re)t.texStorage2D(n.TEXTURE_CUBE_MAP,1,ce,J.width,J.height);else for(let be=0;be<6;be++)t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,0,ce,J.width,J.height,0,ue,ae,null)}else if(he){Re&&We&&t.texStorage2D(n.TEXTURE_CUBE_MAP,Le,ce,J.width,J.height);for(let be=0;be<6;be++){Ge=Q[be].mipmaps;for(let ut=0;ut<Ge.length;ut++){let Wt=Ge[ut];S.format!==Dn?ue!==null?Re?se&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut,0,0,Wt.width,Wt.height,ue,Wt.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut,ce,Wt.width,Wt.height,0,Wt.data):De("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Re?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut,0,0,Wt.width,Wt.height,ue,ae,Wt.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut,ce,Wt.width,Wt.height,0,ue,ae,Wt.data)}}}else{if(Ge=S.mipmaps,Re&&We){Ge.length>0&&Le++;let be=ze(Q[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,Le,ce,be.width,be.height)}for(let be=0;be<6;be++)if(P){Re?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,0,0,0,Q[be].width,Q[be].height,ue,ae,Q[be].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,0,ce,Q[be].width,Q[be].height,0,ue,ae,Q[be].data);for(let ut=0;ut<Ge.length;ut++){let Ui=Ge[ut].image[be].image;Re?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut+1,0,0,Ui.width,Ui.height,ue,ae,Ui.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut+1,ce,Ui.width,Ui.height,0,ue,ae,Ui.data)}}else{Re?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,0,0,0,ue,ae,Q[be]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,0,ce,ue,ae,Q[be]);for(let ut=0;ut<Ge.length;ut++){let Wt=Ge[ut];Re?se&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut+1,0,0,ue,ae,Wt.image[be]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+be,ut+1,ce,ue,ae,Wt.image[be])}}}_(S)&&S.mipmapsAutoUpdate===!0&&b(n.TEXTURE_CUBE_MAP),le.__version=ee.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function St(C,S,B,ie,ee,le){let fe=r.convert(B.format,B.colorSpace),K=r.convert(B.type),Z=T(B.internalFormat,fe,K,B.normalized,B.colorSpace),he=i.get(S),P=i.get(B);if(P.__renderTarget=S,!he.__hasExternalTextures){let Q=Math.max(1,S.width>>le),J=Math.max(1,S.height>>le);ee===n.TEXTURE_3D||ee===n.TEXTURE_2D_ARRAY?t.texImage3D(ee,le,Z,Q,J,S.depth,0,fe,K,null):t.texImage2D(ee,le,Z,Q,J,0,fe,K,null)}t.bindFramebuffer(n.FRAMEBUFFER,C),ge(S)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ie,ee,P.__webglTexture,0,bt(S)):(ee===n.TEXTURE_2D||ee>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&ee<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,ie,ee,P.__webglTexture,le),t.bindFramebuffer(n.FRAMEBUFFER,null)}function oi(C,S,B){if(n.bindRenderbuffer(n.RENDERBUFFER,C),S.depthBuffer){let ie=S.depthTexture,ee=ie&&ie.isDepthTexture?ie.type:null,le=x(S.stencilBuffer,ee),fe=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;ge(S)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,bt(S),le,S.width,S.height):B?n.renderbufferStorageMultisample(n.RENDERBUFFER,bt(S),le,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,le,S.width,S.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,fe,n.RENDERBUFFER,C)}else{let ie=S.textures;for(let ee=0;ee<ie.length;ee++){let le=ie[ee],fe=r.convert(le.format,le.colorSpace),K=r.convert(le.type),Z=T(le.internalFormat,fe,K,le.normalized,le.colorSpace);ge(S)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,bt(S),Z,S.width,S.height):B?n.renderbufferStorageMultisample(n.RENDERBUFFER,bt(S),Z,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,Z,S.width,S.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function Gt(C,S,B){let ie=S.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,C),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let ee=i.get(S.depthTexture);ee.__renderTarget=S;let le=ie?S.depthTexture.image[0]:S.depthTexture.image;(!ee.__webglTexture||le.width!==S.width||le.height!==S.height)&&(le.width=S.width,le.height=S.height,S.depthTexture.needsUpdate=!0),ie?me(S.depthTexture,0):oe(S.depthTexture,0);let fe=ee.__webglTexture,K=bt(S),Z=ie?n.TEXTURE_CUBE_MAP_POSITIVE_X+B:n.TEXTURE_2D,he=S.depthTexture.format===Di?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(S.depthTexture.format===Ri)ge(S)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,he,Z,fe,0,K):n.framebufferTexture2D(n.FRAMEBUFFER,he,Z,fe,0);else if(S.depthTexture.format===Di)ge(S)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,he,Z,fe,0,K):n.framebufferTexture2D(n.FRAMEBUFFER,he,Z,fe,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Nn(C){let S=i.get(C),B=C.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==C.depthTexture){let ie=C.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),ie){let ee=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,ie.removeEventListener("dispose",ee)};ie.addEventListener("dispose",ee),S.__depthDisposeCallback=ee}S.__boundDepthTexture=ie}if(C.depthTexture&&!S.__autoAllocateDepthBuffer)if(B)for(let ie=0;ie<6;ie++)Gt(S.__webglFramebuffer[ie],C,ie);else C.texture.mipmaps.length>0?Gt(S.__webglFramebuffer[0],C,0):Gt(S.__webglFramebuffer,C,0);else if(B){S.__webglDepthbuffer=[];for(let ie=0;ie<6;ie++)if(t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer[ie]),S.__webglDepthbuffer[ie]===void 0)S.__webglDepthbuffer[ie]=n.createRenderbuffer(),oi(S.__webglDepthbuffer[ie],C,!1);else{let ee=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,le=S.__webglDepthbuffer[ie];n.bindRenderbuffer(n.RENDERBUFFER,le),n.framebufferRenderbuffer(n.FRAMEBUFFER,ee,n.RENDERBUFFER,le)}}else if(C.texture.mipmaps.length>0?t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=n.createRenderbuffer(),oi(S.__webglDepthbuffer,C,!1);else{let ee=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,le=S.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,le),n.framebufferRenderbuffer(n.FRAMEBUFFER,ee,n.RENDERBUFFER,le)}t.bindFramebuffer(n.FRAMEBUFFER,null)}function On(C,S,B){let ie=i.get(C);S!==void 0&&St(ie.__webglFramebuffer,C,C.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),B!==void 0&&Nn(C)}function Un(C){let S=C.texture,B=i.get(C),ie=i.get(S);C.addEventListener("dispose",H),k(C);let ee=C.textures,le=C.isWebGLCubeRenderTarget===!0,fe=ee.length>1;if(fe||(ie.__webglTexture===void 0&&(ie.__webglTexture=n.createTexture()),ie.__version=S.version,a.memory.textures++),le){B.__webglFramebuffer=[];for(let K=0;K<6;K++)if(S.mipmaps.length>0){B.__webglFramebuffer[K]=[];for(let Z=0;Z<S.mipmaps.length;Z++)B.__webglFramebuffer[K][Z]=n.createFramebuffer()}else B.__webglFramebuffer[K]=n.createFramebuffer()}else{if(S.mipmaps.length>0){B.__webglFramebuffer=[];for(let K=0;K<S.mipmaps.length;K++)B.__webglFramebuffer[K]=n.createFramebuffer()}else B.__webglFramebuffer=n.createFramebuffer();if(fe)for(let K=0,Z=ee.length;K<Z;K++){let he=i.get(ee[K]);he.__webglTexture===void 0&&(he.__webglTexture=n.createTexture(),a.memory.textures++)}if(C.samples>0&&ge(C)===!1){B.__webglMultisampledFramebuffer=n.createFramebuffer(),B.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let K=0;K<ee.length;K++){let Z=ee[K];B.__webglColorRenderbuffer[K]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,B.__webglColorRenderbuffer[K]);let he=r.convert(Z.format,Z.colorSpace),P=r.convert(Z.type),Q=T(Z.internalFormat,he,P,Z.normalized,Z.colorSpace,C.isXRRenderTarget===!0),J=bt(C);n.renderbufferStorageMultisample(n.RENDERBUFFER,J,Q,C.width,C.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+K,n.RENDERBUFFER,B.__webglColorRenderbuffer[K])}n.bindRenderbuffer(n.RENDERBUFFER,null),C.depthBuffer&&(B.__webglDepthRenderbuffer=n.createRenderbuffer(),oi(B.__webglDepthRenderbuffer,C,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(le){t.bindTexture(n.TEXTURE_CUBE_MAP,ie.__webglTexture),rt(n.TEXTURE_CUBE_MAP,S);for(let K=0;K<6;K++)if(S.mipmaps.length>0)for(let Z=0;Z<S.mipmaps.length;Z++)St(B.__webglFramebuffer[K][Z],C,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+K,Z);else St(B.__webglFramebuffer[K],C,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0);_(S)?b(n.TEXTURE_CUBE_MAP):S.mipmaps.length>0&&n.texParameteri(n.TEXTURE_CUBE_MAP,n.TEXTURE_MAX_LEVEL,S.mipmaps.length-1),t.unbindTexture()}else if(fe){for(let K=0,Z=ee.length;K<Z;K++){let he=ee[K],P=i.get(he),Q=n.TEXTURE_2D;(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(Q=C.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(Q,P.__webglTexture),rt(Q,he),St(B.__webglFramebuffer,C,he,n.COLOR_ATTACHMENT0+K,Q,0),_(he)&&b(Q)}t.unbindTexture()}else{let K=n.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(K=C.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(K,ie.__webglTexture),rt(K,S),S.mipmaps.length>0)for(let Z=0;Z<S.mipmaps.length;Z++)St(B.__webglFramebuffer[Z],C,S,n.COLOR_ATTACHMENT0,K,Z);else St(B.__webglFramebuffer,C,S,n.COLOR_ATTACHMENT0,K,0);_(S)?b(K):S.mipmaps.length>0&&n.texParameteri(K,n.TEXTURE_MAX_LEVEL,S.mipmaps.length-1),t.unbindTexture()}C.depthBuffer&&Nn(C)}function U(C){let S=C.textures;for(let B=0,ie=S.length;B<ie;B++){let ee=S[B];if(_(ee)&&ee.mipmapsAutoUpdate===!0){let le=M(C),fe=i.get(ee).__webglTexture;t.bindTexture(le,fe),b(le),t.unbindTexture()}}}let Fn=[];function vt(C){if(C.samples>0){if(ge(C)===!1){let S=C.textures,B=C.width,ie=C.height,ee=n.COLOR_BUFFER_BIT,le=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,fe=i.get(C),K=S.length>1;if(K)for(let he=0;he<S.length;he++)t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,fe.__webglMultisampledFramebuffer),C.texture.mipmaps.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglFramebuffer);for(let he=0;he<S.length;he++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(ee|=n.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(ee|=n.STENCIL_BUFFER_BIT)),K){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,fe.__webglColorRenderbuffer[he]);let P=i.get(S[he]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,P,0)}n.blitFramebuffer(0,0,B,ie,0,0,B,ie,ee,n.NEAREST),l===!0&&(Fn.length=0,Fn.push(n.COLOR_ATTACHMENT0+he),C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&Fn.push(le),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Fn))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),K)for(let he=0;he<S.length;he++){t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.RENDERBUFFER,fe.__webglColorRenderbuffer[he]);let P=i.get(S[he]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.TEXTURE_2D,P,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&l){let S=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[S])}}}function bt(C){return Math.min(s.maxSamples,C.samples)}function ge(C){let S=i.get(C);return C.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function Ot(C){let S=a.render.frame;h.get(C)!==S&&(h.set(C,S),C.update())}function Ne(C,S){let B=C.colorSpace,ie=C.format,ee=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||B!==Us&&B!==ii&&(je.getTransfer(B)===ct?(ie!==Dn||ee!==In)&&De("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ue("WebGLTextures: Unsupported texture color space:",B)),S}function ze(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(c.width=C.displayWidth,c.height=C.displayHeight):(c.width=C.width,c.height=C.height),c}this.allocateTextureUnit=ke,this.resetTextureUnits=q,this.getTextureUnits=ne,this.setTextureUnits=ye,this.setTexture2D=oe,this.setTexture2DArray=ve,this.setTexture3D=Ce,this.setTextureCube=me,this.rebindTextures=On,this.setupRenderTarget=Un,this.updateRenderTargetMipmap=U,this.updateMultisampleRenderTarget=vt,this.setupDepthRenderbuffer=Nn,this.setupFrameBufferTexture=St,this.useMultisampledRTT=ge,this.dispose=G}function dM(n,e){function t(i,s=ii){let r,a=je.getTransfer(s);if(i===In)return n.UNSIGNED_BYTE;if(i===mc)return n.UNSIGNED_SHORT_4_4_4_4;if(i===gc)return n.UNSIGNED_SHORT_5_5_5_1;if(i===ud)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===dd)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===cd)return n.BYTE;if(i===hd)return n.SHORT;if(i===Vr)return n.UNSIGNED_SHORT;if(i===pc)return n.INT;if(i===ti)return n.UNSIGNED_INT;if(i===kn)return n.FLOAT;if(i===ni)return n.HALF_FLOAT;if(i===fd)return n.ALPHA;if(i===pd)return n.RGB;if(i===Dn)return n.RGBA;if(i===Ri)return n.DEPTH_COMPONENT;if(i===Di)return n.DEPTH_STENCIL;if(i===md)return n.RED;if(i===yc)return n.RED_INTEGER;if(i===ls)return n.RG;if(i===vc)return n.RG_INTEGER;if(i===bc)return n.RGBA_INTEGER;if(i===Ka||i===Za||i===Qa||i===eo)if(a===ct)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===Ka)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Za)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Qa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===eo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===Ka)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Za)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Qa)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===eo)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===xc||i===_c||i===Sc||i===wc)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===xc)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===_c)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Sc)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===wc)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Mc||i===Ec||i===Tc||i===Ac||i===Cc||i===to||i===Rc)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(i===Mc||i===Ec)return a===ct?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===Tc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===Ac)return r.COMPRESSED_R11_EAC;if(i===Cc)return r.COMPRESSED_SIGNED_R11_EAC;if(i===to)return r.COMPRESSED_RG11_EAC;if(i===Rc)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Pc||i===Lc||i===Ic||i===kc||i===Dc||i===Nc||i===Oc||i===Uc||i===Fc||i===Bc||i===zc||i===Hc||i===Vc||i===Gc)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(i===Pc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Lc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Ic)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===kc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Dc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Nc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Oc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Uc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Fc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Bc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===zc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Hc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Vc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Gc)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Wc||i===$c||i===Xc)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(i===Wc)return a===ct?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===$c)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Xc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===qc||i===Yc||i===no||i===jc)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(i===qc)return r.COMPRESSED_RED_RGTC1_EXT;if(i===Yc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===no)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===jc)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===$s?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var fM=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,pM=`
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

}`,zd=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new Wa(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new Cn({vertexShader:fM,fragmentShader:pM,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Zt(new Vs(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Hd=class extends Zn{constructor(e,t){super();let i=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,f=null,p=null,y=typeof XRWebGLBinding<"u",m=new zd,g={},v=t.getContextAttributes(),_=null,b=null,M=[],T=[],x=new Ie,A=null,k=null,R=new ln;R.viewport=new ht;let D=new ln;D.viewport=new ht;let H=[R,D],j=new hc,L=null,G=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let oe=M[$];return oe===void 0&&(oe=new Cr,M[$]=oe),oe.getTargetRaySpace()},this.getControllerGrip=function($){let oe=M[$];return oe===void 0&&(oe=new Cr,M[$]=oe),oe.getGripSpace()},this.getHand=function($){let oe=M[$];return oe===void 0&&(oe=new Cr,M[$]=oe),oe.getHandSpace()};function V($){let oe=T.indexOf($.inputSource);if(oe===-1)return;let ve=M[oe];ve!==void 0&&(ve.update($.inputSource,$.frame,c||a),ve.dispatchEvent({type:$.type,data:$.inputSource}))}function W(){s.removeEventListener("select",V),s.removeEventListener("selectstart",V),s.removeEventListener("selectend",V),s.removeEventListener("squeeze",V),s.removeEventListener("squeezestart",V),s.removeEventListener("squeezeend",V),s.removeEventListener("end",W),s.removeEventListener("inputsourceschange",te);for(let $=0;$<M.length;$++){let oe=T[$];oe!==null&&(T[$]=null,M[$].disconnect(oe))}L=null,G=null,m.reset();for(let $ in g)delete g[$];if(e.setRenderTarget(_),f=null,d=null,u=null,s=null,b=null,ke.stop(),i.isPresenting=!1,e.setPixelRatio(A),e.setSize(x.width,x.height,!1),k!==null){let $=k.camera;$.fov=k.fov,$.zoom=k.zoom,$.updateProjectionMatrix(),k=null}i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){r=$,i.isPresenting===!0&&De("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){o=$,i.isPresenting===!0&&De("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u===null&&y&&(u=new XRWebGLBinding(s,t)),u},this.getFrame=function(){return p},this.getSession=function(){return s},this.setSession=async function($){if(s=$,s!==null){if(_=e.getRenderTarget(),s.addEventListener("select",V),s.addEventListener("selectstart",V),s.addEventListener("selectend",V),s.addEventListener("squeeze",V),s.addEventListener("squeezestart",V),s.addEventListener("squeezeend",V),s.addEventListener("end",W),s.addEventListener("inputsourceschange",te),v.xrCompatible!==!0&&await t.makeXRCompatible(),A=e.getPixelRatio(),e.getSize(x),y&&"createProjectionLayer"in XRWebGLBinding.prototype){let ve=null,Ce=null,me=null;v.depth&&(me=v.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ve=v.stencil?Di:Ri,Ce=v.stencil?$s:ti);let Fe={colorFormat:t.RGBA8,depthFormat:me,scaleFactor:r};u=this.getBinding(),d=u.createProjectionLayer(Fe),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),b=new mn(d.textureWidth,d.textureHeight,{format:Dn,type:In,depthTexture:new Li(d.textureWidth,d.textureHeight,Ce,void 0,void 0,void 0,void 0,void 0,void 0,ve),stencilBuffer:v.stencil,colorSpace:e.outputColorSpace,samples:v.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let ve={antialias:v.antialias,alpha:!0,depth:v.depth,stencil:v.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,t,ve),s.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),b=new mn(f.framebufferWidth,f.framebufferHeight,{format:Dn,type:In,colorSpace:e.outputColorSpace,stencilBuffer:v.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}b.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),ke.setContext(s),ke.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function te($){for(let oe=0;oe<$.removed.length;oe++){let ve=$.removed[oe],Ce=T.indexOf(ve);Ce>=0&&(T[Ce]=null,M[Ce].disconnect(ve))}for(let oe=0;oe<$.added.length;oe++){let ve=$.added[oe],Ce=T.indexOf(ve);if(Ce===-1){for(let Fe=0;Fe<M.length;Fe++)if(Fe>=T.length){T.push(ve),Ce=Fe;break}else if(T[Fe]===null){T[Fe]=ve,Ce=Fe;break}if(Ce===-1)break}let me=M[Ce];me&&me.connect(ve)}}function Y($,oe){oe===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(oe.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(s===null)return;let oe=$.near,ve=$.far;m.texture!==null&&(m.depthNear>0&&(oe=m.depthNear),m.depthFar>0&&(ve=m.depthFar)),j.near=D.near=R.near=oe,j.far=D.far=R.far=ve,(L!==j.near||G!==j.far)&&(s.updateRenderState({depthNear:j.near,depthFar:j.far}),L=j.near,G=j.far),j.layers.mask=$.layers.mask|6,R.layers.mask=j.layers.mask&-5,D.layers.mask=j.layers.mask&-3;let Ce=$.parent,me=j.cameras;Y(j,Ce);for(let Fe=0;Fe<me.length;Fe++)Y(me[Fe],Ce);j.projectionMatrix.copy(R.projectionMatrix),j.projectionMatrixInverse.copy(R.projectionMatrixInverse),k===null&&$.isPerspectiveCamera&&(k={camera:$,fov:$.fov,zoom:$.zoom}),q($,j,Ce)};function q($,oe,ve){ve===null?$.matrix.copy(oe.matrixWorld):($.matrix.copy(ve.matrixWorld),$.matrix.invert(),$.matrix.multiply(oe.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(oe.projectionMatrix),$.projectionMatrixInverse.copy(oe.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=Tr*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return j},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function($){l=$,d!==null&&(d.fixedFoveation=$),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=$)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(j)},this.getCameraTexture=function($){return g[$]};let ne=null;function ye($,oe){if(h=oe.getViewerPose(c||a),p=oe,h!==null){let ve=h.views;f!==null&&(e.setRenderTargetFramebuffer(b,f.framebuffer),e.setRenderTarget(b));let Ce=!1;ve.length!==j.cameras.length&&(j.cameras.length=0,Ce=!0);for(let Se=0;Se<ve.length;Se++){let rt=ve[Se],at=null;if(f!==null)at=f.getViewport(rt);else{let Dt=u.getViewSubImage(d,rt);at=Dt.viewport,Se===0&&(e.setRenderTargetTextures(b,Dt.colorTexture,Dt.depthStencilTexture),e.setRenderTarget(b))}let He=H[Se];He===void 0&&(He=new ln,He.layers.enable(Se),He.viewport=new ht,H[Se]=He),He.matrix.fromArray(rt.transform.matrix),He.matrix.decompose(He.position,He.quaternion,He.scale),He.projectionMatrix.fromArray(rt.projectionMatrix),He.projectionMatrixInverse.copy(He.projectionMatrix).invert(),He.viewport.set(at.x,at.y,at.width,at.height),Se===0&&(j.matrix.copy(He.matrix),j.matrix.decompose(j.position,j.quaternion,j.scale)),Ce===!0&&j.cameras.push(He)}let me=s.enabledFeatures;if(me&&me.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&y){u=i.getBinding();let Se=u.getDepthInformation(ve[0]);Se&&Se.isValid&&Se.texture&&m.init(Se,s.renderState)}if(me&&me.includes("camera-access")&&y){e.state.unbindTexture(),u=i.getBinding();for(let Se=0;Se<ve.length;Se++){let rt=ve[Se].camera;if(rt){let at=g[rt];at||(at=new Wa,g[rt]=at);let He=u.getCameraImage(rt);at.sourceTexture=He}}}}for(let ve=0;ve<M.length;ve++){let Ce=T[ve],me=M[ve];Ce!==null&&me!==void 0&&me.update(Ce,oe,c||a)}ne&&ne($,oe),oe.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:oe}),p=null}let ke=new Sg;ke.setAnimationLoop(ye),this.setAnimationLoop=function($){ne=$},this.dispose=function(){}}},mM=new ft,Ig=new Be;Ig.set(-1,0,0,0,1,0,0,0,1);function gM(n,e){function t(m,g){m.matrixAutoUpdate===!0&&m.updateMatrix(),g.value.copy(m.matrix)}function i(m,g){g.color.getRGB(m.fogColor.value,Cd(n)),g.isFog?(m.fogNear.value=g.near,m.fogFar.value=g.far):g.isFogExp2&&(m.fogDensity.value=g.density)}function s(m,g,v,_,b){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(m,g):g.isMeshLambertMaterial?(r(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(m,g),u(m,g)):g.isMeshPhongMaterial?(r(m,g),h(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(m,g),d(m,g),g.isMeshPhysicalMaterial&&f(m,g,b)):g.isMeshMatcapMaterial?(r(m,g),p(m,g)):g.isMeshDepthMaterial?r(m,g):g.isMeshDistanceMaterial?(r(m,g),y(m,g)):g.isMeshNormalMaterial?r(m,g):g.isLineBasicMaterial?(a(m,g),g.isLineDashedMaterial&&o(m,g)):g.isPointsMaterial?l(m,g,v,_):g.isSpriteMaterial?c(m,g):g.isShadowMaterial?(m.color.value.copy(g.color),m.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(m,g){m.opacity.value=g.opacity,g.color&&m.diffuse.value.copy(g.color),g.emissive&&m.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.bumpMap&&(m.bumpMap.value=g.bumpMap,t(g.bumpMap,m.bumpMapTransform),m.bumpScale.value=g.bumpScale,g.side===gn&&(m.bumpScale.value*=-1)),g.normalMap&&(m.normalMap.value=g.normalMap,t(g.normalMap,m.normalMapTransform),m.normalScale.value.copy(g.normalScale),g.side===gn&&m.normalScale.value.negate()),g.displacementMap&&(m.displacementMap.value=g.displacementMap,t(g.displacementMap,m.displacementMapTransform),m.displacementScale.value=g.displacementScale,m.displacementBias.value=g.displacementBias),g.emissiveMap&&(m.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,m.emissiveMapTransform)),g.specularMap&&(m.specularMap.value=g.specularMap,t(g.specularMap,m.specularMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest);let v=e.get(g),_=v.envMap,b=v.envMapRotation;_&&(m.envMap.value=_,m.envMapRotation.value.setFromMatrix4(mM.makeRotationFromEuler(b)).transpose(),_.isCubeTexture&&_.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(Ig),m.reflectivity.value=g.reflectivity,m.ior.value=g.ior,m.refractionRatio.value=g.refractionRatio),g.lightMap&&(m.lightMap.value=g.lightMap,m.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,m.lightMapTransform)),g.aoMap&&(m.aoMap.value=g.aoMap,m.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,m.aoMapTransform))}function a(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform))}function o(m,g){m.dashSize.value=g.dashSize,m.totalSize.value=g.dashSize+g.gapSize,m.scale.value=g.scale}function l(m,g,v,_){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.size.value=g.size*v,m.scale.value=_*.5,g.map&&(m.map.value=g.map,t(g.map,m.uvTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function c(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.rotation.value=g.rotation,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function h(m,g){m.specular.value.copy(g.specular),m.shininess.value=Math.max(g.shininess,1e-4)}function u(m,g){g.gradientMap&&(m.gradientMap.value=g.gradientMap)}function d(m,g){m.metalness.value=g.metalness,g.metalnessMap&&(m.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,m.metalnessMapTransform)),m.roughness.value=g.roughness,g.roughnessMap&&(m.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,m.roughnessMapTransform)),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)}function f(m,g,v){m.ior.value=g.ior,g.diffuseRoughness>0&&(m.diffuseRoughness.value=g.diffuseRoughness,g.diffuseRoughnessMap&&(m.diffuseRoughnessMap.value=g.diffuseRoughnessMap,t(g.diffuseRoughnessMap,m.diffuseRoughnessMapTransform))),g.sheen>0&&(m.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),m.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(m.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,m.sheenColorMapTransform)),g.sheenRoughnessMap&&(m.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,m.sheenRoughnessMapTransform))),g.clearcoat>0&&(m.clearcoat.value=g.clearcoat,m.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(m.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,m.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(m.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===gn&&m.clearcoatNormalScale.value.negate())),g.dispersion>0&&(m.dispersion.value=g.dispersion),g.retroreflectivity>0&&(m.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(m.iridescence.value=g.iridescence,m.iridescenceIOR.value=g.iridescenceIOR,m.iridescenceThicknessMinimum.value=g.iridescenceThicknessMinimum,m.iridescenceThicknessMaximum.value=g.iridescenceThicknessMaximum,g.iridescenceMap&&(m.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,m.iridescenceMapTransform)),g.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),g.transmission>0&&(m.transmission.value=g.transmission,m.transmissionSamplerMap.value=v.texture,m.transmissionSamplerSize.value.set(v.width,v.height),g.transmissionMap&&(m.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,m.transmissionMapTransform)),m.thickness.value=g.thickness,g.thicknessMap&&(m.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=g.attenuationDistance,m.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(m.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(m.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=g.specularIntensity,m.specularColor.value.copy(g.specularColor),g.specularColorMap&&(m.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,m.specularColorMapTransform)),g.specularIntensityMap&&(m.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,m.specularIntensityMapTransform))}function p(m,g){g.matcap&&(m.matcap.value=g.matcap)}function y(m,g){let v=e.get(g).light;m.referencePosition.value.setFromMatrixPosition(v.matrixWorld),m.nearDistance.value=v.shadow.camera.near,m.farDistance.value=v.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function yM(n,e,t,i){let s={},r={};function a(v,_){let b=_.program;i.uniformBlockBinding(v,b,s[v.id])}function o(v,_){let b=s[v.id];b===void 0&&(p(v),b=l(v),s[v.id]=b,v.addEventListener("dispose",m));let M=_.program;i.updateUBOMapping(v,M);let T=e.render.frame;r[v.id]!==T&&(c(v),r[v.id]=T)}function l(v){let _=n.createBuffer(),b=v.__size,M=v.usage;return n.bindBuffer(n.UNIFORM_BUFFER,_),n.bufferData(n.UNIFORM_BUFFER,b,M),n.bindBuffer(n.UNIFORM_BUFFER,null),_}function c(v){let _=s[v.id],b=v.uniforms,M=v.__cache;n.bindBuffer(n.UNIFORM_BUFFER,_);for(let T=0,x=b.length;T<x;T++){let A=b[T];if(Array.isArray(A))for(let k=0,R=A.length;k<R;k++)h(A[k],T,k,M);else h(A,T,0,M)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function h(v,_,b,M){if(d(v,_,b,M)===!0){let T=v.__offset,x=v.value;if(Array.isArray(x)){let A=0;for(let k=0;k<x.length;k++){let R=x[k],D=y(R,!0);u(R,v.__data,A),A+=D.storage/Float32Array.BYTES_PER_ELEMENT}}else u(x,v.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,T,v.__data)}}function u(v,_,b){typeof v=="number"||typeof v=="boolean"?_[b]=v:v.isMatrix3?(_[b]=v.elements[0],_[b+1]=v.elements[1],_[b+2]=v.elements[2],_[b+3]=0,_[b+4]=v.elements[3],_[b+5]=v.elements[4],_[b+6]=v.elements[5],_[b+7]=0,_[b+8]=v.elements[6],_[b+9]=v.elements[7],_[b+10]=v.elements[8],_[b+11]=0):ArrayBuffer.isView(v)?_.set(v.subarray(0,_.length-b),b):v.toArray(_,b)}function d(v,_,b,M){let T=v.value,x=_+"_"+b;if(Array.isArray(T)){M[x]===void 0&&(M[x]=[]);let A=M[x],k=!1;for(let R=0;R<T.length;R++)f(T[R],A,R)===!0&&(k=!0);return k}return f(T,M,x)}function f(v,_,b){if(_[b]===void 0)return typeof v=="number"||typeof v=="boolean"?_[b]=v:ArrayBuffer.isView(v)?_[b]=v.slice():_[b]=v.clone(),!0;{let M=_[b];if(typeof v=="number"||typeof v=="boolean"){if(M!==v)return _[b]=v,!0}else{if(ArrayBuffer.isView(v))return!0;if(M.equals(v)===!1)return M.copy(v),!0}}return!1}function p(v){let _=v.uniforms,b=0,M=16;for(let x=0,A=_.length;x<A;x++){let k=Array.isArray(_[x])?_[x]:[_[x]];for(let R=0,D=k.length;R<D;R++){let H=k[R],j=Array.isArray(H.value)?H.value:[H.value],L=Array.isArray(_[x])||Array.isArray(H.value),G=b;for(let W=0,te=j.length;W<te;W++){let Y=j[W],q=y(Y,L),ne=b%M,ye=ne%q.boundary,ke=ne+ye;b+=ye,ke!==0&&M-ke<q.storage&&(b+=M-ke),W===0&&(G=b),b+=q.storage}let V=H.type==="int"?Int32Array:H.type==="uint"?Uint32Array:Float32Array;H.__data=new V((b-G)/Float32Array.BYTES_PER_ELEMENT),H.__offset=G}}let T=b%M;return T>0&&(b+=M-T),v.__size=b,v.__cache={},this}function y(v,_){let b={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(b.boundary=4,b.storage=4):v.isVector2?(b.boundary=8,b.storage=8):v.isVector3||v.isColor?(b.boundary=16,b.storage=12):v.isVector4?(b.boundary=16,b.storage=16):v.isMatrix3?(b.boundary=16,b.storage=48):v.isMatrix4?(b.boundary=16,b.storage=64):v.isTexture?De("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(b.boundary=16,b.storage=v.byteLength):De("WebGLRenderer: Unsupported uniform value type.",v),_===!0&&(b.boundary=16,b.storage=Math.ceil(b.storage/16)*16),b}function m(v){let _=v.target;_.removeEventListener("dispose",m),n.deleteBuffer(s[_.id]),delete s[_.id],delete r[_.id]}function g(){for(let v in s)n.deleteBuffer(s[v]);s={},r={}}return{bind:a,update:o,dispose:g}}var vM=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),yi=null;function bM(){return yi===null&&(yi=new Pr(vM,16,16,ls,ni),yi.name="DFG_LUT",yi.minFilter=pn,yi.magFilter=pn,yi.wrapS=pi,yi.wrapT=pi,yi.generateMipmaps=!1,yi.needsUpdate=!0),yi}var eh=class{constructor(e={}){let{canvas:t=qm(),context:i=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=In}=e;this.isWebGLRenderer=!0;let p;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=i.getContextAttributes().alpha}else p=a;let y=f,m=new Set([bc,vc,yc]),g=new Set([In,ti,Vr,$s,mc,gc]),v=new Uint32Array(4),_=new Int32Array(4),b={textures:[],min:[],max:[],resolution:[]},M=null,T=null,x=[],A=[],k=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=mi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let R=this,D=!1,H=null,j=null,L=null,G=null;this._outputColorSpace=En;let V=0,W=0,te=null,Y=-1,q=null,ne=new ht,ye=new ht,ke=null,$=new Xe(0),oe=0,ve=t.width,Ce=t.height,me=1,Fe=null,Ye=null,Se=new ht(0,0,ve,Ce),rt=new ht(0,0,ve,Ce),at=!1,He=new Bs,Dt=new Yl,Nt=!1,yn=!1,St=new ft,oi=new O,Gt=new ht,Nn={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},On=!1;function Un(){return te===null?me:1}let U=i;function Fn(w,I){return t.getContext(w,I)}let vt,bt,ge,Ot,Ne,ze,C,S,B,ie,ee,le,fe,K,Z,he,P,Q,J,ue,ae,ce,Re;try{let w={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"187"}`),t.addEventListener("webglcontextlost",Le,!1),t.addEventListener("webglcontextrestored",Ge,!1),t.addEventListener("webglcontextcreationerror",be,!1),U===null){let I="webgl2";if(U=Fn(I,w),U===null)throw Fn(I)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}We()}catch(w){throw t.removeEventListener("webglcontextlost",Le,!1),t.removeEventListener("webglcontextrestored",Ge,!1),t.removeEventListener("webglcontextcreationerror",be,!1),Ue("WebGLRenderer: "+w.message),w}function We(){vt=new PS(U),vt.init(),ae=new dM(U,vt),bt=new bS(U,vt,e,ae),ge=new hM(U,vt),bt.reversedDepthBuffer&&d&&ge.buffers.depth.setReversed(!0),j=U.createFramebuffer(),L=U.createFramebuffer(),G=U.createFramebuffer(),Ot=new kS(U),Ne=new Jw,ze=new uM(U,vt,ge,Ne,bt,ae,Ot),C=new RS(R),S=new Nb(U),ce=new yS(U,S),B=new LS(U,S,Ot,ce),ie=new NS(U,B,S,ce,Ot),Q=new DS(U,bt,ze),Z=new xS(Ne),ee=new jw(R,C,vt,bt,ce,Z),le=new gM(R,Ne),fe=new Zw,K=new sM(vt),P=new gS(R,C,ge,ie,p,l),he=new cM(R,ie,bt),Re=new yM(U,Ot,bt,ge),J=new vS(U,vt,Ot),ue=new IS(U,vt,Ot),Ot.programs=ee.programs,R.capabilities=bt,R.extensions=vt,R.properties=Ne,R.renderLists=fe,R.shadowMap=he,R.state=ge,R.info=Ot}y!==In&&(k=new US(y,t.width,t.height,o,s,r));let se=new Hd(R,U);this.xr=se,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){let w=vt.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){let w=vt.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return me},this.setPixelRatio=function(w){w!==void 0&&(me=w,this.setSize(ve,Ce,!1))},this.getSize=function(w){return w.set(ve,Ce)},this.setSize=function(w,I,X=!0){if(se.isPresenting){De("WebGLRenderer: Can't change size while VR device is presenting.");return}ve=w,Ce=I,t.width=Math.floor(w*me),t.height=Math.floor(I*me),X===!0&&(t.style.width=w+"px",t.style.height=I+"px"),k!==null&&k.setSize(t.width,t.height),this.setViewport(0,0,w,I)},this.getDrawingBufferSize=function(w){return w.set(ve*me,Ce*me).floor()},this.setDrawingBufferSize=function(w,I,X){ve=w,Ce=I,me=X,t.width=Math.floor(w*X),t.height=Math.floor(I*X),this.setViewport(0,0,w,I)},this.setEffects=function(w){if(y===In){Ue("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(w){for(let I=0;I<w.length;I++)if(w[I].isOutputPass===!0){De("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}k.setEffects(w||[])},this.getCurrentViewport=function(w){return w.copy(ne)},this.getViewport=function(w){return w.copy(Se)},this.setViewport=function(w,I,X,F){w.isVector4?Se.set(w.x,w.y,w.z,w.w):Se.set(w,I,X,F),ge.viewport(ne.copy(Se).multiplyScalar(Un()).round())},this.getScissor=function(w){return w.copy(rt)},this.setScissor=function(w,I,X,F){w.isVector4?rt.set(w.x,w.y,w.z,w.w):rt.set(w,I,X,F),ge.scissor(ye.copy(rt).multiplyScalar(Un()).round())},this.getScissorTest=function(){return at},this.setScissorTest=function(w){ge.setScissorTest(at=w)},this.setOpaqueSort=function(w){Fe=w},this.setTransparentSort=function(w){Ye=w},this.getClearColor=function(w){return w.copy(P.getClearColor())},this.setClearColor=function(){P.setClearColor(...arguments)},this.getClearAlpha=function(){return P.getClearAlpha()},this.setClearAlpha=function(){P.setClearAlpha(...arguments)},this.clear=function(w=!0,I=!0,X=!0){let F=0;if(w){let z=!1;if(te!==null){let pe=te.texture.format;z=m.has(pe)}if(z){let pe=te.texture.type,Me=g.has(pe),de=P.getClearColor(),_e=P.getClearAlpha(),Ae=de.r,Ve=de.g,Ke=de.b;Me?(v[0]=Ae,v[1]=Ve,v[2]=Ke,v[3]=_e,U.clearBufferuiv(U.COLOR,0,v)):(_[0]=Ae,_[1]=Ve,_[2]=Ke,_[3]=_e,U.clearBufferiv(U.COLOR,0,_))}else F|=U.COLOR_BUFFER_BIT}I&&(F|=U.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),X&&(F|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),F!==0&&U.clear(F)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(w){w.setRenderer(this),H=w},this.dispose=function(){t.removeEventListener("webglcontextlost",Le,!1),t.removeEventListener("webglcontextrestored",Ge,!1),t.removeEventListener("webglcontextcreationerror",be,!1),P.dispose(),fe.dispose(),K.dispose(),ze.dispose(),Ne.dispose(),C.dispose(),ie.dispose(),B.dispose(),ce.dispose(),Re.dispose(),ee.dispose(),se.dispose(),se.removeEventListener("sessionstart",yf),se.removeEventListener("sessionend",vf),ps.stop()};function Le(w){w.preventDefault(),Ua("WebGLRenderer: Context Lost."),D=!0}function Ge(){Ua("WebGLRenderer: Context Restored."),D=!1;let w=Ot.autoReset,I=he.enabled,X=he.autoUpdate,F=he.needsUpdate,z=he.type;We(),Ot.autoReset=w,he.enabled=I,he.autoUpdate=X,he.needsUpdate=F,he.type=z}function be(w){Ue("WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function ut(w){let I=w.target;I.removeEventListener("dispose",ut),Wt(I)}function Wt(w){Ui(w),Ne.remove(w)}function Ui(w){let I=Ne.get(w).programs;I!==void 0&&(I.forEach(function(X){ee.releaseProgram(X)}),w.isShaderMaterial&&ee.releaseShaderCache(w))}this.renderBufferDirect=function(w,I,X,F,z,pe){I===null&&(I=Nn);let Me=z.isMesh&&z.matrixWorld.determinantAffine()<0,de=O0(w,I,X,F,z);ge.setMaterial(F,Me);let _e=X.index,Ae=1;if(F.wireframe===!0){if(_e=B.getWireframeAttribute(X),_e===void 0)return;Ae=2}let Ve=X.drawRange,Ke=X.attributes.position,Ee=Ve.start*Ae,Ze=(Ve.start+Ve.count)*Ae;pe!==null&&(Ee=Math.max(Ee,pe.start*Ae),Ze=Math.min(Ze,(pe.start+pe.count)*Ae)),_e!==null?(Ee=Math.max(Ee,0),Ze=Math.min(Ze,_e.count)):Ke!=null&&(Ee=Math.max(Ee,0),Ze=Math.min(Ze,Ke.count));let At=Ze-Ee;if(At<0||At===1/0)return;ce.setup(z,F,de,X,_e);let pt,dt=J;if(_e!==null&&(pt=S.get(_e),dt=ue,dt.setIndex(pt)),z.isMesh)F.wireframe===!0?(ge.setLineWidth(F.wireframeLinewidth*Un()),dt.setMode(U.LINES)):dt.setMode(U.TRIANGLES);else if(z.isLine){let nn=F.linewidth;nn===void 0&&(nn=1),ge.setLineWidth(nn*Un()),z.isLineSegments?dt.setMode(U.LINES):z.isLineLoop?dt.setMode(U.LINE_LOOP):dt.setMode(U.LINE_STRIP)}else z.isPoints?dt.setMode(U.POINTS):z.isSprite&&dt.setMode(U.TRIANGLES);if(z.isBatchedMesh)if(vt.get("WEBGL_multi_draw"))dt.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{let nn=z._multiDrawStarts,Te=z._multiDrawCounts,hn=z._multiDrawCount,nt=_e?S.get(_e).bytesPerElement:1,ms=Ne.get(F).currentProgram.getUniforms();for(let sn=0;sn<hn;sn++)ms.setValue(U,"_gl_DrawID",sn),dt.render(nn[sn]/nt,Te[sn])}else if(z.isInstancedMesh)dt.renderInstances(Ee,At,z.count);else if(X.isInstancedBufferGeometry){let nn=X._maxInstanceCount!==void 0?X._maxInstanceCount:1/0,Te=Math.min(X.instanceCount,nn);dt.renderInstances(Ee,At,Te)}else dt.render(Ee,At)};function gf(w,I,X,F){H!==null&&w.isNodeMaterial&&H.setObject(F,w),Nt===!0&&Z.setState(w,X,!1),w.transparent===!0&&w.side===Ln&&w.forceSinglePass===!1?(w.side=gn,w.needsUpdate=!0,ea(w,I,F),w.side=os,w.needsUpdate=!0,ea(w,I,F),w.side=Ln):ea(w,I,F)}this.compile=function(w,I,X=null){X===null&&(X=w),H!==null&&H.renderStart(w,I,X),T=K.get(X),T.init(I),A.push(T),X.traverseVisible(function(z){z.isLight&&z.layers.test(I.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),w!==X&&w.traverseVisible(function(z){z.isLight&&z.layers.test(I.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),T.setupLights(),H!==null&&H.updateLights(T.state.lightsArray),yn=this.localClippingEnabled,Nt=Z.init(this.clippingPlanes,yn),Nt===!0&&Z.setGlobalState(this.clippingPlanes,I),H!==null&&he.render(T.state.shadowsArray,X,I);let F=new Set;return w.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;let pe=z.material;if(pe)if(Array.isArray(pe))for(let Me=0;Me<pe.length;Me++){let de=pe[Me];gf(de,X,I,z),F.add(de)}else gf(pe,X,I,z),F.add(pe)}),T=A.pop(),H!==null&&H.renderEnd(),F},this.compileAsync=function(w,I,X=null){let F=this.compile(w,I,X);return new Promise(z=>{function pe(){if(F.forEach(function(Me){let _e=Ne.get(Me).currentProgram;(_e===void 0||_e.isReady())&&F.delete(Me)}),F.size===0){z(w);return}setTimeout(pe,10)}vt.get("KHR_parallel_shader_compile")!==null?pe():setTimeout(pe,10)})};let Th=null;function D0(w){Th&&Th(w)}function yf(){ps.stop()}function vf(){ps.start()}let ps=new Sg;ps.setAnimationLoop(D0),typeof self<"u"&&ps.setContext(self),this.setAnimationLoop=function(w){Th=w,se.setAnimationLoop(w),w===null?ps.stop():ps.start()},se.addEventListener("sessionstart",yf),se.addEventListener("sessionend",vf),this.render=function(w,I){if(I!==void 0&&I.isCamera!==!0){Ue("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;H!==null&&H.renderStart(w,I);let X=se.enabled===!0&&se.isPresenting===!0,F=k!==null&&(te===null||X)&&k.begin(R,te);if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),I.parent===null&&I.matrixWorldAutoUpdate===!0&&I.updateMatrixWorld(),se.enabled===!0&&se.isPresenting===!0&&(k===null||k.isCompositing()===!1)&&(se.cameraAutoUpdate===!0&&se.updateCamera(I),I=se.getCamera()),w.isScene===!0&&w.onBeforeRender(R,w,I,te),T=K.get(w,A.length),T.init(I),T.state.textureUnits=ze.getTextureUnits(),A.push(T),St.multiplyMatrices(I.projectionMatrix,I.matrixWorldInverse),I.isArrayCamera?Dt.setFromArrayCamera(I):He.setFromProjectionMatrix(St,Gn,I.reversedDepth),yn=this.localClippingEnabled,Nt=Z.init(this.clippingPlanes,yn),M=fe.get(w,x.length),M.init(),x.push(M),this.info.render.frame++,se.enabled===!0&&se.isPresenting===!0){let Me=R.xr.getDepthSensingMesh();Me!==null&&Ah(Me,I,-1/0,R.sortObjects)}Ah(w,I,0,R.sortObjects),M.finish(),H!==null&&H.updateLights(T.state.lightsArray),R.sortObjects===!0&&M.sort(Fe,Ye),On=se.enabled===!1||se.isPresenting===!1||se.hasDepthSensing()===!1,On&&P.addToRenderList(M,w),this.info.autoReset===!0&&this.info.reset(),Nt===!0&&Z.beginShadows();let z=T.state.shadowsArray;if(he.render(z,w,I),Nt===!0&&Z.endShadows(),(F&&k.hasRenderPass())===!1){let Me=M.opaque,de=M.transmissive;if(T.setupLights(),I.isArrayCamera){let _e=I.cameras;if(de.length>0)for(let Ae=0,Ve=_e.length;Ae<Ve;Ae++){let Ke=_e[Ae];xf(Me,de,w,Ke)}On&&P.render(w);for(let Ae=0,Ve=_e.length;Ae<Ve;Ae++){let Ke=_e[Ae];bf(M,w,Ke,Ke.viewport)}}else de.length>0&&xf(Me,de,w,I),On&&P.render(w),bf(M,w,I)}te!==null&&W===0&&(ze.updateMultisampleRenderTarget(te),ze.updateRenderTargetMipmap(te)),F&&k.end(R),w.isScene===!0&&w.onAfterRender(R,w,I),ce.resetDefaultState(),Y=-1,q=null,A.pop(),A.length>0?(T=A[A.length-1],ze.setTextureUnits(T.state.textureUnits),Nt===!0&&Z.setGlobalState(R.clippingPlanes,T.state.camera)):T=null,x.pop(),x.length>0?M=x[x.length-1]:M=null,H!==null&&H.renderEnd()};function Ah(w,I,X,F){if(w.visible===!1)return;if(w.layers.test(I.layers)){if(w.isGroup)X=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(I);else if(w.isLight)T.pushLight(w),w.castShadow&&T.pushShadow(w);else if(w.isSprite){let Me=I.isArrayCamera?Dt:He;if(!w.frustumCulled||w.intersectsFrustum(Me)){F&&Gt.setFromMatrixPosition(w.matrixWorld).applyMatrix4(St);let de=ie.update(w),_e=w.material;_e.visible&&M.push(w,de,_e,X,Gt.z,null,I)}}else if(w.isMesh||w.isLine||w.isPoints){let Me=I.isArrayCamera?Dt:He;if(!w.frustumCulled||w.intersectsFrustum(Me)){let de=ie.update(w),_e=w.material;if(F&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Gt.copy(w.boundingSphere.center)):(de.boundingSphere===null&&de.computeBoundingSphere(),Gt.copy(de.boundingSphere.center)),Gt.applyMatrix4(w.matrixWorld).applyMatrix4(St)),Array.isArray(_e)){let Ae=de.groups;for(let Ve=0,Ke=Ae.length;Ve<Ke;Ve++){let Ee=Ae[Ve],Ze=_e[Ee.materialIndex];Ze&&Ze.visible&&M.push(w,de,Ze,X,Gt.z,Ee,I)}}else _e.visible&&M.push(w,de,_e,X,Gt.z,null,I)}}}let pe=w.children;for(let Me=0,de=pe.length;Me<de;Me++)Ah(pe[Me],I,X,F)}function bf(w,I,X,F){let{opaque:z,transmissive:pe,transparent:Me}=w;T.setupLightsView(X),Nt===!0&&Z.setGlobalState(R.clippingPlanes,X),F&&ge.viewport(ne.copy(F)),z.length>0&&_o(z,I,X),pe.length>0&&_o(pe,I,X),Me.length>0&&_o(Me,I,X),ge.buffers.depth.setTest(!0),ge.buffers.depth.setMask(!0),ge.buffers.color.setMask(!0),ge.setPolygonOffset(!1)}function xf(w,I,X,F){if((X.isScene===!0?X.overrideMaterial:null)!==null)return;if(T.state.transmissionRenderTarget[F.id]===void 0){let Ee=vt.has("EXT_color_buffer_half_float")||vt.has("EXT_color_buffer_float");T.state.transmissionRenderTarget[F.id]=new mn(1,1,{generateMipmaps:!0,type:Ee?ni:In,minFilter:ki,samples:Math.max(4,bt.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:je.workingColorSpace})}let pe=T.state.transmissionRenderTarget[F.id],Me=F.viewport||ne;pe.setSize(Me.z*R.transmissionResolutionScale,Me.w*R.transmissionResolutionScale);let de=R.getRenderTarget(),_e=R.getActiveCubeFace(),Ae=R.getActiveMipmapLevel();R.setRenderTarget(pe),R.getClearColor($),oe=R.getClearAlpha(),oe<1&&R.setClearColor(16777215,.5),R.clear(),On&&P.render(X);let Ve=R.toneMapping;R.toneMapping=mi;let Ke=F.viewport;if(F.viewport!==void 0&&(F.viewport=void 0),T.setupLightsView(F),Nt===!0&&Z.setGlobalState(R.clippingPlanes,F),_o(w,X,F),ze.updateMultisampleRenderTarget(pe),ze.updateRenderTargetMipmap(pe),vt.has("WEBGL_multisampled_render_to_texture")===!1){let Ee=!1;for(let Ze=0,At=I.length;Ze<At;Ze++){let pt=I[Ze],{object:dt,geometry:nn,material:Te,group:hn}=pt;if(Te.side===Ln&&dt.layers.test(F.layers)){let nt=Te.side;Te.side=gn,Te.needsUpdate=!0,_f(dt,X,F,nn,Te,hn),Te.side=nt,Te.needsUpdate=!0,Ee=!0}}Ee===!0&&(ze.updateMultisampleRenderTarget(pe),ze.updateRenderTargetMipmap(pe))}R.setRenderTarget(de,_e,Ae),R.setClearColor($,oe),Ke!==void 0&&(F.viewport=Ke),R.toneMapping=Ve}function _o(w,I,X){let F=I.isScene===!0?I.overrideMaterial:null;for(let z=0,pe=w.length;z<pe;z++){let Me=w[z],{object:de,geometry:_e,group:Ae}=Me,Ve=Me.material;Ve.allowOverride===!0&&F!==null&&(Ve=F),de.layers.test(X.layers)&&_f(de,I,X,_e,Ve,Ae)}}function _f(w,I,X,F,z,pe){H!==null&&z.isNodeMaterial&&H.setObject(w,z),w.onBeforeRender(R,I,X,F,z,pe),w.modelViewMatrix.multiplyMatrices(X.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),z.onBeforeRender(R,I,X,F,w,pe),z.transparent===!0&&z.side===Ln&&z.forceSinglePass===!1?(z.side=gn,z.needsUpdate=!0,R.renderBufferDirect(X,I,F,z,w,pe),z.side=os,z.needsUpdate=!0,R.renderBufferDirect(X,I,F,z,w,pe),z.side=Ln):R.renderBufferDirect(X,I,F,z,w,pe),w.onAfterRender(R,I,X,F,z,pe)}function Sf(w){let I=0;for(let X of w)X.texture!==null&&I++;return I}function ea(w,I,X){I.isScene!==!0&&(I=Nn);let F=Ne.get(w),z=T.state.lights,pe=T.state.shadowsArray,Me=z.state.version,de=ee.getParameters(w,z.state,pe,I,X,T.state.lightProbeGridArray),_e=ee.getProgramCacheKey(de),Ae=F.programs;F.environment=w.isMeshStandardMaterial||w.isMeshLambertMaterial||w.isMeshPhongMaterial?I.environment:null,F.fog=I.fog;let Ve=w.isMeshStandardMaterial||w.isMeshLambertMaterial&&!w.envMap||w.isMeshPhongMaterial&&!w.envMap;F.envMap=C.get(w.envMap||F.environment,Ve),F.envMapRotation=F.environment!==null&&w.envMap===null?I.environmentRotation:w.envMapRotation,Ae===void 0&&(w.addEventListener("dispose",ut),Ae=new Map,F.programs=Ae,F.programVariants=new Map);let Ke=Ae.get(_e);if(Ke!==void 0){if(F.currentProgram===Ke&&F.lightsStateVersion===Me)return Mf(w,de),Ke}else de.uniforms=ee.getUniforms(w),H!==null&&w.isNodeMaterial&&H.build(w,X,de),w.onBeforeCompile(de,R),Ke=ee.acquireProgram(de,_e),Ae.set(_e,Ke),F.uniforms=de.uniforms;let Ee=F.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Ee.clippingPlanes=Z.uniform),Mf(w,de),F.needsLights=F0(w),F.lightsStateVersion=Me,F.needsLights&&(Ee.ambientLightColor.value=z.state.ambient,Ee.lightProbe.value=z.state.probe,Ee.sunLights.value=z.state.sun,Ee.sunLightShadows.value=z.state.sunShadow,Ee.directionalLights.value=z.state.directional,Ee.directionalLightShadows.value=z.state.directionalShadow,Ee.spotLights.value=z.state.spot,Ee.spotLightShadows.value=z.state.spotShadow,Ee.rectAreaLights.value=z.state.rectArea,Ee.ltc_1.value=z.state.rectAreaLTC1,Ee.ltc_2.value=z.state.rectAreaLTC2,Ee.pointLights.value=z.state.point,Ee.pointLightShadows.value=z.state.pointShadow,Ee.hemisphereLights.value=z.state.hemi,Ee.sunShadowMatrix.value=z.state.sunShadowMatrix,Ee.sunShadowCascade.value=z.state.sunShadowCascade,Ee.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Ee.spotLightMatrix.value=z.state.spotLightMatrix,Ee.spotLightMap.value=z.state.spotLightMap,Ee.pointShadowMatrix.value=z.state.pointShadowMatrix),F.numLightProbeGrids=Sf(T.state.lightProbeGridArray),F.currentProgram=Ke,F.uniformsList=null,Ke}function N0(w,I,X,F,z){let pe=Ne.get(w),Me=pe.currentProgram.id+","+F+","+z,de=pe.programVariants.get(Me);return de===void 0?(de=ea(w,I,X),pe.programVariants.set(Me,de)):(pe.currentProgram=de,pe.uniformsList=null,pe.outputColorSpace=F,pe.toneMapping=z),de}function wf(w){if(w.uniformsList===null){let I=w.currentProgram.getUniforms();w.uniformsList=Gr.seqWithValue(I.seq,w.uniforms)}return w.uniformsList}function Mf(w,I){let X=Ne.get(w);X.outputColorSpace=I.outputColorSpace,X.batching=I.batching,X.batchingColor=I.batchingColor,X.instancing=I.instancing,X.instancingColor=I.instancingColor,X.instancingMorph=I.instancingMorph,X.skinning=I.skinning,X.morphTargets=I.morphTargets,X.morphNormals=I.morphNormals,X.morphColors=I.morphColors,X.morphTargetsCount=I.morphTargetsCount,X.numClippingPlanes=I.numClippingPlanes,X.numIntersection=I.numClipIntersection,X.vertexAlphas=I.vertexAlphas,X.vertexTangents=I.vertexTangents,X.toneMapping=I.toneMapping}function O0(w,I,X,F,z){I.isScene!==!0&&(I=Nn),ze.resetTextureUnits();let pe=I.fog,Me=F.isMeshStandardMaterial||F.isMeshLambertMaterial||F.isMeshPhongMaterial?I.environment:null,de=te===null?R.outputColorSpace:te.isXRRenderTarget===!0?te.texture.colorSpace:je.workingColorSpace,_e=F.isMeshStandardMaterial||F.isMeshLambertMaterial&&!F.envMap||F.isMeshPhongMaterial&&!F.envMap,Ae=C.get(F.envMap||Me,_e),Ve=F.vertexColors===!0&&!!X.attributes.color&&X.attributes.color.itemSize===4,Ke=!!X.attributes.tangent&&(!!F.normalMap||F.anisotropy>0),Ee=!!X.morphAttributes.position,Ze=!!X.morphAttributes.normal,At=!!X.morphAttributes.color,pt=mi;F.toneMapped&&(te===null||te.isXRRenderTarget===!0)&&(pt=R.toneMapping);let dt=X.morphAttributes.position||X.morphAttributes.normal||X.morphAttributes.color,nn=dt!==void 0?dt.length:0,Te=Ne.get(F),hn=T.state.lights;if(Nt===!0&&(yn===!0||w!==q)){let wt=w===q&&F.id===Y;Z.setState(F,w,wt)}let nt=!1,ms=!1;F.version===Te.__version?Te.needsLights&&Te.lightsStateVersion!==hn.state.version||z.isBatchedMesh&&Te.batching===!1||!z.isBatchedMesh&&Te.batching===!0||z.isBatchedMesh&&Te.batchingColor===!0&&z._colorsTexture===null||z.isBatchedMesh&&Te.batchingColor===!1&&z._colorsTexture!==null||z.isInstancedMesh&&Te.instancing===!1||!z.isInstancedMesh&&Te.instancing===!0||z.isSkinnedMesh&&Te.skinning===!1||!z.isSkinnedMesh&&Te.skinning===!0||z.isInstancedMesh&&Te.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Te.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Te.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Te.instancingMorph===!1&&z.morphTexture!==null||Te.envMap!==Ae||F.fog===!0&&Te.fog!==pe||Te.numClippingPlanes!==void 0&&(Te.numClippingPlanes!==Z.numPlanes||Te.numIntersection!==Z.numIntersection)||Te.vertexAlphas!==Ve||Te.vertexTangents!==Ke||Te.morphTargets!==Ee||Te.morphNormals!==Ze||Te.morphColors!==At||Te.morphTargetsCount!==nn||Te.numLightProbeGrids!==Sf(T.state.lightProbeGridArray)?nt=!0:(Te.outputColorSpace!==de||Te.toneMapping!==pt)&&(ms=!0):(nt=!0,Te.__version=F.version);let sn=Te.currentProgram;(nt===!0||ms===!0)&&(sn=ms===!0?N0(F,I,z,de,pt):ea(F,I,z),H&&F.isNodeMaterial&&H.onUpdateProgram(F,sn,Te));let So=!1,Fi=!1,gs=!1,tt=sn.getUniforms(),Qt=Te.uniforms;if(ge.useProgram(sn.program)&&(So=!0,Fi=!0,gs=!0),F.id!==Y&&(Y=F.id,Fi=!0),So||q!==w){ge.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),tt.setValue(U,"projectionMatrix",w.projectionMatrix),tt.setValue(U,"viewMatrix",w.matrixWorldInverse);let $t=tt.map.cameraPosition;$t!==void 0&&$t.setValue(U,oi.setFromMatrixPosition(w.matrixWorld)),bt.logarithmicDepthBuffer&&tt.setValue(U,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(F.isMeshPhongMaterial||F.isMeshToonMaterial||F.isMeshLambertMaterial||F.isMeshBasicMaterial||F.isMeshStandardMaterial||F.isShaderMaterial)&&tt.setValue(U,"isOrthographic",w.isOrthographicCamera===!0),q!==w&&(q=w,Fi=!0,gs=!0)}if(Te.needsLights&&(hn.state.sunShadowMap.length>0&&tt.setValue(U,"sunShadowMap",hn.state.sunShadowMap,ze),hn.state.directionalShadowMap.length>0&&tt.setValue(U,"directionalShadowMap",hn.state.directionalShadowMap,ze),hn.state.spotShadowMap.length>0&&tt.setValue(U,"spotShadowMap",hn.state.spotShadowMap,ze),hn.state.pointShadowMap.length>0&&tt.setValue(U,"pointShadowMap",hn.state.pointShadowMap,ze)),z.isSkinnedMesh){tt.setOptional(U,z,"bindMatrix"),tt.setOptional(U,z,"bindMatrixInverse");let wt=z.skeleton;wt&&(wt.boneTexture===null&&wt.computeBoneTexture(),tt.setValue(U,"boneTexture",wt.boneTexture,ze))}z.isBatchedMesh&&(tt.setOptional(U,z,"batchingTexture"),tt.setValue(U,"batchingTexture",z._matricesTexture,ze),tt.setOptional(U,z,"batchingIdTexture"),tt.setValue(U,"batchingIdTexture",z._indirectTexture,ze),tt.setOptional(U,z,"batchingColorTexture"),z._colorsTexture!==null&&tt.setValue(U,"batchingColorTexture",z._colorsTexture,ze));let $n=X.morphAttributes;if(($n.position!==void 0||$n.normal!==void 0||$n.color!==void 0)&&Q.update(z,X,sn),(Fi||Te.receiveShadow!==z.receiveShadow)&&(Te.receiveShadow=z.receiveShadow,tt.setValue(U,"receiveShadow",z.receiveShadow)),(F.isMeshStandardMaterial||F.isMeshLambertMaterial||F.isMeshPhongMaterial)&&F.envMap===null&&I.environment!==null&&(Qt.envMapIntensity.value=I.environmentIntensity),Qt.dfgLUT!==void 0&&(Qt.dfgLUT.value=bM()),Fi){if(tt.setValue(U,"toneMappingExposure",R.toneMappingExposure),Te.needsLights&&U0(Qt,gs),pe&&F.fog===!0&&le.refreshFogUniforms(Qt,pe),le.refreshMaterialUniforms(Qt,F,me,Ce,T.state.transmissionRenderTarget[w.id]),Te.needsLights&&Te.numLightProbeGrids>0){let wt=b,$t=0;for(let bi of T.state.lightProbeGridArray)bi.texture!==null&&(wt.textures[$t]=bi.texture,wt.min[$t]=bi.boundingBox.min,wt.max[$t]=bi.boundingBox.max,wt.resolution[$t]=bi.resolution,$t++);for(let bi in wt)wt[bi].length=$t;Qt.probesSH.value=wt.textures,Qt.probesMin.value=wt.min,Qt.probesMax.value=wt.max,Qt.probesResolution.value=wt.resolution}Gr.upload(U,wf(Te),Qt,ze)}if(F.isShaderMaterial&&F.uniformsNeedUpdate===!0&&(Gr.upload(U,wf(Te),Qt,ze),F.uniformsNeedUpdate=!1),F.isSpriteMaterial&&tt.setValue(U,"center",z.center),tt.setValue(U,"modelViewMatrix",z.modelViewMatrix),tt.setValue(U,"normalMatrix",z.normalMatrix),tt.setValue(U,"modelMatrix",z.matrixWorld),F.uniformsGroups!==void 0){let wt=F.uniformsGroups;for(let $t=0,bi=wt.length;$t<bi;$t++){let Tf=wt[$t];Re.update(Tf,sn),Re.bind(Tf,sn)}}return sn}function U0(w,I){w.ambientLightColor.needsUpdate=I,w.lightProbe.needsUpdate=I,w.sunLights.needsUpdate=I,w.sunLightShadows.needsUpdate=I,w.directionalLights.needsUpdate=I,w.directionalLightShadows.needsUpdate=I,w.pointLights.needsUpdate=I,w.pointLightShadows.needsUpdate=I,w.spotLights.needsUpdate=I,w.spotLightShadows.needsUpdate=I,w.rectAreaLights.needsUpdate=I,w.hemisphereLights.needsUpdate=I}function F0(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return V},this.getActiveMipmapLevel=function(){return W},this.getRenderTarget=function(){return te},this.setRenderTargetTextures=function(w,I,X){let F=Ne.get(w);F.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,F.__autoAllocateDepthBuffer===!1&&(F.__useRenderToTexture=!1),Ne.get(w.texture).__webglTexture=I,Ne.get(w.depthTexture).__webglTexture=F.__autoAllocateDepthBuffer?void 0:X,F.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,I){let X=Ne.get(w);X.__webglFramebuffer=I,X.__useDefaultFramebuffer=I===void 0},this.setRenderTarget=function(w,I=0,X=0){te=w,V=I,W=X;let F=null,z=!1,pe=!1;if(w){let de=Ne.get(w);if(de.__useDefaultFramebuffer!==void 0){ge.bindFramebuffer(U.FRAMEBUFFER,de.__webglFramebuffer),ne.copy(w.viewport),ye.copy(w.scissor),ke=w.scissorTest,ge.viewport(ne),ge.scissor(ye),ge.setScissorTest(ke),Y=-1;return}else if(de.__webglFramebuffer===void 0)ze.setupRenderTarget(w);else if(de.__hasExternalTextures)ze.rebindTextures(w,Ne.get(w.texture).__webglTexture,Ne.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){let Ve=w.depthTexture;if(de.__boundDepthTexture!==Ve){if(Ve!==null&&Ne.has(Ve)&&(w.width!==Ve.image.width||w.height!==Ve.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");ze.setupDepthRenderbuffer(w)}}let _e=w.texture;(_e.isData3DTexture||_e.isDataArrayTexture||_e.isCompressedArrayTexture)&&(pe=!0);let Ae=Ne.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Ae[I])?F=Ae[I][X]:F=Ae[I],z=!0):w.samples>0&&ze.useMultisampledRTT(w)===!1?F=Ne.get(w).__webglMultisampledFramebuffer:Array.isArray(Ae)?F=Ae[X]:F=Ae,ne.copy(w.viewport),ye.copy(w.scissor),ke=w.scissorTest}else ne.copy(Se).multiplyScalar(me).floor(),ye.copy(rt).multiplyScalar(me).floor(),ke=at;if(X!==0&&(F=j),ge.bindFramebuffer(U.FRAMEBUFFER,F)&&ge.drawBuffers(w,F),ge.viewport(ne),ge.scissor(ye),ge.setScissorTest(ke),z){let de=Ne.get(w.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+I,de.__webglTexture,X)}else if(pe){let de=I;for(let _e=0;_e<w.textures.length;_e++){let Ae=Ne.get(w.textures[_e]);U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0+_e,Ae.__webglTexture,X,de)}}else if(w!==null&&X!==0){let de=Ne.get(w.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,de.__webglTexture,X)}Y=-1};function Ef(w){let I=Ne.get(w);return(I.__readFormat!==w.format||I.__readType!==w.type)&&(I.__readFormat=w.format,I.__readType=w.type,I.__formatReadable=bt.textureFormatReadable(w.format),I.__typeReadable=bt.textureTypeReadable(w.type)),I}this.readRenderTargetPixels=function(w,I,X,F,z,pe,Me,de=0){if(!(w&&w.isWebGLRenderTarget)){Ue("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let _e=Ne.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Me!==void 0&&(_e=_e[Me],Array.isArray(_e)&&(_e=_e[0])),_e){ge.bindFramebuffer(U.FRAMEBUFFER,_e);try{let Ae=w.textures[de],Ve=Ae.format,Ke=Ae.type;w.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+de);let Ee=Ef(Ae);if(Ee.__formatReadable===!1){Ue("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Ee.__typeReadable===!1){Ue("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}I>=0&&I<=w.width-F&&X>=0&&X<=w.height-z&&U.readPixels(I,X,F,z,ae.convert(Ve),ae.convert(Ke),pe)}finally{let Ae=te!==null?Ne.get(te).__webglFramebuffer:null;ge.bindFramebuffer(U.FRAMEBUFFER,Ae)}}},this.readRenderTargetPixelsAsync=async function(w,I,X,F,z,pe,Me,de=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let _e=Ne.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Me!==void 0&&(_e=_e[Me],Array.isArray(_e)&&(_e=_e[0])),_e)if(I>=0&&I<=w.width-F&&X>=0&&X<=w.height-z){ge.bindFramebuffer(U.FRAMEBUFFER,_e);let Ae=w.textures[de],Ve=Ae.format,Ke=Ae.type;w.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+de);let Ee=Ef(Ae);if(Ee.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Ee.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ze=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,Ze),U.bufferData(U.PIXEL_PACK_BUFFER,pe.byteLength,U.STREAM_READ),U.readPixels(I,X,F,z,ae.convert(Ve),ae.convert(Ke),0),U.bindBuffer(U.PIXEL_PACK_BUFFER,null);let At=te!==null?Ne.get(te).__webglFramebuffer:null;ge.bindFramebuffer(U.FRAMEBUFFER,At);let pt=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await jm(U,pt,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,Ze),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,pe),U.bindBuffer(U.PIXEL_PACK_BUFFER,null),U.deleteBuffer(Ze),U.deleteSync(pt),pe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,I=null,X=0){let F=Math.pow(2,-X),z=Math.floor(w.image.width*F),pe=Math.floor(w.image.height*F),Me=I!==null?I.x:0,de=I!==null?I.y:0;ze.setTexture2D(w,0),U.copyTexSubImage2D(U.TEXTURE_2D,X,0,0,Me,de,z,pe),ge.unbindTexture()},this.copyTextureToTexture=function(w,I,X=null,F=null,z=0,pe=0){let Me,de,_e,Ae,Ve,Ke,Ee,Ze,At,pt=w.isCompressedTexture?w.mipmaps[pe]:w.image;if(X!==null)Me=X.max.x-X.min.x,de=X.max.y-X.min.y,_e=X.isBox3?X.max.z-X.min.z:1,Ae=X.min.x,Ve=X.min.y,Ke=X.isBox3?X.min.z:0;else{let tt=Math.pow(2,-z);Me=Math.floor(pt.width*tt),de=Math.floor(pt.height*tt),w.isDataArrayTexture?_e=pt.depth:w.isData3DTexture?_e=Math.floor(pt.depth*tt):_e=1,Ae=0,Ve=0,Ke=0}F!==null?(Ee=F.x,Ze=F.y,At=F.z):(Ee=0,Ze=0,At=0);let dt=ae.convert(I.format),nn=ae.convert(I.type),Te;I.isData3DTexture?(ze.setTexture3D(I,0),Te=U.TEXTURE_3D):I.isDataArrayTexture||I.isCompressedArrayTexture?(ze.setTexture2DArray(I,0),Te=U.TEXTURE_2D_ARRAY):(ze.setTexture2D(I,0),Te=U.TEXTURE_2D),ge.activeTexture(U.TEXTURE0),ge.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,I.flipY),ge.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,I.premultiplyAlpha),ge.pixelStorei(U.UNPACK_ALIGNMENT,I.unpackAlignment);let hn=ge.getParameter(U.UNPACK_ROW_LENGTH),nt=ge.getParameter(U.UNPACK_IMAGE_HEIGHT),ms=ge.getParameter(U.UNPACK_SKIP_PIXELS),sn=ge.getParameter(U.UNPACK_SKIP_ROWS),So=ge.getParameter(U.UNPACK_SKIP_IMAGES);ge.pixelStorei(U.UNPACK_ROW_LENGTH,pt.width),ge.pixelStorei(U.UNPACK_IMAGE_HEIGHT,pt.height),ge.pixelStorei(U.UNPACK_SKIP_PIXELS,Ae),ge.pixelStorei(U.UNPACK_SKIP_ROWS,Ve),ge.pixelStorei(U.UNPACK_SKIP_IMAGES,Ke);let Fi=w.isDataArrayTexture||w.isData3DTexture,gs=I.isDataArrayTexture||I.isData3DTexture;if(w.isDepthTexture){let tt=Ne.get(w),Qt=Ne.get(I),$n=Ne.get(tt.__renderTarget),wt=Ne.get(Qt.__renderTarget);ge.bindFramebuffer(U.READ_FRAMEBUFFER,$n.__webglFramebuffer),ge.bindFramebuffer(U.DRAW_FRAMEBUFFER,wt.__webglFramebuffer);for(let $t=0;$t<_e;$t++)Fi&&(U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Ne.get(w).__webglTexture,z,Ke+$t),U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Ne.get(I).__webglTexture,pe,At+$t)),U.blitFramebuffer(Ae,Ve,Ae+Me,Ve+de,Ee,Ze,Ee+Me,Ze+de,U.DEPTH_BUFFER_BIT,U.NEAREST);ge.bindFramebuffer(U.READ_FRAMEBUFFER,null),ge.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(z!==0||w.isRenderTargetTexture||Ne.has(w)){let tt=Ne.get(w),Qt=Ne.get(I);ge.bindFramebuffer(U.READ_FRAMEBUFFER,L),ge.bindFramebuffer(U.DRAW_FRAMEBUFFER,G);for(let $n=0;$n<_e;$n++)Fi?U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,tt.__webglTexture,z,Ke+$n):U.framebufferTexture2D(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,tt.__webglTexture,z),gs?U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Qt.__webglTexture,pe,At+$n):U.framebufferTexture2D(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,Qt.__webglTexture,pe),z!==0?U.blitFramebuffer(Ae,Ve,Ae+Me,Ve+de,Ee,Ze,Ee+Me,Ze+de,U.COLOR_BUFFER_BIT,U.NEAREST):gs?U.copyTexSubImage3D(Te,pe,Ee,Ze,At+$n,Ae,Ve,Me,de):U.copyTexSubImage2D(Te,pe,Ee,Ze,Ae,Ve,Me,de);ge.bindFramebuffer(U.READ_FRAMEBUFFER,null),ge.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else gs?w.isDataTexture||w.isData3DTexture?U.texSubImage3D(Te,pe,Ee,Ze,At,Me,de,_e,dt,nn,pt.data):I.isCompressedArrayTexture?U.compressedTexSubImage3D(Te,pe,Ee,Ze,At,Me,de,_e,dt,pt.data):U.texSubImage3D(Te,pe,Ee,Ze,At,Me,de,_e,dt,nn,pt):w.isDataTexture?U.texSubImage2D(U.TEXTURE_2D,pe,Ee,Ze,Me,de,dt,nn,pt.data):w.isCompressedTexture?U.compressedTexSubImage2D(U.TEXTURE_2D,pe,Ee,Ze,pt.width,pt.height,dt,pt.data):U.texSubImage2D(U.TEXTURE_2D,pe,Ee,Ze,Me,de,dt,nn,pt);ge.pixelStorei(U.UNPACK_ROW_LENGTH,hn),ge.pixelStorei(U.UNPACK_IMAGE_HEIGHT,nt),ge.pixelStorei(U.UNPACK_SKIP_PIXELS,ms),ge.pixelStorei(U.UNPACK_SKIP_ROWS,sn),ge.pixelStorei(U.UNPACK_SKIP_IMAGES,So),pe===0&&I.generateMipmaps===!0&&I.mipmapsAutoUpdate===!0&&U.generateMipmap(Te),ge.unbindTexture()},this.initRenderTarget=function(w){Ne.get(w).__webglFramebuffer===void 0&&ze.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?ze.setTextureCube(w,0):w.isData3DTexture?ze.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?ze.setTexture2DArray(w,0):ze.setTexture2D(w,0),ge.unbindTexture()},this.resetState=function(){V=0,W=0,te=null,ge.reset(),ce.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Gn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=je._getDrawingBufferColorSpace(e),t.unpackColorSpace=je._getUnpackColorSpace()}};var kg={type:"change"},Gd={type:"start"},Ng={type:"end"},ih=new ns,Dg=new Tn,_M=Math.cos(70*Ad.DEG2RAD),Vt=new O,xn=2*Math.PI,st={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Vd=1e-6,sh=class extends Ya{constructor(e,t=null){super(e,t),this.state=st.NONE,this.target=new O,this.cursor=new O,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Wn.ROTATE,MIDDLE:Wn.DOLLY,RIGHT:Wn.PAN},this.touches={ONE:ei.ROTATE,TWO:ei.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new O,this._lastQuaternion=new An,this._lastTargetPosition=new O,this._quat=new An().setFromUnitVectors(e.up,new O(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Fr,this._sphericalDelta=new Fr,this._scale=1,this._panOffset=new O,this._rotateStart=new Ie,this._rotateEnd=new Ie,this._rotateDelta=new Ie,this._panStart=new Ie,this._panEnd=new Ie,this._panDelta=new Ie,this._dollyStart=new Ie,this._dollyEnd=new Ie,this._dollyDelta=new Ie,this._dollyDirection=new O,this._mouse=new Ie,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=wM.bind(this),this._onPointerDown=SM.bind(this),this._onPointerUp=MM.bind(this),this._onContextMenu=LM.bind(this),this._onMouseWheel=AM.bind(this),this._onKeyDown=CM.bind(this),this._onTouchStart=RM.bind(this),this._onTouchMove=PM.bind(this),this._onMouseDown=EM.bind(this),this._onMouseMove=TM.bind(this),this._interceptControlDown=IM.bind(this),this._interceptControlUp=kM.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.ownerDocument.addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=st.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.ownerDocument.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.ownerDocument.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(kg),this.update(),this.state=st.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Vt.copy(t).sub(this.target),Vt.applyQuaternion(this._quat),this._spherical.setFromVector3(Vt),this.autoRotate&&this.state===st.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(i)&&isFinite(s)&&(i<-Math.PI?i+=xn:i>Math.PI&&(i-=xn),s<-Math.PI?s+=xn:s>Math.PI&&(s-=xn),i<=s?this._spherical.theta=Math.max(i,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+s)/2?Math.max(i,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=a!=this._spherical.radius}if(Vt.setFromSpherical(this._spherical),Vt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Vt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){let o=Vt.length();a=this._clampDistance(o*this._scale);let l=o-a;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let o=new O(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new O(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(o),this.object.updateMatrixWorld(),a=Vt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(ih.origin.copy(this.object.position),ih.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(ih.direction))<_M?this.object.lookAt(this.target):(Dg.setFromNormalAndCoplanarPoint(this.object.up,this.target),ih.intersectPlane(Dg,this.target))))}else if(this.object.isOrthographicCamera){let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Vd||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Vd||this._lastTargetPosition.distanceToSquared(this.target)>Vd?(this.dispatchEvent(kg),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?xn/60*this.autoRotateSpeed*e:xn/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Vt.setFromMatrixColumn(t,0),Vt.multiplyScalar(-e),this._panOffset.add(Vt)}_panUp(e,t){this.screenSpacePanning===!0?Vt.setFromMatrixColumn(t,1):(Vt.setFromMatrixColumn(t,0),Vt.crossVectors(this.object.up,Vt)),Vt.multiplyScalar(e),this._panOffset.add(Vt)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let s=this.object.position;Vt.copy(s).sub(this.target);let r=Vt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/i.clientHeight,this.object.matrix),this._panUp(2*t*r/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),s=e-i.left,r=t-i.top,a=i.width,o=i.height;this._mouse.x=s/a*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientY),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(xn*this._rotateDelta.x/t.clientHeight),this._rotateUp(xn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.zoomToCursor&&(this._performCursorZoom=!0,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-xn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(i,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(i,s)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(i*i+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),s=.5*(e.pageX+i.x),r=.5*(e.pageY+i.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(xn*this._rotateDelta.x/t.clientHeight),this._rotateUp(xn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(i,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(i*i+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new Ie,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function SM(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function wM(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function MM(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Ng),this.state=st.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function EM(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case Wn.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=st.DOLLY;break;case Wn.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=st.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=st.ROTATE}break;case Wn.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=st.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=st.PAN}break;default:this.state=st.NONE}this.state!==st.NONE&&this.dispatchEvent(Gd)}function TM(n){switch(this.state){case st.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case st.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case st.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function AM(n){this.enabled===!1||this.enableZoom===!1||this.state!==st.NONE||(n.preventDefault(),this.dispatchEvent(Gd),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(Ng))}function CM(n){this.enabled!==!1&&this._handleKeyDown(n)}function RM(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case ei.ROTATE:if(this.enableRotate===!1){this.state=st.NONE;break}this._handleTouchStartRotate(n),this.state=st.TOUCH_ROTATE;break;case ei.PAN:if(this.enablePan===!1){this.state=st.NONE;break}this._handleTouchStartPan(n),this.state=st.TOUCH_PAN;break;default:this.state=st.NONE}break;case 2:switch(this.touches.TWO){case ei.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=st.TOUCH_DOLLY_PAN;break;case ei.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=st.TOUCH_DOLLY_ROTATE;break;default:this.state=st.NONE}break;default:this.state=st.NONE}this.state!==st.NONE&&this.dispatchEvent(Gd)}function PM(n){switch(this._trackPointer(n),this.state){case st.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case st.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case st.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case st.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=st.NONE}}function LM(n){this.enabled!==!1&&n.preventDefault()}function IM(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.ownerDocument.addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function kM(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.ownerDocument.removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var qd='"Helvetica Neue", Arial, sans-serif',Fg=13,Bg=12,Xd=(n,e)=>{let[t,i,s]=mt(n).map(r=>Math.round(255*r));return`rgba(${t}, ${i}, ${s}, ${e})`};function zg(n,e,t,i,s,r,a,o){let l=s/2;switch(n.beginPath(),e){case"square":n.rect(t-l,i-l,s,s);break;case"diamond":n.moveTo(t,i-l),n.lineTo(t+l,i),n.lineTo(t,i+l),n.lineTo(t-l,i),n.closePath();break;case"triangle":n.moveTo(t,i-l),n.lineTo(t+.866*l,i+.5*l),n.lineTo(t-.866*l,i+.5*l),n.closePath();break;case"star":for(let c=0;c<10;c++){let h=-Math.PI/2+c*Math.PI/5,u=c%2===0?l:.4*l;c===0?n.moveTo(t+u*Math.cos(h),i+u*Math.sin(h)):n.lineTo(t+u*Math.cos(h),i+u*Math.sin(h))}n.closePath();break;case"cross":case"plus":{e==="cross"?(n.moveTo(t-l,i-l),n.lineTo(t+l,i+l),n.moveTo(t-l,i+l),n.lineTo(t+l,i-l)):(n.moveTo(t-l,i),n.lineTo(t+l,i),n.moveTo(t,i-l),n.lineTo(t,i+l)),n.lineWidth=Math.max(1,o||s/6),n.strokeStyle=r??"#ffffff",n.lineCap="butt",n.stroke();return}default:n.arc(t,i,l,0,2*Math.PI)}if(e==="ring"){n.lineWidth=Math.max(1,o||s/6),n.strokeStyle=r??"#ffffff",n.stroke();return}r!==null&&(n.fillStyle=r,n.fill()),a!==null&&o>0&&(n.lineWidth=o,n.strokeStyle=a,n.lineJoin="miter",n.stroke())}function Yd(n,e){let t=n.shape??"disc",i=typeof n.edge_width=="number"?n.edge_width:n.edge!==void 0?1:0;return t==="ring"||t==="cross"||t==="plus"?Math.max(1,i||e/6):n.edge!==void 0?i:0}function Hg(n,e,t=4){let i=Yd(n,e),s=e+i,r=Math.max(8,Math.min(512,Math.ceil(s*t))),a=document.createElement("canvas");a.width=a.height=r;let o=a.getContext("2d"),l=r/s;return o.scale(l,l),zg(o,n.shape??"disc",s/2,s/2,e,n.color??"#ffffff",n.edge??null,i),a}var $r=.984,ah=.227,Xr=$r-ah,DM=1.15,NM=2/14;function Vg(n=1.2){return DM+Xr*(n-1.2)}var Gg=.7,Wg=.18,OM=.42;function $g(n){let e=typeof n=="string"?[{text:n}]:n,t=[[]];for(let i of e)i.text.split(`
`).forEach((s,r)=>{r>0&&t.push([]),s!==""&&t[t.length-1].push({text:s,...i.shift?{shift:i.shift}:{}})});return t}var jd=(n,e)=>`${n.weight==="bold"?"bold ":""}${e?.shift?Gg*n.size:n.size}px ${n.font}`;function Xg(n,e,t){let i=0;for(let s of e)n.font=jd(t,s),i+=n.measureText(s.text).width;return i}var rh=n=>typeof n=="string"?n:n.map(e=>e.text).join("");function Jd(n,e,t,i,s){let r=$g(e),a=Math.max(0,...r.map(u=>Xg(n,u,s)));n.font=jd(s);let o=($r+Vg(s.linespacing)*(r.length-1))*s.size,l=s.align==="center"?t-a/2:s.align==="end"?t-a:t,c=s.baseline,h=c==="middle"?i-o/2:c==="bottom"?i-o:c==="alphabetic"?i-o+ah*s.size:i;return[l,h,a,o]}function lo(n,e,t,i,s){if(s.opacity<=0||rh(e)==="")return;let[r,a,o,l]=Jd(n,e,t,i,s);n.save(),n.globalAlpha*=s.opacity;let c=s.box;if(c!==void 0){let h=c.pad??4,u=c.radius??0;n.beginPath(),UM(n,r-h,a-h,o+2*h,l+2*h,u),c.fill!==void 0&&(n.fillStyle=Xd(c.fill,c.opacity??1),n.fill()),c.edge!==void 0&&(c.edge_width??1)>0&&(n.lineWidth=c.edge_width??1,n.strokeStyle=Xd(c.edge,c.opacity??1),n.stroke())}n.fillStyle=s.color,n.textBaseline="alphabetic",n.textAlign="left",$g(e).forEach((h,u)=>{let d=Xg(n,h,s),f=s.align==="center"?r+(o-d)/2:s.align==="end"?r+o-d:r,p=a+(Xr+Vg(s.linespacing)*u)*s.size;for(let y of h){n.font=jd(s,y);let m=y.shift==="sub"?Wg*s.size:y.shift==="sup"?-OM*s.size:0;n.fillText(y.text,f,p+m),f+=n.measureText(y.text).width}}),n.restore()}function UM(n,e,t,i,s,r){let a=Math.max(0,Math.min(r,i/2,s/2));n.moveTo(e+a,t),n.lineTo(e+i-a,t),n.arcTo(e+i,t,e+i,t+a,a),n.lineTo(e+i,t+s-a),n.arcTo(e+i,t+s,e+i-a,t+s,a),n.lineTo(e+a,t+s),n.arcTo(e,t+s,e,t+s-a,a),n.lineTo(e,t+a),n.arcTo(e,t,e+a,t,a),n.closePath()}function qg(n,e,t){let i=n.box===void 0?void 0:{...n.box,...n.box.fill?{fill:qt(n.box.fill,e)}:{},...n.box.edge?{edge:qt(n.box.edge,e)}:{}};return{size:n.size??Fg,color:n.color!==void 0?qt(n.color,e):e.foreground,weight:n.weight??"normal",font:e.font??qd,align:n.align??"start",baseline:n.baseline??"middle",opacity:Xt(n.opacity,t),box:i,...n.linespacing===void 0?{}:{linespacing:n.linespacing}}}function FM(n,e,t,i,s,r,a){let o=qg(e,r,a);if(o.opacity<=0||rh(t)==="")return;let[l,c]=e.offset??[0,0],h=i+l,u=s+c;if(e.leader!==void 0&&e.leader!==!1&&(l!==0||c!==0)){let[d,f,p,y]=Jd(n,t,h,u,o),m=e.box!==void 0?e.box.pad??4:0,g=d+p/2,v=f+y/2,_=i-g,b=s-v,M=p/2+m,T=y/2+m,x=Math.min(Math.abs(_)>1e-9?M/Math.abs(_):1/0,Math.abs(b)>1e-9?T/Math.abs(b):1/0),A=NM*o.size;if(x<1){let k=g+x*_,R=v+x*b,D=Math.hypot(i-k,s-R);if(D>2*A){let H=(i-k)/D,j=(s-R)/D,L=e.leader===!0?{}:e.leader;n.save(),n.globalAlpha*=o.opacity,n.strokeStyle=L.color!==void 0?qt(L.color,r):o.color,n.lineWidth=L.width??1,n.beginPath(),n.moveTo(k+A*H,R+A*j),n.lineTo(i-A*H,s-A*j),n.stroke(),n.restore()}}}lo(n,t,h,u,o)}var BM=[1,2,2.5,5,10];function Og(n,e,t){let i=e-n;if(!(i>0)||!Number.isFinite(i))return{values:[],step:1};let s=i/Math.max(1,t),r=Math.pow(10,Math.floor(Math.log10(s))),a=[10,1,.1,.01].flatMap(d=>BM.map(f=>f*r*d)),o=a.filter(d=>d>=s*(1-1e-9)).sort((d,f)=>d-f),l=a.filter(d=>d<s*(1-1e-9)).sort((d,f)=>f-d),c=[...o,...l],h=[],u=c[0];for(let d of c){u=d,h=[];for(let f=Math.ceil(n/d-1e-9);f<=Math.floor(e/d+1e-9)&&h.length<200;f++)h.push(f*d+0);if(h.length>=2)break}return{values:h,step:u}}function Ug(n,e){let t=0;for(;t<10&&Math.abs(Math.round(e*10**t)-e*10**t)>1e-9*10**t;)t++;return(Math.abs(n)<e*1e-9?0:n).toFixed(t).replace("-","\u2212")}function zM(n,e,t){if(e.opacity<=0||e.rect.w<2||e.rect.h<2)return;let{x:i,y:s,w:r,h:a}=e.rect,o=t.font??qd,l=t.foreground,c=3.5/14*e.size,h=3.5/14*e.size,u=4/14*e.size,d=.8/14*e.size;n.save(),n.globalAlpha*=e.opacity,n.strokeStyle=l,n.fillStyle=l,n.lineWidth=d,n.strokeRect(i,s,r,a),n.font=`${e.size}px ${o}`;let f=b=>i+(b-e.x0)/(e.x1-e.x0)*r,p=b=>s+a-(b-e.y0)/(e.y1-e.y0)*a,y=Og(e.x0,e.x1,Math.max(1,Math.floor(r/(3*e.size)))),m=Og(e.y0,e.y1,Math.max(1,Math.floor(a/(2*e.size))));n.beginPath();for(let b of y.values)n.moveTo(f(b),s+a),n.lineTo(f(b),s+a+c);for(let b of m.values)n.moveTo(i,p(b)),n.lineTo(i-c,p(b));n.stroke();let g=0;if(n.textBaseline="alphabetic",e.ticks.x){n.textAlign="center";for(let b of y.values)n.fillText(Ug(b,y.step),f(b),s+a+c+h+Xr*e.size)}if(e.ticks.y){n.textAlign="right";for(let b of m.values){let M=Ug(b,m.step);g=Math.max(g,n.measureText(M).width),n.fillText(M,i-c-h,p(b)+Xr/2*e.size)}}let v=16/14*e.size,_={size:v,color:l,weight:"normal",font:o,align:"center",baseline:"alphabetic",opacity:1};rh(e.titles[0])!==""&&lo(n,e.titles[0],i+r/2,s+a+c+h+(e.ticks.x?$r*e.size:0)+u+Xr*v,_),rh(e.titles[1])!==""&&(n.save(),n.translate(i-c-h-(e.ticks.y?g:0)-u,s+a/2),n.rotate(-Math.PI/2),lo(n,e.titles[1],0,-ah*v,_),n.restore()),n.restore()}function HM(n,e,t,i,s,r){let a=Xt(e.opacity,r);if(a<=0||e.entries.length===0)return;let o=e.size??Fg,l=s.font??qd;n.save(),n.globalAlpha*=a,n.font=`${o}px ${l}`;let c=(e.handle_length??2)*o,h=(e.handle_pad??.8)*o,u=(e.column_spacing??2)*o,d=Math.max(1,Math.min(e.columns??e.entries.length,e.entries.length)),f=Math.ceil(e.entries.length/d),p=G=>c,y=e.entries.map((G,V)=>({e:G,col:Math.floor(V/f),row:V%f})),m=Array.from({length:d},()=>0),g={size:o,color:qt(e.color??s.foreground,s),weight:"normal",font:l,align:"start",baseline:"middle",opacity:1};for(let G of y)m[G.col]=Math.max(m[G.col],p(G.e)+h+Jd(n,$d(G.e.label),0,0,g)[2]);let v=m.reduce((G,V)=>G+V,0)+u*(d-1),_=($r+.5)*o,b=.4*o,M=.5*o,T=G=>$d(G.label).some(V=>V.shift==="sub")?(Wg+(Gg-1)*ah)*o:0,x=y.map(({col:G,row:V})=>{let W=0;for(let te=0;te<V;te++)W+=_+T(e.entries[G*f+te]);return W}),A=Math.max(...y.map((G,V)=>x[V]+_+T(G.e)))-.5*o,k=e.at[0]*t,R=e.at[1]*i,D=e.align??"center",H=D==="center"?k-v/2:D==="end"?k-M-b-v:k+M+b,j=e.baseline??"top",L=j==="middle"?R-A/2:j==="bottom"?R-M-b-A:R+M+b;for(let[G,{e:V,col:W}]of y.entries()){let te=H+m.slice(0,W).reduce((ye,ke)=>ye+ke,0)+u*W,Y=L+x[G]+$r/2*o,q=Y+(Xr-$r/2-.35)*o,ne=p(V);if(V.colors!==void 0){let ye=V.colors.length,ke=ne/ye;V.colors.forEach(($,oe)=>{n.strokeStyle=qt($,s),n.lineWidth=V.line?.width??2,n.globalAlpha=a*(V.line?.opacity??1),n.lineCap="butt",n.beginPath(),n.moveTo(te+oe*ke,q),n.lineTo(te+(oe+1)*ke,q),n.stroke()}),n.globalAlpha=a}else V.line!==void 0&&(n.save(),n.globalAlpha=a*(V.line.opacity??1),n.strokeStyle=qt(V.line.color??s.foreground,s),n.lineWidth=V.line.width??2,n.lineCap=V.line.dash===void 0?"square":"butt",V.line.dash!==void 0&&n.setLineDash(V.line.dash),n.beginPath(),n.moveTo(te,q),n.lineTo(te+ne,q),n.stroke(),n.restore());if(V.marker!==void 0){let ye=ca(V.marker,s);n.save(),n.globalAlpha=a*Xt(ye.opacity,r),zg(n,ye.shape??"disc",te+ne/2,q,aa(ye.size,r,.6*o),ye.color??s.foreground,ye.edge??null,typeof ye.edge_width=="number"?ye.edge_width:ye.edge?1:0),n.restore()}lo(n,$d(V.label),te+ne+h,Y,g)}n.restore()}function VM(n,e,t,i){t>=1||(n.save(),n.fillStyle=Xd(i.background,1-Math.max(0,t)),n.fillRect(e.x,e.y,e.w,e.h),n.restore())}var Yg=n=>n.gutter??Ut(n.foreground,n.background,.9);function oh(n,e,t,i,s,r,a,o,l){let c=r*Ct(t.clock),h=null,u=d=>d.kind==="panel"?d.id:u(d.a);h=u(i.layout);for(let d of Object.keys(i.panels)){let f=e.paintInfo(d);if(f===null||f.outer.w<1||f.outer.h<1)continue;let p=Xt(f.opacity,c);if(VM(n,f.outer,p,s),!(p<=0)){if(n.save(),n.globalAlpha=p,f.box!==null){let y=f.boxTitles,m=y===void 0?f.box.titles:[0,1].map(g=>{let v=y[g];if(v===void 0)return f.box.titles[g];let _=typeof v=="string"?[v]:v;return Wd(_,l(d,_))});zM(n,{...f.box,titles:m,opacity:Xt(f.box.opacity,c)},s)}for(let y of f.labels){let m=f.rect;if(y.clip&&!(y.x>=m.x-.5&&y.x<=m.x+m.w+.5&&y.y>=m.y-.5&&y.y<=m.y+m.h+.5))continue;let g=typeof y.layer.text=="string"?[y.layer.text]:y.layer.text;FM(n,y.layer,Wd(g,l(d,g)),y.x,y.y,s,c)}n.restore()}}for(let d of t.overlays??[])if(d.kind==="legend")HM(n,d,a,o,s,c);else if(d.kind==="text"){let f=typeof d.text=="string"?[d.text]:d.text;lo(n,h===null?"":Wd(f,l(h,f)),d.at[0]*a,d.at[1]*o,qg(d,s,c))}}function Wd(n,e){return e.map((t,i)=>{let s=n[i];return typeof s=="object"&&s!==null&&"sub"in s?{text:t,shift:"sub"}:typeof s=="object"&&s!==null&&"sup"in s?{text:t,shift:"sup"}:{text:t}})}function $d(n){return typeof n=="string"?[{text:n}]:n.map(e=>typeof e=="string"?{text:e}:e.sub!==void 0?{text:e.sub,shift:"sub"}:{text:e.sup??"",shift:"sup"})}function GM(n,e){let[t,i,s,r]=n,a=[(t[0]+s[0])/2,(t[1]+s[1])/2],o=[(i[0]-t[0])/2,(i[1]-t[1])/2],l=[(r[0]-t[0])/2,(r[1]-t[1])/2];for(let c of[0,1]){let h=2*(Math.abs(o[c])+Math.abs(l[c]));h>=e||(h>0?(o[c]*=e/h,l[c]*=e/h):(Math.hypot(...o)<Math.hypot(...l)?o:l)[c]=e/2)}return[[a[0]-o[0]-l[0],a[1]-o[1]-l[1]],[a[0]+o[0]-l[0],a[1]+o[1]-l[1]],[a[0]+o[0]+l[0],a[1]+o[1]+l[1]],[a[0]-o[0]+l[0],a[1]-o[1]+l[1]]]}function WM(n,e,t,i,s,r){let a=0,o=1,l=e[0]-n[0],c=e[1]-n[1];for(let[h,u]of[[-l,n[0]-t],[l,i-n[0]],[-c,n[1]-s],[c,r-n[1]]])if(h===0){if(u<0)return null}else{let d=u/h;h<0?a=Math.max(a,d):o=Math.min(o,d)}return a<=o?[a,o]:null}function $M(n,e,t,i){let s=n.length,r=[],a=0,o=[];for(let f=0;f<s;f++){let p=n[f],y=n[(f+1)%s],m=Math.hypot(y[0]-p[0],y[1]-p[1]);r.push(a);let g=WM(p,y,-16,e+16,-16,t+16);if(g!==null&&m>0){let v=o[o.length-1],_=a+g[0]*m;v!==void 0&&_-v[1]<1e-9*Math.max(1,_)?v[1]=a+g[1]*m:o.push([_,a+g[1]*m])}a+=m}let l=a;if(!(l>0)||!Number.isFinite(l))return{closed:!1,paths:[]};if(o.length===1&&o[0][0]===0&&o[0][1]>=l*(1-1e-12)&&i===void 0)return{closed:!0,paths:[n.map(f=>[f[0],f[1]])]};let h=f=>{let p=s-1;for(;p>0&&r[p]>f;)p--;let y=n[p],m=n[(p+1)%s],g=(p+1<s?r[p+1]:l)-r[p],v=g>0?(f-r[p])/g:0;return[y[0]+v*(m[0]-y[0]),y[1]+v*(m[1]-y[1])]},u=(f,p)=>{let y=[h(f)];for(let m=1;m<s;m++)r[m]>f&&r[m]<p&&y.push(n[m]);return y.push(h(p)),y},d=[];for(let[f,p]of o){if(i===void 0){d.push(u(f,p));continue}let y=i[0]+i[1];for(let m=Math.floor(f/y);m*y<p;m++){let g=Math.max(f,m*y),v=Math.min(p,m*y+i[0]);v>g&&d.push(u(g,v))}}return{closed:!1,paths:d}}function XM(n,e,t,i=[]){let s=n.filter((h,u)=>u===0||Math.hypot(h[0]-n[u-1][0],h[1]-n[u-1][1])>1e-9);e&&s.length>1&&Math.hypot(s[0][0]-s[s.length-1][0],s[0][1]-s[s.length-1][1])<=1e-9&&s.pop();let r=s.length;if(r<2)return i;let a=t/2,o=(h,u)=>{let d=Math.hypot(u[0]-h[0],u[1]-h[1]);return[-(u[1]-h[1])/d,(u[0]-h[0])/d]},l=[];for(let h=0;h<r;h++){let u=e||h>0?o(s[(h-1+r)%r],s[h]):null,d=e||h<r-1?o(s[h],s[(h+1)%r]):null;if(u===null||d===null){let g=u??d;l.push([g[0]*a,g[1]*a]);continue}let f=[u[0]+d[0],u[1]+d[1]],p=Math.hypot(f[0],f[1]),y=p>1e-9?[f[0]/p,f[1]/p]:d,m=a/Math.max(1/4,y[0]*d[0]+y[1]*d[1]);l.push([y[0]*m,y[1]*m])}let c=e?r:r-1;for(let h=0;h<c;h++){let u=(h+1)%r,[d,f,p,y]=[s[h],s[u],l[h],l[u]],m=[d[0]+p[0],d[1]+p[1]],g=[d[0]-p[0],d[1]-p[1]],v=[f[0]+y[0],f[1]+y[1]],_=[f[0]-y[0],f[1]-y[1]];i.push(...m,...g,...v,...g,..._,...v)}return i}function jg(n,e,t,i){let{closed:s,paths:r}=$M(GM(n,i.minSize),e,t,i.dash),a=[];for(let o of r)XM(o,s,i.width,a);return a}function Jg(n){let e=new Map;for(let t of n){let i=JSON.stringify([t.label,t.gradient,t.lo,t.hi]),s=e.get(i);s===void 0?e.set(i,t):e.set(i,{...s,marker:s.marker??t.marker,band:s.band??t.band})}return[...e.values()]}function qr(n,e,t){let i={panels:new Map,gutters:[]},s=(r,a,o)=>{if(r.kind==="panel"){i.panels.set(r.id,a);return}let l=r.dir==="row",c=r.ratio<=0||r.ratio>=1?0:t,h=Math.max(0,(l?a.w:a.h)-c),u=Math.round(h*Math.min(1,Math.max(0,r.ratio))),d=h-u;l?(s(r.a,{x:a.x,y:a.y,w:u,h:a.h},`${o}a`),c>0&&i.gutters.push({path:o,dir:r.dir,rect:{x:a.x+u,y:a.y,w:c,h:a.h},outer:a}),s(r.b,{x:a.x+u+c,y:a.y,w:d,h:a.h},`${o}b`)):(s(r.a,{x:a.x,y:a.y,w:a.w,h:u},`${o}a`),c>0&&i.gutters.push({path:o,dir:r.dir,rect:{x:a.x,y:a.y+u,w:a.w,h:c},outer:a}),s(r.b,{x:a.x,y:a.y+u+c,w:a.w,h:d},`${o}b`))};return s(n,e,""),i}function lh(n,e,t){return n.kind==="panel"?n:e===""?{...n,ratio:t}:e[0]==="a"?{...n,a:lh(n.a,e.slice(1),t)}:{...n,b:lh(n.b,e.slice(1),t)}}function Kg(n,e,t,i){let s=n.outer,r=n.dir==="row"?e-s.x-i/2:t-s.y-i/2,a=Math.max(1,(n.dir==="row"?s.w:s.h)-i);return Math.min(.9,Math.max(.1,r/a))}var Jr=6,Zg=9,qM=10,YM=.8,jM=8,JM=8,KM=.25,ZM=.35,fh="vec4(2.0, 2.0, 2.0, 1.0)",h0=`
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
`,u0=`
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
    if (va.z >= 0.0 && vb.z >= 0.0) return ${fh};
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
`,QM=h0+`
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
    gl_Position = ${fh};
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
`,eE=h0+u0+`
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
    gl_Position = ${fh};
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
`,tE=u0+`
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
`,Qg=`
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
    gl_Position = ${fh};
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
`,nE=`
uniform vec4 uColor;
varying vec4 vColor;
void main() {
  vColor = uColor;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,iE=`
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
`;function sE(){let n=document.createElement("canvas");n.width=n.height=64;let e=n.getContext("2d");e.fillStyle="#fff",e.beginPath(),e.arc(32,32,28,0,Math.PI*2),e.fill();let t=new Dr(n);return t.needsUpdate=!0,t}function ch(n,e=6){if(!(n>0)||!Number.isFinite(n))return 1;let t=n/e,i=Math.pow(10,Math.floor(Math.log10(t))),s=t/i;return(s<1.5?1:s<3.5?2:s<7.5?5:10)*i}function Oi(n){let e=(o,l,c)=>new O(o,l,c);if(n.kind==="plane")return n.plane==="xz"?{right:e(1,0,0),up:e(0,0,1),normal:e(0,-1,0)}:n.plane==="yz"?{right:e(0,1,0),up:e(0,0,1),normal:e(1,0,0)}:{right:e(1,0,0),up:e(0,1,0),normal:e(0,0,1)};let[t,i,s]=n.up==="x"?[e(0,1,0),e(0,0,1),e(1,0,0)]:n.up==="y"?[e(0,0,1),e(1,0,0),e(0,1,0)]:[e(1,0,0),e(0,1,0),e(0,0,1)],r=t.clone().addScaledVector(i,-1.6).addScaledVector(s,.9).normalize();return{right:new O().crossVectors(s,r).normalize(),up:s,normal:r}}function Yr(n){return n.kind==="orbit"&&n.stretch!==void 0?new O(...n.stretch):new O(1,1,1)}function af(){let n=new Or;return n.setAttribute("position",new Bt([-1,0,0,1,0,0,-1,1,0,1,1,0],3)),n.setIndex([0,1,2,2,1,3]),n}var po=(n,e,t={})=>new Cn({vertexShader:n,fragmentShader:iE,uniforms:e,defines:t,transparent:!0,depthTest:!1,depthWrite:!1,side:Ln}),e0=n=>Math.min(1,Math.max(0,n));function t0(n,e){n.stencilWrite=!0,n.stencilRef=e,n.stencilFunc=vd,n.stencilFail=Os,n.stencilZFail=Os,n.stencilZPass=yd}var ef=class{cache=new Map;get(e,t){let i=this.cache.get(e);return i===void 0&&(i=t(),this.cache.set(e,i)),i}};function rE(n,e){if(e===void 0||typeof e=="string"||ha(e)||typeof e.colormap=="string")return e;let t=e.colormap;lt(n.scene,t.var)?.kind!=="choice"&&E("2.7",`the colormap is keyed on ${t.var}, which is not a choice`);let i=Gi(n,t.var),s=typeof i=="string"&&Object.hasOwn(t.map,i)?t.map[i]:void 0;return s===void 0&&E("2.7",`the colormap keyed on ${t.var} does not name a colormap for ${JSON.stringify(i)}`),{...e,colormap:s}}function aE(n,e,t,i){let s=t.panels[i],r=n.views[s.view],a={scene:n,state:t,panel:s},o=bs(a,r),l=Rt(n.clock),c=Et(a,r.driver.sets),h=c===null?null:{set:e.sets.get(c),track:0};h&&(h.track=nr(a,r.driver.member,h.set),l>1&&!h.set.periodic&&E("C6",`the driver's track set ${h.set.id} is not periodic, and the clock has ${l} laps`));let u=[];return r.layers.forEach((d,f)=>{if(ir(a,d))if(d.kind==="track"){let p=Et(a,d.sets),y=p===null?null:e.sets.get(p),m=y===null?[]:tr(a,d.members,y),g=d.clock===void 0?n.clock:oa(n.clock,d.clock),v=xp(d,g)?d.clock===void 0?t.clock.channel:g.channels[0]:null,_=d.context??"own";_!=="own"&&_!=="driver"&&E("L6",`a track layer's context is ${JSON.stringify(_)}, not own or driver`),y!==null&&v!==null&&d.clock===void 0&&l>1&&!y.periodic&&E("C6",`a reading is taken on track set ${y.id}, which is not periodic, and the clock has ${l} laps`);let b=d.highlight;if(b?.kernel!==void 0){let x=lt(n,b.var);(x?.kind!=="selector"||(x.by??"nearest")!=="nearest"||x.parameter===void 0)&&E("2.7",`a highlight kernel needs a selector by nearest, and ${b.var} is not one`)}let M=y!==null&&b!==void 0?Ro(a,{var:b.var},y):null,T=M!==null&&m.includes(M)?M:null;u.push({kind:"track",index:f,layer:d,set:y,members:m,highlight:T,selected:M,channel:v,color:rE(a,d.color),context:_,clock:g})}else if(d.kind==="arrow"){let p=Et(a,d.sets),y=d.clock===void 0?n.clock:oa(n.clock,d.clock),m=d.clock===void 0?t.clock.channel:y.channels[0];u.push({kind:"arrow",index:f,layer:d,set:p===null?null:e.sets.get(p),channel:m,clock:y})}else if(d.kind==="outline")u.push({kind:"outline",index:f,layer:d});else if(d.kind==="body")u.push({kind:"body",index:f,layer:d});else if(d.kind==="points"){let p=Et(a,d.sets);u.push({kind:"points",index:f,layer:d,set:p===null?null:e.sets.get(p)})}else if(d.kind==="label"){let p=d.at,y=p!==null&&typeof p=="object"&&"sets"in p?Et(a,p.sets):null;u.push({kind:"label",index:f,layer:d,set:y===null?null:e.sets.get(y)})}else u.push({kind:d.kind,index:f,layer:d})}),{viewId:s.view,view:r,display:o,scope:a,driver:h,layers:u}}function oE(n){return[n.viewId,n.display,n.driver?.set.id??"",...n.layers.map(e=>e.kind==="track"||e.kind==="points"?e.set?.id??"":"")].join("\0")}function tf(n,e,t,i){let s=n.transform([0,0,0],e,t,i),r=new Float64Array(12);for(let a=0;a<3;a++){let o=n.transform([a===0?1:0,a===1?1:0,a===2?1:0],e,t,i);for(let l=0;l<3;l++)r[3*l+a]=o[l]-s[l]}return r.set(s,9),r}function lE(n,e,t,i=new ft,s){let{a:r,b:a,w:o}=sr(t,_s(n,t,s).at),l=tf(n.frames,e,n.display,r),c=tf(n.frames,e,n.display,a),h=l.map((u,d)=>(1-o)*u+o*c[d]);return i.set(h[0],h[1],h[2],h[9],h[3],h[4],h[5],h[10],h[6],h[7],h[8],h[11],0,0,0,1)}var cE=4e6;function hE(n,e,t,i,s){let r=i.frames,a=n.set.def.frame,o=i.geometry(n.set.id,a),l=e.set.periodic?Rt(i.scene.clock):1,c=r.requirements(a,t).channels.size>0,h=c?e.set.count(e.track):1,u=n.members.length===n.set.tracks?o.positions:Float64Array.from(n.members.flatMap(f=>[...o.track(f,0)]));if(u.length>24&&u.length/3*h*(c?l:1)>s){let[f,p,y,m,g,v]=o.bounds();u=Float64Array.from([f,p,y,m,p,y,f,g,y,m,g,y,f,p,v,m,p,v,f,g,v,m,g,v])}let d=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let f=0;f<(c?l:1);f++)for(let p=0;p<h;p++){let y=tf(r,a,t,{set:e.set,track:e.track,sample:p,shifted:!1,lap:f});for(let m=0;m<u.length;m+=3){let g=u[m],v=u[m+1],_=u[m+2];for(let b=0;b<3;b++){let M=y[3*b]*g+y[3*b+1]*v+y[3*b+2]*_+y[9+b];M<d[b]&&(d[b]=M),M>d[b+3]&&(d[b+3]=M)}}}return d}function uE(n,e,t=cE){let i=null;for(let s of n.layers){if(s.kind!=="track"||s.set===null||s.members.length===0||s.layer.fit===!1||s.context==="driver"&&n.driver===null)continue;let r;if(s.context==="driver")r=[hE(s,n.driver,n.display,e,t)];else{let a=e.geometry(s.set.id,n.display);r=s.members.length===s.set.tracks?[a.bounds()]:s.members.map(o=>a.bounds(o))}for(let a of r)if(i===null)i=[...a];else for(let o=0;o<3;o++)i[o]=Math.min(i[o],a[o]),i[o+3]=Math.max(i[o+3],a[o+3])}return i}var hh=n=>n.kind==="plane"&&n.aspect==="free";function dE(n,e,t){let i=n.getCenter(new O),s=n.getSize(new O),r=Math.max(s.length()/2,1e-9),{right:a,up:o}=Oi(e),l=y=>new O(Math.abs(y.x),Math.abs(y.y),Math.abs(y.z)),c=e.kind==="plane"?s.dot(l(a))/2:r,h=e.kind==="plane"?s.dot(l(o))/2:r,u=Math.max(h,c/t)*1.1,d=u>1e-12?u:Math.max(r,1);if(!hh(e))return{center:i,halfWidth:d*t,halfHeight:d};let f=y=>Math.max(Math.abs(n.min.dot(y)),Math.abs(n.max.dot(y))),p=(y,m)=>y>0&&y>1e-9*m;return{center:i,halfWidth:p(c,f(a))?c*1.1:d*t,halfHeight:p(h,f(o))?h*1.1:d}}function fE(n,e,t,i){let s=t>0?i/(e.width*t):0;return Math.max(n,e.opacity*Math.exp(-s*s))}function pE(n,e,t,i){let{right:s,up:r}=Oi(e),a=n.position.dot(s),o=n.position.dot(r),l=(n.right-n.left)/(2*n.zoom),c=(n.top-n.bottom)/(2*n.zoom);return{x0:a-l,x1:a+l,y0:o-c,y1:o+c,w:t,h:i,stepX:ch(2*l,Math.max(3,t/110)),stepY:ch(2*c,Math.max(3,i/70))}}function uh(n,e,t){let i=[],s=Math.floor(e/t);for(let r=Math.ceil(n/t);r<=s&&i.length<1e3;r++)i.push(r*t);return i}function n0(n,e){let t=Math.max(0,-Math.floor(Math.log10(e)));return(Math.abs(n)<e*1e-9?0:n).toFixed(t).replace("-","\u2212")}var d0=n=>7*n.length-3.5*(n.split(".").length-1);function i0(n){let e=n.kind==="title"?13:12,t=d0(n.text)*e/12,i=n.align==="center"?-t/2:n.align==="end"?-t:0;return n.rotate?[n.x-e/2,n.y-i-t,n.x+e/2,n.y-i]:[n.x+i,n.y-e/2,n.x+i+t,n.y+e/2]}function mE(n,e){let[t,i,s,r]=i0(n),[a,o,l,c]=i0(e);return t<l&&a<s&&i<c&&o<r}var s0=160;function gE(n,e,t){let i=[],s=a=>(a-n.x0)/(n.x1-n.x0)*n.w,r=a=>n.h-(a-n.y0)/(n.y1-n.y0)*n.h;if(e){let a=[];for(let l of uh(n.y0,n.y1,n.stepY)){let c=r(l);c>22&&c<n.h-44&&a.push({text:n0(l,n.stepY),x:0,y:c,align:"end",kind:"tick"})}let o=Math.max(44,22+Math.max(0,...a.map(l=>d0(l.text))));for(let l of uh(n.x0,n.x1,n.stepX)){let c=s(l);c>o+12&&c<n.w-16&&i.push({text:n0(l,n.stepX),x:c,y:n.h-28,align:"center",kind:"tick"})}for(let l of a)i.push({...l,x:o})}return t!==null&&(t[0]!==""&&n.h>=s0&&i.push({text:t[0],x:n.w/2,y:n.h-10,align:"center",kind:"title"}),t[1]!==""&&n.w>=s0&&i.push({text:t[1],x:10,y:n.h/2,align:"center",rotate:!0,kind:"title"})),i}var nf=class{holder=new Kt;mat;spec;src;wide;obj=null;sharedNames=[];shown="";constructor(e,t,i){this.src=e,this.spec=t,this.wide=t.width>1;let s={...i,uLap:{value:t.lap},uSkip:{value:-1},uSegBase:{value:0},uOpacity:{value:t.opacity},uWidth:{value:t.width},uKernel:{value:e.kernel&&!t.highlight?1:0}},r={};e.coloring.kind==="sample"&&(r.USE_TRACK_COLOR=""),e.dist!==null&&(r.DASH=""),this.mat=po(this.wide?eE:QM,s,r)}show(e){this.mat.uniforms.uSegBase.value=typeof e=="number"?this.src.set.start(e)-e:0;let t=e===null?"":String(e);if(t===this.shown||(this.clear(),this.shown=t,e===null))return;let i=this.wide?this.quads(e):this.lines(e);this.obj=this.wide?new Zt(i,this.mat):new Ir(i,this.mat),this.obj.frustumCulled=!1,this.obj.renderOrder=this.holder.parent?.renderOrder??0,this.holder.add(this.obj)}arrays(e){let{ctx:t,set:i,geo:s,display:r,readings:a,coloring:o,colorKey:l,dist:c}=this.src,h=this.spec.lap;if(e==="set")return{pos:t.shared.get(`pos\0${i.id}\0${r}\0${s.lapKey(h)}`,()=>Ep(s,h)),u:t.shared.get(`u\0${i.id}\0${a.channel}`,()=>Cp(i,a.u)),tr:t.shared.get(`t\0${i.id}`,()=>Pp(i)),col:o.kind==="sample"?t.shared.get(`c\0${i.id}\0${l}`,()=>yu(i,o.rgb,3)):null,dist:c===null?null:t.shared.get(`d\0${i.id}\0${r}\0${Kd(c)}`,()=>yu(i,c,1))};let u=i.start(e),d=i.count(e);return{pos:Tp(s,e,h),u:Rp(a.u,u,d),tr:new Float32Array(2*(d-1)).fill(e),col:o.kind==="sample"?vu(o.rgb,3,u,d):null,dist:c===null?null:vu(c,1,u,d)}}lines(e){let t=this.arrays(e),i=(r,a,o)=>e==="set"?this.src.ctx.shared.get(`gl\0${r}\0${this.src.set.id}\0${Kd(a)}`,()=>new kt(a,o)):new kt(a,o),s=new _t;return s.setAttribute("position",i("position",t.pos,3)),s.setAttribute("useg",i("useg",t.u,2)),s.setAttribute("track",i("track",t.tr,1)),t.col&&s.setAttribute("tcolor",i("tcolor",t.col,3)),t.dist&&s.setAttribute("dist",i("dist",t.dist,1)),this.sharedNames=e==="set"?Object.keys(s.attributes):[],s}quads(e){let t=this.arrays(e),i=(a,o,l)=>e==="set"?this.src.ctx.shared.get(`gpu\0${a}\0${this.src.set.id}\0${Kd(o)}`,()=>new as(o,l)):new as(o,l),s=af(),r=i("pos",t.pos,6);if(s.setAttribute("instanceStart",new Tt(r,3,0)),s.setAttribute("instanceEnd",new Tt(r,3,3)),s.setAttribute("useg",new Tt(i("u",t.u,4),2,0)),s.setAttribute("track",new Tt(i("t",t.tr,2),1,0)),t.col){let a=i("c",t.col,6);s.setAttribute("colorStart",new Tt(a,3,0)),s.setAttribute("colorEnd",new Tt(a,3,3))}if(t.dist){let a=i("d",t.dist,2);s.setAttribute("distStart",new Tt(a,1,0)),s.setAttribute("distEnd",new Tt(a,1,1))}return s.instanceCount=t.pos.length/6,this.sharedNames=e==="set"?Object.keys(s.attributes).filter(a=>a!=="position"):[],s}clear(){if(this.obj!==null){this.holder.remove(this.obj);for(let e of this.sharedNames)this.obj.geometry.deleteAttribute(e);this.obj.geometry.dispose(),this.obj=null,this.sharedNames=[]}}dispose(){this.clear(),this.mat.dispose()}},r0=new WeakMap,yE=0;function Kd(n){let e=r0.get(n);return e===void 0&&(e=yE++,r0.set(n,e)),e}var co=18,sf=class{mesh;buffer;mat;n=0;constructor(e,t,i=null){this.mat=po(tE,{uResolution:t,...i??{}},i===null?{}:{DASH:""}),this.buffer=this.allocate(e),this.mesh=new Zt(this.geometry(),this.mat),this.mesh.frustumCulled=!1}allocate(e){let t=new as(new Float32Array(co*Math.max(1,e)),co);return t.setUsage(gi),t}geometry(){let e=af(),t=this.buffer;return e.setAttribute("instanceStart",new Tt(t,3,0)),e.setAttribute("instanceEnd",new Tt(t,3,3)),e.setAttribute("colorStart",new Tt(t,4,6)),e.setAttribute("colorEnd",new Tt(t,4,10)),e.setAttribute("widthStart",new Tt(t,1,14)),e.setAttribute("widthEnd",new Tt(t,1,15)),e.setAttribute("distStart",new Tt(t,1,16)),e.setAttribute("distEnd",new Tt(t,1,17)),e.instanceCount=0,e}begin(e){return co*e>this.buffer.array.length&&(this.mesh.geometry.dispose(),this.buffer=this.allocate(2*e),this.mesh.geometry=this.geometry()),this.n=0,this.buffer.array}end(){this.mesh.geometry.instanceCount=this.n,this.mesh.visible=this.n>0,this.buffer.clearUpdateRanges(),this.buffer.addUpdateRange(0,co*this.n),this.buffer.needsUpdate=!0}dispose(){this.mesh.geometry.dispose(),this.mat.dispose()}};function vE(n,e,t){let i=e.highlight?.kernel;if(i===void 0)return null;let s=lt(n.scene,e.highlight.var);if(s?.kind!=="selector"||s.parameter===void 0)return null;let r=t.parameter(s.parameter,"2.7"),a=1/0,o=-1/0;for(let l=0;l<r.length;l++)a=Math.min(a,r[l]),o=Math.max(o,r[l]);return{parameter:s.parameter,width:i.width,opacity:i.opacity,values:r,extent:o>=a?o-a:0}}function bE(n,e,t,i,s,r,a,o,l,c){let h=i>0?e[t]:0,u=!1;for(let d=0;d+1<i;d++){let f=n[2*(t+d)],p=n[2*(t+d)+1],y=n[2*(t+d+1)]-f,m=n[2*(t+d+1)+1]-p,g=0,v=1,_=!0;for(let[M,T]of[[-y,f-s],[y,a-f],[-m,p-r],[m,o-p]])if(M===0)T<0&&(_=!1);else{let x=T/M;M<0?g=Math.max(g,x):v=Math.min(v,x)}let b=_&&g<=v;if(b&&(g>0||!u)){let M=e[t+d];h=M+g*(e[t+d+1]-M)}l[c+d]=h,u=b&&v>=1}}function Zd(n){let e=Math.min(Math.max(n,1),2048),t=Math.ceil(Math.max(n,1)/e),i=new Float32Array(4*e*t),s=new Pr(i,e,t,Dn,kn);return s.minFilter=s.magFilter=xt,s.generateMipmaps=!1,s.needsUpdate=!0,{data:i,texture:s,width:e}}function a0(n,e,t=1,i=1){let s=new Float32Array(n.samples),r=[1,1,1];r[t]=i;for(let a=0;a<n.tracks;a++){let o=n.start(a),l=0;s[o]=0;for(let c=1;c<n.count(a);c++){let h=3*(o+c-1),u=3*(o+c);l+=Math.hypot(r[0]*(e[u]-e[h]),r[1]*(e[u+1]-e[h+1]),r[2]*(e[u+2]-e[h+2])),s[o+c]=l}}return s}var mo=class{points;material;marker;tinted;texSize=0;texEdge=-1;edgeWidth;constructor(e,t,i){this.marker=e,this.edgeWidth=typeof e.edge_width=="number"?e.edge_width:void 0,this.tinted=i,this.material=new Hs({size:t,sizeAttenuation:!1,vertexColors:i,transparent:!0,alphaTest:.01,depthTest:!1,depthWrite:!1}),this.points=new kr(new _t,this.material),this.points.frustumCulled=!1,this.grow(1),this.setSize(t)}setSize(e,t=this.edgeWidth){this.edgeWidth=t;let i={...this.marker,edge_width:t};this.material.size=e+Yd(i,e);let s=Math.max(1,e),r=t??0;if(Math.abs(s/Math.max(this.texSize,1e-9)-1)>.05||Math.abs(r-this.texEdge)>.05*Math.max(r,.5)){this.texSize=s,this.texEdge=r,this.material.map?.dispose();let a=new Dr(Hg(this.tinted?{...i,color:void 0}:i,s));a.needsUpdate=!0,this.material.map=a,this.material.needsUpdate=!0}}setOpacity(e){this.material.opacity=e}grow(e){let t=this.points.geometry.getAttribute("position");if(t!==void 0&&t.count>=e)return;this.points.geometry.dispose();let i=new _t;i.setAttribute("position",new kt(new Float32Array(3*e),3).setUsage(gi)),i.setAttribute("color",new kt(new Float32Array(3*e),3).setUsage(gi)),this.points.geometry=i}get position(){return this.points.geometry.getAttribute("position")}get color(){return this.points.geometry.getAttribute("color")}show(e){this.position.needsUpdate=!0,this.color.needsUpdate=!0,this.points.geometry.setDrawRange(0,e),this.points.visible=e>0}dispose(){this.points.geometry.dispose(),this.material.map?.dispose(),this.material.dispose()}};function Qd(n){let e=n.head;return typeof e=="object"&&e!==null?e:{}}var hs=class{key;group=new fn;src;layer;set;geo;clocks;clock;spec;color;width;hiWidth;opacity;hiOpacity;fraction;taperWidth;taperOpacity;kernel;ranges;alphas;dashFrom;dashScreen=new Float64Array(0);restartOut=[];resolution={value:new Ie(1,1)};uniforms;baseHolder=new Kt;hiHolder=new Kt;passes=new Map;pieces;heads=null;glow=null;headSize;headColor;fill=null;fillBuffer=new Float32Array(0);line;flatMark;tweened;members=[];highlight=null;selected=null;baseWhat=null;skip=-1;filled=!1;driverContext;geometry;constructor(e,t,i,s){this.key=s,this.geometry=e.geometry;let r=t.set,a=t.layer;this.set=r,this.layer=a,this.clock=t.clock,this.driverContext=t.context==="driver",this.driverContext&&(this.group.matrixAutoUpdate=!1),this.geo=e.geometry.geometry(r.id,this.driverContext?r.def.frame:i),this.clocks=t.channel===null?null:e.geometry.readings(r.id,t.channel);let o=this.clocks??e.geometry.readings(r.id,ot);this.spec=_p(a,r.periodic,Rt(t.clock)),this.color=t.color;let l=Qf(Jf(t.color,e.theme),r,mt(e.theme.foreground));this.kernel=vE(e,a,r),this.line=a.line!==!1,this.flatMark=a.flat===!0?t.index%255+1:0;let c=a.dash!==void 0&&this.line;this.src={ctx:e,set:r,geo:this.geo,display:this.geo.frame,readings:o,colorKey:JSON.stringify(t.color??null),coloring:l,kernel:this.kernel!==null,dist:c?e.shared.get(`dist\0${r.id}\0${this.geo.frame}`,()=>a0(r,this.geo.positions)):null},this.width=a.width??1,this.hiWidth=a.highlight?.width??this.width,this.opacity=typeof a.opacity=="number"?a.opacity:1,this.hiOpacity=a.highlight?.opacity??1,this.fraction=this.spec.reveal==="trail"?this.spec.laps*this.spec.fraction:0,this.taperWidth=a.trail?.taper?.width??KM,this.taperOpacity=a.trail?.taper?.opacity??ZM;let h=ca(Qd(a),e.theme);this.tweened=typeof a.opacity=="object"||typeof h.size=="object"||typeof h.opacity=="object"||typeof h.edge_width=="object",this.ranges=Zd(r.tracks);for(let d=0;d<r.tracks;d++)this.ranges.data.set(xa,4*d);this.alphas=this.kernel===null?null:Zd(r.tracks);let u=c?{uPixels:{value:1},uDash:{value:new Ie(a.dash[0],a.dash[1])}}:null;if(this.dashFrom=c?Zd(Math.max(1,r.samples-r.tracks)):null,this.uniforms={uRanges:{value:this.ranges.texture},uAlphas:{value:(this.alphas??this.ranges).texture},uRangesWidth:{value:this.ranges.width},uColor:{value:new O(...l.kind==="constant"?l.rgb:[1,1,1])},uResolution:this.resolution,uFraction:{value:this.fraction},uTaperWidth:{value:this.taperWidth},uTaperOpacity:{value:this.fraction>0?this.taperOpacity:1},uFade:{value:1},...u??{},...this.dashFrom===null?{}:{uDashFrom:{value:this.dashFrom.texture},uDashWidth:{value:this.dashFrom.width}}},a.fill!==void 0){let d=a.fill,f=mt(d.color!==void 0?qt(d.color,e.theme):l.kind==="constant"?`#${new Xe(...l.rgb).getHexString()}`:e.theme.foreground),p=new Rr({color:new Xe(...f),transparent:!0,opacity:d.opacity??.25,depthTest:!1,depthWrite:!1,side:Ln});this.fill=new Zt(new _t,p),this.fill.frustumCulled=!1,this.group.add(this.fill)}if(this.group.add(this.baseHolder,this.hiHolder),this.pieces=new sf(2*Math.min(r.tracks,64),this.resolution,u),this.flatMark>0&&t0(this.pieces.mesh.material,this.flatMark),this.group.add(this.pieces.mesh),this.headSize=typeof h.size=="number"?h.size:Zg,this.headColor=h.color!==void 0?mt(h.color):null,Wi(a)){if(h.glow!==void 0){let d=h.glow;this.glow=new mo({shape:"disc",color:d.color??"#d62728"},d.size??2.4*this.headSize,!1),this.glow.setOpacity(d.opacity??.35),this.group.add(this.glow.points)}this.heads=new mo(h,this.headSize,h.color===void 0),this.group.add(this.heads.points)}}resize(e,t){this.resolution.value.set(Math.max(1,e),Math.max(1,t))}dashRatio=1;setPixels(e,t){if(this.uniforms.uPixels===void 0||this.src.dist===null)return;this.uniforms.uPixels.value=e;let i=t/Math.max(e,1e-12);if(Math.abs(i/this.dashRatio-1)>.01){this.dashRatio=i,this.src.dist=a0(this.set,this.geo.positions,this.planeAxes[1],i);for(let s of this.passes.values())s.holder.removeFromParent(),s.dispose();this.passes.clear(),this.filled=!1}}colorAt(e,t,i,s){let r=this.src.coloring;if(r.kind==="constant"){i.set(r.rgb,s);return}let a=this.set.start(e);if("sample"in t){for(let o=0;o<3;o++)i[s+o]=r.rgb[3*(a+t.sample)+o];return}for(let o=0;o<3;o++)i[s+o]=(1-t.w)*r.rgb[3*(a+t.k)+o]+t.w*r.rgb[3*(a+t.k+1)+o]}distAt(e,t){let i=this.src.dist;if(i===null)return 0;let s=this.set.start(e),r="sample"in t?Math.min(t.sample,this.set.count(e)-2):t.k,a=this.dashFrom?.data[4*(s-e+Math.max(0,r))]??0;return"sample"in t?i[s+t.sample]-a:(1-t.w)*i[s+t.k]+t.w*i[s+t.k+1]-a}placeDash(e,t,i,s,r){let a=this.dashFrom,o=this.src.dist;if(a===null||o===null)return;e.updateMatrixWorld(),this.group.updateWorldMatrix(!0,!1);let c=new ft().multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse).multiply(this.group.matrixWorld).elements,h=this.geo.positions;this.dashScreen.length<2*this.set.samples&&(this.dashScreen=new Float64Array(2*this.set.samples));let u=this.dashScreen,d=!1;for(let f of this.members){let p=this.set.start(f),y=this.set.count(f);for(let g=p;g<p+y;g++){let v=h[3*g],_=h[3*g+1],b=h[3*g+2],M=c[3]*v+c[7]*_+c[11]*b+c[15],T=(c[0]*v+c[4]*_+c[8]*b+c[12])/M,x=(c[1]*v+c[5]*_+c[9]*b+c[13])/M;u[2*g]=t.x+(T+1)/2*t.w,u[2*g+1]=t.y+(1-x)/2*t.h}let m=p-f;bE(u,o,p,y,-r,-r,i+r,s+r,this.restartOut,0);for(let g=0;g+1<y;g++){let v=this.restartOut[g];a.data[4*(m+g)]!==v&&(a.data[4*(m+g)]=v,d=!0)}}d&&(a.texture.needsUpdate=!0)}fillKernel(){let e=this.kernel;if(e===null||this.alphas===null)return;let t=this.selected===null?null:e.values[this.selected];for(let i=0;i<this.set.tracks;i++)this.alphas.data[4*i]=t===null?this.opacity:fE(this.opacity,e,e.extent,Math.abs(e.values[i]-t));this.alphas.texture.needsUpdate=!0}showPass(e){e.show(e.spec.highlight?this.highlight:this.baseWhat),e.mat.uniforms.uSkip.value=e.spec.highlight?-1:this.skip}pass(e,t){let i=`${t?"h":"b"}${e}`,s=this.passes.get(i);return s===void 0&&(s=new nf(this.src,{lap:e,highlight:t,width:t?this.hiWidth:this.width,opacity:t?this.hiOpacity:this.opacity},this.uniforms),this.flatMark>0&&!t&&t0(s.mat,this.flatMark),(t?this.hiHolder:this.baseHolder).add(s.holder),this.passes.set(i,s),this.showPass(s)),s}syncPasses(e,t){for(let i of this.passes.values())i.holder.visible=!1;if(this.line){if(this.baseWhat!==null)for(let i=e[0];i<=e[1];i++)this.pass(i,!1).holder.visible=!0;if(this.highlight!==null)for(let i=t[0];i<=t[1];i++)this.pass(i,!0).holder.visible=!0}}get isStatic(){return this.clocks===null&&!this.driverContext&&!this.tweened}place(e,t){this.group.visible=t!==null,t!==null&&(lE(e,this.set.def.frame,t,this.group.matrix,this.geometry.readings(t.set.id,e.channel).clocks[t.track]),this.group.matrixWorldNeedsUpdate=!0)}fade(e){let t=this.layer,i=typeof t.opacity=="object"?Xt(t.opacity,e)/Math.max(this.opacity,1e-9):1;this.uniforms.uFade.value=typeof t.opacity=="object"?Xt(t.opacity,e):1;let s=Qd(t),r=typeof t.opacity=="object"?Xt(t.opacity,e):1;return this.heads?.setOpacity(r*Xt(s.opacity,e)),this.heads!==null&&(typeof s.size=="object"||typeof s.edge_width=="object")&&this.heads.setSize(aa(s.size,e,Zg),s.edge_width===void 0?void 0:ra(s.edge_width,e,0)),this.glow!==null&&this.glow.setOpacity(r*Xt(s.opacity,e)*(s.glow?.opacity??.35)),this.fill!==null&&(this.fill.material.opacity=r*(t.fill?.opacity??.25)),i}update(e,t,i){let s=Bn(t.clock,i);this.fade(s);let r=this.uniforms.uFade.value,a=e.highlight;if(e.members.length!==this.members.length||e.members.some((_,b)=>_!==this.members[b])||a!==this.highlight||e.selected!==this.selected){let _=e.layer.members!=="all"&&e.members.length===1?e.members[0]:-1;this.members=e.members,this.highlight=a,this.selected=e.selected,this.baseWhat=_>=0?_===a?null:_:e.members.length>0?"set":null,this.skip=_<0&&a!==null?a:-1;for(let b of this.passes.values())this.showPass(b);for(let b=0;b<this.set.tracks;b++)this.ranges.data.set(xa,4*b);this.fillKernel(),this.heads?.grow(e.members.length),this.glow?.grow(e.members.length),this.filled=!1}if(this.clocks===null&&this.filled)return!1;let l=this.pieces.begin(this.line?2*e.members.length:0),c=this.heads?.position,h=this.heads?.color,u=this.glow?.position,d=Qd(this.layer).glow?.channel,f=d===void 0?null:this.set.channel(d,"2.7"),p=0,y=0,m=[1/0,-1/0],g=[1/0,-1/0],v=[];for(let _ of e.members){let b=this.clocks?.clocks[_]??null,M=Sp(b,this.clock,i,this.spec,Math.fround);this.ranges.data.set(M.range,4*_);let T=_===a;if(M.laps!==null){let R=T?g:m;R[0]=Math.min(R[0],M.laps[0]),R[1]=Math.max(R[1],M.laps[1])}let x=T?this.hiWidth:this.width,A=r*(T?this.hiOpacity:this.alphas!==null?this.alphas.data[4*_]:this.opacity),k=this.fraction>0&&M.loop!==null;if(this.line)for(let R of M.pieces){let D=co*this.pieces.n++;R.forEach((H,j)=>{this.geo.vertex(_,H,l,D+3*j),this.colorAt(_,H,l,D+6+4*j);let L=k?e0(1-(M.loop-Ap(b,H))/this.fraction):1;l[D+9+4*j]=A*(k?this.taperOpacity+(1-this.taperOpacity)*L:1),l[D+14+j]=x>1&&k?x*(this.taperWidth+(1-this.taperWidth)*L):x,l[D+16+j]=this.distAt(_,H)})}if(c!==void 0&&h!==void 0&&M.head!==null&&p<c.count&&(this.geo.vertex(_,M.head,c.array,3*p),this.headColor!==null?h.array.set(this.headColor,3*p):this.colorAt(_,M.head,h.array,3*p),p++,u!==void 0&&f!==null)){let R=M.head,D="sample"in R?R.sample:R.w>=1?R.k+1:R.k;f[this.set.start(_)+D]>0&&this.geo.vertex(_,R,u.array,3*y++)}this.fill!==null&&!M.hidden&&this.fillTrack(_,b,M.loop,v)}return this.pieces.end(),this.heads?.show(p),this.glow?.show(y),this.fill!==null&&this.setFill(v),this.syncPasses(m,g),this.ranges.texture.needsUpdate=!0,this.filled=!0,!0}fillTrack(e,t,i,s){let r=this.spec,a=r.laps,o;t===null||i===null||r.reveal==="none"?o=Dh(this.set.count(e),a,r.periodic):r.reveal==="grow"?o=Io(t,0,i,a):o=ko(t,i,a,r.fraction,r.periodic);let l=this.planeAxes,c=this.layer.fill?.base??0,h=new Float32Array(3),u=null;for(let d of o){this.geo.vertex(e,d,h,0);let f=[h[l[0]],h[l[1]]];u!==null&&xE(u,f,c,s),u=f}}planeAxes=[0,1];setFill(e){let t=this.fill,i=e.length/2;3*i>this.fillBuffer.length&&(this.fillBuffer=new Float32Array(3*Math.max(2*i,96)),t.geometry.dispose(),t.geometry=new _t,t.geometry.setAttribute("position",new kt(this.fillBuffer,3).setUsage(gi)));let[s,r]=this.planeAxes;this.fillBuffer.fill(0,0,3*i);for(let o=0;o<i;o++)this.fillBuffer[3*o+s]=e[2*o],this.fillBuffer[3*o+r]=e[2*o+1];let a=t.geometry.getAttribute("position");a!==void 0&&(a.clearUpdateRanges(),a.addUpdateRange(0,3*i),a.needsUpdate=!0),t.geometry.setDrawRange(0,i),t.visible=i>0}extend(){}colorbar(){let e=this.color;if(e===void 0||typeof e=="string"||ha(e))return null;let t=Gh(e,this.set),i=this.set.def.parameters??{},s=t.perTrack&&Object.hasOwn(i,t.name)?i[t.name]:void 0,r=s?.label??t.name,[a,o]=t.range,l=f=>o===a?.5:e0((f-a)/(o-a)),c=this.highlight??(this.layer.members!=="all"&&this.members.length===1?this.members[0]:null),h=t.perTrack&&c!==null?l(t.values[c]):null,u=this.kernel,d=null;if(u!==null&&t.perTrack&&t.name===u.parameter&&this.selected!==null){let f=t.values[this.selected],p=1.5*u.width*u.extent;d=[l(f-p),l(f+p)]}return{label:s?.unit?`${r}, ${s.unit}`:r,gradient:ep(t),stops:Wh(t),lo:a,hi:o,marker:h,band:d}}dispose(){for(let e of this.passes.values())e.dispose();this.ranges.texture.dispose(),this.alphas?.texture.dispose(),this.pieces.dispose(),this.heads?.dispose(),this.glow?.dispose(),this.fill!==null&&(this.fill.geometry.dispose(),this.fill.material.dispose())}};function xE(n,e,t,i){let[s,r]=n,[a,o]=e,l=r>t,c=o>t;if(!l&&!c)return;let h=(d,f,p,y)=>i.push(d,t,d,f,p,y,d,t,p,y,p,t);if(l&&c){h(s,r,a,o);return}let u=s+(t-r)/(o-r)*(a-s);l?i.push(s,t,s,r,u,t):i.push(u,t,a,o,a,t)}var ho=class{key;group=new fn;sprites;layer;rgb;isStatic;done=!1;constructor(e,t,i){this.key=i,this.layer=t;let s=t.marker??{};this.rgb=mt(s.color!==void 0?qt(s.color,e.theme):e.theme.foreground),this.sprites=new mo(ca(s,e.theme),typeof s.size=="number"?s.size:4,!1),this.group.add(this.sprites.points),this.isStatic=(t.reveal??"none")==="none"&&t.before===void 0&&t.after===void 0&&typeof s.size!="object"&&typeof s.edge_width!="object"&&typeof s.opacity!="object"&&typeof t.opacity!="object"}update(e,t){let i=Bn(e.base?.clock??e.clock,e.q),s=this.layer.marker??{};if(this.sprites.setOpacity(Xt(this.layer.opacity,i)*Xt(s.opacity,i)),(typeof s.size=="object"||typeof s.edge_width=="object")&&this.sprites.setSize(aa(s.size,i,4),s.edge_width===void 0?void 0:ra(s.edge_width,i,0)),this.isStatic&&this.done)return;let r=Uo(e,this.layer,t.set),a=0;for(let h of r.members)a+=h.points.length;this.sprites.grow(a);let o=this.sprites.position.array,l=this.sprites.color.array,c=0;for(let h of r.members)for(let u of h.points)o.set(u,3*c),l.set(this.rgb,3*c),c++;this.sprites.show(a),this.done=!0}extend(e){let t=this.sprites.position,i=this.sprites.points.geometry.drawRange;for(let s=0;s<Math.min(t.count,i.count);s++)e.expandByPoint(new O(t.getX(s),t.getY(s),t.getZ(s)))}dispose(){this.sprites.dispose()}},uo=class{key;group=new fn;layer;at=null;constructor(e,t){this.key=t,this.layer=e}update(e,t,i){let s=Oo(e,this.layer,t.set,i);this.at=s.position===null?null:new O(...s.position)}extend(){}dispose(){}},o0=new WeakMap;function _E(n,e){let t=o0.get(n);t===void 0&&o0.set(n,t=new Map);let i=t.get(e);return i===void 0&&(i=(async()=>{let s=n.bytes(e),r=s[0]===255?"image/jpeg":s[0]===82?"image/webp":"image/png",a=await createImageBitmap(new Blob([s],{type:r}),{imageOrientation:"flipY"}),o=new tn(a);return o.generateMipmaps=!1,o.minFilter=xt,o.magFilter=xt,o.flipY=!1,o.colorSpace=ii,o.needsUpdate=!0,o})(),t.set(e,i)),i}var us=class{key;group=new fn;label;size;at=null;point;trail;geometry;scratch=new Float64Array(3);capacity=0;layer;ready;constructor(e,t,i,s=()=>{}){this.key=i,this.layer=t,this.geometry=e.geometry;let r=e.scene.bodies??{},a=Object.hasOwn(r,t.body)?r[t.body]:void 0;this.label=a?.label??null,this.size=t.size??jM;let o=new Xe(...mt(a?.color!==void 0?qt(a.color,e.theme):e.theme.foreground));this.ready=Promise.resolve();let l=new _t;l.setAttribute("position",new kt(new Float32Array(3),3).setUsage(gi)),this.point=new kr(l,new Hs({color:o,size:this.size,sizeAttenuation:!1,map:e.disc,alphaTest:.5,transparent:!0,depthTest:!1,depthWrite:!1})),this.point.frustumCulled=!1;let c=a?.image;if(c!==void 0){let h=this.point.material;h.color.setRGB(1,1,1),h.alphaTest=.01,h.map=null,this.point.visible=!1,this.ready=_E(e.geometry,c).then(u=>{h.map=u,h.needsUpdate=!0,s()},()=>{})}this.trail=new Lr(new _t,new zs({color:o,transparent:!0,opacity:.6,depthTest:!1,depthWrite:!1})),this.trail.frustumCulled=!1,this.group.add(this.trail,this.point)}update(e,t,i){let s=Xt(this.layer.opacity,Bn(e.clock,e.q));if(this.point.material.opacity=s,this.trail.material.opacity=.6*s,i===null){this.point.visible=!1,this.trail.visible=!1,this.at=null;return}let{set:r,track:a}=i,o=Rt(e.clock),l=this.geometry.readings(r.id,e.channel).clocks[a],c=this.geometry.bodyTrail(t.body,e.display,r.id,a),h=o*Xn(l.reading(e.clock,e.q)),u=rn(h,o),d=this.scratch;c.vertex(Pt(l,u.u,!1,u.lap),d),this.point.visible=!this.hasImage||this.point.material.map!==null,this.at=new O(d[0],d[1],d[2]);let f=this.point.geometry.getAttribute("position");if(f.setXYZ(0,d[0],d[1],d[2]),f.needsUpdate=!0,t.trail===void 0){this.trail.visible=!1;return}let p=t.trail.fraction,y=h-o*p;y<0&&!r.periodic&&(y=0);let m=Lp(c.m,o,p);if(m>this.capacity){this.capacity=m,this.trail.geometry.dispose();let _=new _t;_.setAttribute("position",new kt(new Float32Array(3*this.capacity),3).setUsage(gi)),this.trail.geometry=_}let g=this.trail.geometry.getAttribute("position"),v=c.polyline(l,y,h,o,g.array);g.clearUpdateRanges(),g.addUpdateRange(0,3*v),g.needsUpdate=!0,this.trail.geometry.setDrawRange(0,v),this.trail.visible=v>1}extend(e){this.at!==null&&e.expandByPoint(this.at)}clip(e){if(!this.hasImage||this.at===null)return;let t=this.at.clone().project(e);(Math.abs(t.x)>1||Math.abs(t.y)>1)&&(this.point.visible=!1)}get hasImage(){let e=this.geometry.scene.bodies??{};return Object.hasOwn(e,this.layer.body)&&e[this.layer.body].image!==void 0}dispose(){this.point.material.map?.dispose();for(let e of[this.point,this.trail])e.geometry.dispose(),e.material.dispose()}},dh=class{key;group=new fn;geometry;resolution={value:new Ie(1,1)};shaft;head;buffer;constructor(e,t,i){this.key=i,this.geometry=e.geometry;let{layer:s}=t,r={uResolution:this.resolution,uColor:{value:new ht(...mt(qt(s.color??e.theme.foreground,e.theme)),typeof s.opacity=="number"?s.opacity:1)},uWidth:{value:s.width??1},uHead:{value:s.head?.size??qM},uHeadWidth:{value:YM}};this.buffer=this.allocate(t.set.tracks);let a=new Or;a.setAttribute("position",new Bt([-1,0,0,1,0,0,0,1,0],3)),this.shaft=new Zt(this.attach(af()),po(Qg,r)),this.head=new Zt(this.attach(a),po(Qg,r,{HEAD:""}));for(let o of[this.shaft,this.head])o.frustumCulled=!1;this.group.add(this.shaft,this.head)}allocate(e){return new as(new Float32Array(6*Math.max(1,e)),6).setUsage(gi)}attach(e){return e.setAttribute("instanceBase",new Tt(this.buffer,3,0)),e.setAttribute("instanceTip",new Tt(this.buffer,3,3)),e.instanceCount=0,e}update(e,t){typeof t.layer.opacity=="object"&&(this.shaft.material.uniforms.uColor.value.w=Xt(t.layer.opacity,Bn(e.clock,e.q)));let i=this.geometry.readings(t.set.id,t.channel).clocks,r=Do(e,t.layer,t.set,o=>i[o]).members.filter(o=>o.base!==null&&o.tip!==null);if(6*r.length>this.buffer.array.length){this.buffer=this.allocate(2*r.length);for(let o of[this.shaft,this.head])o.geometry.deleteAttribute("instanceBase"),o.geometry.deleteAttribute("instanceTip"),this.attach(o.geometry)}let a=this.buffer.array;r.forEach((o,l)=>{a.set(o.base,6*l),a.set(o.tip,6*l+3)}),this.buffer.clearUpdateRanges(),this.buffer.addUpdateRange(0,6*r.length),this.buffer.needsUpdate=!0;for(let o of[this.shaft,this.head])o.geometry.instanceCount=r.length,o.visible=r.length>0}resize(e,t){this.resolution.value.set(Math.max(1,e),Math.max(1,t))}extend(){}dispose(){for(let e of[this.shaft,this.head])e.geometry.dispose(),e.material.dispose()}};function SE(n,e,t,i,s,r,a){let{right:o,up:l}=Oi(t),c=Yr(s);i.updateMatrixWorld();let[h,u,d]=n.axes.map(p=>new O(...p)),f=[];for(let[p,y]of[[e.x0,e.y0],[e.x1,e.y0],[e.x1,e.y1],[e.x0,e.y1]]){let m=o.clone().multiplyScalar(p).addScaledVector(l,y),g=new O(...n.origin).addScaledVector(h,m.x).addScaledVector(u,m.y).addScaledVector(d,m.z);if(g.multiply(c).applyMatrix4(i.matrixWorldInverse),i instanceof ln&&g.z>=-i.near)return null;g.applyMatrix4(i.projectionMatrix),f.push([(g.x+1)/2*r,(1-g.y)/2*a])}return f}var fo=class{key;group=new fn;layer;mesh;positions=new Float32Array(0);map=null;constructor(e,t,i){this.key=i,this.layer=t;let s=new ht(...mt(qt(t.color??e.theme.foreground,e.theme)),typeof t.opacity=="number"?t.opacity:1);this.mesh=new Zt(new _t,po(nE,{uColor:{value:s}})),this.mesh.frustumCulled=!1,this.mesh.visible=!1,this.group.add(this.mesh)}update(e,t){typeof this.layer.opacity=="object"&&(this.mesh.material.uniforms.uColor.value.w=Xt(this.layer.opacity,Bn(e.clock,e.q))),this.map=No(e,this.layer,t)}get target(){return this.map?.origin==null?null:this.map.panel}place(e,t){let i=this.map,s=[],{w:r,h:a}=e.rect;if(i?.origin!=null&&i.axes!==null&&t?.view!=null&&t.error===null&&t.cameraSpec.kind==="plane"){let l=SE({...i,origin:i.origin,axes:i.axes},t.view,t.cameraSpec,e.camera,e.cameraSpec,r,a),c={width:this.layer.width??1,minSize:this.layer.min_size??JM,dash:this.layer.dash};l!==null&&(s=jg(l,r,a,c))}let o=s.length/2;3*o>this.positions.length&&(this.positions=new Float32Array(3*Math.max(2*o,96)),this.mesh.geometry.dispose(),this.mesh.geometry=new _t,this.mesh.geometry.setAttribute("position",new kt(this.positions,3).setUsage(gi)));for(let l=0;l<o;l++)this.positions[3*l]=2*s[2*l]/r-1,this.positions[3*l+1]=1-2*s[2*l+1]/a;if(o>0){let l=this.mesh.geometry.getAttribute("position");l.clearUpdateRanges(),l.addUpdateRange(0,3*o),l.needsUpdate=!0}this.mesh.geometry.setDrawRange(0,o),this.mesh.visible=o>0}extend(){}dispose(){this.mesh.geometry.dispose(),this.mesh.material.dispose()}},Ni=class{key;group=new fn;kind;follows;full;ticks;box;theme;lines;shown="";tips=[];constructor(e,t,i,s){this.key=s,this.kind=t.kind,this.theme=e.theme;let r=i.kind==="plane";this.box=t.kind==="axes"&&t.span==="box"&&r?t:null,t.kind==="axes"?(this.full=(t.span??(r?"full":"positive"))==="full",this.ticks=r&&this.full):(this.full=!1,this.ticks=r&&(t.labels??r)),this.follows=this.ticks||t.kind==="grid"&&hh(i);let a=new zs({vertexColors:!0,transparent:!0,depthTest:!1,depthWrite:!1});this.lines=new Ir(new _t,a),this.lines.frustumCulled=!1,this.group.add(this.lines)}set(e,t){this.lines.geometry.dispose();let i=new _t;i.setAttribute("position",new Bt(e,3)),i.setAttribute("color",new Bt(t,4)),this.lines.geometry=i}layout(e,t,i=new O(1,1,1)){if(this.follows||this.box!==null)return;let s=e.getCenter(new O),r=e.getSize(new O),a=Math.max(r.x,r.y,r.z,1e-9),o=[],l=[],c=(h,u,d,f)=>{o.push(h.x,h.y,h.z,u.x,u.y,u.z),l.push(...d,f,...d,f)};if(this.kind==="axes"){let h=r.clone().multiply(i),u=Math.max(h.x,h.y,h.z,1e-9),d=p=>ch(hh(t)&&p>1e-9*u?p:u,2),f=mt(this.theme.foreground);this.tips=[new O(d(h.x)/i.x,0,0),new O(0,d(h.y)/i.y,0),new O(0,0,d(h.z)/i.z)];for(let p of this.tips)c(this.full?p.clone().negate():new O,p,f,.8)}else{let{right:h,up:u,normal:d}=Oi(t.kind==="plane"?t:{kind:"plane",plane:t.up==="x"?"yz":t.up==="y"?"xz":"xy"}),f=ch(a,8),p=mt(this.theme.grid),y=mt(Ut(this.theme.grid,this.theme.foreground,.3)),m=s.dot(h),g=s.dot(u),v=Math.abs(d.x)>.5?"x":Math.abs(d.y)>.5?"y":"z",_=new O;_[v]=1;let b=e.min[v]<=0&&e.max[v]>=0?0:s[v],M=2.5*a,T=Math.floor((m-M)/f),x=Math.ceil((m+M)/f),A=Math.floor((g-M)/f),k=Math.ceil((g+M)/f),R=(D,H)=>h.clone().multiplyScalar(D).addScaledVector(u,H).addScaledVector(_,b);for(let D=T;D<=x;D++)c(R(D*f,A*f),R(D*f,k*f),D===0?y:p,1);for(let D=A;D<=k;D++)c(R(T*f,D*f),R(x*f,D*f),D===0?y:p,1)}this.set(o,l)}follow(e,t){if(!this.follows)return;let i=[e.x0,e.x1,e.y0,e.y1,e.stepX,e.stepY].join(",");if(i===this.shown)return;this.shown=i;let{right:s,up:r}=Oi(t),a=[],o=[],l=(c,h,u,d,f,p)=>{let y=s.clone().multiplyScalar(c).addScaledVector(r,h),m=s.clone().multiplyScalar(u).addScaledVector(r,d);a.push(y.x,y.y,y.z,m.x,m.y,m.z),o.push(...f,p,...f,p)};if(this.kind==="axes"){let c=mt(this.theme.foreground);e.y0<=0&&e.y1>=0&&l(e.x0,0,e.x1,0,c,.5),e.x0<=0&&e.x1>=0&&l(0,e.y0,0,e.y1,c,.5)}else{let c=mt(this.theme.grid),h=mt(Ut(this.theme.grid,this.theme.foreground,.3));for(let u of uh(e.x0,e.x1,e.stepX))l(u,e.y0,u,e.y1,u===0?h:c,1);for(let u of uh(e.y0,e.y1,e.stepY))l(e.x0,u,e.x1,u,u===0?h:c,1)}this.set(a,o)}extend(){}dispose(){this.lines.geometry.dispose(),this.lines.material.dispose()}},wE=100,ME=150;function l0(n,e,t){return new mn(n,e,{samples:t,depthBuffer:!0,stencilBuffer:!0,minFilter:xt,magFilter:xt,generateMipmaps:!1})}function EE(){let n=new Cn({glslVersion:io,uniforms:{uUnderlay:{value:null}},vertexShader:"void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",fragmentShader:"uniform sampler2D uUnderlay; out vec4 color; void main() { color = texelFetch(uUnderlay, ivec2(gl_FragCoord.xy), 0); }",depthTest:!1,depthWrite:!1,blending:Ii}),e=new Zt(new Vs(2,2),n);e.frustumCulled=!1;let t=new Fs;return t.add(e),{scene:t,camera:new Pn,material:n}}function TE(n,e){n.updateMatrixWorld();let t=n.matrixWorld.elements,i=n.projectionMatrix.elements,s=!1;for(let r=0;r<16;r++)e[r]!==t[r]&&(s=!0,e[r]=t[r]),e[16+r]!==i[r]&&(s=!0,e[16+r]=i[r]);return s}var rf=class{id;scene=new Fs;staticScene=new Fs;underlay=new ht(-1,-1,-1,-1);underlayDirty=!0;staticKey="";rebuiltAt=-1/0;coarse=!1;cameraSeen=new Float64Array(32);camera=new Pn;cameraSpec={kind:"plane",plane:"xy"};controls=null;element=null;labels=null;plan=null;error=null;draws=new Map;rect={x:0,y:0,w:1,h:1};outer={x:0,y:0,w:1,h:1};window=null;content="";needsFit=!0;userMoved=!1;fitting=!1;halfWidth=1;halfHeight=1;box=null;target=new O;turned=0;view=null;constructor(e){this.id=e}},c0=n=>JSON.stringify(n),AE=n=>n.kind==="orbit"&&(n.turn??0)!==0,jr=class{canvas;onChange=()=>{};gl;ctx;panels=new Map;lastState=null;size={w:0,h:0,ratio:0};background;cacheStatic;coarseDrags;refineTimer=null;blit;underlay=null;scratch=null;viewport=new ht;cssViewport=new ht;cssScissor=new ht;buffer=new Ie;region=new qa;corner=new Ie;constructor(e,t,i,s={}){this.canvas=e,je.enabled=!1,this.gl=new eh({canvas:e,antialias:!0,stencil:!0,preserveDrawingBuffer:s.preserveDrawingBuffer??!1}),this.cacheStatic=s.cacheStatic??!0,this.coarseDrags=s.coarseDrags??!0,this.blit=EE(),e.addEventListener("webglcontextrestored",()=>{for(let a of this.panels.values())a.underlayDirty=!0}),this.gl.outputColorSpace=Us,this.gl.autoClear=!1;let r=s.theme??Es(t);this.background=new Xe(...mt(r.background)),this.ctx={scene:t,geometry:i,shared:new ef,theme:r,disc:sE()}}setTheme(e){this.ctx.theme=e,this.background.setRGB(...mt(e.background)),this.lastState=null;for(let t of this.panels.values())t.underlayDirty=!0}panel(e){let t=this.panels.get(e);return t||(t=new rf(e),this.panels.set(e,t)),t}bind(e,t){let i=this.panel(e);i.element!==t&&(i.controls?.dispose(),i.controls=null,i.labels?.remove(),i.labels=null,i.element=t,t!==null&&(i.labels=document.createElement("div"),i.labels.className="labels",t.append(i.labels),this.makeControls(i)))}refit(e){let t=this.panels.get(e);t&&(t.needsFit=!0,t.userMoved=!1)}refitAll(){for(let e of this.panels.keys())this.refit(e)}offKeys(e){let t=this.panels.get(e);return t!==void 0&&t.userMoved&&t.cameraSpec.kind==="plane"&&t.cameraSpec.keys!==void 0}makeControls(e){if(e.controls?.dispose(),e.controls=null,e.element===null)return;let t=new sh(e.camera,e.element);t.enableDamping=!1,t.screenSpacePanning=!0,e.cameraSpec.kind==="plane"&&(t.enableRotate=!1,t.zoomToCursor=!0,t.mouseButtons={LEFT:Wn.PAN,MIDDLE:Wn.DOLLY,RIGHT:Wn.PAN},t.touches={ONE:ei.PAN,TWO:ei.DOLLY_PAN}),t.addEventListener("change",()=>{e.fitting||(e.userMoved=!0,this.onChange())}),e.controls=t}setCamera(e,t){e.cameraSpec=t;let i=t.kind==="plane"||t.projection==="orthographic";e.camera=i?new Pn(-1,1,1,-1,-1,1):new ln(35,1,.01,100);let s=Yr(t);e.scene.scale.copy(s),e.staticScene.scale.copy(s),e.underlayDirty=!0,e.needsFit=!0,e.userMoved=!1,this.makeControls(e)}drawStatic(e){if(e.staticScene.children.length===0)return;if(!this.cacheStatic||AE(e.cameraSpec)){this.gl.render(e.staticScene,e.camera);return}let t=this.gl.getDrawingBufferSize(this.buffer);if(this.underlay===null||this.underlay.width!==t.x||this.underlay.height!==t.y){this.underlay?.dispose(),this.underlay=l0(t.x,t.y,0),this.gl.initRenderTarget(this.underlay);for(let s of this.panels.values())s.underlayDirty=!0}let i=this.gl.getCurrentViewport(this.viewport);if(i.equals(e.underlay)||(e.underlay.copy(i),e.underlayDirty=!0),TE(e.camera,e.cameraSeen)&&(e.underlayDirty=!0),e.underlayDirty){e.underlayDirty=!1;let s=performance.now();e.coarse=this.coarseDrags&&s-e.rebuiltAt<wE,e.rebuiltAt=s,e.coarse?(this.drawCoarse(e,this.underlay,i),this.scheduleRefine()):this.drawFine(e,this.underlay,i),this.gl.setViewport(this.gl.getViewport(this.cssViewport)),this.gl.setScissor(this.gl.getScissor(this.cssScissor))}this.blit.material.uniforms.uUnderlay.value=this.underlay.texture,this.gl.render(this.blit.scene,this.blit.camera)}drawCoarse(e,t,i){t.viewport.copy(i),t.scissor.copy(i),t.scissorTest=!0,this.gl.setRenderTarget(t),this.gl.clear(!0,!1,!0),this.gl.render(e.staticScene,e.camera),this.gl.setRenderTarget(null)}scheduleRefine(){this.refineTimer!==null&&clearTimeout(this.refineTimer),this.refineTimer=setTimeout(()=>{this.refineTimer=null;for(let e of this.panels.values())e.coarse&&(e.underlayDirty=!0,e.rebuiltAt=-1/0);this.onChange()},ME)}drawFine(e,t,i){let s=this.scratch;(s===null||s.width<i.z||s.height<i.w)&&(s?.dispose(),s=this.scratch=l0(Math.max(i.z,s?.width??0),Math.max(i.w,s?.height??0),4)),s.viewport.set(0,0,i.z,i.w),s.scissor.set(0,0,i.z,i.w),s.scissorTest=!0,this.gl.setRenderTarget(s),this.gl.clear(!0,!1,!0),this.gl.render(e.staticScene,e.camera),this.gl.setRenderTarget(null),this.region.min.set(0,0),this.region.max.set(Math.min(i.z,t.width-i.x),Math.min(i.w,t.height-i.y)),this.gl.copyTextureToTexture(s.texture,t.texture,this.region,this.corner.set(i.x,i.y))}disposePanel(e){for(let t of e.draws.values())t.dispose();e.draws.clear(),e.controls?.dispose(),e.labels?.remove(),this.panels.delete(e.id)}replan(e,t){let i=this.ctx.scene,s;try{s=aE(i,this.ctx.geometry,t,e.id),e.error=null}catch(f){if(!(f instanceof un))throw f;e.error=f.message,e.plan=null;for(let p of e.draws.values())p.group.visible=!1;return}let r=e.plan,a=s.view.camera??{kind:"plane",plane:"xy"};(r===null||r.viewId!==s.viewId||c0(a)!==c0(e.cameraSpec))&&this.setCamera(e,a);let o=oE(s);o!==e.content&&(e.content=o,e.needsFit=!0,e.userMoved=!1),e.plan=s;let l=new Set,c=JSON.stringify(this.ctx.theme);try{for(let f of s.layers){let p;if(f.kind==="track"){if(f.set===null)continue;let v=`${JSON.stringify(f.color??null)}\0${c}`;p=`track\0${s.viewId}\0${f.index}\0${f.set.id}\0${s.display}\0${f.channel??""}\0${v}`}else if(f.kind==="arrow"){if(f.set===null)continue;let v=JSON.stringify([f.layer.color??null,c,f.layer.opacity,f.layer.width,f.layer.head]);p=`arrow\0${s.viewId}\0${f.index}\0${f.set.id}\0${s.display}\0${f.channel}\0${v}`}else if(f.kind==="outline")p=`outline\0${s.viewId}\0${f.index}\0${JSON.stringify([f.layer,c])}`;else if(f.kind==="points"||f.kind==="label"){if(f.kind==="points"&&f.set===null)continue;p=`${f.kind}\0${s.viewId}\0${f.index}\0${f.set?.id??""}\0${s.display}\0${JSON.stringify(f.layer)}\0${c}`}else p=`${f.kind}\0${s.viewId}\0${f.index}\0${s.display}\0${c}`;l.add(f.index);let y=e.draws.get(f.index);if(y!==void 0&&y.key===p){y.group.visible=!0;continue}y!==void 0&&(y.group.removeFromParent(),y.dispose(),e.draws.delete(f.index));let m=f.kind==="track"?new hs(this.ctx,f,s.display,p):f.kind==="arrow"?new dh(this.ctx,f,p):f.kind==="outline"?new fo(this.ctx,f.layer,p):f.kind==="body"?new us(this.ctx,f.layer,p,()=>{e.underlayDirty=!0,this.onChange()}):f.kind==="points"?new ho(this.ctx,f.layer,p):f.kind==="label"?new uo(f.layer,p):new Ni(this.ctx,f.layer,e.cameraSpec,p);m.group.renderOrder=f.index;let g=0;for(let v of m.group.children)v.renderOrder=16*f.index+g++;e.draws.set(f.index,m),m instanceof Ni&&e.box!==null&&m.layout(e.box,e.cameraSpec,Yr(e.cameraSpec))}}catch(f){if(!(f instanceof un))throw f;e.error=f.message,e.plan=null;for(let p of e.draws.values())p.group.visible=!1;return}for(let[f,p]of[...e.draws])l.has(f)||(p.group.removeFromParent(),p.dispose(),e.draws.delete(f));let h=[],u=!0;for(let f of s.layers){let p=e.draws.get(f.index);p!==void 0&&(u&&=p instanceof hs&&p.isStatic,(u?e.staticScene:e.scene).add(p.group),u&&h.push(p.key))}let d=h.join(`
`);d!==e.staticKey&&(e.staticKey=d,e.underlayDirty=!0)}advance(e,t,i){let s=e.plan;if(s===null)return;let r=this.ctx.scene,a={scope:s.scope,frames:this.ctx.geometry.frames,clock:r.clock,channel:t.clock.channel,q:i,display:s.display};e.error=null;let o=e.cameraSpec.kind==="plane"?Qs(e.cameraSpec):[0,1];try{for(let l of s.layers){let c=e.draws.get(l.index);c instanceof hs&&l.kind==="track"?(c.planeAxes=o,c.update(l,r,i)&&c.isStatic&&(e.underlayDirty=!0),c.driverContext&&c.place(a,s.driver)):c instanceof dh&&l.kind==="arrow"?c.update(xi(a,l.layer),l):c instanceof fo&&l.kind==="outline"?c.update(a,s.driver):c instanceof us&&l.kind==="body"?c.update(a,l.layer,s.driver):c instanceof ho&&l.kind==="points"?c.update(xi(a,l.layer),l):c instanceof uo&&l.kind==="label"&&c.update(a,l,s.driver)}}catch(l){if(!(l instanceof un))throw l;e.error=l.message}}fit(e){let t=new Qn,i=e.plan===null?null:uE(e.plan,this.ctx.geometry);if(i!==null)t.set(new O(i[0],i[1],i[2]),new O(i[3],i[4],i[5]));else for(let f of e.draws.values())(f instanceof us&&f.group.visible||f instanceof ho)&&f.extend(t);t.isEmpty()&&t.set(new O(-1,-1,-1),new O(1,1,1));let s=e.cameraSpec,r=Yr(s),a=new Qn(t.min.clone().multiply(r),t.max.clone().multiply(r)),o=a.getCenter(new O),l=a.getSize(new O),c=Math.max(l.length()/2,1e-9),{up:h,normal:u}=Oi(s),d=e.camera;if(e.fitting=!0,d instanceof Pn){({halfWidth:e.halfWidth,halfHeight:e.halfHeight}=dE(a,s,e.rect.w/Math.max(1,e.rect.h)));let f=4*c+1,p=10*(o.length()+f+c);d.near=-p,d.far=p,d.zoom=1,d.position.copy(o).addScaledVector(u,f)}else{let f=c/Math.sin(d.fov*Math.PI/360)*1.08;d.near=f/1e3,d.far=f*1e3+o.length(),d.position.copy(o).addScaledVector(u,f)}d.up.copy(h),d.lookAt(o),e.target.copy(o),e.turned=0,this.aspect(e),e.controls&&(e.controls.target.copy(o),e.controls.update());for(let f of e.draws.values())f instanceof Ni&&f.layout(t,s,r);e.box=t,e.fitting=!1,e.needsFit=!1}aspect(e){let t=e.rect.w/Math.max(1,e.rect.h),i=e.camera;i instanceof Pn?(hh(e.cameraSpec)||(e.halfWidth=e.halfHeight*t),i.top=e.halfHeight,i.bottom=-e.halfHeight,i.left=-e.halfWidth,i.right=e.halfWidth):i.aspect=t,i.updateProjectionMatrix()}turn(e,t){let i=e.cameraSpec;if(i.kind!=="orbit"||i.turn===void 0)return;let s=i.turn*t*Math.PI/180,r=e.controls?.target??e.target;e.camera.position.sub(r).applyAxisAngle(Oi(i).up,s-e.turned).add(r),e.camera.lookAt(r),e.turned=s}follow(e){let t=e.cameraSpec;if(e.view=t.kind==="plane"&&e.camera instanceof Pn?pE(e.camera,t,e.rect.w,e.rect.h):null,!(e.view===null||t.kind!=="plane"))for(let i of e.draws.values())i instanceof Ni&&i.follow(e.view,t)}renderAt(e,t,i,s,r){let a=Math.max(1,Math.floor(i)),o=Math.max(1,Math.floor(s));(a!==this.size.w||o!==this.size.h||r!==this.size.ratio)&&(this.gl.setPixelRatio(r),this.gl.setSize(a,o,!1),this.size={w:a,h:o,ratio:r});let l=Bn(this.ctx.scene.clock,t),c=qr(qs(e.layout,l),{x:0,y:0,w:a,h:o},Jr);for(let d of[...this.panels.values()])Object.hasOwn(e.panels,d.id)||this.disposePanel(d);let h=e!==this.lastState;this.lastState=e;let u=new Map;this.gl.setScissorTest(!1),this.gl.setClearColor(this.background,1),this.gl.clear(),this.gl.setScissorTest(!0);for(let[d,f]of c.panels){let p=this.panel(d);(h||p.plan===null)&&this.replan(p,e);let m=CE(f,p.plan?.view.margin),g=m.w!==p.rect.w||m.h!==p.rect.h;p.outer=f,p.rect=m,this.advance(p,e,t),p.needsFit||g&&!p.userMoved?this.fit(p):g&&this.aspect(p),this.keyed(p,e,t),this.turn(p,t),this.follow(p);for(let M of p.draws.values())M instanceof us&&M.clip(p.camera);let v=p.camera instanceof Pn?p.camera:null,_=v===null?1:p.rect.w/Math.max(1e-12,(v.right-v.left)/v.zoom),b=v===null?1:p.rect.h/Math.max(1e-12,(v.top-v.bottom)/v.zoom);for(let M of p.draws.values())M instanceof hs&&M.setPixels(_,b);for(let M of p.draws.values())M instanceof hs&&M.placeDash(p.camera,p.rect,a,o,1/r)}for(let[d]of c.panels){let f=this.panel(d),p=f.rect;if(f.error!==null){u.set(d,f.error);continue}if(p.w<1||p.h<1||Xt(f.plan?.view.opacity,l)<=0)continue;for(let m of f.draws.values())m.resize?.(p.w,p.h);for(let m of f.draws.values())m instanceof fo&&m.place(f,m.target===null?void 0:this.panels.get(m.target));let y=o-p.y-p.h;this.gl.setViewport(p.x,y,p.w,p.h),this.gl.setScissor(p.x,y,p.w,p.h),this.drawStatic(f),this.gl.render(f.scene,f.camera),this.placeLabels(f)}return this.gl.setScissorTest(!1),u}labelItems(e){if(e.plan===null)return[];let t=[],i=[],s=[],r=this.ctx.scene.frames[e.plan.display],a=r?.axes??["x","y","z"],{normal:o}=Oi(e.cameraSpec),l=Yr(e.cameraSpec),c=e.rect.x-e.outer.x,h=e.rect.y-e.outer.y,u=(p,y,m,g)=>{let v=y.clone().multiply(l).project(e.camera),_=(v.x+1)/2*e.rect.w+m,b=(1-v.y)/2*e.rect.h,M=v.z>-1&&v.z<1&&_>=0&&_<=e.rect.w&&b>=0&&b<=e.rect.h,T={text:p,x:_+c,y:b+h,hidden:g||!M};return t.push(T),T},d=[...e.draws.values()].filter(p=>p instanceof Ni);if(e.view!==null&&e.cameraSpec.kind==="plane"){let[p,y]=Qs(e.cameraSpec),m=_=>a[_]&&r?.unit?`${a[_]} [${r.unit}]`:a[_]??"",g=d.some(_=>_.follows&&_.kind==="axes"),v=d.some(_=>_.ticks);for(let _ of gE(e.view,v,g?[m(p),m(y)]:null)){let b={..._,x:_.x+c,y:_.y+h,hidden:!1};t.push(b),_.kind==="title"&&i.push(b)}}for(let p of e.draws.values())p instanceof Ni&&p.kind==="axes"&&!p.follows&&p.box===null?p.tips.forEach((y,m)=>{let g=a[m]??"",v=l.getComponent(m),_=g!==""&&v!==1?`${g} \xD7${Number(v.toPrecision(4))}`:g;i.push(u(_,y,4,e.cameraSpec.kind==="plane"&&Math.abs(y.clone().normalize().dot(o))>.99))}):p instanceof us&&p.label!==null&&p.at!==null&&p.group.visible&&s.push(u(p.label,p.at,p.size/2+3,!1));let f=s.filter(p=>!p.hidden);for(let p of i)f.some(y=>mE(p,y))&&(p.hidden=!0);return t}labels(e){let t=this.panels.get(e);return t===void 0?[]:this.labelItems(t).filter(i=>!i.hidden).map(({hidden:i,...s})=>s)}colorbars(e){let t=this.panels.get(e),i=[];if(t===void 0)return i;for(let s of t.draws.values()){if(!(s instanceof hs)||!s.group.visible)continue;let r=s.colorbar();r!==null&&i.push(r)}return Jg(i)}placeLabels(e){let t=e.labels;if(t===null)return;let i=this.labelItems(e);for(;t.children.length<i.length;)t.appendChild(document.createElement("span"));for(;t.children.length>i.length;)t.lastChild.remove();i.forEach((s,r)=>{let a=t.children[r];a.textContent!==s.text&&(a.textContent=s.text),a.hidden=s.hidden;let o=s.align==="center"?"-50%":s.align==="end"?"-100%":"0";a.style.transformOrigin="0 0",a.style.fontSize=s.kind==="title"?"13px":"",a.style.transform=`translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)${s.rotate?" rotate(-90deg)":""} translate(${o}, -50%)`})}keyed(e,t,i){let s=e.cameraSpec;if(e.window=null,s.kind!=="plane"||s.keys===void 0||e.plan===null||e.userMoved||!(e.camera instanceof Pn))return;let r=this.ctx.scene,a={scope:e.plan.scope,frames:this.ctx.geometry.frames,clock:r.clock,channel:t.clock.channel,q:i,display:e.plan.display},o;try{o=Hh(a,e.plan.view,this.ctx.geometry.sets,e.plan.driver)}catch(v){if(!(v instanceof un))throw v;e.error=v.message;return}if(o===null)return;e.window=o;let l=e.camera,{right:c,up:h,normal:u}=Oi(s),d=e.rect.w/Math.max(1,e.rect.h),f=o.width/2,p=o.height!==null?o.height/2:f/d,y=l.position.dot(u),m=c.clone().multiplyScalar(o.center[0]).addScaledVector(h,o.center[1]),g=m.clone().addScaledVector(u,e.target.dot(u));e.fitting=!0,e.halfWidth=f,e.halfHeight=p,l.left=-f,l.right=f,l.top=p,l.bottom=-p,l.zoom=1,l.position.copy(m).addScaledVector(u,y),l.up.copy(h),l.lookAt(g),l.updateProjectionMatrix(),e.target.copy(g),e.controls&&(e.controls.target.copy(g),e.controls.update()),e.fitting=!1}async ready(){let e=[];for(let t of this.panels.values())for(let i of t.draws.values())i instanceof us&&e.push(i.ready);await Promise.all(e)}paintInfo(e){let t=this.panels.get(e);if(t===void 0||t.plan===null||t.error!==null)return null;let i=this.ctx.scene,s=Yr(t.cameraSpec),r=c=>{let h=c.clone().multiply(s).project(t.camera);return h.z>-1&&h.z<1?[t.rect.x+(h.x+1)/2*t.rect.w,t.rect.y+(1-h.y)/2*t.rect.h]:null},a=[],o=null,l;for(let c of t.plan.layers){let h=t.draws.get(c.index);if(h instanceof uo){let u=h.layer.at,d,f=u!==null&&typeof u=="object"&&"screen"in u&&u.screen!==void 0;f?d=[t.rect.x+u.screen[0]*t.rect.w,t.rect.y+u.screen[1]*t.rect.h]:d=h.at===null?null:r(h.at),d!==null&&a.push({layer:h.layer,x:d[0],y:d[1],clip:!f})}else if(h instanceof Ni&&h.box!==null&&t.view!==null&&t.cameraSpec.kind==="plane"){let u=i.frames[t.plan.display],d=u?.axes??["","",""],[f,p]=Qs(t.cameraSpec),y=g=>d[g]&&u?.unit?`${d[g]} [${u.unit}]`:d[g]??"",m=h.box.ticks??["x","y"];o={rect:t.rect,x0:t.view.x0,x1:t.view.x1,y0:t.view.y0,y1:t.view.y1,ticks:{x:m.includes("x"),y:m.includes("y")},size:h.box.size??Bg,titles:[y(f),y(p)],opacity:h.box.opacity},l=h.box.titles}}return{outer:t.outer,rect:t.rect,opacity:t.plan.view.opacity,labels:a,box:o,...l!==void 0?{boxTitles:l}:{}}}dispose(){for(let e of[...this.panels.values()])this.disposePanel(e);this.refineTimer!==null&&clearTimeout(this.refineTimer),this.blit.material.dispose(),this.underlay?.dispose(),this.scratch?.dispose(),this.ctx.disc.dispose(),this.gl.dispose(),this.gl.forceContextLoss()}};function CE(n,e){if(e===void 0)return n;let t=Math.round((e.left??0)*n.w),i=Math.round((e.right??0)*n.w),s=Math.round((e.top??0)*n.h),r=Math.round((e.bottom??0)*n.h);return{x:n.x+t,y:n.y+s,w:Math.max(0,n.w-t-i),h:Math.max(0,n.h-s-r)}}function qs(n,e){if(n.kind==="panel")return n;let t=qs(n.a,e),i=qs(n.b,e),s=n.keys===void 0?n.ratio:Math.min(1,Math.max(0,Zs(n.keys,e)));return t===n.a&&i===n.b&&s===n.ratio?n:{...n,ratio:s,a:t,b:i}}var Kr={frames:2e3,seconds:90},ph=[24,30,60],p0=[1,2,3,4];function mh(n,e,t,i=1,s=0,r=sa){let a=Math.round(t*r*e/i),o=l=>ll(s,l,e,n,i,r);return{count:a,duration:a/e,index:l=>Sa(o(l),n),progress:l=>wa(o(l),n)}}function gh(n,e){return n>=1?n>Kr.frames?`${n} frames is more than the ${Kr.frames} an export may have: lower the frame rate or the loops, or raise the speed`:n/e>Kr.seconds?`${(n/e).toFixed(1)} s is longer than the ${Kr.seconds} s an export may last: lower the loops or raise the speed`:null:`the frame count of the export is ${n}, not a count of at least one`}function m0(n,e,t=sa){for(let i of[...ph].reverse())if(gh(mh(n,i,1,e,0,t).count,i)===null)return i;return null}function go(n,e={w:1280,h:720},t=1,i=30){if(n==="720p")return{width:1280,height:720,pixelRatio:1};if(n==="1080p")return{width:1920,height:1080,pixelRatio:1.5};let s=l=>Math.max(2,2*Math.floor(l/2)),r=s(e.w),a=s(e.h),o={width:r,height:a,pixelRatio:1};for(let l=8*Math.min(2,Math.max(1,Math.round(t)));l>=1;l--){let c=l/8;if(o={width:s(r*c),height:s(a*c),pixelRatio:c},y0(o.width,o.height,i))break}return o}var RE=[[30,1620,40500],[31,3600,108e3],[32,5120,216e3],[40,8192,245760],[42,8704,522240],[50,22080,589824],[51,36864,983040],[52,36864,2073600]],g0=4096;function y0(n,e,t){return n%2===0&&e%2===0&&Math.max(n,e)<=g0&&v0(n,e,t)!==null}function v0(n,e,t,i="high"){let s=Math.ceil(n/16),r=Math.ceil(e/16),a=s*r,o=RE.find(([,c,h])=>a<=c&&a*t<=h&&Math.max(s,r)<=Math.sqrt(8*c));return o===void 0?null:`avc1.${{high:"6400",main:"4d40",baseline:"42e0"}[i]}${o[0].toString(16).padStart(2,"0")}`}function PE(n,e,t){return Math.round(Math.min(4e7,Math.max(1e6,.08*n*e*t)))}var of=class{muxer;constructor(e,t,i){if(e%2!==0||t%2!==0)throw new Error(`an MP4 export needs even sides, not ${e} by ${t}`);this.muxer=new yp({target:new su,video:{codec:"avc",width:e,height:t,frameRate:i},fastStart:"in-memory"})}add(e,t,i,s,r){let a=r?.decoderConfig;if(a!==void 0){if(!a.codec.startsWith("avc1."))throw new Error(`an MP4 export holds H.264 only, not ${a.codec}`);if(a.description===void 0)throw new Error('the H.264 encoder did not give an avcC record. Configure it with avc: { format: "avc" }')}this.muxer.addVideoChunkRaw(e,t?"key":"delta",i,s,r)}finish(){return this.muxer.finalize(),new Uint8Array(this.muxer.target.buffer)}};function lf(){return typeof VideoEncoder>"u"||typeof VideoFrame>"u"?"this browser does not have a WebCodecs video encoder":null}async function LE(n,e,t,i){if(!y0(n,e,t))throw new Error(`${n} by ${e} at ${t} fps is past H.264, which needs even sides, at most ${g0} pixels a side, and a frame size and rate within level 5.2`);for(let s of["high","main","baseline"]){let r={codec:v0(n,e,t,s),width:n,height:e,bitrate:i,framerate:t,avc:{format:"avc"}};if((await VideoEncoder.isConfigSupported(r)).supported===!0)return r}throw new Error(`this browser does not have an H.264 encoder for ${n} by ${e} at ${t} fps, and an MP4 that QuickTime opens needs H.264`)}var cf='"Helvetica Neue", Arial, sans-serif';function b0(n){return n.kind==="panel"?n.id:b0(n.a)}var f0=18;function ds(n,e,t,i,s,r){n.lineJoin="round",n.lineWidth=3,n.strokeStyle=r,n.strokeText(e,t,i),n.fillStyle=s,n.fillText(e,t,i)}function IE(n,e,t,i,s,r,a=cf){n.font=`${e.kind==="title"?13:12}px ${a}`,n.textAlign=e.align==="center"?"center":e.align==="end"?"right":"left",e.rotate?(n.save(),n.translate(t,i),n.rotate(-Math.PI/2),ds(n,e.text,0,0,s,r),n.restore()):ds(n,e.text,t,i,s,r),n.textAlign="left"}function kE(n,e,t,i,s,r,a,o,l=cf){let c=t;n.font=`11px ${l}`;for(let h of[...e].reverse()){let u=Yn(h.hi,3),d=Yn(h.lo,3),f=Math.max(n.measureText(h.label).width,13+Math.max(n.measureText(u).width,n.measureText(d).width));c-=f,n.textBaseline="top",ds(n,h.label,c,i,r,o);let p=i+16,y=n.createLinearGradient(0,p+120,0,p);for(let[m,g]of h.stops)y.addColorStop(m,g);if(n.fillStyle=y,n.fillRect(c,p,8,120),n.strokeStyle=a,n.lineWidth=1,n.strokeRect(c+.5,p+.5,7,119),h.band!==null){let[m,g,v]=mt(s).map(_=>Math.round(255*_));n.fillStyle=`rgba(${m}, ${g}, ${v}, 0.18)`,n.fillRect(c-3,p+120*(1-h.band[1]),14,120*(h.band[1]-h.band[0]))}if(ds(n,u,c+13,p,r,o),n.textBaseline="bottom",ds(n,d,c+13,p+120,r,o),h.marker!==null){let m=p+120*(1-h.marker);n.fillStyle=s,n.beginPath(),n.moveTo(c-1,m),n.lineTo(c-7,m-4),n.lineTo(c-7,m+4),n.closePath(),n.fill()}c-=12}}async function x0(n,e={}){let t=lf();if(t!==null)throw new Error(t);let{scene:i,geometry:s}=n,r=structuredClone(n.state),a=e.fps??30,o=typeof e.size=="object"?e.size:go(e.size??"720p",n.stage,typeof window>"u"?1:window.devicePixelRatio,a),l=mh(i.clock.steps,a,e.loops??1,e.speed??1,e.start??0,Ct(i.clock)),c=gh(l.count,a);if(c!==null)throw new Error(c);let{width:h,height:u,pixelRatio:d}=o,f=e.signal,p=()=>new DOMException("the export was canceled","AbortError");if(f?.aborted)throw p();let y=await LE(h,u,a,e.bitrate??PE(h,u,a));e.onConfig?.(y);let m=new of(h,u,a),g=null,v=new VideoEncoder({output:($,oe)=>{let ve=new Uint8Array($.byteLength);$.copyTo(ve);try{m.add(ve,$.type==="key",$.timestamp,$.duration??Math.round(1e6/a),oe)}catch(Ce){g??=Ce}},error:$=>g=$});v.configure(y);let _=n.font??n.theme?.font??Es(i).font??cf,b={...n.theme??Es(i),font:_},M=Ut(b.background,b.background,0),T=Ut(b.foreground,b.foreground,0),x=Ut(b.foreground,b.background,.4),A=Ut(b.foreground,b.background,.8),k=Yg(b),R=(i.readouts??[]).filter($=>$.place==="caption"),D=(i.readouts??[]).filter($=>$.place==="panel"),H=h/d,j=u/d,L=R.length>0?10+f0*R.length:0,G=Math.floor(H),V=Math.floor(j-L),W=document.createElement("canvas"),te=new jr(W,i,s,{preserveDrawingBuffer:!0,coarseDrags:!1,theme:b}),Y=document.createElement("canvas");Y.width=h,Y.height=u;let q=Y.getContext("2d",{alpha:!1}),ne=b0(r.layout),ye=Ct(i.clock),ke=($,oe,ve,Ce)=>{try{return kp({scene:i,geometry:s,state:r,panel:$,frameIndex:ve,progress:Ce},oe)}catch(me){return me.message}};try{te.renderAt(r,l.progress(0),G,V,d),await te.ready();for(let $=0;$<l.count;$++){if(f?.aborted)throw p();if(g!==null)throw g;let oe=l.index($),ve=l.progress($),Ce=te.renderAt(r,ve,G,V,d),me=qr(qs(r.layout,ve*ye),{x:0,y:0,w:G,h:V},Jr);q.setTransform(1,0,0,1,0,0),q.fillStyle=M,q.fillRect(0,0,h,u),q.drawImage(W,0,0),q.setTransform(d,0,0,d,0,0),q.fillStyle=k;for(let Ye of me.gutters)q.fillRect(Ye.rect.x,Ye.rect.y,Ye.rect.w,Ye.rect.h);q.save(),oh(q,te,i,r,b,ve,G,V,(Ye,Se)=>{try{return Ma({scene:i,geometry:s,state:r,panel:Ye,frameIndex:oe,progress:ve},Se)}catch{return[]}}),q.restore();for(let[Ye,Se]of me.panels){q.save(),q.beginPath(),q.rect(Se.x,Se.y,Se.w,Se.h),q.clip(),q.textBaseline="middle";for(let He of te.labels(Ye))IE(q,He,Se.x+He.x,Se.y+He.y,T,M,_);kE(q,te.colorbars(Ye),Se.x+Se.w-10,Se.y+10,T,x,A,M,_),q.font=`13px ${_}`,q.textBaseline="bottom",D.map(He=>ke(Ye,He.parts,oe,ve)).join(`
`).split(`
`).reverse().forEach((He,Dt)=>ds(q,He,Se.x+8,Se.y+Se.h-6-17*Dt,T,M));let at=Ce.get(Ye);at!==void 0&&(q.textBaseline="top",ds(q,at,Se.x+12,Se.y+12,"#e0a24a",M)),q.restore()}q.font=`13px ${_}`,q.textBaseline="alphabetic",R.forEach((Ye,Se)=>ds(q,ke(ne,Ye.parts,oe,ve),14,V+5+f0*(Se+1)-4,T,M));let Fe=new VideoFrame(Y,{timestamp:Math.round($*1e6/a),duration:Math.round(1e6/a)});for(v.encode(Fe,{keyFrame:$%(2*a)===0}),Fe.close(),e.onProgress?.($+1,l.count);v.encodeQueueSize>4;)await new Promise(Ye=>setTimeout(Ye,1));await new Promise(Ye=>setTimeout(Ye,0))}if(await v.flush(),g!==null)throw g}finally{v.state!=="closed"&&v.close(),te.dispose()}return new Blob([m.finish()],{type:"video/mp4"})}var _0="http://www.w3.org/2000/svg",S0=(n,e)=>`M${n-1} ${e}a1 1 0 1 0 2 0a1 1 0 1 0-2 0`,DE={house:{grid:24,fill:!1,d:["M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8","M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"]},chevronDown:{grid:24,fill:!1,d:["m6 9 6 6 6-6"]},grip:{grid:24,fill:!1,d:[[5,12,19].map(n=>S0(9,n)).join(""),[5,12,19].map(n=>S0(15,n)).join("")]},x:{grid:24,fill:!1,d:["M18 6 6 18","m6 6 12 12"]},rotateCcw:{grid:24,fill:!1,d:["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","M3 3v5h5"]},plus:{grid:24,fill:!1,d:["M5 12h14","M12 5v14"]},download:{grid:24,fill:!1,d:["M12 15V3","M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","m7 10 5 5 5-5"]},play:{grid:16,fill:!0,d:["M5 3.5v9l7.5-4.5z"]},pause:{grid:16,fill:!0,d:["M4.5 3H7v10H4.5zM9 3h2.5v10H9z"]}};function si(n,e){let t=DE[n],i=document.createElementNS(_0,"svg"),s={viewBox:`0 0 ${t.grid} ${t.grid}`,"aria-hidden":"true",focusable:"false",fill:t.fill?"currentColor":"none",stroke:t.fill?"none":"currentColor"};t.fill||Object.assign(s,{"stroke-width":"2","stroke-linecap":"round","stroke-linejoin":"round"});for(let[r,a]of Object.entries(s))i.setAttribute(r,a);i.setAttribute("class",e===void 0?`i i-${n}`:`i i-${n} ${e}`);for(let r of t.d){let a=document.createElementNS(_0,"path");a.setAttribute("d",r),i.appendChild(a)}return i}function yh(n){return n?n.kind==="panel"?[n.id]:[...yh(n.a),...yh(n.b)]:[]}function yo(n,e,t,i){if(n.kind==="panel"){if(n.id!==e)return n;if(i==="centre")return{kind:"panel",id:t};let s={kind:"panel",id:t},r=i==="left"||i==="right"?"row":"col",a=i==="left"||i==="top";return{kind:"split",dir:r,ratio:.5,a:a?s:n,b:a?n:s}}return{...n,a:yo(n.a,e,t,i),b:yo(n.b,e,t,i)}}function vo(n,e){if(n.kind==="panel")return n.id===e?null:n;let t=vo(n.a,e),i=vo(n.b,e);return t?i?{...n,a:t,b:i}:t:i}function vh(n,e=1){return n.kind==="panel"?[{id:n.id,area:e}]:[...vh(n.a,e*n.ratio),...vh(n.b,e*(1-n.ratio))]}function w0(n,e,t,i){let s=n/Math.max(1,t),r=e/Math.max(1,i),a=.28,o=[{zone:"left",v:s},{zone:"right",v:1-s},{zone:"top",v:r},{zone:"bottom",v:1-r}].sort((l,c)=>l.v-c.v)[0];return o.v<a?o.zone:"centre"}function _h(){return Object.create(null)}function bh(n,e,t){let i=_h();for(let[s,r]of Object.entries(n??{}))s!==e&&r!==void 0&&(i[s]=r);return t!==void 0&&(i[e]=t),i}var NE=(n,e)=>(n%e+e)%e,xh=class{snap;index=0;play=!1;steps;listeners=new Set;constructor(e,t){this.snap=e,this.steps=t}get state(){return this.snap}get frame(){return this.index}get playing(){return this.play}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}emit(e){for(let t of[...this.listeners])t(e)}set(e){e!==this.snap&&(this.snap=e,this.emit("state"))}update(e){this.set(e(this.snap))}setFrame(e){if(!Number.isInteger(e))return;let t=NE(e,this.steps);t!==this.index&&(this.index=t,this.emit("frame"))}setPlaying(e){e!==this.play&&(this.play=e,this.emit("playing"))}};function fs(n,e,t,i,s){let r=lt(n,t);if(r===void 0||!Co(r,i))return e;if(r.scope==="panel"){if(s===void 0||!Object.hasOwn(e.panels,s))return e;let a=e.panels[s];return a.variables!==void 0&&Object.hasOwn(a.variables,t)&&a.variables[t]===i?e:hf(e,s,{...a,variables:bh(a.variables,t,i)})}return e.variables!==void 0&&Object.hasOwn(e.variables,t)&&e.variables[t]===i?e:{...e,variables:bh(e.variables,t,i)}}function E0(n,e){return n.clock.channel===e?n:{...n,clock:{channel:e}}}function hf(n,e,t){return{...n,panels:bh(n.panels,e,t)}}function bo(n,e){return{...n,layout:e}}function T0(n,e){if(!Object.hasOwn(n.panels,e)||Object.keys(n.panels).length<2)return n;let t=vo(n.layout,e);return t===null?n:{...n,panels:bh(n.panels,e,void 0),layout:t}}function OE(n){for(let e=Object.keys(n.panels).length+1;;e++){let t=`p${e}`;if(!Object.hasOwn(n.panels,t))return t}}function uf(n,e,t){return n.kind==="panel"?n.id===e?{kind:"panel",id:t}:n.id===t?{kind:"panel",id:e}:n:{...n,a:uf(n.a,e,t),b:uf(n.b,e,t)}}function Sh(n,e,t,i,s,r=1/0){if(!Object.hasOwn(e.panels,t))return e;let a=e.panels[t];if(s.kind==="panel"){if(s.id===t||!Object.hasOwn(e.panels,s.id))return e;if(i==="centre")return bo(e,uf(e.layout,s.id,t));let h=vo(e.layout,s.id);return h===null?e:bo(e,yo(h,t,s.id,i))}if(i==="centre")return s.kind==="view"?Object.hasOwn(n.views,s.view)?hf(e,t,{...a,view:s.view}):e:fs(n,e,s.variable,s.value,t);if(Object.keys(e.panels).length>=r)return e;let o=OE(e),l={view:a.view,variables:Object.assign(_h(),a.variables)};if(s.kind==="view"){if(!Object.hasOwn(n.views,s.view))return e;l.view=s.view}let c=bo(hf(e,o,l),yo(e.layout,t,o,i));return s.kind==="value"?fs(n,c,s.variable,s.value,o):c}function ff(n,e,t,i,s){if(Object.keys(e.panels).length>=i)return e;let r=vh(e.layout).reduce((a,o)=>o.area>a.area?o:a);return Sh(n,e,r.id,s(r.id)?"bottom":"right",t,i)}function A0(n,e,t){let i=Object.keys(n.panels).length>=t,s=yh(n.layout),r=s.map(e),a=[{label:"Add panel",placement:{kind:"add"},disabled:i,group:!1}];return s.forEach((o,l)=>{let h=r.filter(u=>u===r[l]).length>1?`${r[l]} (${r.slice(0,l+1).filter(u=>u===r[l]).length})`:r[l];a.push({label:`Split ${h} right`,placement:{kind:"drop",target:o,zone:"right"},disabled:i,group:!0},{label:`Split ${h} below`,placement:{kind:"drop",target:o,zone:"bottom"},disabled:i,group:!1},{label:`Replace ${h}`,placement:{kind:"drop",target:o,zone:"centre"},disabled:!1,group:!1})}),a}function C0(n,e,t,i,s,r){return t.kind==="add"?ff(n,e,i,s,r):Sh(n,e,t.target,t.zone,i,s)}function UE(n){let e=new TextEncoder().encode(n),t=2166136261;for(let i of e)t^=i,t=Math.imul(t,16777619)>>>0;return t.toString(16).padStart(8,"0")}function wh(n){return`tycho:state:${UE(n)}:${n.length}`}var Zr=n=>n!==null&&typeof n=="object"&&!Array.isArray(n);function M0(n,e,t){let i=_h();if(!Zr(e))return i;for(let[s,r]of Object.entries(e)){let a=lt(n,s);a===void 0||a.scope==="panel"!=(t==="panel")||!Co(a,r)||(i[s]=r)}return i}function df(n,e,t){if(!Zr(n))return;if(n.kind==="panel")return typeof n.id!="string"?void 0:!e(n.id)||t.has(n.id)?null:(t.add(n.id),{kind:"panel",id:n.id});if(n.kind!=="split"||n.dir!=="row"&&n.dir!=="col")return;let i=df(n.a,e,t),s=df(n.b,e,t);if(i===void 0||s===void 0)return;if(i===null)return s;if(s===null)return i;let r=n.ratio,a=typeof r=="number"&&r>0&&r<1?r:.5;return{kind:"split",dir:n.dir,ratio:a,a:i,b:s}}function R0(n,e){let t=()=>structuredClone(n.initial);if(!Zr(e)||!Zr(e.clock)||!Zr(e.panels))return t();let i=e.clock.channel;if(typeof i!="string"||!n.clock.channels.includes(i))return t();let s=_h();for(let[c,h]of Object.entries(e.panels))!Mo.test(c)||!Zr(h)||typeof h.view!="string"||!Object.hasOwn(n.views,h.view)||(s[c]={view:h.view,variables:M0(n,h.variables,"panel")});let r=df(e.layout,c=>Object.hasOwn(s,c),new Set);if(r==null)return t();let a=new Set,o=c=>c.kind==="panel"?void a.add(c.id):(o(c.a),o(c.b));o(r);for(let c of Object.keys(s))a.has(c)||delete s[c];if(Object.keys(s).length===0)return t();let l={variables:M0(n,e.variables,"scene"),clock:{channel:i},panels:s,layout:r};try{er(n,l)}catch{return t()}return l}var Mh=8,FE=[.25,.5,1,2,4],BE=`
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
`;function re(n,e,t){let i=document.createElement(n);return e!==void 0&&(i.className=e),t!==void 0&&(i.textContent=t),i}function ri(n,e){n.textContent!==e&&(n.textContent=e)}var ai=n=>n.stopPropagation();function Qr(n,e,t,i="icon"){let s=re("button",i);return s.type="button",s.setAttribute("aria-label",e),s.title=t,s.appendChild(si(n)),s.addEventListener("pointerdown",ai),s}function pf(n,e){let t=re("div",e===void 0?"cap":`cap ${e}`);return t.setAttribute("role","group"),t.setAttribute("aria-label",n),t}function P0(n,e,t){let i=re("div","seg");i.setAttribute("role","group"),t!==void 0&&i.setAttribute("aria-label",t);let s=new Map;for(let r of n){let a=re("button",void 0,r.label);a.type="button",a.setAttribute("aria-pressed","false"),a.addEventListener("pointerdown",ai),a.addEventListener("click",()=>e(r.id)),s.set(r.id,a),i.appendChild(a)}return{el:i,set(r){for(let[a,o]of s)o.setAttribute("aria-pressed",String(a===r))}}}function mf(n,e){n.value=String(e);let t=Number(n.max)-Number(n.min);n.style.setProperty("--p",`${t>0?100*(Number(n.value)-Number(n.min))/t:0}%`)}function L0(n,e){let t=re("div","chip"),i=re("span","body"),s=re("span","lbl",n);i.append(si("grip","grip"),s),t.appendChild(i);let r=null,a=null;if(e==="menu")r=re("button","caret"),r.type="button",r.setAttribute("aria-haspopup","menu"),r.setAttribute("aria-expanded","false"),r.setAttribute("aria-label",`${n}: placement`),r.title="Add, split, or replace a panel",r.appendChild(si("chevronDown")),r.addEventListener("pointerdown",ai),t.appendChild(r);else if(e==="select"){let o=re("span","caret");a=re("select"),o.append(si("chevronDown"),a),o.addEventListener("pointerdown",ai),t.appendChild(o)}return{root:t,body:i,label:s,button:r,select:a}}function I0(n,e){let t=Dp(n),i=re("div",`readout ${e}`),s=re("div","line"),r=null,a=[];if(t!==null){r=re("dl");for(let o of t){let l=re("div"),c=re("dd"),h=re("b");o.width!==null&&(h.style.minWidth=`${o.width}ch`),c.appendChild(h),o.unit!==""&&c.appendChild(re("span","u",o.unit)),l.append(re("dt",void 0,o.label),c),r.appendChild(l),a.push(h)}i.appendChild(r),s.hidden=!0}return i.appendChild(s),{parts:n,tiles:t,root:i,list:r,values:a,line:s}}function k0(n,e){let t=Array.isArray(e);if(t&&n.tiles!==null&&n.list!==null&&e.length>0){n.list.hidden=!1,n.line.hidden=!0,n.tiles.forEach((i,s)=>ri(n.values[s],e[i.part]??""));return}n.list!==null&&(n.list.hidden=!0),n.line.hidden=!1,ri(n.line,t?e.join(""):e.error)}function zE(n,e){let t=n.kind==="panel";if(e==="centre")return t?"swap":"replace";let i={left:"left",right:"right",top:"above",bottom:"below"}[e];return`${t?"move":"split"} ${i}`}function HE(){return typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}var VE=typeof HTMLElement>"u"?class{}:HTMLElement,xo=class extends VE{static observedAttributes=["theme"];scene=null;sceneText="";geometry=null;store=null;renderer=null;theme=null;kiosk=!1;lean=!1;keepPanels=!1;loading=!1;loads=0;choice=null;root;header;titleEl;varsEl;addEl;stage;panelsEl;statusEl;statsEl;footer;canvas=null;paintCanvas=null;get heldProgress(){return this.heldValue!==null&&this.store!==null&&this.store.frame===this.heldFrame?this.heldValue:null}set heldProgress(e){this.heldValue=e,e!==null&&this.scene!==null&&(this.heldFrame=Math.min(this.scene.clock.steps-1,Math.floor(e*this.scene.clock.steps)))}heldValue=null;heldFrame=-1;stopAt=null;panelDom=new Map;gutterDom=new Map;gutters=[];sceneWidgets=[];captions=[];addChips=[];addButton=null;addGroup=null;transport=null;menu=null;closeExport=null;raf=0;intersecting=!0;shown=!1;viewObserver=null;onVisibility=()=>this.syncShown();dirty=!0;anchor={index:0,time:0};playProgress=null;speed=1;meter=new al;stageSize={w:0,h:0};saveTimer=0;resizeObserver=null;onPageHide=()=>this.flushSave();unsubscribe=null;lastPanels=null;lastLayout=null;refreshExport=null;connectedCallback(){if(this.shadowRoot===null&&this.buildShell(),this.scene!==null){this.applyTheme(),this.start();return}this.loading||(this.loading=!0,document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{this.loadFromSources()},{once:!0}):this.loadFromSources())}disconnectedCallback(){this.stop()}attributeChangedCallback(){this.applyTheme()}buildShell(){this.kiosk=this.hasAttribute("kiosk"),this.lean=this.hasAttribute("lean"),this.keepPanels=this.lean&&(this.getAttribute("lean")??"").split(/\s+/).includes("panels");let e=this.attachShadow({mode:"open"}),t=re("style");t.textContent=BE,e.appendChild(t),this.root=re("div",`root${this.kiosk?" kiosk":""}${this.lean?" lean":""}${this.keepPanels?" keep-panels":""}`),this.header=re("header"),this.titleEl=re("h1"),this.varsEl=re("div","vars"),this.varsEl.setAttribute("role","group"),this.varsEl.setAttribute("aria-label","Scene"),this.addEl=re("div","add"),this.addEl.setAttribute("role","group"),this.addEl.setAttribute("aria-label","Add panel"),this.header.append(this.titleEl,this.varsEl,this.addEl),this.stage=re("div","stage"),this.panelsEl=re("div","panels"),this.statusEl=re("div","status","loading\u2026"),this.stage.append(this.panelsEl,this.statusEl),this.statsEl=re("div","stats"),this.footer=re("footer"),this.root.append(this.header,this.stage,this.statsEl,this.footer),e.appendChild(this.root),this.hasAttribute("tabindex")||(this.tabIndex=0),this.addEventListener("keydown",i=>this.onKey(i))}fail(e){this.statusEl.hidden=!1,this.statusEl.className="status error",this.statusEl.textContent=e}select(e){let t=this.getRootNode();try{return t.querySelector?.(e)??document.querySelector(e)}catch{return null}}source(e){for(let s of this.children)if(s.tagName==="SCRIPT"&&s.getAttribute("data-tycho")===e)return s;let t=this.getAttribute(e);if(!t)return this.select(`#tycho-${e}`);let i=this.select(t);if(i===null&&t.startsWith("#"))throw new Error(`the ${e} selector ${t} does not match an element`);return i??t}async read(e){if(typeof e!="string")return wo(e.textContent??"",e.getAttribute("data-encoding")??"base64");let t=await fetch(e);if(!t.ok)throw new Error(`${e} answered ${t.status}`);return new Uint8Array(await t.arrayBuffer())}async loadFromSources(){try{let e=this.source("scene"),t=this.source("data");if(e===null&&t===null){this.loading=!1;return}if(e===null||t===null)throw new Error(`the ${e===null?"scene":"data"} is missing`);let[i,s]=await Promise.all([this.read(e),this.read(t)]);if(this.loads>0)return;await this.load(new TextDecoder("utf-8").decode(i),s)}catch(e){this.fail(`the scene did not load: ${e.message}`)}}async load(e,t){this.shadowRoot===null&&this.buildShell();let i=++this.loads,s,r;try{if(s=JSON.parse(e),r=await Js.parse(t),i!==this.loads)return;for(let a of Go(s,r))console.warn(`TyCHO: ${a}`)}catch(a){if(i!==this.loads)return;this.stop(),this.fail(a instanceof un?a.message:`the scene cannot be read: ${a.message}`);return}this.stop(),this.scene=s,this.sceneText=e,this.geometry=new nl(s,r),this.store=new xh(this.recall(),s.clock.steps),this.choice=this.templateChoice(),this.statusEl.hidden=!0,this.applyTheme(),this.titleEl.textContent=s.title??"",this.buildTopBar(),this.buildFooter(),this.start(),(this.kiosk||this.hasAttribute("autoplay"))&&!HE()&&this.play()}start(){if(!(this.scene===null||this.store===null||this.renderer!==null||!this.isConnected)){this.canvas=re("canvas"),this.stage.insertBefore(this.canvas,this.panelsEl),this.paintCanvas=re("canvas","paint"),this.stage.insertBefore(this.paintCanvas,this.panelsEl);try{this.renderer=new jr(this.canvas,this.scene,this.geometry,{theme:this.theme})}catch(e){this.fail(`WebGL is not available: ${e.message}`);return}this.renderer.onChange=()=>this.invalidate(),this.unsubscribe=this.store.subscribe(e=>this.onChange(e)),this.measureStage(),this.resizeObserver=new ResizeObserver(()=>{this.measureStage(),this.layoutDom(),this.fitAddGroup(),this.invalidate()}),this.resizeObserver.observe(this.stage),this.resizeObserver.observe(this.header),window.addEventListener("pagehide",this.onPageHide),document.addEventListener("visibilitychange",this.onVisibility),typeof IntersectionObserver<"u"&&(this.intersecting=!1,this.viewObserver=new IntersectionObserver(e=>{this.intersecting=e[e.length-1].isIntersecting,this.syncShown()},{threshold:0}),this.viewObserver.observe(this)),this.lastPanels=null,this.lastLayout=null;for(let e of[...this.panelDom.keys()])this.removePanelDom(e);this.onChange("state"),this.store.playing&&this.onChange("playing"),this.syncShown()}}stop(){cancelAnimationFrame(this.raf),this.raf=0,this.shown=!1,document.removeEventListener("visibilitychange",this.onVisibility),this.viewObserver?.disconnect(),this.viewObserver=null,this.flushSave(),this.closeMenu(!1),window.removeEventListener("pagehide",this.onPageHide),this.unsubscribe?.(),this.unsubscribe=null,this.resizeObserver?.disconnect(),this.resizeObserver=null,this.renderer?.dispose(),this.renderer=null,this.canvas?.remove(),this.canvas=null,this.paintCanvas?.remove(),this.paintCanvas=null}hostProperty(e){return typeof getComputedStyle>"u"?"":getComputedStyle(this).getPropertyValue(e).trim()}applyTheme(){if(this.scene!==null){this.theme=Kf(Es(this.scene),this.getAttribute("theme"),e=>this.hostProperty(e));for(let[e,t]of Object.entries(Zf(this.theme)))this.style.setProperty(e,t);this.renderer?.setTheme(this.theme),this.invalidate()}}recall(){let e=this.scene;if(this.kiosk)return structuredClone(e.initial);try{let t=localStorage.getItem(wh(this.sceneText));return t===null?structuredClone(e.initial):R0(e,JSON.parse(t))}catch{return structuredClone(e.initial)}}save(){this.kiosk||(window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>this.flushSave(),300))}flushSave(){if(!(this.saveTimer===0||this.store===null)){window.clearTimeout(this.saveTimer),this.saveTimer=0;try{localStorage.setItem(wh(this.sceneText),JSON.stringify(this.store.state))}catch{}}}reset(){if(!(this.scene===null||this.store===null)){try{localStorage.removeItem(wh(this.sceneText))}catch{}this.closeMenu(!1),this.store.set(structuredClone(this.scene.initial));for(let e of this.panelDom.keys())this.renderer?.refit(e)}}get state(){return this.store?.state??null}onChange(e){let t=this.store;if(e==="state"){let i=t.state;i.panels!==this.lastPanels&&this.syncPanels(),(i.layout!==this.lastLayout||i.panels!==this.lastPanels)&&this.layoutDom(),this.lastPanels=i.panels,this.lastLayout=i.layout,this.syncWidgets(),this.save()}else if(e==="playing"){let i=this.transport;if(i!==null){let s=t.playing?"Pause (k)":"Play (k)";i.play.replaceChildren(si(t.playing?"pause":"play")),i.play.setAttribute("aria-label",s),i.play.title=s,i.play.classList.toggle("on",t.playing)}if(this.meter.reset(),t.playing){let s=this.scene.clock,r=s.end==="stop"&&this.heldProgress!==null&&this.heldProgress>=1-2e-9;this.anchor={index:r?0:this.heldProgress===null?t.frame:this.heldProgress*s.steps,time:performance.now()},this.heldProgress=null}else this.playProgress!==null&&(this.heldProgress=this.playProgress);this.playProgress=null,t.playing||(this.stopAt=null),i!==null&&this.showRate(null)}this.invalidate()}invalidate(){this.dirty=!0,this.schedule()}schedule(){this.raf===0&&this.renderer!==null&&this.shown&&(this.raf=requestAnimationFrame(e=>this.tick(e)))}syncShown(){let e=this.intersecting&&!document.hidden;if(e!==this.shown){if(this.shown=e,!e){cancelAnimationFrame(this.raf),this.raf=0;return}this.store?.playing&&(this.meter.reset(),this.anchor={index:this.playPosition(),time:performance.now()}),this.invalidate()}}playPosition(){return this.playProgress===null?this.store.frame:this.playProgress*this.scene.clock.steps}tick(e){this.raf=0;let t=this.store,i=this.scene.clock;if(t.playing){let s=ll(this.anchor.index,e-this.anchor.time,1e3,i.steps,this.speed,Ct(i)),r=this.stopAt,a=i.end==="stop"?Math.floor(this.anchor.index/i.steps)*i.steps+i.steps*(1-1e-9):1/0,o=Math.min(r?.x??1/0,a);if(s>=o){s=o;let l=r!==null&&r.x<=a?r.index:null;t.setFrame(Sa(s,i.steps)),this.playProgress=wa(s,i.steps),this.stopAt=null,this.pause(),l!==null&&this.reachStage(l)}else t.setFrame(Sa(s,i.steps)),this.playProgress=wa(s,i.steps);this.dirty=!0}this.dirty&&(this.dirty=!1,this.draw(),t.playing&&this.countDraw(e)),t.playing&&this.schedule()}countDraw(e){this.meter.note(e),this.showRate(this.meter.report(e))}showRate(e){let t=this.transport;if(t===null)return;ri(t.fps,bu(e));let i=xu(e);t.fps.title!==i&&(t.fps.title=i)}measureStage(){this.stageSize={w:this.stage.clientWidth,h:this.stage.clientHeight}}draw(){let e=this.renderer,t=this.store,i=this.scene;if(e===null)return;let s=t.state,{w:r,h:a}=this.stageSize;if(r<1||a<1)return;let o=t.playing&&this.playProgress!==null?this.playProgress:this.heldProgress??t.frame/i.clock.steps,l=Math.min(window.devicePixelRatio||1,2),c=e.renderAt(s,o,r,a,l);this.paint(o,r,a,l),this.animatedLayout&&this.layoutDom(o);for(let[u,d]of this.panelDom){ri(d.error,c.get(u)??"");let f=e.offKeys?.(u)??!1;d.follow.hidden===f&&(d.follow.hidden=!f);for(let p of d.readouts)k0(p,this.pieces(u,p.parts,o));d.barsFor!==s&&(this.syncBars(u,d),d.barsFor=s)}let h=this.firstPanel();for(let u of this.captions)k0(u,h===null?[]:this.pieces(h,u.parts,o));this.transport&&(mf(this.transport.scrub,t.frame),ri(this.transport.frame,`${t.frame} / ${i.clock.steps}`))}get animatedLayout(){let e=t=>t.kind==="split"&&(t.keys!==void 0||e(t.a)||e(t.b));return this.store!==null&&e(this.store.state.layout)}paint(e,t,i,s){let r=this.paintCanvas,a=this.renderer;if(r===null||a===null||this.scene===null||this.theme===null)return;let o=Math.round(t*s),l=Math.round(i*s);(r.width!==o||r.height!==l)&&(r.width=o,r.height=l);let c=r.getContext("2d");c!==null&&(c.setTransform(1,0,0,1,0,0),c.clearRect(0,0,o,l),c.setTransform(s,0,0,s,0,0),oh(c,a,this.scene,this.store.state,this.theme,e,t,i,(h,u)=>{let d=this.pieces(h,u,e);return"error"in d?[]:d}))}pieces(e,t,i){try{let s={scene:this.scene,geometry:this.geometry,state:this.store.state,panel:e,frameIndex:this.store.frame,progress:i};return Ma(s,t)}catch(s){if(s instanceof un)return{error:s.message};throw s}}firstPanel(){let e=t=>t.kind==="panel"?t.id:e(t.a);return this.store===null?null:e(this.store.state.layout)}hasTransport(){return(this.scene?.controls??[]).some(e=>e.kind==="transport")}get playing(){return this.store?.playing??!1}play(){this.store?.setPlaying(!0)}pause(){this.store?.setPlaying(!1)}step(e){let t=this.store;t!==null&&(this.pause(),this.heldProgress=null,t.setFrame(t.frame+e))}get stages(){return[...this.scene?.stages??[]]}get time(){return this.scene===null||this.store===null?0:(this.store.playing&&this.playProgress!==null?this.playProgress:this.heldProgress??this.store.frame/this.scene.clock.steps)*Ct(this.scene.clock)}get currentStage(){let e=this.time+1e-9,t=null;for(let i of this.stages)i.at<=e&&(t=i.id);return t}stageIndex(e){let t=this.stages,i=typeof e=="number"?e:t.findIndex(s=>s.id===e);if(!Number.isInteger(i)||i<0||i>=t.length)throw new Error(`the scene does not have a stage ${JSON.stringify(e)}`);return i}seek(e){let t=this.scene,i=this.store;if(t===null||i===null||!Number.isFinite(e))return;let s=Ct(t.clock),r=Math.min(Math.max(e/s,0),1-1e-9);this.stopAt=null,this.pause(),this.heldProgress=r,this.playProgress=null,i.setFrame(Math.min(t.clock.steps-1,Math.floor(r*t.clock.steps))),this.invalidate()}goto(e){this.seek(this.stages[this.stageIndex(e)].at)}playTo(e){let t=this.scene,i=this.store;if(t===null||i===null)return;let s=this.stageIndex(e),r=Ct(t.clock),a=t.clock.steps,o=this.time,l=this.stages[s].at;if(Math.abs(l-o)<1e-9){this.reachStage(s);return}let c=(l>o?0:1)*a+Math.min(l/r*a,a*(1-1e-9));i.playing?this.anchor={index:this.playPosition(),time:performance.now()}:this.heldProgress??=i.frame/a,i.setPlaying(!0),this.stopAt={x:c,index:s}}next(){let e=this.time+1e-6,t=this.stages.findIndex(i=>i.at>e);return t<0?null:(this.playTo(t),this.stages[t].id)}previous(){let e=this.time-1e-6,t=-1;return this.stages.forEach((i,s)=>{i.at<e&&(t=s)}),t<0?null:(this.goto(t),this.stages[t].id)}reachStage(e){let t=this.stages[e];t!==void 0&&this.dispatchEvent(new CustomEvent("tycho-stage",{detail:{id:t.id,index:e,at:t.at},bubbles:!0,composed:!0}))}seekFrame(e){let t=this.store;t.setFrame(e),this.playProgress=null,this.heldProgress=null,this.stopAt=null,t.playing&&(this.anchor={index:t.frame,time:performance.now()})}onKey(e){this.useKey(e)&&e.stopPropagation()}useKey(e){if(this.store===null||e.metaKey||e.ctrlKey||e.altKey)return!1;if(e.key==="Escape"){if(this.menu!==null)this.closeMenu(!0);else if(!this.closeExport?.())return!1;return e.preventDefault(),!0}let t=Np(e.key,e.shiftKey,this.scene.clock.steps),i=e.composedPath()[0];return i!==void 0&&["INPUT","SELECT","BUTTON","TEXTAREA"].includes(i.tagName)&&Op(i.tagName,i.type,e.key)?!0:t===null?!1:t.kind==="fit"?(e.preventDefault(),this.fitAll(),!0):t.kind==="slider"?this.stepSlider(t.by)?(e.preventDefault(),!0):!1:!this.hasTransport()&&!this.kiosk?!1:(e.preventDefault(),t.kind==="toggle"?this.store.setPlaying(!this.store.playing):t.kind==="step"?this.step(t.by):this.seekFrame(t.frame),!0)}fitAll(){this.renderer?.refitAll(),this.invalidate()}fitPanel(e){this.renderer?.refit(e),this.invalidate()}stepSlider(e){let t=this.scene,i=this.store.state,s=this.firstPanel(),r=(t.controls??[]).find(h=>h.kind==="slider"&&lt(t,h.variable)?.scope!=="panel");if(r===void 0||s===null)return!1;let a={scene:t,state:i,panel:i.panels[s]},o=ol(a,this.geometry.sets,r);if(o.length===0)return!1;let l=this.panelValue(a,r.variable),c=Math.min(o.length-1,Math.max(0,_a(o,l)+e));return this.store.update(h=>fs(t,h,r.variable,o[c])),!0}buildFooter(){let e=this.scene;if(this.footer.replaceChildren(),this.transport=null,this.hasTransport()){let r=pf("Playback","playback"),a=Qr("play","Play (k)","Play (k)","icon play");a.addEventListener("click",()=>this.store.setPlaying(!this.store.playing));let o=re("input","scrub");o.type="range",o.min="0",o.max=String(e.clock.steps-1),o.step="1",o.setAttribute("aria-label","Frame"),o.addEventListener("pointerdown",ai),o.addEventListener("input",()=>{this.pause(),this.store.setFrame(Number(o.value))});let l=re("span","frame");l.style.minWidth=`${2*String(e.clock.steps).length+3}ch`,l.title="Frame index of the loop. Left and right step, Home goes to 0";let c=re("select","speed");c.setAttribute("aria-label","Playback speed"),c.title="Playback speed";for(let d of FE){let f=re("option",void 0,`${d}\xD7`);f.value=String(d),f.selected=d===this.speed,c.appendChild(f)}c.addEventListener("change",()=>{this.speed=Number(c.value),this.anchor={index:this.playPosition(),time:performance.now()},this.refreshExport?.()}),r.append(a,o,l,c);let h=null;e.clock.channels.length>1&&(h=P0(e.clock.channels.map((d,f)=>({id:d,label:e.clock.labels?.[f]??d})),d=>this.store.update(f=>E0(f,d)),"Clock"),h.el.title="What the frame index runs along",r.append(h.el));let u=re("span","fps",bu(null));u.title=xu(null),r.append(u),this.footer.append(r),this.transport={play:a,scrub:o,frame:l,fps:u,channel:h}}let t=pf("View","view"),i=Qr("house","Reset every view","Reset every view: return each panel to its timeline's camera, or fit it to what it draws (F)");i.addEventListener("click",()=>this.fitAll());let s=Qr("rotateCcw","Reset scene","Reset scene: panels, layout, and controls as written");s.addEventListener("click",()=>this.reset()),t.append(i,s),this.footer.append(t),this.buildExport()}exportVideo(e={}){if(this.scene===null||this.store===null||this.geometry===null)return Promise.reject(new Error("the viewer has not loaded a scene"));let t={w:this.stage.clientWidth,h:this.stage.clientHeight},i=this.hostProperty("--tycho-font"),s={...this.theme===null?{}:{theme:this.theme},...i===""?{}:{font:i}};return x0({scene:this.scene,geometry:this.geometry,state:this.store.state,stage:t,...s},{speed:this.speed,...e})}buildExport(){let e=pf("Export","export"),t=re("button","disclose");t.type="button",t.append(si("download"),re("span",void 0,"Export video"),si("chevronDown","chev"));let i=re("div","exportbar");e.appendChild(t),this.footer.appendChild(e),this.closeExport=null;let s=lf();if(s!==null){t.disabled=!0,this.footer.append(re("span","why",`video export is unavailable: ${s}`));return}let r=re("span","xprog");r.hidden=!0,t.appendChild(r),i.id="xbar",i.setAttribute("role","group"),i.setAttribute("aria-label","Export options"),i.hidden=!0,t.setAttribute("aria-expanded","false"),t.setAttribute("aria-controls","xbar");let a=b=>{i.hidden=!b,t.setAttribute("aria-expanded",String(b)),b&&(v(),_())};this.closeExport=()=>i.hidden?!1:(a(!1),t.focus(),!0),t.addEventListener("click",()=>a(i.hidden!==!1));let o=(b,M)=>{let T=re("select");T.setAttribute("aria-label",b),T.title=b;for(let[x,A]of M){let k=re("option",void 0,A);k.value=x,T.appendChild(k)}return T},l=o("Size",[["720p","1280\xD7720"],["1080p","1920\xD71080"],["stage","stage size"]]),c=o("Frame rate",ph.map(b=>[String(b),`${b} fps`]));c.value="30";let h=()=>go("stage",{w:this.stage.clientWidth,h:this.stage.clientHeight},window.devicePixelRatio||1,Number(c.value)),u=o("Loops",p0.map(b=>[String(b),b===1?"1 loop":`${b} loops`])),d=re("span","info"),f=re("button","btn primary","Start");f.type="button";let p=re("progress");p.hidden=!0;let y=re("button","btn","Cancel");y.type="button",y.hidden=!0;let m=Qr("x","Close export options","Close (Esc)");m.addEventListener("click",()=>{a(!1),t.focus()});let g=null,v=()=>{if(g!==null)return;let b=this.scene.clock;u.value="1",c.value=String(m0(b.steps,this.speed,Ct(b))??ph[0])},_=()=>{if(g!==null)return;let b=l.options[2],M=h();b.textContent=`stage, ${M.width}\xD7${M.height}`;let T=this.scene.clock,x=mh(T.steps,Number(c.value),Number(u.value),this.speed,0,Ct(T)),A=gh(x.count,Number(c.value));d.textContent=A??`${x.count} frames, ${x.duration.toFixed(1)} s at ${this.speed}\xD7 speed`,f.disabled=A!==null};for(let b of[l,c,u])b.addEventListener("change",_);this.refreshExport=()=>{i.hidden||(v(),_())},f.addEventListener("click",()=>{let b=new AbortController;g=b,f.disabled=!0,y.hidden=!1,p.hidden=!1,p.value=0,r.hidden=!1,r.style.width="0%";let M=l.value,T=`${(this.scene.title??"tycho").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"tycho"}.mp4`,x="";this.exportVideo({size:M,fps:Number(c.value),loops:Number(u.value),signal:b.signal,onConfig:A=>x=`${A.width}\xD7${A.height} H.264 ${A.codec}`,onProgress:(A,k)=>{p.max=k,p.value=A,r.style.width=`${k>0?100*A/k:0}%`,d.textContent=`${x}, frame ${A} of ${k}`}}).then(A=>{let k=URL.createObjectURL(A),R=re("a");R.href=k,R.download=T,this.shadowRoot.appendChild(R),R.click(),R.remove(),window.setTimeout(()=>URL.revokeObjectURL(k),6e4),d.textContent=`saved ${T}, ${x}, ${(A.size/1e6).toFixed(2)} MB`}).catch(A=>{d.textContent=A instanceof DOMException&&A.name==="AbortError"?"canceled":`export failed: ${A.message}`}).finally(()=>{g=null,f.disabled=!1,y.hidden=!0,p.hidden=!0,r.hidden=!0})}),y.addEventListener("click",()=>g?.abort()),i.append(l,c,u,d,f,p,y,m),this.footer.append(i)}makeWidget(e,t){let i=this.scene,s=lt(i,e.variable);if(s===void 0)return null;let r=l=>this.store.update(c=>fs(i,c,e.variable,l,t)),a=l=>{let c=s.scope==="panel"?l.panel.variables:l.state.variables;return c!==void 0&&Object.hasOwn(c,e.variable)?c[e.variable]:s.default},o=()=>{let l=re("label","field");return l.appendChild(re("span","k",e.label)),l.addEventListener("pointerdown",ai),l};if(e.kind==="tabs"&&s.kind==="choice"&&t!==void 0&&s.values.length>3){let l=s,c=re("select");l.values.forEach((u,d)=>{let f=re("option",void 0,l.labels?.[d]??u);f.value=u,c.appendChild(f)}),c.addEventListener("change",()=>r(c.value));let h=o();return h.appendChild(c),{el:h,sync:u=>{c.value=String(a(u))}}}if(e.kind==="tabs"&&s.kind==="choice"){let l=s,c=P0(l.values.map((u,d)=>({id:u,label:l.labels?.[d]??u})),u=>r(u),e.label),h=re("span","field");return h.append(re("span","k",e.label),c.el),h.addEventListener("pointerdown",ai),{el:h,sync:u=>c.set(String(a(u)))}}if(e.kind==="toggle"&&s.kind==="toggle"){let l=re("input");l.type="checkbox",l.addEventListener("change",()=>r(l.checked));let c=o();return c.prepend(l),{el:c,sync:h=>{l.checked=a(h)===!0}}}if(e.kind==="slider"&&s.kind==="selector"){let l=re("input");l.type="range",l.min="0",l.step="1";let c=re("output"),h=[];l.addEventListener("input",()=>{mf(l,Number(l.value));let d=h[Number(l.value)];d!==void 0&&r(d)});let u=o();return u.append(l,c),{el:u,sync:d=>{h=ol(d,this.geometry.sets,e),l.disabled=h.length===0,l.max=String(Math.max(0,h.length-1));let f=a(d);mf(l,Math.max(0,_a(h,f))),c.textContent=Yn(f)}}}return null}templateChoice(){let e=this.scene,t=Object.entries(e.variables??{}).filter(([,o])=>o?.kind==="choice"&&o.scope==="panel");if(t.length===0)return null;let i=new Set(Object.values(e.views).map(o=>typeof o.frame=="string"?"":o.frame.var)),[s,r]=t.find(([o])=>i.has(o))??t[0],a=(e.controls??[]).find(o=>o.kind==="tabs"&&o.variable===s);return{id:s,def:r,label:a?.label??s}}templates(){let e=this.scene,t=Object.entries(e.views).map(([s,r])=>({kind:"view",view:s,label:r.label??s})),i=this.choice;return t.length>1||i===null?t:i.def.values.map((s,r)=>({kind:"value",variable:i.id,value:s,label:i.def.labels?.[r]??s}))}buildTopBar(){let e=this.scene;this.varsEl.replaceChildren(),this.sceneWidgets=[];for(let t of e.controls??[]){if(t.kind==="transport"||lt(e,t.variable)?.scope==="panel")continue;let i=this.makeWidget(t,void 0);i&&(this.sceneWidgets.push(i),this.varsEl.appendChild(i.el))}this.buildAddGroup(),this.statsEl.replaceChildren(),this.captions=(e.readouts??[]).filter(t=>t.place==="caption").map(t=>I0(t.parts,"wide")),this.statsEl.append(...this.captions.map(t=>t.root))}buildAddGroup(){this.addEl.replaceChildren();let e=this.templates(),t=re("div","chips");t.appendChild(re("span","k","Add panel")),this.addChips=[];for(let s of e){let r=L0(s.label,"menu");r.body.setAttribute("role","button"),r.body.tabIndex=0,r.body.setAttribute("aria-roledescription","draggable"),r.body.title="Drag onto a panel: an edge splits it, the center replaces it. Click to add a panel.",r.body.addEventListener("pointerdown",o=>this.startDrag(o,s,r.body,r.root)),r.body.addEventListener("keydown",o=>{o.key!=="Enter"&&o.key!==" "||(o.preventDefault(),o.stopPropagation(),this.addPanel(s))});let a=r.button;a.addEventListener("click",()=>this.openMenu(a,this.chipEntries(s))),t.appendChild(r.root),this.addChips.push(r.root)}let i=re("button","btn");i.type="button",i.setAttribute("aria-haspopup","menu"),i.setAttribute("aria-expanded","false"),i.append(si("plus"),re("span",void 0,"Add panel"),si("chevronDown","chev")),i.hidden=!0,i.addEventListener("pointerdown",ai),i.addEventListener("click",()=>this.openMenu(i,e.map(s=>({label:s.label,run:()=>this.addPanel(s)})))),this.addEl.append(t,i),this.addGroup=t,this.addButton=i,this.fitAddGroup()}fitAddGroup(){let e=this.addGroup,t=this.addButton;if(e===null||t===null||this.addChips.length<2)return;let i=this.shadowRoot?.activeElement??null;e.hidden=!1,t.hidden=!0;let s=this.addChips[0],a=this.addChips[this.addChips.length-1].offsetTop>s.offsetTop+s.offsetHeight/2;e.hidden=a,t.hidden=!a,a&&i!==null&&e.contains(i)&&t.focus()}chipEntries(e){let t=this.scene;return A0(this.store.state,i=>this.panelName(i),Mh).map(i=>({label:i.label,disabled:i.disabled,group:i.group,run:()=>this.store.update(s=>C0(t,s,i.placement,e,Mh,r=>this.isTall(r)))}))}addPanel(e){this.store.update(t=>ff(this.scene,t,e,Mh,i=>this.isTall(i)))}isTall(e){let t=this.panelDom.get(e)?.host.getBoundingClientRect();return t!==void 0&&t.width<t.height}panelName(e){let t=this.panelDom.get(e);if(t===void 0)return e;let i=t.chipLabel.textContent??"";return t.title.hidden?i||e:`${t.title.textContent??e}, ${i}`}openMenu(e,t){let i=this.menu?.anchor===e;if(this.closeMenu(!1),i)return;let s=re("div","menu");s.setAttribute("role","menu");let r=[];for(let h of t){if(h.group&&r.length>0){let d=re("hr");d.setAttribute("role","separator"),s.appendChild(d)}let u=re("button",void 0,h.label);u.type="button",u.setAttribute("role","menuitem"),u.tabIndex=-1,u.disabled=h.disabled===!0,u.addEventListener("click",()=>{this.closeMenu(!0),h.run()}),s.appendChild(u),r.push(u)}let a=r.filter(h=>!h.disabled);s.addEventListener("pointerdown",ai),s.addEventListener("keydown",h=>{let u=a.indexOf(this.shadowRoot.activeElement),d=a.length,f=p=>a[(p%d+d)%d]?.focus();if(h.key==="ArrowDown")f(u+1);else if(h.key==="ArrowUp")f(u-1);else if(h.key==="Home")f(0);else if(h.key==="End")f(d-1);else if(h.key==="Escape")this.closeMenu(!0);else if(h.key==="Tab")this.closeMenu(!1);else return;h.key!=="Tab"&&h.preventDefault(),h.stopPropagation()}),this.root.appendChild(s);let o=e.getBoundingClientRect(),l=o.bottom+4+s.offsetHeight<=window.innerHeight;s.style.left=`${Math.max(4,Math.min(o.left,window.innerWidth-s.offsetWidth-4))}px`,s.style.top=`${l?o.bottom+4:Math.max(4,o.top-s.offsetHeight-4)}px`,e.setAttribute("aria-expanded","true");let c=h=>{let u=h.composedPath();!u.includes(s)&&!u.includes(e)&&this.closeMenu(!1)};window.addEventListener("pointerdown",c,!0),this.menu={anchor:e,close:h=>{s.remove(),e.setAttribute("aria-expanded","false"),window.removeEventListener("pointerdown",c,!0),h&&e.focus()}},a[0]?.focus()}closeMenu(e){let t=this.menu;this.menu=null,t?.close(e)}syncWidgets(){let e=this.store,t=this.scene,i=e.state,s=this.firstPanel();if(s!==null){let o={scene:t,state:i,panel:i.panels[s]};for(let l of this.sceneWidgets)l.sync(o)}let r=Object.keys(t.views).length,a=this.choice;for(let[o,l]of this.panelDom){let c=i.panels[o];if(c===void 0)continue;let h={scene:t,state:i,panel:c};for(let g of l.widgets)g.sync(h);let u=t.views[c.view];l.title.textContent=u.label??c.view,l.title.hidden=r<2;let d=typeof u.frame=="string"?u.frame:String(this.panelValue(h,u.frame.var)),p=(Object.hasOwn(t.frames,d)?t.frames[d]:void 0)?.label??d,y=u.frame,m=typeof y=="string"?null:y.var;if(a!==null&&l.select!==null){let g=String(this.panelValue(h,a.id));l.select.value=g,ri(l.chipLabel,a.def.labels?.[a.def.values.indexOf(g)]??g),l.meta.textContent=p,l.meta.hidden=m===a.id||m!==null&&(t.controls??[]).some(v=>v.kind!=="transport"&&v.variable===m&&lt(t,m)?.scope==="panel")}else ri(l.chipLabel,p),l.meta.hidden=!0;l.close.hidden=Object.keys(i.panels).length<2}this.transport?.channel?.set(i.clock.channel)}panelValue(e,t){let i=lt(e.scene,t);if(i===void 0)return"";let s=i.scope==="panel"?e.panel.variables:e.state.variables;return s!==void 0&&Object.hasOwn(s,t)?s[t]:i.default}syncPanels(){let e=this.store.state;for(let t of[...this.panelDom.keys()])Object.hasOwn(e.panels,t)||this.removePanelDom(t);for(let t of Object.keys(e.panels)){let i=this.panelDom.get(t);i!==void 0&&i.view===e.panels[t].view||(i!==void 0&&this.removePanelDom(t),this.createPanelDom(t,e.panels[t]))}}createPanelDom(e,t){let i=this.scene,s=re("div","panel");s.dataset.id=e;let r=re("div","pbody"),a=(i.readouts??[]).filter(T=>T.place==="panel").map(T=>I0(T.parts,"stack")),o=re("div","preadout");o.append(...a.map(T=>T.root));let l=re("div","perror"),c=re("div","cbars"),h=re("div","drop"),u=re("span");h.appendChild(u),h.hidden=!0;let d=re("button","btn follow");d.type="button",d.append(si("house"),re("span",void 0,"Timeline view")),d.title="Back to the timeline's camera (F returns every panel)",d.hidden=!0,d.addEventListener("pointerdown",ai),d.addEventListener("click",()=>this.fitPanel(e)),r.append(o,l,c,h,d),r.addEventListener("dblclick",()=>this.fitPanel(e));let f=re("div","phead"),p=re("span","t"),y=this.choice,m=L0("",y===null?"none":"select");if(m.body.title="Drag to move the panel: onto an edge of another to place it there, onto its center to swap",y!==null&&m.select!==null){let T=m.select;T.setAttribute("aria-label",y.label),y.def.values.forEach((x,A)=>{let k=re("option",void 0,y.def.labels?.[A]??x);k.value=x,T.appendChild(k)}),T.addEventListener("change",()=>this.store.update(x=>fs(i,x,y.id,T.value,e)))}let g=re("span","m"),v=re("span","pc mini"),_=[];for(let T of i.controls??[]){if(T.kind==="transport"||lt(i,T.variable)?.scope!=="panel"||y!==null&&T.kind==="tabs"&&T.variable===y.id)continue;let x=this.makeWidget(T,e);x&&(_.push(x),v.appendChild(x.el))}let b=Qr("house","Reset view","Reset view: fit to what this panel draws (F resets every panel)");b.addEventListener("click",()=>this.fitPanel(e));let M=Qr("x","Close panel","Close panel");M.addEventListener("click",()=>this.store.update(T=>T0(T,e))),f.append(p,m.root,g,v,re("span","sp"),b,M),f.addEventListener("pointerdown",T=>this.startDrag(T,{kind:"panel",id:e},f,m.root)),s.append(r,f),this.panelsEl.appendChild(s),this.panelDom.set(e,{host:s,body:r,head:f,title:p,chip:m.root,chipLabel:m.label,select:m.select,meta:g,close:M,readouts:a,error:l,follow:d,drop:h,dropLabel:u,bars:c,barDom:[],barsFor:null,widgets:_,view:t.view}),this.renderer?.bind(e,r)}removePanelDom(e){let t=this.panelDom.get(e);t&&(this.renderer?.bind(e,null),t.host.remove(),this.panelDom.delete(e))}layoutDom(e){if(this.store===null)return;let{w:t,h:i}=this.stageSize,s=e??this.heldProgress??this.store.frame/this.scene.clock.steps,r=qr(qs(this.store.state.layout,s*Ct(this.scene.clock)),{x:0,y:0,w:t,h:i},Jr);for(let[o,l]of r.panels){let c=this.panelDom.get(o);c&&Object.assign(c.host.style,{left:`${l.x}px`,top:`${l.y}px`,width:`${l.w}px`,height:`${l.h}px`})}this.gutters=r.gutters;let a=new Set;for(let o of r.gutters){a.add(o.path);let l=this.gutterDom.get(o.path);if(!l){l=re("div","gutter");let c=o.path;l.addEventListener("pointerdown",h=>this.startResize(h,c,l)),this.gutterDom.set(o.path,l),this.panelsEl.appendChild(l)}l.className=`gutter ${o.dir}`,Object.assign(l.style,{left:`${o.rect.x}px`,top:`${o.rect.y}px`,width:`${o.rect.w}px`,height:`${o.rect.h}px`})}for(let[o,l]of[...this.gutterDom])a.has(o)||(l.remove(),this.gutterDom.delete(o))}startResize(e,t,i){let s=this.gutters.find(o=>o.path===t);if(!s||e.button!==0)return;e.preventDefault(),i.classList.add("active"),i.setPointerCapture(e.pointerId);let r=o=>{let l=this.stage.getBoundingClientRect(),c=Kg(s,o.clientX-l.left,o.clientY-l.top,Jr);this.store.update(h=>bo(h,lh(h.layout,t,c)))},a=()=>{i.classList.remove("active"),i.removeEventListener("pointermove",r),i.removeEventListener("pointerup",a),i.removeEventListener("pointercancel",a)};i.addEventListener("pointermove",r),i.addEventListener("pointerup",a),i.addEventListener("pointercancel",a)}syncBars(e,t){let i=this.scene,s=this.renderer.colorbars(e);t.barDom.length!==s.length&&(t.barDom=s.map(()=>this.makeBar(e)),t.bars.replaceChildren(...t.barDom.map(o=>o.root)));let r=this.store.state.panels[e],a=r===void 0?void 0:i.views[r.view];s.forEach((o,l)=>{let c=t.barDom[l];ri(c.title,o.label),c.gradient!==o.gradient&&(c.gradient=o.gradient,c.grad.style.background=o.gradient);let h=Number.isInteger(o.lo)&&Number.isInteger(o.hi)?void 0:3;ri(c.hi,Yn(o.hi,h)),ri(c.lo,Yn(o.lo,h)),c.range=[o.lo,o.hi],c.mark.hidden=o.marker===null,o.marker!==null&&(c.mark.style.bottom=`${(100*o.marker).toFixed(2)}%`),c.band.hidden=o.band===null,o.band!==null&&(c.band.style.bottom=`${(100*o.band[0]).toFixed(2)}%`,c.band.style.height=`${(100*(o.band[1]-o.band[0])).toFixed(2)}%`),c.link=a===void 0?null:Up(i,a,o.label);let u=c.grad;if(u.classList.toggle("live",c.link!==null),c.link===null){for(let f of["role","tabindex","aria-orientation","aria-label","aria-valuemin","aria-valuemax","aria-valuenow","aria-valuetext","title"])u.removeAttribute(f);return}let d=this.panelValue({scene:i,state:this.store.state,panel:r},c.link.variable);u.setAttribute("role","slider"),u.setAttribute("tabindex","0"),u.setAttribute("aria-orientation","vertical"),u.setAttribute("aria-label",c.link.label),u.setAttribute("aria-valuemin",String(o.lo)),u.setAttribute("aria-valuemax",String(o.hi)),u.setAttribute("aria-valuenow",String(d)),u.setAttribute("aria-valuetext",Yn(d)),u.title=`Drag or click to set ${c.link.label}`})}makeBar(e){let t=re("div","cbar"),i=re("div","cbar-t"),s=re("div","cbar-b"),r=re("div","cbar-g"),a=re("span","cbar-k"),o=re("i");r.append(a,o);let l=re("div","cbar-n"),c=re("span"),h=re("span");l.append(c,h),s.append(r,l),t.append(i,s);let u={root:t,title:i,grad:r,band:a,mark:o,hi:c,lo:h,gradient:"",range:[0,1],link:null};return r.addEventListener("pointerdown",d=>{if(u.link===null||d.button!==0)return;d.preventDefault(),d.stopPropagation(),r.focus(),r.setPointerCapture(d.pointerId);let f=y=>{let m=r.getBoundingClientRect();this.setFromBar(e,u,m.height>0?(m.bottom-y.clientY)/m.height:0)},p=()=>{r.removeEventListener("pointermove",f),r.removeEventListener("pointerup",p),r.removeEventListener("pointercancel",p)};f(d),r.addEventListener("pointermove",f),r.addEventListener("pointerup",p),r.addEventListener("pointercancel",p)}),r.addEventListener("dblclick",ai),r.addEventListener("keydown",d=>{if(u.link===null)return;let f={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10,Home:-1/0,End:1/0};d.key in f&&(d.preventDefault(),d.stopPropagation(),this.stepBar(e,u,f[d.key]))}),u}barStops(e,t){let i=this.store.state,s=i.panels[e];if(s===void 0)return[];let r={kind:"slider",variable:t.variable,label:t.label,domain:t.domain};return ol({scene:this.scene,state:i,panel:s},this.geometry.sets,r)}setFromBar(e,t,i){if(t.link===null)return;let s=this.barStops(e,t.link),r=Fp(s,t.range[0],t.range[1],i),a=t.link.variable;r>=0&&this.store.update(o=>fs(this.scene,o,a,s[r]))}stepBar(e,t,i){if(t.link===null)return;let s=this.barStops(e,t.link),r=this.store.state;if(s.length===0||r.panels[e]===void 0)return;let a=this.panelValue({scene:this.scene,state:r,panel:r.panels[e]},t.link.variable),o=Math.min(s.length-1,Math.max(0,_a(s,a)+i)),l=t.link.variable;this.store.update(c=>fs(this.scene,c,l,s[o]))}startDrag(e,t,i,s){if(e.button!==0||this.store===null)return;e.preventDefault(),this.closeMenu(!1);let r=e.clientX,a=e.clientY,o=this.shadowRoot,l=null,c=null;i.setPointerCapture(e.pointerId);let h=()=>{for(let f of this.panelDom.values())f.drop.hidden=!0},u=f=>{if(!l){if(Math.hypot(f.clientX-r,f.clientY-a)<4)return;l=s.cloneNode(!0),l.classList.add("ghost"),this.root.appendChild(l),s.classList.add("source"),this.root.classList.add("dragging")}l.style.left=`${f.clientX}px`,l.style.top=`${f.clientY}px`,h(),c=null;let y=o.elementFromPoint(f.clientX,f.clientY)?.closest(".panel");if(!y)return;let m=y.dataset.id;if(t.kind==="panel"&&t.id===m)return;let g=this.panelDom.get(m);if(!g)return;let v=g.host.getBoundingClientRect(),_=w0(f.clientX-v.left,f.clientY-v.top,v.width,v.height);c={id:m,zone:_},g.drop.hidden=!1,g.drop.style.inset=_==="left"?"0 50% 0 0":_==="right"?"0 0 0 50%":_==="top"?"0 0 50% 0":_==="bottom"?"50% 0 0 0":"0",ri(g.dropLabel,zE(t,_))},d=f=>{i.removeEventListener("pointermove",u),i.removeEventListener("pointerup",d),i.removeEventListener("pointercancel",d),h();let p=l!==null;if(l?.remove(),s.classList.remove("source"),this.root.classList.remove("dragging"),!p){t.kind!=="panel"&&f.type==="pointerup"&&this.addPanel(t);return}c&&this.dropOn(c.id,c.zone,t)};i.addEventListener("pointermove",u),i.addEventListener("pointerup",d),i.addEventListener("pointercancel",d)}dropOn(e,t,i){let s=this.scene;this.store.update(r=>Sh(s,r,e,t,i,Mh))}};function Eh(n="tycho-viewer"){typeof customElements<"u"&&!customElements.get(n)&&customElements.define(n,xo)}function GE(n,e){return n.exportVideo(e)}Eh();return W0(WE);})();
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
