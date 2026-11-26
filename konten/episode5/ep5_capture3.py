#!/usr/bin/env python3
"""Capture ULANG Episode 5 — teknik renderer pinjaman (borrow-scene).

Perbedaan dari ep5_capture.py (penyebab versi 1 bikin pusing):
- TIDAK pakai screencast. Tiap frame di-render on-demand lewat WebGLRenderer
  kedua dengan kamera sendiri -> cadence seragam & terkendali penuh.
- Gerakan kamera PENDEK dan PELAN per adegan; tanpa minterpolate dan tanpa
  perlambatan global di tahap rakit (konversi 24fps = duplikasi frame biasa).
- Frame disimpan sebagai urutan JPEG 720x1280 di /root/ep5c/frames.
PROBE=1 -> tiap leg hanya 3 frame (awal/tengah/akhir) untuk cek komposisi.
"""
import base64, json, math, os, sys, time, urllib.request
import websocket

URL = "https://merdu.id/"
DIR = "/root/ep5c/frames"
os.makedirs(DIR, exist_ok=True)
LOG = open("/root/ep5c/capture.log", "a", buffering=1)
PROBE = bool(os.environ.get("PROBE"))


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=LOG, flush=True)
    print(time.strftime("%H:%M:%S"), *a, flush=True)


SISIPAN = (
    "\n;(function(){try{"
    "window.__renderers=[];window.__fc=0;window.__appcam=null;"
    "var NS=window.THREE;"
    "if(NS&&NS.WebGLRenderer){"
    "  var A=NS.WebGLRenderer;"
    "  function B(){var r=Reflect.construct(A,arguments);"
    "    var idx=window.__renderers.length;window.__renderers.push(r);"
    "    if(idx===0){var ro=r.render.bind(r);"
    "      r.render=function(scene,camera){window.__appcam=camera;"
    "        var out=ro(scene,camera);window.__fc++;return out;};}"
    "    return r;}"
    "  B.prototype=A.prototype;Object.setPrototypeOf(B,A);"
    "  NS.WebGLRenderer=B;window.__sisipanAktif=true;"
    "}"
    "}catch(e){(window.__errKumpul=window.__errKumpul||[]).push('sisipan: '+e.message);}})();\n"
)

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

SETUP_BR = r"""
JSON.stringify((() => {
  const km = window.__kotaMassal;
  let scene = km.grup; while (scene.parent) scene = scene.parent;
  window.__scene = scene;
  const app = window.__renderers[0];
  const br = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  br.setSize(720, 1280);
  br.toneMapping = app.toneMapping;
  br.toneMappingExposure = app.toneMappingExposure;
  if ('outputEncoding' in br) br.outputEncoding = app.outputEncoding;
  if ('outputColorSpace' in br && app.outputColorSpace !== undefined) br.outputColorSpace = app.outputColorSpace;
  window.__br = br;
  const fov = (window.__appcam && window.__appcam.fov) || 55;
  window.__bcam = new THREE.PerspectiveCamera(fov, 720 / 1280, 0.1, 12000);
  return { fov, tm: app.toneMapping, exp: app.toneMappingExposure };
})())
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
        if meth == "Fetch.requestPaused":
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
        body = body + SISIPAN
        log("FETCH: three.min.js disisipi")
    tunggu(kirim("Fetch.fulfillRequest", {
        "requestId": rid,
        "responseCode": p.get("responseStatusCode", 200),
        "responseHeaders": headers,
        "body": base64.b64encode(body.encode()).decode(),
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
cmd("Fetch.enable", patterns=[{"urlPattern": "*three.min.js*", "requestStage": "Response"}])
cmd("Emulation.setDeviceMetricsOverride", width=640, height=1138, deviceScaleFactor=1, mobile=False)
try:
    cmd("Emulation.setFocusEmulationEnabled", enabled=True)
except Exception:
    pass
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
log("setup_br:", ev(SETUP_BR))
# panaskan: satu render buangan agar shader ter-compile
ev("(function(){var c=window.__bcam;c.position.set(200,120,200);c.lookAt(0,0,0);window.__br.render(window.__scene,c);return 'ok';})()")


def ambil(seg, i, p, l):
    expr = ("(function(){var c=window.__bcam;c.position.set(%r,%r,%r);c.lookAt(%r,%r,%r);"
            "window.__br.render(window.__scene,c);"
            "return window.__br.domElement.toDataURL('image/jpeg',0.86);})()" % (p[0], p[1], p[2], l[0], l[1], l[2]))
    v = ev(expr)
    if not isinstance(v, str) or not v.startswith("data:image"):
        log("AMBIL GAGAL", seg, i, str(v)[:120])
        return 0
    data = base64.b64decode(v.split(",", 1)[1])
    path = os.path.join(DIR, "%s_%04d.jpg" % (seg, i))
    with open(path, "wb") as fh:
        fh.write(data)
    return len(data)


def smooth(u):
    return u * u * (3 - 2 * u)


def lerp(a, b, u):
    return a + (b - a) * u


def leg(seg, i0, p1, l1, p2, l2, n):
    """Satu leg gerak: n frame unik, interpolasi smoothstep antar ujung."""
    if PROBE:
        us = [0.0, 0.5, 1.0]
    else:
        us = [j / max(1, n - 1) for j in range(n)]
    tot = 0
    t0 = time.time()
    for j, uu in enumerate(us):
        u = smooth(uu)
        p = tuple(lerp(p1[k], p2[k], u) for k in range(3))
        l = tuple(lerp(l1[k], l2[k], u) for k in range(3))
        tot += ambil(seg, i0 + j, p, l)
    dt = time.time() - t0
    log("%s leg: %d frame, %.2f MB, %.2f dtk/frame (dinding)" % (seg, len(us), tot / 1e6, dt / max(1, len(us))))
    return i0 + len(us)


log("stage:", ev(STAGE))

# ---------- B1 d1: drone pembuka — dorongan pelan pendek ----------
i = leg("d1", 0, (196, 110, 120), (10, 0, -90), (168, 92, 84), (16, 0, -100), 12)
log("d1 selesai")

# ---------- B2 a1: absen #35-37 — glide jalan pelan ----------
i = leg("a1", 0, (-1, 4.4, -96), (29, 2.6, -125), (43, 4.3, -94), (49, 2.5, -122), 30)
log("a1 selesai")

# ---------- B3 a2: absen #38-40 — lanjut pelan + naik sedikit ----------
i = leg("a2", 0, (43, 4.3, -94), (55, 2.5, -121), (80, 5.4, -89), (67, 3, -120), 24)
log("a2 selesai")

# ---------- B4 k1: masjid (busur kecil) -> lahan apartemen -> tahan statis (kartu kas) ----------
i = leg("k1", 0, (398, 30, 356), (378, 12, 294), (418, 25, 322), (378, 12, 294), 11)
i = leg("k1", i, (26, 38, 232), (-35, 5, 133), (0, 25, 204), (-35, 5, 134), 12)
i = leg("k1", i, (-2, 19, 192), (-35, 4, 134), (-3, 18.6, 190), (-35, 4, 134), 9)
log("k1 selesai")

# ---------- B5 v1: voting — dorongan sangat pelan ke pentas presiden ----------
log("stage5:", ev(STAGE5))
i = leg("v1", 0, (0, 3.2, 45), (0, 2.6, 14), (0, 3.0, 37), (0, 2.6, 14), 18)
log("v1 selesai")

# ---------- Fase senja: penutup ----------
ev("localStorage.setItem('pinarak_waktu','senja')")
cmd("Page.reload")
if not tunggu_kota():
    sys.exit(3)
log("bedahS:", ev(BEDAH))
log("setup_brS:", ev(SETUP_BR))
ev("(function(){var c=window.__bcam;c.position.set(200,120,200);c.lookAt(0,0,0);window.__br.render(window.__scene,c);return 'ok';})()")
i = leg("p1", 0, (-44, 32, 108), (0, 8, -20), (2, 42, 80), (0, 6, -26), 18)
log("p1 selesai")
try:
    urllib.request.urlopen("http://127.0.0.1:9223/json/close/" + tab["id"], timeout=10)
except Exception:
    pass
print("CAPTURE_DONE")
log("CAPTURE_DONE")
