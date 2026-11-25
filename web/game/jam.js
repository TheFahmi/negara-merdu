/* Negara Merdu — modul game "jam": JAM ANALOG REAL TIME (permintaan Diah
   25 Nov 2026: "semua jam di negara real time").
   buatJam(r) membuat jam (muka berangka + jarum jam/menit/detik) yang
   menghadap +z lokal; semua jam terdaftar dan jarumnya digerakkan
   perbaruiJam() dari jam perangkat pemain (new Date(), zona waktu lokal).
   Jarum detik bergerak halus. */
const JAM = [];
let TEX_MUKA = null;
function teksturMuka() {
  if (TEX_MUKA) return TEX_MUKA;
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const c = cv.getContext("2d");
  c.fillStyle = "#fffaf0"; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
  c.strokeStyle = "#2a2320"; c.lineWidth = 6; c.stroke();
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, p = i % 5 === 0, r0 = p ? 100 : 110;
    c.lineWidth = p ? 6 : 2; c.beginPath(); c.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); c.lineTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); c.stroke();
  }
  c.fillStyle = "#2a2320"; c.font = "bold 30px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
  for (let h = 1; h <= 12; h++) { const a = h / 12 * Math.PI * 2; c.fillText(String(h), 128 + Math.sin(a) * 78, 128 - Math.cos(a) * 78); }
  c.font = "bold 14px system-ui"; c.fillStyle = "#7a1f1f"; c.fillText("MERDU", 128, 170);
  return (TEX_MUKA = new THREE.CanvasTexture(cv));
}
function jarum(panjang, lebar, warna, z) {
  const piv = new THREE.Group(); piv.position.z = z;
  const m = new THREE.Mesh(new THREE.BoxGeometry(lebar, panjang, lebar * 0.4), new THREE.MeshBasicMaterial({ color: warna }));
  m.position.y = panjang * 0.4; piv.add(m); return piv;
}
/* r = jari-jari muka; rim = warna bingkai. Menghadap +z lokal. */
export function buatJam(r, rim) {
  const g = new THREE.Group();
  const bingkai = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, r * 0.18, 28), new THREE.MeshStandardMaterial({ color: rim == null ? 0x2a2320 : rim, roughness: 0.5, metalness: 0.3 }));
  bingkai.rotation.x = Math.PI / 2; g.add(bingkai);
  const muka = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ map: teksturMuka() }));
  muka.position.z = r * 0.1; g.add(muka);
  const jamJ = jarum(r * 0.55, r * 0.07, 0x1b1d20, r * 0.12), menit = jarum(r * 0.82, r * 0.05, 0x1b1d20, r * 0.14), detik = jarum(r * 0.9, r * 0.02, 0xc8102e, r * 0.16);
  g.add(jamJ, menit, detik);
  const poros = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.05, r * 0.05, r * 0.1, 10), new THREE.MeshBasicMaterial({ color: 0xc8102e })); poros.rotation.x = Math.PI / 2; poros.position.z = r * 0.18; g.add(poros);
  JAM.push({ jamJ, menit, detik });
  return g;
}
export function perbaruiJam() {
  if (!JAM.length) return;
  const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  const aJ = -h / 12 * Math.PI * 2, aM = -m / 60 * Math.PI * 2, aS = -s / 60 * Math.PI * 2;
  for (const j of JAM) { j.jamJ.rotation.z = aJ; j.menit.rotation.z = aM; j.detik.rotation.z = aS; }
}
