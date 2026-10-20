# Reads every .jpg of a folder with EasyOCR (Arabic + English), on the CPU. The first run downloads its models.
# Usage: py ocr_easyocr.py <folder> <output.json>
import json, os, sys, time
import easyocr

folder, out = sys.argv[1], sys.argv[2]
reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
result = {}
for f in sorted(os.listdir(folder)):
    if not f.endswith('.jpg'):
        continue
    t0 = time.time()
    # paragraph=False keeps one box per text run; the boxes are sorted top to bottom, then right to left for Arabic
    boxes = reader.readtext(os.path.join(folder, f), detail=1)
    lines = [b[1] for b in sorted(boxes, key=lambda b: (round(b[0][0][1] / 25), -b[0][0][0]))]
    result[f[:-4]] = {'texts': {'ar+en': '\n'.join(lines)}, 'sec': round(time.time() - t0, 2)}
json.dump(result, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(result), 'pictures')
