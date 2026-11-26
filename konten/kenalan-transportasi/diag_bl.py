#!/usr/bin/env python3
"""Diagnostik cepat: posisi BUSREG[0] + uji __ikutBus exterior via screenshot CDP."""
import base64, json, sys, time
sys.path.insert(0, r"C:\Users\alienware\ep7cap")
import kt_capture_aw as K

K.buka("about:blank")
time.sleep(1)
print("POSISI BUSREG:")
for i in range(3):
    print(" ", K.ev("""(() => { const B = window.__BUSREG || []; const out = [];
      for (let i = 0; i < B.length; i++) { const p = new THREE.Vector3(); B[i].getWorldPosition(p);
        out.push(i + ':' + p.x.toFixed(0) + ',' + p.y.toFixed(1) + ',' + p.z.toFixed(0)); }
      return out.join(' '); })()"""))
    time.sleep(1.5)
print("SET IKUT:", K.ev("window.__ikutBus(0, [8.5, 2.9, 10.5], [0, 1.5, 0.5], 0.4)"))
time.sleep(3)
print("KAMERA:", K.ev("(() => { const c = window.__KAM; return c ? c.position.x.toFixed(1)+','+c.position.y.toFixed(1)+','+c.position.z.toFixed(1) : 'tak ada'; })()"))
r = K.cmd("Page.captureScreenshot", {"format": "jpeg", "quality": 80})
open(r"C:\Users\alienware\ep7cap\diag_bl.jpg", "wb").write(base64.b64decode(r["data"]))
print("screenshot ok")
print("SET IKUT BUS LAIN (bergerak tercepat via __POSISI):")
print(" ", K.ev("(() => { const P = window.__POSISI; return JSON.stringify(P.bus[0]) + ' ' + JSON.stringify(P.bus.length); })()"))
