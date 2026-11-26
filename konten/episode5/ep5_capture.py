#!/usr/bin/env python3
"""Syuting TEASER APARTEMEN Negara Merdu — adaptasi rig drama_capture.py.

Fase A (status live): drone ke lahan Blok 2120 + pengumuman Presiden.
Fase B (visualisasi): response /api/pembangunan di-intercept SISI KLIEN,
status apartemen dibalik "terbangun" -> model Residensia 10 berdiri.
Server TIDAK diubah. Fase C: sama + waktu senja.
PROBE=1 -> tiap leg hanya 3 frame (cek komposisi).
"""
import base64, json, math, os, sys, time, urllib.request
import websocket

URL = "https://merdu.id/"
DIR = "/root/ep5/frames"
os.makedirs(DIR, exist_ok=True)
LOG = open("/root/ep5/capture.log", "a", buffering=1)
PROBE = bool(os.environ.get("PROBE"))
FLIP_APT = [False]  # dibaca handler fetch saat runtime


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=LOG, flush=True)
    print(time.strftime("%H:%M:%S"), *a, flush=True)


SISIPAN = (
    "\n;(function(){try{"
    "try{localStorage.setItem('pinarak_kualitas','tinggi');}catch(e){}"
    "window.__renderers=[];window.__fc=0;window.__shot=null;window.__errs=[];"
    "var NS=window.THREE;"
    "if(NS&&NS.WebGLRenderer){"
    "  var A=NS.WebGLRenderer;"
    "  function B(){var r=Reflect.construct(A,arguments);"
    "    var idx=window.__renderers.length;window.__renderers.push(r);"
    "    if(idx===0){var ro=r.render.bind(r);"
    "      r.render=function(scene,camera){"
    "        try{var s=window.__shot;if(s&&camera){camera.position.set(s.px,s.py,s.pz);camera.lookAt(s.lx,s.ly,s.lz);}}catch(e){}"
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
})();
"""

BEDAH = r"""
JSON.stringify((() => {
  const km = window.__kotaMassal;
  let scene = km.grup; while (scene.parent) scene = scene.parent;
  scene.traverse((o) => { if (o.isDirectionalLight) o.castShadow = false; });
  const r = window.__renderers[0];
  r.shadowMap.enabled = false;
  scene.traverse((o) => {
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
  });
  let dipangkas = 0;
  km.grup.traverse((o) => {
    if (!o.isInstancedMesh) return;
    const g = o.geometry;
    const tris = Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
    const c = o.count;
    let f = null;
    if (tris === 40 && c > 7000) f = 0.05;
    else if (tris === 12 && c > 100000) f = 0.05;
    else if (tris === 48 && c > 10000) f = 0.10;
    else if (tris === 72 && c > 20000) f = 0.20;
    else if (tris === 20 && c > 30000) f = 0.1;
    else if ((tris === 24 || tris === 20) && c > 13000 && c < 15000) f = 0.25;
    if (f) { o.count = Math.floor(c * f); dipangkas++; }
  });
  return { dipangkas, tris: r.info.render.triangles };
})())
"""

# ---------- koneksi ----------
try:
    for t in json.load(urllib.request.urlopen("http://127.0.0.1:9223/json/list", timeout=10)):
        if t.get("type") == "page" and ("pinarak" in t.get("url", "") or "merdu.id" in t.get("url", "")):
            urllib.request.urlopen("http://127.0.0.1:9223/json/close/" + t["id"], timeout=10)
            log("tab lama ditutup:", t["id"][:8])
    time.sleep(1)
except Exception as e:
    log("tutup tab lama gagal:", str(e)[:100])

req = urllib.request.Request("http://127.0.0.1:9223/json/new?about:blank", method="PUT")
tab = json.load(urllib.request.urlopen(req, timeout=15))
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=900, suppress_origin=True)
mid = 0
antrean_frame = []
menunggu = {}


def pompa(batas=0.2):
    ws.settimeout(batas)
    t0 = time.time()
    while True:
        try:
            m = json.loads(ws.recv())
        except Exception:
            return
        meth = m.get("method")
        if meth == "Page.screencastFrame":
            p = m["params"]
            antrean_frame.append(p)
            try:
                ws.send(json.dumps({"id": 0, "method": "Page.screencastFrameAck",
                                    "params": {"sessionId": p["sessionId"]}}))
            except Exception:
                pass
        elif meth == "Fetch.requestPaused":
            tangani_fetch(m["params"])
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
        body2 = body + SISIPAN
        log("FETCH: three.min.js disisipi")
    elif "api/pembangunan" in url and FLIP_APT[0]:
        try:
            d = json.loads(body)
            for f in d.get("fasilitas", []):
                if f.get("kunci") == "apartemen":
                    f["status"] = "terbangun"
            body2 = json.dumps(d)
            log("FETCH: pembangunan DIBALIK (apartemen terbangun, sisi klien)")
        except Exception as e:
            body2 = body
            log("FETCH: flip gagal:", str(e)[:100])
    else:
        body2 = body
    tunggu(kirim("Fetch.fulfillRequest", {
        "requestId": rid,
        "responseCode": p.get("responseStatusCode", 200),
        "responseHeaders": headers,
        "body": base64.b64encode(body2.encode()).decode(),
    }))


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
cmd("Fetch.enable", patterns=[{"urlPattern": "*three.min.js*", "requestStage": "Response"},
                              {"urlPattern": "*api/pembangunan*", "requestStage": "Response"}])
cmd("Emulation.setDeviceMetricsOverride", width=640, height=1138, deviceScaleFactor=1, mobile=False)
try:
    cmd("Emulation.setFocusEmulationEnabled", enabled=True)
except Exception:
    pass
cmd("Page.addScriptToEvaluateOnNewDocument", source=CSS_HOOK)
log("navigasi...")
cmd("Page.navigate", url=URL)


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
        if d.get("km"):
            log("kota siap:", s)
            return True
        if int(time.time() - t0) % 30 < 3:
            log("  tunggu kota:", s)
    log("TIMEOUT tunggu kota:", s)
    return False


if not tunggu_kota():
    sys.exit(1)
log("bedah:", ev(BEDAH))

# ---------- screencast ----------
def mulai_cast():
    cmd("Page.startScreencast", format="jpeg", quality=82, maxWidth=640, maxHeight=1138, everyNthFrame=1)
    time.sleep(1)
    pompa(2)
    antrean_frame.clear()
    log("screencast jalan")


def stop_cast():
    try:
        cmd("Page.stopScreencast")
    except Exception:
        pass


def set_shot(p, l):
    ev("window.__shot = {px:%r, py:%r, pz:%r, lx:%r, ly:%r, lz:%r}" % (p[0], p[1], p[2], l[0], l[1], l[2]))


def ambil_frame(timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if antrean_frame:
            return antrean_frame.pop(0)
        pompa(0.4)
    return None


def tangkap(seg, i):
    antrean_frame.clear()
    f = ambil_frame()
    if f is None:
        log("SHOT GAGAL (screencast diam)", seg, i)
        return 0
    path = os.path.join(DIR, "%s_%04d.jpg" % (seg, i))
    with open(path, "wb") as fh:
        fh.write(base64.b64decode(f["data"]))
    return os.path.getsize(path)


def smooth(u):
    return u * u * (3 - 2 * u)


def lerp(a, b, u):
    return a + (b - a) * u


def leg(seg, i0, p1, l1, p2, l2, n):
    if PROBE:
        n = 3
    tot = 0
    t0 = time.time()
    for j in range(n):
        u = smooth(j / max(1, n - 1))
        p = tuple(lerp(p1[k], p2[k], u) for k in range(3))
        l = tuple(lerp(l1[k], l2[k], u) for k in range(3))
        set_shot(p, l)
        tot += tangkap(seg, i0 + j)
        if j % 20 == 19:
            log("  %s %d/%d (%.2f dtk/frame)" % (seg, j + 1, n, (time.time() - t0) / (j + 1)))
    log("%s leg selesai: %d frame, %.2f MB, %.2f dtk/frame" % (seg, n, tot / 1e6, (time.time() - t0) / max(1, n)))
    return i0 + n


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
  // Blok 2120: pusat (-35,133); papan nama di z=160; pentas di tepi selatan lahan.
  const set = (k, x, z, ry) => { if (!k) return; k.position.set(x, 0, z); k.rotation.y = ry; k.visible = true; };
  set(pentas.presiden, -26, 166.5, 0.25);
  const posW = [[-44, 168, -0.2], [-37, 169.5, 0.1], [-18, 168.5, -0.35], [-48, 165, 0.5], [-13, 165.5, -0.5], [-31, 171, 0]];
  pentas.warga.forEach((k, i) => set(k, posW[i][0], posW[i][1], posW[i][2]));
  return { nGrup: grups.length, warga: pentas.warga.length };
})())
"""
log("stage:", ev(STAGE))
mulai_cast()

# ---------- D1: drone pembuka -> Blok 1881 ----------
i = leg("d1", 0, (560, 260, 420), (0, 0, -60), (170, 90, -40), (40, 4, -126), 10)
i = leg("d1", i, (170, 90, -40), (40, 4, -126), (30, 26, -62), (46, 3, -124), 8)
log("d1 selesai")

# ---------- A1: absen #35-37 — glide sepanjang baris kav 10-12 ----------
i = leg("a1", 0, (-16, 4.2, -96), (30, 2.5, -126), (52, 4.2, -94), (52, 2.5, -122), 24)
log("a1 selesai")

# ---------- A2: absen #38-40 — lanjut kav 13-15 lalu naik ----------
i = leg("a2", 0, (52, 4.2, -94), (58, 2.5, -121), (104, 7, -88), (70, 3, -120), 20)
log("a2 selesai")

# ---------- K1: masjid 2285 lalu lahan apartemen 2120 ----------
i = leg("k1", 0, (300, 42, 380), (378, 14, 294), (428, 26, 330), (378, 12, 294), 12)
i = leg("k1", i, (428, 26, 330), (378, 12, 294), (60, 60, 260), (-35, 6, 133), 8)
i = leg("k1", i, (60, 60, 260), (-35, 6, 133), (-30, 22, 226), (-35, 5, 136), 6)
log("k1 selesai")
stop_cast()

# ---------- V1: voting — pentas presiden + warga di plaza ----------
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
log("stage5:", ev(STAGE5))
mulai_cast()
i = leg("v1", 0, (0, 3.4, 52), (0, 2.6, 14), (0, 3.0, 40), (0, 2.6, 14), 16)
log("v1 selesai")
stop_cast()

# ---------- Fase senja: penutup ----------
ev("localStorage.setItem('pinarak_waktu','senja')")
cmd("Page.reload")
if not tunggu_kota():
    sys.exit(3)
log("bedahS:", ev(BEDAH))
mulai_cast()
i = leg("p1", 0, (-120, 30, 190), (0, 8, -20), (90, 70, 60), (0, 6, -30), 14)
log("p1 selesai")
stop_cast()
try:
    urllib.request.urlopen("http://127.0.0.1:9223/json/close/" + tab["id"], timeout=10)
except Exception:
    pass
print("CAPTURE_DONE")
