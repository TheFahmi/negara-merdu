"""Tes minimal screencast di Chrome capture Alienware (port 9334):
tab baru -> merdu.id -> tunggu -> startScreencast -> hitung frame 20 dtk.
Tanpa intersepsi Fetch, tanpa sisipan. Jalan di Alienware."""
import json, time, urllib.request
import websocket

CDP = "http://127.0.0.1:9334"
req = urllib.request.Request(CDP + "/json/new?about:blank", method="PUT")
tab = json.load(urllib.request.urlopen(req, timeout=15))
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30, suppress_origin=True)
mid = 0
waiters = {}
frames = [0]
t_frames = []


def pompa(batas=0.3):
    ws.settimeout(batas)
    t0 = time.time()
    while True:
        try:
            m = json.loads(ws.recv())
        except Exception:
            return
        if m.get("method") == "Page.screencastFrame":
            frames[0] += 1
            t_frames.append(time.time())
            kirim("Page.screencastFrameAck", {"sessionId": m["params"]["sessionId"]})
        elif "id" in m:
            waiters[m["id"]] = m
        if time.time() - t0 >= batas:
            return


def kirim(method, params):
    global mid
    mid += 1
    ws.send(json.dumps({"id": mid, "method": method, "params": params}))
    return mid


def cmd(method, **params):
    i = kirim(method, params)
    t0 = time.time()
    while time.time() - t0 < 120:
        if i in waiters:
            return waiters.pop(i)
        pompa(0.3)
    raise TimeoutError(method)


cmd("Page.enable")
cmd("Runtime.enable")
cmd("Emulation.setDeviceMetricsOverride", width=720, height=1280, deviceScaleFactor=1, mobile=False)
cmd("Page.navigate", url="https://merdu.id/")
print("navigasi ok, tunggu 45 dtk...")
t0 = time.time()
while time.time() - t0 < 45:
    pompa(0.5)
r = cmd("Runtime.evaluate", expression="JSON.stringify({km: !!window.__kotaMassal, vis: document.visibilityState})", returnByValue=True)
print("status:", r.get("result", {}).get("result", {}).get("value"))
cmd("Page.startScreencast", format="jpeg", quality=88, maxWidth=720, maxHeight=1280, everyNthFrame=1)
t0 = time.time()
while time.time() - t0 < 20:
    pompa(0.3)
print("FRAME 20dtk:", frames[0])
if len(t_frames) > 2:
    sp = [round(t_frames[i + 1] - t_frames[i], 2) for i in range(len(t_frames) - 1)]
    print("spacing:", sp[:20])
try:
    cmd("Page.stopScreencast")
except Exception:
    pass
urllib.request.urlopen(CDP + "/json/close/" + tab["id"], timeout=10)
print("MINI_DONE")
