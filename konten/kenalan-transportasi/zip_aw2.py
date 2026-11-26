import zipfile, os
BASE = r"C:\Users\alienware\ep7cap"
names = [l.strip() for l in open(os.path.join(BASE, "filelist2b.txt")) if l.strip()]
out = os.path.join(BASE, "kt_frames2.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as z:
    for n in names:
        p = os.path.join(BASE, "frames", n)
        if os.path.exists(p):
            z.write(p, n)
print("zip2 selesai:", os.path.getsize(out), "bytes,", len(names), "nama")
