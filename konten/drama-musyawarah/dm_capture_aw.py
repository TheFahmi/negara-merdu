#!/usr/bin/env python3
"""Capture video KENALAN TRANSPORTASI Negara Merdu di ALIENWARE — resep Ep5 vs3/Ep6
+ kamera IKUT kendaraan (bus/KRL) + direktur berbasis pemicu henti (dwell).

- Chrome headless GPU (profil ep7cap-profile, port 9333) di Alienware.
- Animator rAF (legs) ATAU kamera ikut objek (localToWorld per render).
- Screencast mengalir bebas; frame hanya disimpan saat segmen ditag.
- Kota UTUH: tanpa bedah, bayangan aktif, kualitas 'tinggi'.
- TANPA minterpolate / setpts di rakit — resample nearest-timestamp saja.
KT_MODE=recon  -> registrasi kendaraan + poll posisi 150 dtk -> recon.json
KT_MODE=probe  -> tangkapan komposisi 4 dtk: d1, lm, kl, ku (seg prob_*)
KT_MODE=full   -> semua segmen (KT_SHOTS=d1,bl,bd,lm,kl,kd,ku,p1)
Jalan di Alienware: python.exe kt_capture_aw.py
"""
import base64, json, os, sys, threading, time, urllib.request
import websocket

CDP = "http://127.0.0.1:9333"
BASE = r"C:\Users\alienware\ep9cap"
OUTDIR = os.path.join(BASE, "frames")
os.makedirs(OUTDIR, exist_ok=True)
LOG = open(os.path.join(BASE, "capture.log"), "a", buffering=1)
MODE = os.environ.get("DM_MODE", "full").strip()
SHOTS = [s.strip() for s in os.environ.get("DM_SHOTS", "ist,kop,mal,plzA,plzB,p9").split(",") if s.strip()]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=LOG, flush=True)
    print(time.strftime("%H:%M:%S"), *a, flush=True)


SISIPAN = (
    "\n;(function(){try{"
    "try{localStorage.setItem('pinarak_kualitas','tinggi');}catch(e){}"
    "window.__renderers=[];window.__fc=0;window.__errs=[];"
    "window.__anim={legs:[],t0:0,aktif:false};"
    "window.__ikut=null;"
    "window.__setLegs=function(legs){window.__anim.legs=legs||[];};"
    "window.__startAnim=function(){window.__anim.t0=performance.now();window.__anim.aktif=true;};"
    "window.__stopAnim=function(){window.__anim.aktif=false;};"
    "window.__setIkut=function(obj,off,look,lerp){window.__ikut={obj:obj,off:off,look:look,lerp:(lerp==null?1:lerp),snap:true};};"
    "window.__lepasIkut=function(){window.__ikut=null;};"
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
    "        try{"
    "          if(window.__ikut&&window.__ikut.obj&&camera){var ik=window.__ikut;"
    "            var tp=ik.obj.localToWorld(new NS.Vector3(ik.off[0],ik.off[1],ik.off[2]));"
    "            var tl=ik.obj.localToWorld(new NS.Vector3(ik.look[0],ik.look[1],ik.look[2]));"
    "            if(ik.snap||ik.lerp>=1){camera.position.copy(tp);}else{camera.position.lerp(tp,ik.lerp);}"
    "            ik.snap=false;camera.lookAt(tl);}"
    "          else if(window.__anim.aktif&&camera){var t=(performance.now()-window.__anim.t0)/1000;"
    "            var ps=posePada(t);if(ps){camera.position.set(ps.p[0],ps.p[1],ps.p[2]);camera.lookAt(ps.l[0],ps.l[1],ps.l[2]);}}"
    "        }catch(e){}"
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

FUNGSI = r"""
(() => {
  window.__cariKend = function(){
    var km = window.__kotaMassal; var sc = km.grup; while (sc.parent) sc = sc.parent;
    var bus = [], krl = [];
    sc.traverse(function(o){
      if (o.userData && o.userData.gerbong) krl.push(o);
      else if (o.userData && Array.isArray(o.userData.pintu) && o.isGroup) {
        var p = o.parent;
        if (!(p && p.userData && p.userData.gerbong)) bus.push(o);
      }
    });
    window.__bus = bus; window.__krl = krl;
    return JSON.stringify({bus: bus.length, krl: krl.length,
      gerbong: krl.map(function(k){ return k.userData.gerbong.length; })});
  };
  window.__posSemua = function(){
    var out = [];
    (window.__bus || []).forEach(function(b, i){ out.push({j:'b', i:i, x:+b.position.x.toFixed(2), y:+b.position.y.toFixed(2), z:+b.position.z.toFixed(2)}); });
    (window.__krl || []).forEach(function(k, ti){ k.userData.gerbong.forEach(function(c, ci){ out.push({j:'k', i:ti*10+ci, x:+c.position.x.toFixed(2), y:+c.position.y.toFixed(2), z:+c.position.z.toFixed(2)}); }); });
    return JSON.stringify(out);
  };
  window.__ikutBus = function(i, off, look, lerp){ window.__setIkut(window.__bus[i], off, look, lerp); return 'ikut-bus-' + i; };
  window.__ikutKrl = function(ti, ci, off, look, lerp){ window.__setIkut(window.__krl[ti].userData.gerbong[ci], off, look, lerp); return 'ikut-krl-' + ti + '-' + ci; };
  window.__sumberDaya = function(){
    return JSON.stringify(performance.getEntriesByType('resource').map(function(e){ return e.name; }).filter(function(u){ return u.indexOf('.js') >= 0; }));
  };
  return 'fungsi-ok';
})()
"""

STASIUN_POS = [(385.0, 931.0), (7.0, -1757.0)]  # Merdu (selatan), Merdu Utara

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
events = {}


ws_lock = threading.Lock()
fetch_queue = []


def kirim(method, params):
    global mid
    with ws_lock:
        mid += 1
        ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        return mid


def _receiver():
    """Utas penerima khusus: ACK screencast secepatnya (flow-control CDP),
    respons perintah disimpan ke `menunggu`, Fetch diantrekan ke utas utama."""
    while True:
        try:
            m = json.loads(ws.recv())
        except Exception as e:
            if "closed" in str(e).lower():
                return
            continue
        meth = m.get("method")
        if meth == "Fetch.requestPaused":
            fetch_queue.append(m["params"])
        elif meth == "Page.screencastFrame":
            try:
                tangani_frame(m["params"])
            except Exception:
                pass
        elif "id" in m:
            menunggu[m["id"]] = m


def pompa(batas=0.2):
    t0 = time.time()
    while fetch_queue:
        tangani_fetch(fetch_queue.pop(0))
    sisa = batas - (time.time() - t0)
    if sisa > 0:
        time.sleep(sisa)


def tunggu(mid_target, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if mid_target in menunggu:
            return menunggu.pop(mid_target)
        pompa(0.05)
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
        log("FETCH: three.min.js disisipi animator+ikut")
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


ws.settimeout(None)
threading.Thread(target=_receiver, daemon=True).start()
cmd("Runtime.enable")
cmd("Page.enable")
cmd("Fetch.enable", patterns=[{"urlPattern": "*three.min.js*", "requestStage": "Response"}])
cmd("Emulation.setDeviceMetricsOverride", width=720, height=1280, deviceScaleFactor=1, mobile=False)
try:
    cmd("Page.bringToFront")
    log("bringToFront ok")
except Exception as e:
    log("bringToFront gagal:", str(e)[:80])
log("navigasi...")
cmd("Page.navigate", url="https://merdu.id/")
try:
    cmd("Page.bringToFront")
except Exception:
    pass


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
log("fungsi:", ev(FUNGSI))
reg = ev("window.__cariKend()")
log("registrasi kendaraan:", reg)
try:
    REG = json.loads(reg)
except Exception:
    REG = {}

cmd("Page.startScreencast", format="jpeg", quality=88, maxWidth=720, maxHeight=1280, everyNthFrame=1)
pompa(1.0)

# ---------- pantau posisi ----------
KEC = {}   # kunci -> kec ema
POS = {}   # kunci -> (x, z, t)
DWELL = {}  # kunci -> {mulai, x, z} dwell berjalan
DWELL_LOG = []  # dwell selesai {k, t0, t1, x, z}


def poll(dt_tunggu=0.45):
    """Satu siklus poll posisi; kembalikan dict posisi kini. Memompa frame juga."""
    t_awal = time.time()
    s = ev("window.__posSemua()")
    t_ini = time.time()
    try:
        daftar = json.loads(s)
    except Exception:
        daftar = []
    kini = {}
    for d in daftar:
        k = "%s%d" % (d["j"], d["i"])
        kini[k] = (d["x"], d["z"])
        if k in POS:
            px, pz, pt = POS[k]
            v = ((d["x"] - px) ** 2 + (d["z"] - pz) ** 2) ** 0.5 / max(0.05, t_ini - pt)
            KEC[k] = 0.55 * KEC.get(k, v) + 0.45 * v
        POS[k] = (d["x"], d["z"], t_ini)
        # dwell tracking
        v = KEC.get(k, 9)
        if v < 0.3:
            if k not in DWELL:
                DWELL[k] = {"mulai": t_ini, "x": d["x"], "z": d["z"]}
        else:
            if k in DWELL and t_ini - DWELL[k]["mulai"] >= 1.2:
                DWELL_LOG.append({"k": k, "t0": DWELL[k]["mulai"], "t1": t_ini,
                                   "x": DWELL[k]["x"], "z": DWELL[k]["z"]})
            DWELL.pop(k, None)
    sisa = dt_tunggu - (time.time() - t_awal)
    if sisa > 0:
        pompa(sisa)
    return kini


def tunggu_sampai(syarat, timeout, dt=0.45):
    t0 = time.time()
    while time.time() - t0 < timeout:
        kini = poll(dt)
        r = syarat(kini, time.time())
        if r:
            return r
    return None


def seg_mulai(nama):
    seg_t0[0] = time.time()
    seg_now[0] = nama
    meta_awal = len(meta)
    return meta_awal


def seg_selesai(nama, info=None):
    seg_now[0] = None
    ev("window.__lepasIkut()")
    ev("window.__stopAnim()")
    pompa(0.3)
    m = [row for row in meta if row[0] == nama]
    json.dump(m, open(os.path.join(BASE, "meta_%s.json" % nama), "w"))
    events[nama] = {"frame": len(m), "info": info or {}}
    json.dump(events, open(os.path.join(BASE, "events.json"), "w"), indent=1)
    log("seg %s selesai: %d frame, info=%s" % (nama, len(m), json.dumps(info or {})[:200]))


def jalankan_legs(nama, dur, legs):
    ev("window.__setLegs(%s)" % json.dumps(
        [{"t0": f0 * dur, "t1": f1 * dur, "p1": p1, "l1": l1, "p2": p2, "l2": l2}
         for (p1, l1, p2, l2, f0, f1) in legs]))
    ev("window.__startAnim()")
    seg_mulai(nama)
    t0 = time.time()
    while time.time() - t0 < dur:
        poll(0.3)
    seg_selesai(nama, {"dur": dur})


def cluster_halte():
    """Cluster posisi dwell bus 4.5-10 dtk dari DWELL_LOG -> kandidat halte."""
    titik = [(d["x"], d["z"]) for d in DWELL_LOG if d["k"].startswith("b") and 3.5 <= d["t1"] - d["t0"] <= 12.0]
    clusters = []
    for (x, z) in titik:
        for c in clusters:
            if ((x - c[0]) ** 2 + (z - c[1]) ** 2) ** 0.5 < 14:
                c[2] += 1
                c[0] = (c[0] * (c[2] - 1) + x) / c[2]
                c[1] = (c[1] * (c[2] - 1) + z) / c[2]
                break
        else:
            clusters.append([x, z, 1])
    return clusters


def dekat_halte(x, z, clusters, maks=13):
    return any(((x - c[0]) ** 2 + (z - c[1]) ** 2) ** 0.5 < maks for c in clusters)


# ================= MODE DIAG =================
if MODE == "diag":
    log("visibility:", ev("document.visibilityState"), "| hidden:", ev("document.hidden"))
    fc0 = ev("window.__fc || 0")
    seg_mulai("diag")
    t0 = time.time()
    while time.time() - t0 < 20:
        poll(0.3)
    seg_selesai("diag", {"dur": 20})
    fc1 = ev("window.__fc || 0")
    log("DIAG fc: %s -> %s (render %.1f fps), frame screencast: %d" % (fc0, fc1, (fc1 - fc0) / 20.0, seg_count.get("diag", 0)))
    print("DIAG_DONE")
    sys.exit(0)

# ================= MODE PROBE =================
if MODE == "probe":
    jalankan_legs("prob_ist", 4, [([7, 6, 84], [7, 13, -34], [7, 5, 50], [7, 13, -34], 0, 1)])
    jalankan_legs("prob_kop", 4, [([-480, 135, -1255], [-290, 0, -1045], [-150, 85, -865], [-290, 0, -1045], 0, 1)])
    jalankan_legs("prob_mal", 4, [([-480, 135, 795], [-290, 0, 973], [-150, 85, 1155], [-290, 0, 973], 0, 1)])
    jalankan_legs("prob_plzA", 4, [([54, 3.8, 86], [36, 2.0, 57], [54, 3.8, 86], [36, 2.0, 57], 0, 1)])
    jalankan_legs("prob_plzB", 4, [([-26, 4.2, 92], [7, 2, 5], [-26, 4.2, 92], [7, 2, 5], 0, 1)])
    jalankan_legs("prob_plzC", 4, [([88, 6, 150], [7, 2, 20], [88, 6, 150], [7, 2, 20], 0, 1)])
    print("PROBE_DONE", json.dumps(seg_count))
    sys.exit(0)

# ================= MODE FULL =================
for seg in SHOTS:
    log("=== segmen %s ===" % seg)
    if seg == "ist":
        jalankan_legs("ist", 13, [([7, 6, 84], [7, 13, -34], [7, 5, 50], [7, 13, -34], 0, 1)])
    elif seg == "kop":
        jalankan_legs("kop", 14, [([-480, 135, -1255], [-290, 0, -1045], [-150, 85, -865], [-290, 0, -1045], 0, 1)])
    elif seg == "mal":
        jalankan_legs("mal", 14, [([-480, 135, 795], [-290, 0, 973], [-150, 85, 1155], [-290, 0, 973], 0, 1)])
    elif seg == "plzA":
        jalankan_legs("plzA", 11, [([54, 3.8, 86], [36, 2.0, 57], [54, 3.8, 86], [36, 2.0, 57], 0, 1)])
    elif seg == "plzB":
        jalankan_legs("plzB", 11, [([-26, 4.2, 92], [7, 2, 5], [-26, 4.2, 92], [7, 2, 5], 0, 1)])
    elif seg == "p9":
        jalankan_legs("p9", 13, [([250, 75, 330], [7, 10, -30], [120, 38, 175], [7, 10, -30], 0, 1)])

try:
    cmd("Page.stopScreencast")
except Exception:
    pass
json.dump(events, open(os.path.join(BASE, "events.json"), "w"), indent=1)
try:
    urllib.request.urlopen(CDP + "/json/close/" + tab["id"], timeout=10)
except Exception:
    pass
print("CAPTURE_DONE", json.dumps(seg_count))
log("CAPTURE_DONE", json.dumps(seg_count))
