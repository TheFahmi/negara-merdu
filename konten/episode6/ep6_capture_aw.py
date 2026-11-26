#!/usr/bin/env python3
"""Capture Episode 6 Negara Merdu di ALIENWARE — resep Episode 5 vs3.

- Chrome headless GPU (profil ep6cap-profile, port 9333) di Alienware.
- Kamera digerakkan ANIMATOR rAF di dalam halaman: wrapper render renderer
  utama menimpa posisi kamera dari jadwal leg (smoothstep) tiap frame.
- Screencast mengalir bebas; semua frame disimpan + timestamp (meta.json).
- Kota UTUH: tanpa bedah/pangkas, bayangan aktif, kualitas 'tinggi'.
- TANPA minterpolate / setpts di rakit — resample nearest-timestamp saja.
PROBE=1 -> tiap segmen dipangkas 4 dtk (cek komposisi awal/tengah/akhir).
Jalan di Alienware: python.exe ep6_capture_aw.py
"""
import base64, json, os, sys, time, urllib.request
import websocket

CDP = "http://127.0.0.1:9333"
BASE = r"C:\Users\alienware\ep6cap"
OUTDIR = os.path.join(BASE, os.environ.get("EP6_OUT", "frames").strip())
os.makedirs(OUTDIR, exist_ok=True)
LOG = open(os.path.join(BASE, "capture.log"), "a", buffering=1)
PROBE = bool(os.environ.get("PROBE"))
CFG = json.load(open(os.path.join(BASE, os.environ.get("EP6_CFG", "blocks.json").strip())))
SEGS = [s.strip() for s in os.environ.get("EP6_SEGS", "d1,a1,a2,k1,v1,p1").split(",")]
META_NAME = os.environ.get("EP6_META", "meta.json").strip()


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=LOG, flush=True)
    print(time.strftime("%H:%M:%S"), *a, flush=True)


SISIPAN = (
    "\n;(function(){try{"
    "try{localStorage.setItem('pinarak_kualitas','tinggi');}catch(e){}"
    "window.__renderers=[];window.__fc=0;window.__errs=[];"
    "window.__anim={legs:[],t0:0,aktif:false};"
    "window.__setLegs=function(legs){window.__anim.legs=legs||[];};"
    "window.__startAnim=function(){window.__anim.t0=performance.now();window.__anim.aktif=true;};"
    "window.__stopAnim=function(){window.__anim.aktif=false;};"
    "function posePada(t){var legs=window.__anim.legs;if(!legs.length)return null;"
    "  for(var i=0;i<legs.length;i++){var L=legs[i];"
    "    if(t<=L.t1||i===legs.length-1){var u=(t-L.t0)/Math.max(0.001,(L.t1-L.t0));"
    "      u=Math.max(0,Math.min(1,u));u=u*u*(3-2*u);"
    "      return {p:[L.p1[0]+(L.p2[0]-L.p1[0])*u,L.p1[1]+(L.p2[1]-L.p1[1])*u,L.p1[2]+(L.p2[2]-L.p1[2])*u],"
    "              l:[L.l1[0]+(L.l2[0]-L.l1[0])*u,L.l1[1]+(L.l2[1]-L.l1[1])*u,L.l1[2]+(L.l2[2]-L.l1[2])*u]};}}"
    "  return null;}"
    "var NS=window.THREE;"
    "if(NS&&NS.WebGLRenderer){"
    "  var A=NS.WebGLRenderer;"
    "  function B(){var r=Reflect.construct(A,arguments);"
    "    var idx=window.__renderers.length;window.__renderers.push(r);"
    "    if(idx===0){var ro=r.render.bind(r);"
    "      r.render=function(scene,camera){"
    "        try{if(window.__anim.aktif&&camera){var t=(performance.now()-window.__anim.t0)/1000;"
    "          var ps=posePada(t);if(ps){camera.position.set(ps.p[0],ps.p[1],ps.p[2]);camera.lookAt(ps.l[0],ps.l[1],ps.l[2]);}}}catch(e){}"
    "        var out=ro(scene,camera);window.__fc++;return out;};}"
    "    return r;}"
    "  B.prototype=A.prototype;Object.setPrototypeOf(B,A);"
    "  NS.WebGLRenderer=B;window.__sisipanAktif=true;"
    "}"
    "}catch(e){(window.__errKumpul=window.__errKumpul||[]).push('sisipan: '+e.message);}})();\n"
)

CSS_HOOK = r"""
(() => {
  const css = '#hud,#gerbang,#muat,#kartu,[id$="-overlay"]{display:none!important}';
  const pasang = () => {
    if (document.getElementById('gaya-syuting')) return;
    const st = document.createElement('style'); st.id = 'gaya-syuting';
    st.textContent = css; (document.head || document.documentElement).appendChild(st);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
  return 'css-ok';
})()
"""

STAGE = r"""
JSON.stringify((() => {
  const km = window.__kotaMassal;
  let scene = km.grup; while (scene.parent) scene = scene.parent;
  const v = new THREE.Vector3();
  const grups = [];
  scene.traverse((o) => {
    if (o.isGroup) {
      let mesh = 0; o.traverse((d) => { if (d.isMesh) mesh++; });
      if (mesh >= 45 && mesh <= 75) {
        o.getWorldPosition(v);
        if (Math.abs(v.y) < 3 && Math.abs(v.x) < 500 && Math.abs(v.z) < 500) grups.push({ o, x: v.x, z: v.z });
      }
    }
  });
  grups.sort((a, b) => (Math.hypot(a.x - 4.6, a.z + 16.6)) - (Math.hypot(b.x - 4.6, b.z + 16.6)));
  const sumberPres = grups[0];
  const pool = grups.slice(1, 12);
  const buatKlon = (src) => {
    const k = src.o.clone(true);
    k.traverse((d) => { if (d.isSprite) d.visible = false; });
    scene.add(k);
    return k;
  };
  const pentas = { warga: [], presiden: buatKlon(sumberPres) };
  for (let i = 0; i < 6; i++) if (pool[i]) pentas.warga.push(buatKlon(pool[i]));
  window.__pentas = pentas;
  const set = (k, x, z, ry) => { if (!k) return; k.position.set(x, 0, z); k.rotation.y = ry; k.visible = true; };
  set(pentas.presiden, -26, 166.5, 0.25);
  const posW = [[-44, 168, -0.2], [-37, 169.5, 0.1], [-18, 168.5, -0.35], [-48, 165, 0.5], [-13, 165.5, -0.5], [-31, 171, 0]];
  pentas.warga.forEach((k, i) => set(k, posW[i][0], posW[i][1], posW[i][2]));
  return { nGrup: grups.length, warga: pentas.warga.length };
})())
"""

STAGE5 = r"""
JSON.stringify((() => {
  const km = window.__kotaMassal;
  let scene = km.grup; while (scene.parent) scene = scene.parent;
  const v = new THREE.Vector3();
  const grups = [];
  scene.traverse((o) => {
    if (o.isGroup) {
      let mesh = 0; o.traverse((d) => { if (d.isMesh) mesh++; });
      if (mesh >= 45 && mesh <= 75) {
        o.getWorldPosition(v);
        if (Math.abs(v.y) < 3 && Math.abs(v.x) < 500 && Math.abs(v.z) < 500) grups.push({ o, x: v.x, z: v.z });
      }
    }
  });
  grups.sort((a, b) => (Math.hypot(a.x - 4.6, a.z + 16.6)) - (Math.hypot(b.x - 4.6, b.z + 16.6)));
  const sumberPres = grups[0];
  const pool = grups.slice(1, 12);
  const buatKlon = (src) => {
    const k = src.o.clone(true);
    k.traverse((d) => { if (d.isSprite) d.visible = false; });
    scene.add(k);
    return k;
  };
  const pentas = { warga: [], presiden: buatKlon(sumberPres) };
  for (let i = 0; i < 6; i++) if (pool[i]) pentas.warga.push(buatKlon(pool[i]));
  window.__pentas5 = pentas;
  const set = (k, x, z, ry) => { if (!k) return; k.position.set(x, 0, z); k.rotation.y = ry; k.visible = true; };
  set(pentas.presiden, 0, 14, 3.14);
  const posW = [[-7, 22, 2.8], [6, 23, -2.9], [-13, 19, 2.4], [12, 18, -2.5], [-3, 27, 3.0], [9, 28, -3.1]];
  pentas.warga.forEach((k, i) => set(k, posW[i][0], posW[i][1], posW[i][2]));
  return { nGrup: grups.length, warga: pentas.warga.length };
})())
"""

# ---------- koneksi ----------
try:
    for t in json.load(urllib.request.urlopen(CDP + "/json/list", timeout=10)):
        if t.get("type") == "page" and ("merdu.id" in t.get("url", "") or "pinarak" in t.get("url", "")):
            urllib.request.urlopen(CDP + "/json/close/" + t["id"], timeout=10)
            log("tab lama ditutup:", t["id"][:8])
    time.sleep(1)
except Exception as e:
    log("tutup tab lama gagal:", str(e)[:100])

req = urllib.request.Request(CDP + "/json/new?about:blank", method="PUT")
tab = json.load(urllib.request.urlopen(req, timeout=15))
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30, suppress_origin=True)
mid = 0
menunggu = {}
meta = []
seg_now = [None]
seg_t0 = [0.0]
seg_count = {}


def pompa(batas=0.2):
    ws.settimeout(batas)
    t0 = time.time()
    while True:
        try:
            m = json.loads(ws.recv())
        except Exception:
            return
        meth = m.get("method")
        if meth == "Fetch.requestPaused":
            tangani_fetch(m["params"])
        elif meth == "Page.screencastFrame":
            tangani_frame(m["params"])
        elif "id" in m:
            menunggu[m["id"]] = m
        if time.time() - t0 >= batas:
            return


def kirim(method, params):
    global mid
    mid += 1
    ws.send(json.dumps({"id": mid, "method": method, "params": params}))
    return mid


def tunggu(mid_target, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if mid_target in menunggu:
            return menunggu.pop(mid_target)
        pompa(0.5)
    raise TimeoutError("tunggu " + str(mid_target))


def tangani_fetch(p):
    rid = p["requestId"]
    url = p.get("request", {}).get("url", "")
    resp = tunggu(kirim("Fetch.getResponseBody", {"requestId": rid}))
    r = resp.get("result", {})
    body = r.get("body", "")
    if r.get("base64Encoded"):
        body = base64.b64decode(body).decode("utf-8", "replace")
    headers = [{"name": h["name"], "value": h["value"]} for h in p.get("responseHeaders", [])
               if h["name"].lower() not in ("content-length",)]
    if "three.min.js" in url:
        body = body + SISIPAN
        log("FETCH: three.min.js disisipi animator")
    tunggu(kirim("Fetch.fulfillRequest", {
        "requestId": rid,
        "responseCode": p.get("responseStatusCode", 200),
        "responseHeaders": headers,
        "body": base64.b64encode(body.encode()).decode(),
    }))


def tangani_frame(p):
    seg = seg_now[0]
    kirim("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
    if seg is None:
        return
    idx = seg_count.get(seg, 0)
    seg_count[seg] = idx + 1
    data = base64.b64decode(p["data"])
    with open(os.path.join(OUTDIR, "%s_%04d.jpg" % (seg, idx)), "wb") as fh:
        fh.write(data)
    meta.append([seg, idx, round(time.time() - seg_t0[0], 3), p["metadata"]["timestamp"]])


def cmd(method, **params):
    return tunggu(kirim(method, params))


def ev(expr, await_promise=False):
    r = cmd("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=await_promise)
    res = r.get("result", {})
    if "exceptionDetails" in res:
        return "EXC: " + str(res["exceptionDetails"].get("exception", {}).get("description", res["exceptionDetails"].get("text")))[:250]
    return res.get("result", {}).get("value")


cmd("Runtime.enable")
cmd("Page.enable")
cmd("Fetch.enable", patterns=[{"urlPattern": "*three.min.js*", "requestStage": "Response"}])
cmd("Emulation.setDeviceMetricsOverride", width=720, height=1280, deviceScaleFactor=1, mobile=False)
log("navigasi...")
cmd("Page.navigate", url="https://merdu.id/")


def tunggu_kota(timeout=420):
    t0 = time.time()
    s = None
    while time.time() - t0 < timeout:
        time.sleep(2)
        s = ev("JSON.stringify({km: !!window.__kotaMassal, fc: window.__fc || 0, sisip: !!window.__sisipanAktif})")
        try:
            d = json.loads(s)
        except Exception:
            d = {}
        if d.get("km") and d.get("fc", 0) > 5:
            log("kota siap:", s)
            return True
        if int(time.time() - t0) % 30 < 3:
            log("  tunggu kota:", s)
    log("TIMEOUT tunggu kota:", s)
    return False


if not tunggu_kota():
    sys.exit(1)

gl = ev("(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');"
        "const e=g.getExtension('WEBGL_debug_renderer_info');"
        "return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()")
log("WEBGL_RENDERER:", gl)
ev(CSS_HOOK)
log("stage:", ev(STAGE))

cmd("Page.startScreencast", format="jpeg", quality=88, maxWidth=720, maxHeight=1280, everyNthFrame=1)
pompa(1.0)


def jalankan_segmen(seg):
    spec = CFG[seg]
    dur = 4.0 if PROBE else float(spec["dur"])
    legs = []
    for (p1, l1, p2, l2, f0, f1) in spec["legs"]:
        legs.append({"t0": f0 * dur, "t1": f1 * dur, "p1": p1, "l1": l1, "p2": p2, "l2": l2})
    ev("window.__setLegs(%s)" % json.dumps(legs))
    ev("window.__startAnim()")
    seg_t0[0] = time.time()
    seg_now[0] = seg  # tag SETELAH animator jalan (hindari frame view default)
    while time.time() - seg_t0[0] < dur:
        pompa(0.25)
    seg_now[0] = None  # berhenti tag SEBELUM animator berhenti
    ev("window.__stopAnim()")
    pompa(0.3)
    log("%s selesai: %d frame" % (seg, seg_count.get(seg, 0)))


for seg in SEGS:
    if seg == "v1":
        log("stage5:", ev(STAGE5))
        jalankan_segmen("v1")
    elif seg == "p1":
        # ---------- fase senja: penutup ----------
        ev("localStorage.setItem('pinarak_waktu','senja')")
        try:
            cmd("Page.stopScreencast")
        except Exception:
            pass
        cmd("Page.reload")
        if not tunggu_kota():
            sys.exit(3)
        ev(CSS_HOOK)
        cmd("Page.startScreencast", format="jpeg", quality=88, maxWidth=720, maxHeight=1280, everyNthFrame=1)
        pompa(1.0)
        jalankan_segmen("p1")
    else:
        jalankan_segmen(seg)

try:
    cmd("Page.stopScreencast")
except Exception:
    pass
json.dump(meta, open(os.path.join(BASE, META_NAME), "w"))
try:
    urllib.request.urlopen(CDP + "/json/close/" + tab["id"], timeout=10)
except Exception:
    pass
print("CAPTURE_DONE", json.dumps(seg_count))
log("CAPTURE_DONE", json.dumps(seg_count))
