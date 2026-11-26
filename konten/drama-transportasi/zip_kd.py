import zipfile, os
BASE = r"C:\Users\alienware\ep8cap"
names = [l.strip() for l in open(os.path.join(BASE, "filelist_kd.txt")) if l.strip()]
out = os.path.join(BASE, "dt_frames_kd.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as z:
    for n in names:
        p = os.path.join(BASE, "frames", n)
        if os.path.exists(p):
            z.write(p, n)
print("zip selesai:", os.path.getsize(out), "bytes,", len(names), "nama")
