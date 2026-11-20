/* Tanzeem: read a PDF / PPTX in the browser -> slide images + tappable word boxes */
(function () {
  'use strict';
  var TZ = (window.TZ = {});
  var BASE = (function () { var s = document.currentScript; return s && s.src ? s.src.replace(/[^\/]*$/, '') : location.href.replace(/[^\/]*$/, '') + 'lib/'; })();
  var STOP = {};
  ('a an the of in on at to is are was were be been am and or but nor for with by as it its this that these those from into than then so if not no do does did has have had can may will would could should i you he she we they them his her our your their my me us there here which who whom what when where why how also such via per etc eg ie vs').split(' ').forEach(function (w) { STOP[w] = 1; });

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  var jszipP = null;
  function needZip() { if (window.JSZip) return Promise.resolve(); return jszipP || (jszipP = loadScript(BASE + 'jszip.min.js')); }
  var pdfP = null;
  function needPdf() {
    if (pdfP) return pdfP;
    // the iPad app may serve .mjs with a type the browser refuses for modules, so the .js copies are tried first
    // inside the iPad app a separate worker may not start, so the worker code is loaded into the page first
    // (pdf.js then runs it on the main thread). The website keeps the normal background worker.
    var native = false; try { native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) {}
    var load = function (ext) {
      var pre = native && !window.pdfjsWorker ? import(BASE + 'pdf.worker.min.' + ext) : Promise.resolve();
      return pre.then(function () { return import(BASE + 'pdf.min.' + ext); }).then(function (m) { m.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.' + ext; return m; });
    };
    pdfP = load('js').catch(function () { return load('mjs'); }).catch(function (e) { pdfP = null; throw e; });
    return pdfP;
  }

  /* a tappable word: returns [x,y,w,h,key,line] (percent) or null */
  function wordRec(text, x, y, w, h, W, H, line) {
    var m = /^[^A-Za-z0-9]*(.*?)[^A-Za-z0-9]*$/.exec(text);
    var core = m ? m[1] : text;
    if (core.length < 2 || !/[A-Za-z]{2,}/.test(core)) return null;
    if (STOP[core.toLowerCase()]) return null;
    var key = /^[A-Z][a-z]+$/.test(core) ? core.toLowerCase() : core;
    function r(v) { return Math.round(v * 100) / 100; }
    return [r(x / W * 100), r(y / H * 100), r(w / W * 100), r(h / H * 100), key, line];
  }
  var CW = { ' ': 278, i: 222, j: 222, l: 222, f: 278, t: 278, r: 333, I: 278, m: 833, w: 722, M: 833, W: 944, c: 500, k: 500, s: 500, v: 500, x: 500, y: 500, z: 500, J: 500, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, K: 667, L: 556, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, X: 667, Y: 667, Z: 611, '.': 278, ',': 278, ':': 278, ';': 278, '-': 333, '(': 333, ')': 333, "'": 191, '"': 355, '/': 278, '!': 278 };
  function cw(ch) { return CW[ch] || 556; }
  function pre(str, n) { var t = 0; for (var i = 0; i < n; i++) t += cw(str[i]); return t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function canvasBlob(cv, q) {
    return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, 'image/jpeg', q || 0.85); });
  }

  /* ---------------- PDF ---------------- */
  TZ.parsePdf = function (buf, onProg) {
    return needPdf().then(function (pdfjs) {
      return pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise.then(function (doc) {
        var out = [], n = doc.numPages;
        function page(i) {
          if (i > n) return out;
          return doc.getPage(i).then(function (pg) {
            var v1 = pg.getViewport({ scale: 1 });
            var sc = Math.min(1280 / v1.width, 1800 / v1.height);
            var vp = pg.getViewport({ scale: sc });
            var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            return pg.render({ canvasContext: ctx, canvas: cv, viewport: vp }).promise.then(function () {
              return pg.getTextContent();
            }).then(function (tc) {
              var W = cv.width, H = cv.height, items = [];
              tc.items.forEach(function (it) {
                if (!it.str || !it.str.trim()) return;
                var t = pdfjs.Util.transform(vp.transform, it.transform);
                if (Math.abs(t[1]) > 0.2 * Math.abs(t[0]) + 0.01) return; /* rotated text: skip */
                var fh = Math.hypot(t[2], t[3]) || it.height * sc || 10;
                items.push({ s: it.str, x: t[4], base: t[5], fh: fh, w: it.width * sc });
              });
              /* lines: cluster by baseline */
              items.sort(function (a, b) { return a.base - b.base || a.x - b.x; });
              var lines = [], cur = null;
              items.forEach(function (it) {
                if (cur && Math.abs(it.base - cur.base) < it.fh * 0.45) { cur.items.push(it); }
                else { cur = { base: it.base, items: [it] }; lines.push(cur); }
              });
              var hot = [], linesTxt = {}, en = [];
              lines.forEach(function (ln, li) {
                ln.items.sort(function (a, b) { return a.x - b.x; });
                var txt = ln.items.map(function (i) { return i.s; }).join(' ').replace(/\s+/g, ' ').trim();
                linesTxt[li] = txt; en.push(txt);
                ln.items.forEach(function (it) {
                  var tot = pre(it.s, it.s.length) || 1, re = /\S+/g, m;
                  while ((m = re.exec(it.s))) {
                    var x0 = it.x + it.w * (pre(it.s, m.index) / tot), w0 = it.w * (pre(m[0], m[0].length) / tot);
                    var rec = wordRec(m[0], x0, it.base - it.fh * 0.92, w0, it.fh * 1.2, W, H, li);
                    if (rec) hot.push(rec);
                  }
                });
              });
              return canvasBlob(cv, 0.85).then(function (b) {
                out.push({ img: URL.createObjectURL(b), ar: W / H, hot: hot, lines: linesTxt, tr: {}, terms: {}, en: en.join('\n') });
                pg.cleanup();
                if (onProg) onProg(i, n);
                return page(i + 1);
              });
            });
          });
        }
        return page(1);
      });
    });
  };


  /* ---------------- PPTX ---------------- */
  var NS_A = 'a:';
  function dom(str) { return new DOMParser().parseFromString(str, 'application/xml'); }
  function ch(el, name) { var r = []; if (!el) return r; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!name || c.nodeName === name)) r.push(c); return r; }
  function c1(el, name) { if (!el) return null; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.nodeName === name) return c; return null; }
  function path(el) { for (var i = 1; i < arguments.length && el; i++) el = c1(el, arguments[i]); return el; }
  function at(el, n, d) { if (!el) return d; var v = el.getAttribute(n); return v === null ? d : v; }
  function num(el, n, d) { var v = at(el, n, null); return v === null ? d : +v; }
  function dirOf(p) { return p.replace(/[^\/]*$/, ''); }
  function resolve(base, target) {
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = dirOf(base).split('/').filter(Boolean);
    target.split('/').forEach(function (t) { if (t === '..') parts.pop(); else if (t !== '.' && t) parts.push(t); });
    return parts.join('/');
  }
  var SCHEME_DEF = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };

  function hex2rgb(h) { return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function rgb2hsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hsl2rgb(a) {
    var h = a[0], s = a[1], l = a[2];
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  }

  TZ.parsePptx = function (buf, onProg) {
    return needZip().then(function () { return JSZip.loadAsync(buf); }).then(function (zip) {
      var cache = {};
      function text(pth) { var f = zip.file(pth); return f ? f.async('string') : Promise.resolve(null); }
      function getXml(pth) {
        if (cache[pth] !== undefined) return Promise.resolve(cache[pth]);
        return text(pth).then(function (t) { cache[pth] = t ? dom(t) : null; return cache[pth]; });
      }
      function getRels(pth) {
        var rp = dirOf(pth) + '_rels/' + pth.replace(/^.*\//, '') + '.rels';
        return getXml(rp).then(function (d) {
          var m = {};
          if (d) ch(d.documentElement, 'Relationship').forEach(function (r) { m[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', target: at(r, 'TargetMode', '') === 'External' ? null : resolve(pth, r.getAttribute('Target')) }; });
          return m;
        });
      }
      var imgCache = {};
      function getImg(pth) {
        if (!pth) return Promise.resolve(null);
        if (imgCache[pth]) return imgCache[pth];
        var f = zip.file(pth);
        if (!f || /\.(emf|wmf|tif|tiff)$/i.test(pth)) return (imgCache[pth] = Promise.resolve(null));
        var mime = /\.png$/i.test(pth) ? 'image/png' : /\.gif$/i.test(pth) ? 'image/gif' : /\.svg$/i.test(pth) ? 'image/svg+xml' : /\.webp$/i.test(pth) ? 'image/webp' : 'image/jpeg';
        return (imgCache[pth] = f.async('arraybuffer').then(function (ab) {
          return new Promise(function (res) {
            var url = URL.createObjectURL(new Blob([ab], { type: mime })), im = new Image();
            im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = url;
          });
        }));
      }

      return getXml('ppt/presentation.xml').then(function (pres) {
        if (!pres) throw new Error('bad pptx');
        var sz = path(pres.documentElement, 'p:sldSz');
        var CX = num(sz, 'cx', 12192000), CY = num(sz, 'cy', 6858000);
        var W = 1280, K = W / CX, H = Math.round(CY * K);
        return getRels('ppt/presentation.xml').then(function (prels) {
          var ids = ch(path(pres.documentElement, 'p:sldIdLst'), 'p:sldId').map(function (e) { return prels[e.getAttribute('r:id')]; }).filter(function (r) { return r && r.target; }).map(function (r) { return r.target; });
          var out = [];
          function slide(i) {
            if (i >= ids.length) return out;
            return renderSlide(ids[i]).then(function (sl) { out.push(sl); if (onProg) onProg(i + 1, ids.length); return slide(i + 1); });
          }
          return slide(0);

          function renderSlide(spath) {
            return Promise.all([getXml(spath), getRels(spath)]).then(function (r0) {
              var sd = r0[0], srels = r0[1];
              var lrel = Object.keys(srels).map(function (k) { return srels[k]; }).filter(function (r) { return /slideLayout$/.test(r.type); })[0];
              var lpath = lrel ? lrel.target : null;
              return Promise.all([lpath ? getXml(lpath) : null, lpath ? getRels(lpath) : {}]).then(function (r1) {
                var ld = r1[0], lrels = r1[1];
                var mrel = Object.keys(lrels).map(function (k) { return lrels[k]; }).filter(function (r) { return /slideMaster$/.test(r.type); })[0];
                var mpath = mrel ? mrel.target : null;
                return Promise.all([mpath ? getXml(mpath) : null, mpath ? getRels(mpath) : {}]).then(function (r2) {
                  var md = r2[0], mrels = r2[1];
                  var trel = Object.keys(mrels).map(function (k) { return mrels[k]; }).filter(function (r) { return /theme$/.test(r.type); })[0];
                  return (trel ? getXml(trel.target) : Promise.resolve(null)).then(function (td) {
                    return draw({ sd: sd, srels: srels, spath: spath, ld: ld, lrels: lrels, lpath: lpath, md: md, mrels: mrels, mpath: mpath, td: td });
                  });
                });
              });
            });
          }

          function draw(D) {
            var theme = {}, fonts = { major: 'Arial', minor: 'Arial' };
            if (D.td) {
              var cs = path(D.td.documentElement, 'a:themeElements', 'a:clrScheme');
              ch(cs).forEach(function (e) { var k = e.nodeName.replace('a:', ''), f = e.firstElementChild; if (!f) return; theme[k] = f.nodeName === 'a:sysClr' ? hex2rgb(at(f, 'lastClr', '000000')) : hex2rgb(at(f, 'val', '000000')); });
              var fs = path(D.td.documentElement, 'a:themeElements', 'a:fontScheme');
              var mj = path(fs, 'a:majorFont', 'a:latin'), mn = path(fs, 'a:minorFont', 'a:latin');
              if (mj) fonts.major = at(mj, 'typeface', 'Arial'); if (mn) fonts.minor = at(mn, 'typeface', 'Arial');
            }
            var clrMap = {};
            var mcm = D.md ? path(D.md.documentElement, 'p:clrMap') : null;
            if (mcm) Array.prototype.forEach.call(mcm.attributes, function (a) { clrMap[a.name] = a.value; });
            [D.ld, D.sd].forEach(function (d) { var ov = d ? path(d.documentElement, 'p:clrMapOvr', 'a:overrideClrMapping') : null; if (ov) Array.prototype.forEach.call(ov.attributes, function (a) { clrMap[a.name] = a.value; }); });

            function schemeRgb(n, phClr) {
              if (n === 'phClr') return phClr || [0, 0, 0];
              var m = clrMap[n] || n; m = SCHEME_DEF[m] || m;
              return theme[m] || theme[SCHEME_DEF[n] || n] || [0, 0, 0];
            }
            /* node: srgbClr / schemeClr / sysClr / prstClr -> {c:[r,g,b], a:alpha} */
            function clr(node, phClr) {
              if (!node) return null;
              var base, nm = node.nodeName;
              if (nm === 'a:srgbClr') base = hex2rgb(at(node, 'val', '000000'));
              else if (nm === 'a:schemeClr') base = schemeRgb(at(node, 'val', 'tx1'), phClr);
              else if (nm === 'a:sysClr') base = hex2rgb(at(node, 'lastClr', '000000'));
              else if (nm === 'a:prstClr') { var P = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0], gray: [128, 128, 128] }; base = P[at(node, 'val', 'black')] || [0, 0, 0]; }
              else return null;
              var a = 1;
              ch(node).forEach(function (m) {
                var v = num(m, 'val', 100000) / 100000, k = m.nodeName;
                if (k === 'a:alpha') a = v;
                else if (k === 'a:lumMod' || k === 'a:lumOff') { var h = rgb2hsl(base); if (k === 'a:lumMod') h[2] = clamp(h[2] * v, 0, 1); else h[2] = clamp(h[2] + v, 0, 1); base = hsl2rgb(h); }
                else if (k === 'a:tint') base = base.map(function (x) { return Math.round(x + (255 - x) * (1 - v)); });
                else if (k === 'a:shade') base = base.map(function (x) { return Math.round(x * v); });
              });
              return { c: base, a: a };
            }
            function css(c) { return c ? 'rgba(' + c.c[0] + ',' + c.c[1] + ',' + c.c[2] + ',' + c.a + ')' : null; }
            function colorIn(parent, phClr) { /* first colour child of a fill container */
              if (!parent) return null;
              var e = ch(parent).filter(function (x) { return /Clr$/.test(x.nodeName); })[0];
              return clr(e, phClr);
            }

            var canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
            var ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
            var hot = [], lines = {}, enParts = [], pid = 0;
            var jobs = []; /* sequential drawing chain */
            var chain = Promise.resolve();
            function later(fn) { chain = chain.then(fn); }

            /* ---- background ---- */
            function bgOf(d, rels, p0) {
              var bg = d ? path(d.documentElement, 'p:cSld', 'p:bg') : null; if (!bg) return null;
              var pr = c1(bg, 'p:bgPr');
              if (pr) {
                var sf = c1(pr, 'a:solidFill'); if (sf) return { color: clr(ch(sf)[0]) };
                var gf = c1(pr, 'a:gradFill'); if (gf) return { color: colorIn(path(gf, 'a:gsLst', 'a:gs')) };
                var bf = c1(pr, 'a:blipFill'); if (bf) { var rid = at(path(bf, 'a:blip'), 'r:embed', null); return rid && rels[rid] ? { img: rels[rid].target } : null; }
                return null;
              }
              var ref = c1(bg, 'p:bgRef'); if (ref) return { color: colorIn(ref) };
              return null;
            }
            var bg = bgOf(D.sd, D.srels) || bgOf(D.ld, D.lrels) || bgOf(D.md, D.mrels);
            later(function () {
              if (!bg) return;
              if (bg.color) { ctx.fillStyle = css(bg.color); ctx.fillRect(0, 0, W, H); }
              else if (bg.img) return getImg(bg.img).then(function (im) { if (im) ctx.drawImage(im, 0, 0, W, H); });
            });

            /* ---- placeholder lookup ---- */
            function phOf(sp) { var nv = path(sp, 'p:nvSpPr', 'p:nvPr'); return nv ? c1(nv, 'p:ph') : null; }
            function spsOf(d) { var tree = d ? path(d.documentElement, 'p:cSld', 'p:spTree') : null; return tree ? ch(tree, 'p:sp') : []; }
            function findPh(d, ph) {
              if (!ph) return null;
              var t = at(ph, 'type', 'body'), idx = at(ph, 'idx', null), all = spsOf(d), best = null;
              all.forEach(function (sp) {
                var q = phOf(sp); if (!q) return;
                var qt = at(q, 'type', 'body'), qi = at(q, 'idx', null);
                if (idx !== null && qi === idx) best = best || sp;
              });
              if (best) return best;
              var tt = (t === 'ctrTitle') ? 'title' : (t === 'subTitle' ? 'body' : t);
              all.forEach(function (sp) { var q = phOf(sp); if (!q || best) return; var qt = at(q, 'type', 'body'); qt = qt === 'ctrTitle' ? 'title' : qt; if (qt === tt) best = sp; });
              return best;
            }
            function xfrmOf(sp) { return path(sp, 'p:spPr', 'a:xfrm'); }

            /* ---- text styles ---- */
            var tx = D.md ? path(D.md.documentElement, 'p:txStyles') : null;
            function styleFor(ph) {
              if (!ph) return c1(tx, 'p:otherStyle');
              var t = at(ph, 'type', 'body');
              if (t === 'title' || t === 'ctrTitle') return c1(tx, 'p:titleStyle');
              if (t === 'dt' || t === 'ftr' || t === 'sldNum') return c1(tx, 'p:otherStyle');
              return c1(tx, 'p:bodyStyle');
            }
            function lvlOf(lst, l) { return lst ? c1(lst, 'a:lvl' + (l + 1) + 'pPr') : null; }

            /* ---- main shape walker ---- */
            function walk(tree, rels, tf, layer) {
              ch(tree).forEach(function (n) {
                var k = n.nodeName;
                if (k === 'p:sp' || k === 'p:cxnSp') later(function () { return drawSp(n, rels, tf, layer); });
                else if (k === 'p:pic') later(function () { return drawPic(n, rels, tf, layer); });
                else if (k === 'p:grpSp') {
                  var gx = path(n, 'p:grpSpPr', 'a:xfrm');
                  var t2 = tf;
                  if (gx) {
                    var off = c1(gx, 'a:off'), ext = c1(gx, 'a:ext'), co = c1(gx, 'a:chOff'), ce = c1(gx, 'a:chExt');
                    var ex = num(ext, 'cx', 1), ey = num(ext, 'cy', 1), cex = num(ce, 'cx', ex) || 1, cey = num(ce, 'cy', ey) || 1;
                    var sx = tf.sx * ex / cex, sy = tf.sy * ey / cey;
                    t2 = { sx: sx, sy: sy, ox: tf.ox + tf.sx * (num(off, 'x', 0) - num(co, 'x', 0) * ex / cex), oy: tf.oy + tf.sy * (num(off, 'y', 0) - num(co, 'y', 0) * ey / cey) };
                  }
                  walk(n, rels, t2, layer);
                } else if (k === 'p:graphicFrame') later(function () { return drawFrame(n, rels, tf, layer); });
              });
            }
            function boxOf(xf, tf) {
              var off = c1(xf, 'a:off'), ext = c1(xf, 'a:ext');
              return { x: (tf.ox + tf.sx * num(off, 'x', 0)) * K, y: (tf.oy + tf.sy * num(off, 'y', 0)) * K, w: tf.sx * num(ext, 'cx', 0) * K, h: tf.sy * num(ext, 'cy', 0) * K,
                rot: num(xf, 'rot', 0) / 60000, fh: at(xf, 'flipH', '0') === '1', fv: at(xf, 'flipV', '0') === '1' };
            }
            function withRot(b, fn) {
              ctx.save();
              if (b.rot || b.fh || b.fv) { ctx.translate(b.x + b.w / 2, b.y + b.h / 2); if (b.rot) ctx.rotate(b.rot * Math.PI / 180); ctx.scale(b.fh ? -1 : 1, b.fv ? -1 : 1); ctx.translate(-b.w / 2 - b.x, -b.h / 2 - b.y); }
              fn(); ctx.restore();
            }

            function geomPath(prst, b, adj) {
              var x = b.x, y = b.y, w = b.w, h = b.h;
              ctx.beginPath();
              if (prst === 'ellipse') { ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); }
              else if (prst === 'roundRect') { var r = Math.min(w, h) * (adj == null ? 0.16667 : adj / 100000); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
              else if (prst === 'triangle') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
              else if (prst === 'diamond') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); }
              else if (prst === 'rightArrow') { var a = h * 0.25, hd = Math.min(w * 0.4, h * 0.5); ctx.moveTo(x, y + a); ctx.lineTo(x + w - hd, y + a); ctx.lineTo(x + w - hd, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - hd, y + h); ctx.lineTo(x + w - hd, y + h - a); ctx.lineTo(x, y + h - a); ctx.closePath(); }
              else if (prst === 'downArrow' || prst === 'upArrow') { var sw = w * 0.25, ah = Math.min(h * 0.45, w * 0.5), dn = prst === 'downArrow'; var xs = x + w * 0.25, xe = x + w * 0.75;
                if (dn) { ctx.moveTo(xs, y); ctx.lineTo(xe, y); ctx.lineTo(xe, y + h - ah); ctx.lineTo(x + w, y + h - ah); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h - ah); ctx.lineTo(xs, y + h - ah); }
                else { ctx.moveTo(xs, y + h); ctx.lineTo(xe, y + h); ctx.lineTo(xe, y + ah); ctx.lineTo(x + w, y + ah); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + ah); ctx.lineTo(xs, y + ah); }
                ctx.closePath(); }
              else if (prst === 'leftArrow') { var a2 = h * 0.25, hd2 = Math.min(w * 0.4, h * 0.5); ctx.moveTo(x + w, y + a2); ctx.lineTo(x + hd2, y + a2); ctx.lineTo(x + hd2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x + hd2, y + h); ctx.lineTo(x + hd2, y + h - a2); ctx.lineTo(x + w, y + h - a2); ctx.closePath(); }
              else if (prst === 'homePlate') { var hp = Math.min(w * 0.3, h * 0.5); ctx.moveTo(x, y); ctx.lineTo(x + w - hp, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - hp, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
              else if (prst === 'chevron') { var cv = Math.min(w * 0.3, h * 0.5); ctx.moveTo(x, y); ctx.lineTo(x + w - cv, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - cv, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x + cv, y + h / 2); ctx.closePath(); }
              else ctx.rect(x, y, w, h);
            }

            function fillStyleOf(spPr, style, phClr) {
              /* returns {kind:'none'|'solid'|'grad'|'blip', ...} or null=undefined */
              if (spPr) {
                if (c1(spPr, 'a:noFill')) return { kind: 'none' };
                var sf = c1(spPr, 'a:solidFill'); if (sf) return { kind: 'solid', c: clr(ch(sf)[0], phClr) };
                var gf = c1(spPr, 'a:gradFill');
                if (gf) {
                  var gs = ch(path(gf, 'a:gsLst'), 'a:gs'); if (gs.length) { var lin = c1(gf, 'a:lin'); return { kind: 'grad', c1: colorIn(gs[0], phClr), c2: colorIn(gs[gs.length - 1], phClr), ang: lin ? num(lin, 'ang', 0) / 60000 : 90 }; }
                }
                var bf = c1(spPr, 'a:blipFill'); if (bf) return { kind: 'blip', rid: at(path(bf, 'a:blip'), 'r:embed', null) };
                var pf = c1(spPr, 'a:pattFill'); if (pf) return { kind: 'solid', c: colorIn(c1(pf, 'a:fgClr') || pf, phClr) };
              }
              if (style) { var fr = c1(style, 'a:fillRef'); if (fr && num(fr, 'idx', 0) > 0) return { kind: 'solid', c: colorIn(fr, phClr) }; }
              return null;
            }
            function lineStyleOf(spPr, style) {
              var ln = spPr ? c1(spPr, 'a:ln') : null;
              if (ln) {
                if (c1(ln, 'a:noFill')) return null;
                var sf = c1(ln, 'a:solidFill');
                var w = num(ln, 'w', 12700) * K;
                if (sf) return { c: clr(ch(sf)[0]), w: Math.max(1, w) };
              }
              if (style && !(ln && c1(ln, 'a:noFill'))) { var lr = c1(style, 'a:lnRef'); if (lr && num(lr, 'idx', 0) > 0) return { c: colorIn(lr), w: Math.max(1, (ln ? num(ln, 'w', 12700) : 12700) * K) }; }
              return null;
            }
            function applyFill(f, b, rels) {
              if (!f || f.kind === 'none') return Promise.resolve(false);
              if (f.kind === 'solid') { if (!f.c) return Promise.resolve(false); ctx.fillStyle = css(f.c); ctx.fill(); return Promise.resolve(true); }
              if (f.kind === 'grad') {
                var a = f.ang * Math.PI / 180, cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = Math.cos(a) * b.w / 2, dy = Math.sin(a) * b.h / 2;
                var g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
                g.addColorStop(0, css(f.c1) || '#fff'); g.addColorStop(1, css(f.c2) || '#fff'); ctx.fillStyle = g; ctx.fill(); return Promise.resolve(true);
              }
              if (f.kind === 'blip' && f.rid && rels[f.rid]) return getImg(rels[f.rid].target).then(function (im) { if (im) { ctx.save(); ctx.clip(); ctx.drawImage(im, b.x, b.y, b.w, b.h); ctx.restore(); } return !!im; });
              return Promise.resolve(false);
            }

            function drawSp(sp, rels, tf, layer) {
              var isCxn = sp.nodeName === 'p:cxnSp';
              var ph = isCxn ? null : phOf(sp);
              if (layer !== 's' && ph) return; /* master/layout placeholders only give formatting */
              var spPr = c1(sp, 'p:spPr'), xf = xfrmOf(sp), lph = null, mph = null;
              if (!xf && ph) {
                lph = findPh(D.ld, ph); xf = lph ? xfrmOf(lph) : null;
                if (!xf) { mph = findPh(D.md, ph); xf = mph ? xfrmOf(mph) : null; }
              }
              if (!xf) return;
              var b = boxOf(xf, tf);
              var style = c1(sp, 'p:style');
              var prstEl = spPr ? c1(spPr, 'a:prstGeom') : null, prst = prstEl ? at(prstEl, 'prst', 'rect') : (spPr && c1(spPr, 'a:custGeom') ? 'cust' : 'rect');
              var av = prstEl ? path(prstEl, 'a:avLst', 'a:gd') : null, adj = av ? +(at(av, 'fmla', '').replace(/[^0-9\-]/g, '')) : null;
              var fill = fillStyleOf(spPr, style), ln = lineStyleOf(spPr, style);
              if (!fill && ph) { /* inherit placeholder fill */ var src = lph || findPh(D.ld, ph) || findPh(D.md, ph); if (src) fill = fillStyleOf(c1(src, 'p:spPr'), null); }
              var prom = Promise.resolve();
              if (isCxn || prst === 'line' || prst === 'straightConnector1') {
                withRot(b, function () { if (ln && ln.c) { ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.strokeStyle = css(ln.c); ctx.lineWidth = ln.w; ctx.stroke(); } });
                return;
              }
              withRot(b, function () {
                if (prst !== 'cust') {
                  geomPath(prst, b, adj);
                  prom = applyFill(fill, b, rels).then(function () { if (ln && ln.c) { ctx.strokeStyle = css(ln.c); ctx.lineWidth = ln.w; geomPath(prst, b, adj); ctx.stroke(); } });
                }
              });
              return prom.then(function () {
                var body = c1(sp, 'p:txBody'); if (!body) return;
                return drawText(body, b, ph, lph || (ph ? findPh(D.ld, ph) : null), mph || (ph ? findPh(D.md, ph) : null), style, tf, null);
              });
            }

            function drawPic(pc, rels, tf, layer) {
              var xf = path(pc, 'p:spPr', 'a:xfrm'); if (!xf) return;
              var b = boxOf(xf, tf), bf = c1(pc, 'p:blipFill'), rid = at(path(bf, 'a:blip'), 'r:embed', null);
              if (!rid || !rels[rid]) return;
              var sr = path(bf, 'a:srcRect');
              return getImg(rels[rid].target).then(function (im) {
                if (!im) return;
                var iw = im.naturalWidth || im.width || 1, ih = im.naturalHeight || im.height || 1;
                var l = num(sr, 'l', 0) / 100000, t = num(sr, 't', 0) / 100000, r = num(sr, 'r', 0) / 100000, bt = num(sr, 'b', 0) / 100000;
                var prst = at(path(pc, 'p:spPr', 'a:prstGeom'), 'prst', 'rect');
                withRot(b, function () {
                  if (prst === 'ellipse') { ctx.save(); geomPath('ellipse', b); ctx.clip(); }
                  else if (prst === 'roundRect') { ctx.save(); geomPath('roundRect', b); ctx.clip(); }
                  try { ctx.drawImage(im, iw * l, ih * t, iw * (1 - l - r), ih * (1 - t - bt), b.x, b.y, b.w, b.h); } catch (e) {}
                  if (prst === 'ellipse' || prst === 'roundRect') ctx.restore();
                });
              });
            }

            function drawFrame(gf, rels, tf, layer) {
              var xf = c1(gf, 'p:xfrm'); if (!xf) return;
              var b = boxOf(xf, tf), gd = path(gf, 'a:graphic', 'a:graphicData'), tbl = gd ? c1(gd, 'a:tbl') : null;
              if (!tbl) {
                if (layer !== 's') return;
                ctx.save(); ctx.fillStyle = '#f3f4f6'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#d1d5db'; ctx.setLineDash([6, 4]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
                ctx.fillStyle = '#6b7280'; ctx.font = '600 ' + Math.max(12, Math.min(22, b.h / 8)) + 'px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Chart / diagram', b.x + b.w / 2, b.y + b.h / 2); ctx.restore();
                return;
              }
              var cols = ch(c1(tbl, 'a:tblGrid'), 'a:gridCol').map(function (c) { return num(c, 'w', 0) * tf.sx * K; });
              var rows = ch(tbl, 'a:tr'), y = b.y, hdr = at(c1(tbl, 'a:tblPr'), 'firstRow', '0') === '1', band = at(c1(tbl, 'a:tblPr'), 'bandRow', '0') === '1';
              var hasStyle = !!path(tbl, 'a:tblPr', 'a:tableStyleId');
              var acc = schemeRgb('accent1');
              var p = Promise.resolve();
              rows.forEach(function (tr, ri) {
                var rh = num(tr, 'h', 0) * tf.sy * K, x = b.x;
                ch(tr, 'a:tc').forEach(function (tc, ci) {
                  var cwid = cols[ci] || 0, span = num(tc, 'gridSpan', 1), wtot = cwid;
                  for (var s2 = 1; s2 < span; s2++) wtot += cols[ci + s2] || 0;
                  var xx = x, yy = y, ww = wtot, hh = rh;
                  x += cwid;
                  if (at(tc, 'hMerge', '0') === '1' || at(tc, 'vMerge', '0') === '1') return;
                  p = p.then(function () {
                    var tcPr = c1(tc, 'a:tcPr'), f = tcPr ? c1(tcPr, 'a:solidFill') : null, bgc = null, white = false, bold = false;
                    if (f) bgc = css(clr(ch(f)[0]));
                    else if (hasStyle && hdr && ri === 0) { bgc = css({ c: acc, a: 1 }); white = true; bold = true; }
                    else if (hasStyle && band) { var t = (ri % 2 === 1) ? 0.8 : 0.9; bgc = css({ c: acc.map(function (v) { return Math.round(v + (255 - v) * t); }), a: 1 }); }
                    if (bgc) { ctx.fillStyle = bgc; ctx.fillRect(xx, yy, ww, hh); }
                    ctx.strokeStyle = hasStyle ? '#ffffff' : '#c9ccd1'; ctx.lineWidth = 1; ctx.strokeRect(xx, yy, ww, hh);
                    var body = c1(tc, 'a:txBody'); if (!body) return;
                    return drawText(body, { x: xx, y: yy, w: ww, h: hh, rot: 0, fh: false, fv: false }, null, null, null, null, tf, { dIns: [91440, 45720, 91440, 45720], white: white, bold: bold });
                  });
                });
                y += rh;
              });
              return p;
            }

            /* ---- text ---- */
            function fontStack(face) {
              if (!face || face === '+mn-lt') face = fonts.minor; else if (face === '+mj-lt') face = fonts.major;
              return '"' + face + '", Arial, "Helvetica Neue", Helvetica, sans-serif';
            }
            function drawText(body, b, ph, lph, mph, style, tf, opt) {
              var bodyPr = c1(body, 'a:bodyPr');
              function bp(n, d) { var v = at(bodyPr, n, null); if (v === null && lph) v = at(c1(c1(lph, 'p:txBody'), 'a:bodyPr'), n, null); if (v === null && mph) v = at(c1(c1(mph, 'p:txBody'), 'a:bodyPr'), n, null); return v === null ? d : v; }
              var ins = opt && opt.dIns ? opt.dIns : [91440, 45720, 91440, 45720];
              var lI = num({ getAttribute: function () { return bp('lIns', null); } }, 'x', ins[0]) * K * tf.sx, tI = num({ getAttribute: function () { return bp('tIns', null); } }, 'x', ins[1]) * K * tf.sy,
                rI = num({ getAttribute: function () { return bp('rIns', null); } }, 'x', ins[2]) * K * tf.sx, bI = num({ getAttribute: function () { return bp('bIns', null); } }, 'x', ins[3]) * K * tf.sy;
              if (bp('vert', 'horz') !== 'horz') return;
              var anchor = bp('anchor', opt ? 'ctr' : 't'), wrapOn = bp('wrap', 'square') !== 'none';
              var af = c1(bodyPr, 'a:normAutofit'), fscale = af ? num(af, 'fontScale', 100000) / 100000 : 1;
              var lsr = af ? num(af, 'lnSpcReduction', 0) / 100000 : 0;
              var lstChain = []; /* lowest priority first */
              var base = styleFor(ph); if (base) lstChain.push(base);
              if (mph) lstChain.push(c1(c1(mph, 'p:txBody'), 'a:lstStyle'));
              if (lph) lstChain.push(c1(c1(lph, 'p:txBody'), 'a:lstStyle'));
              lstChain.push(c1(body, 'a:lstStyle'));
              lstChain = lstChain.filter(Boolean);
              var fr = style ? c1(style, 'a:fontRef') : null, fontRefClr = fr ? colorIn(fr) : null;
              var phColor = null;
              function lvlNodes(l) { return lstChain.slice().reverse().map(function (lst) { return lvlOf(lst, l); }).filter(Boolean); }
              function firstAttr(nodes, name) { for (var i = 0; i < nodes.length; i++) { var v = at(nodes[i], name, null); if (v !== null) return v; } return null; }

              var paras = ch(body, 'a:p'), laid = [], totalH = 0, availW = Math.max(10, b.w - lI - rI);
              var numCount = {};
              paras.forEach(function (p) {
                var pPr = c1(p, 'a:pPr'), lvl = num(pPr, 'lvl', 0), pn = lvlNodes(lvl);
                var pnAll = (pPr ? [pPr] : []).concat(pn);
                var marL = +(firstAttr(pnAll, 'marL') || 0) * K * tf.sx, indent = +(firstAttr(pnAll, 'indent') || 0) * K * tf.sx, algn = firstAttr(pnAll, 'algn') || 'l';
                var dr = pn.map(function (n) { return c1(n, 'a:defRPr'); }).filter(Boolean);
                /* bullet */
                var bu = null;
                for (var i = 0; i < pnAll.length && !bu; i++) {
                  var n0 = pnAll[i];
                  if (c1(n0, 'a:buNone')) bu = { none: true };
                  else if (c1(n0, 'a:buChar')) bu = { ch: at(c1(n0, 'a:buChar'), 'char', '•') };
                  else if (c1(n0, 'a:buAutoNum')) bu = { auto: at(c1(n0, 'a:buAutoNum'), 'type', 'arabicPeriod'), start: num(c1(n0, 'a:buAutoNum'), 'startAt', 1) };
                }
                if (bu && bu.none) bu = null;
                /* line spacing */
                var ls = 1, sb = 0;
                for (var j = 0; j < pnAll.length; j++) { var lsp = path(pnAll[j], 'a:lnSpc', 'a:spcPct'); if (lsp) { ls = num(lsp, 'val', 100000) / 100000; break; } }
                ls = Math.max(0.6, ls - lsr);
                var toks = [], maxSz = 0;
                function runProps(rPr) {
                  var nodes = (rPr ? [rPr] : []).concat(dr);
                  var szv = firstAttr(nodes, 'sz'), sz = szv ? +szv / 100 : 18;
                  var o = { sz: sz * 12700 * K * fscale * (opt && opt.small ? 0.8 : 1), b: (firstAttr(nodes, 'b') === '1') || !!(opt && opt.bold), i: firstAttr(nodes, 'i') === '1', cap: firstAttr(nodes, 'cap') === 'all', sup: +(firstAttr(nodes, 'baseline') || 0) > 0, u: (firstAttr(nodes, 'u') || 'none') !== 'none' };
                  var face = null, col = null;
                  for (var k = 0; k < nodes.length; k++) {
                    if (!face) { var lt = c1(nodes[k], 'a:latin'); if (lt) face = at(lt, 'typeface', null); }
                  }
                  var sfx = rPr ? c1(rPr, 'a:solidFill') : null;
                  if (sfx) col = clr(ch(sfx)[0], phColor);
                  if (!col) col = fontRefClr;
                  if (!col && opt && opt.white) col = { c: [255, 255, 255], a: 1 };
                  for (var k2 = 0; k2 < nodes.length && !col; k2++) { var sf = c1(nodes[k2], 'a:solidFill'); if (sf) col = clr(ch(sf)[0], phColor); }
                  if (!col) col = { c: schemeRgb('tx1'), a: 1 };
                  o.face = face || (ph && /title/i.test(at(ph, 'type', '')) ? '+mj-lt' : '+mn-lt'); o.col = css(col);
                  if (o.sup) o.sz *= 0.65;
                  return o;
                }
                ch(p).forEach(function (n) {
                  var k = n.nodeName;
                  if (k === 'a:r' || k === 'a:fld') {
                    var t = (c1(n, 'a:t') || {}).textContent || '', pr = runProps(c1(n, 'a:rPr'));
                    if (pr.cap) t = t.toUpperCase();
                    maxSz = Math.max(maxSz, pr.sz);
                    t.split(/(\s+)/).forEach(function (w) { if (w !== '') toks.push({ t: w, p: pr, sp: /^\s+$/.test(w) }); });
                  } else if (k === 'a:br') { var pr2 = runProps(c1(n, 'a:rPr')); maxSz = Math.max(maxSz, pr2.sz); toks.push({ br: true, p: pr2 }); }
                });
                if (!maxSz) { var ep = runProps(c1(p, 'a:endParaRPr')); maxSz = ep.sz; }
                var bulletTxt = null, bulletP = null;
                if (bu && toks.some(function (t) { return !t.sp && !t.br; })) {
                  bulletP = toks.filter(function (t) { return t.p; })[0].p;
                  if (bu.auto) { numCount[lvl] = (numCount[lvl] || (bu.start - 1)) + 1; bulletTxt = numCount[lvl] + (/Period/.test(bu.auto) ? '.' : ')'); }
                  else { bulletTxt = bu.ch === '§' || bu.ch === 'Ø' || bu.ch === 'q' ? '•' : bu.ch; }
                } else if (!bu) { numCount[lvl] = 0; }
                /* wrap */
                var startX = marL + (bu ? 0 : indent), hang = marL, lineList = [], line = { items: [], w: 0, h: 0 }, x0 = bu ? marL : startX;
                function pushLine(last) { lineList.push(line); line = { items: [], w: 0, h: 0 }; }
                var curX = x0;
                var firstLine = true;
                var lineLimit = function () { return availW - (firstLine ? (bu ? marL : startX) : hang); };
                toks.forEach(function (t) {
                  if (t.br) { line.h = Math.max(line.h, t.p.sz); pushLine(); firstLine = false; return; }
                  ctx.font = (t.p.i ? 'italic ' : '') + (t.p.b ? 'bold ' : '') + Math.max(1, t.p.sz) + 'px ' + fontStack(t.p.face);
                  var w = ctx.measureText(t.t).width;
                  if (wrapOn && !t.sp && line.w + w > lineLimit() && line.items.some(function (q) { return !q.sp; })) {
                    while (line.items.length && line.items[line.items.length - 1].sp) { var rm = line.items.pop(); line.w -= rm.w; }
                    pushLine(); firstLine = false;
                  }
                  if (t.sp && !line.items.length && !firstLine) return;
                  line.items.push({ t: t.t, p: t.p, w: w, sp: t.sp }); line.w += w; line.h = Math.max(line.h, t.p.sz);
                });
                pushLine();
                var spcB = 0;
                for (var j2 = 0; j2 < pnAll.length; j2++) { var sbn = c1(pnAll[j2], 'a:spcBef'); if (sbn) { var sp1 = c1(sbn, 'a:spcPts'), sp2 = c1(sbn, 'a:spcPct'); spcB = sp1 ? num(sp1, 'val', 0) / 100 * 12700 * K : sp2 ? num(sp2, 'val', 0) / 100000 * maxSz * 1.2 : 0; break; } }
                var spcA = 0;
                for (var j3 = 0; j3 < pnAll.length; j3++) { var san = c1(pnAll[j3], 'a:spcAft'); if (san) { var sa1 = c1(san, 'a:spcPts'), sa2 = c1(san, 'a:spcPct'); spcA = sa1 ? num(sa1, 'val', 0) / 100 * 12700 * K * fscale : sa2 ? num(sa2, 'val', 0) / 100000 * maxSz * 1.2 : 0; break; } }
                var h = 0; lineList.forEach(function (l) { l.h = l.h || maxSz; h += l.h * 1.2 * ls; });
                laid.push({ lines: lineList, marL: marL, indent: indent, algn: algn, bullet: bulletTxt, bp: bulletP, spcB: spcB, spcA: spcA, ls: ls, h: h, text: toks.filter(function (t) { return !t.br; }).map(function (t) { return t.t; }).join('') });
                totalH += h + (laid.length > 1 ? spcB : 0) + spcA;
              });
              var inner = b.h - tI - bI, y0 = b.y + tI;
              if (anchor === 'ctr') y0 += (inner - totalH) / 2; else if (anchor === 'b') y0 += inner - totalH;
              var drawH = function () {
                var y = y0, pidLocal = [];
                laid.forEach(function (P, pi) {
                  if (pi > 0) y += P.spcB;
                  var id = (++pid), ptxt = P.text.replace(/\s+/g, ' ').trim();
                  if (ptxt) { lines[id] = ptxt; enParts.push(ptxt); }
                  P.lines.forEach(function (L, li) {
                    var lead = li === 0 ? (P.bullet ? P.marL + P.indent : P.marL + P.indent) : P.marL;
                    var contentStart = (li === 0 && !P.bullet) ? P.marL + P.indent : P.marL;
                    var lw = L.items.reduce(function (a, q) { return a + q.w; }, 0);
                    var avail = availW - contentStart, off = 0, extra = 0;
                    if (P.algn === 'ctr') off = (avail - lw) / 2; else if (P.algn === 'r') off = avail - lw;
                    else if (P.algn === 'just' && li < P.lines.length - 1) { var nsp = L.items.filter(function (q) { return q.sp; }).length; if (nsp && avail > lw) extra = (avail - lw) / nsp; }
                    var x = b.x + lI + contentStart + Math.max(0, off), lh = L.h * 1.2, lhs = lh * P.ls, baseY = y + lhs - L.h * 0.2;
                    if (li === 0 && P.bullet && P.bp) {
                      ctx.font = Math.max(1, P.bp.sz) + 'px ' + fontStack(P.bp.face); ctx.fillStyle = P.bp.col; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
                      ctx.save(); if (b.rot || b.fh || b.fv) { } ctx.fillText(P.bullet, b.x + lI + P.marL + P.indent, baseY); ctx.restore();
                    }
                    L.items.forEach(function (q) {
                      if (!q.sp) {
                        ctx.font = (q.p.i ? 'italic ' : '') + (q.p.b ? 'bold ' : '') + Math.max(1, q.p.sz) + 'px ' + fontStack(q.p.face); ctx.fillStyle = q.p.col; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
                        ctx.fillText(q.t, x, q.p.sup ? baseY - q.p.sz * 0.6 : baseY);
                        if (q.p.u) { ctx.fillRect(x, baseY + q.p.sz * 0.1, q.w, Math.max(1, q.p.sz * 0.06)); }
                        if (!b.rot && !b.fh && !b.fv) { var rec = wordRec(q.t, x, baseY - L.h * 0.95, q.w, lh, W, H, id); if (rec) hot.push(rec); }
                      }
                      x += q.w + (q.sp ? extra : 0);
                    });
                    y += lhs;
                  });
                  y += P.spcA;
                });
              };
              if (b.rot || b.fh || b.fv) { ctx.save(); withRot(b, drawH); ctx.restore(); } else drawH();
              return Promise.resolve();
            }

            /* ---- queue it all up: master shapes, layout shapes, then slide ---- */
            var ID = { sx: 1, sy: 1, ox: 0, oy: 0 };
            var showM = D.ld ? at(D.ld.documentElement, 'showMasterSp', '1') !== '0' : true;
            if (D.md && showM) walk(path(D.md.documentElement, 'p:cSld', 'p:spTree'), D.mrels, ID, 'm');
            if (D.ld) walk(path(D.ld.documentElement, 'p:cSld', 'p:spTree'), D.lrels, ID, 'l');
            walk(path(D.sd.documentElement, 'p:cSld', 'p:spTree'), D.srels, ID, 's');
            return chain.then(function () { return canvasBlob(canvas, 0.85); }).then(function (blob) {
              /* reading order: top-to-bottom handled by drawing order */
              return { img: URL.createObjectURL(blob), ar: W / H, hot: hot, lines: lines, tr: {}, terms: {}, en: enParts.join('\n') };
            });
          }
        });
      });
    });
  };

  TZ.parse = function (file, onProg) {
    return file.arrayBuffer().then(function (buf) {
      if (/\.pdf$/i.test(file.name)) return TZ.parsePdf(buf, onProg);
      if (/\.pptx$/i.test(file.name)) return TZ.parsePptx(buf, onProg);
      throw new Error('type');
    });
  };
  TZ.parseBuffer = function (buf, name, onProg) {
    if (/\.pdf$/i.test(name)) return TZ.parsePdf(buf, onProg);
    if (/\.pptx$/i.test(name)) return TZ.parsePptx(buf, onProg);
    return Promise.reject(new Error('type'));
  };
  TZ._h = { wordRec: wordRec, needZip: needZip, canvasBlob: canvasBlob, clamp: clamp };
})();
