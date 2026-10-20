# Makes synthetic Algerian-style ID cards (the back with a TD1 machine-readable zone and valid check digits) and a passport,
# each under bad conditions: glare, tilt, perspective, soft focus, a small card on a desk.
# Usage: py make_cards.py <output folder>      (needs numpy, opencv-python, Pillow; Windows fonts Consolas and OCR-A)
import os, random, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
random.seed(7)
np.random.seed(7)

def cd(s):
    w = [7, 3, 1]
    v = lambda c: 0 if c == '<' else int(c) if c.isdigit() else ord(c) - 55
    return str(sum(v(c) * w[i % 3] for i, c in enumerate(s)) % 10)

def td1(doc, birth, sex, expiry, nat, surname, given):
    l1 = ('ID' + 'DZA' + doc + cd(doc)).ljust(30, '<')
    body2 = birth + cd(birth) + sex + expiry + cd(expiry) + nat + '<' * 11
    # composite check digit: document number + its digit + optional data, both dates with their digits, optional data 2
    comp = cd(l1[5:30] + birth + cd(birth) + expiry + cd(expiry) + '<' * 11)
    l2 = (body2 + comp)[:30]
    l3 = (surname + '<<' + given.replace(' ', '<')).ljust(30, '<')[:30]
    return [l1, l2, l3]

def td3(doc, nat, birth, sex, expiry, surname, given):
    doc = doc.ljust(9, '<')
    l1 = ('P<' + nat + surname + '<<' + given.replace(' ', '<')).ljust(44, '<')[:44]
    l2 = doc + cd(doc) + nat + birth + cd(birth) + sex + expiry + cd(expiry) + '<' * 14 + '0'
    l2 = l2[:43] + cd(doc + cd(doc) + birth + cd(birth) + expiry + cd(expiry) + '<' * 14 + '0')
    return [l1, l2]

def card_back(lines, font_path, size_ratio=1.0, w=1011, h=638):
    img = Image.new('RGB', (w, h), (232, 236, 226))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype('arial.ttf', 26)
    d.rectangle([40, 40, 330, 250], outline=(120, 120, 120), width=3)
    d.text((360, 60), 'REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', fill=(40, 40, 40), font=f)
    d.text((360, 110), 'Date de delivrance: 01/07/2021', fill=(60, 60, 60), font=f)
    d.text((360, 150), 'Lieu de naissance: GHARDAIA', fill=(60, 60, 60), font=f)
    d.text((360, 190), 'Adresse: CITE 500 LOGEMENTS', fill=(60, 60, 60), font=f)
    mf = ImageFont.truetype(font_path, int(46 * size_ratio))
    y = h - 40 - 3 * 62
    for l in lines:
        d.text((50, y), l, fill=(15, 15, 15), font=mf)
        y += 62
    return np.array(img)[:, :, ::-1]

def passport_page(lines, font_path, w=1250, h=880):
    img = Image.new('RGB', (w, h), (238, 236, 224))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype('arial.ttf', 30)
    d.rectangle([60, 60, 360, 420], outline=(110, 110, 110), width=3)
    d.text((400, 80), 'PASSEPORT / PASSPORT', fill=(40, 40, 40), font=f)
    d.text((400, 140), 'Surname / Nom', fill=(70, 70, 70), font=f)
    mf = ImageFont.truetype(font_path, 38)
    y = h - 40 - 2 * 62
    for l in lines:
        d.text((40, y), l, fill=(15, 15, 15), font=mf)
        y += 62
    return np.array(img)[:, :, ::-1]

def on_desk(card, scale, angle, persp, blur, noise, contrast, frame=(1920, 1080), glare=False):
    """Place the card on a desk background as a webcam would see it."""
    fh, fw = frame[1], frame[0]
    desk = np.full((fh, fw, 3), (96, 110, 124), np.uint8)
    desk = cv2.GaussianBlur(desk + np.random.randint(0, 22, desk.shape, dtype=np.uint8), (0, 0), 3)
    ch, cw = card.shape[:2]
    s = (fw * scale) / cw
    card = cv2.resize(card, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    ch, cw = card.shape[:2]
    pad = 200
    big = np.full((fh + 2 * pad, fw + 2 * pad, 3), 0, np.uint8)
    mask = np.zeros(big.shape[:2], np.uint8)
    x0, y0 = pad + (fw - cw) // 2, pad + (fh - ch) // 2
    big[y0:y0 + ch, x0:x0 + cw] = card
    mask[y0:y0 + ch, x0:x0 + cw] = 255
    M = cv2.getRotationMatrix2D((pad + fw / 2, pad + fh / 2), angle, 1.0)
    big = cv2.warpAffine(big, M, (big.shape[1], big.shape[0]))
    mask = cv2.warpAffine(mask, M, (big.shape[1], big.shape[0]))
    if persp:
        H, W = big.shape[:2]
        src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
        dst = src + np.float32([[persp * W, persp * H], [-persp * W, 0], [-persp * W * 0.4, -persp * H], [persp * W * 0.5, persp * H * 0.3]])
        P = cv2.getPerspectiveTransform(src, dst)
        big = cv2.warpPerspective(big, P, (W, H))
        mask = cv2.warpPerspective(mask, P, (W, H))
    big = big[pad:pad + fh, pad:pad + fw]
    mask = mask[pad:pad + fh, pad:pad + fw]
    out = np.where(mask[:, :, None] > 0, big, desk)
    out = out.astype(np.float32)
    out = (out - 128) * contrast + 128
    if glare:
        gy, gx = np.ogrid[:fh, :fw]
        g = np.exp(-(((gx - fw * 0.55) / 220) ** 2 + ((gy - fh * 0.6) / 70) ** 2)) * 120
        out += g[:, :, None]
    if blur:
        out = cv2.GaussianBlur(out, (0, 0), blur)
    out += np.random.normal(0, noise, out.shape)
    return np.clip(out, 0, 255).astype(np.uint8)

persons = [
    ('123456789', '960614', 'F', '310614', 'BENYOUCEF', 'KHADIDJA'),
    ('098765432', '890302', 'M', '290302', 'BAHAZ', 'RACHID'),
    ('405118273', '020927', 'M', '320927', 'HADJ SAID', 'AMINA'),
]
fonts = {'consola': r'C:\Windows\Fonts\consola.ttf', 'ocra': r'C:\Windows\Fonts\OCRAEXT.TTF'}
expect = {}
n = 0
def add(name, img, p, kind='td1'):
    global n
    cv2.imwrite(os.path.join(OUT, name + '.jpg'), img, [cv2.IMWRITE_JPEG_QUALITY, 88])
    expect[name] = {'doc': (p[0] if kind == 'td1' else 'A12345678'), 'birth': p[1], 'sex': p[2], 'surname': p[4], 'given': p[5], 'kind': kind}

for fi, (fname, fpath) in enumerate(fonts.items()):
    for pi, p in enumerate(persons):
        lines = td1(p[0], p[1], p[2], p[3], 'DZA', p[4], p[5])
        back = card_back(lines, fpath)
        base = f'{fname}_p{pi}'
        add(base + '_flat_filled', on_desk(back, 0.80, 0, 0, 0.0, 2, 1.0), p)
        add(base + '_small_in_frame', on_desk(back, 0.45, 1.5, 0, 0.8, 4, 0.9), p)
        add(base + '_rotated_blur', on_desk(back, 0.62, 4, 0, 1.6, 5, 0.8), p)
        add(base + '_tilt_perspective', on_desk(back, 0.62, -3, 0.05, 1.0, 5, 0.85), p)
        add(base + '_glare_lowcontrast', on_desk(back, 0.65, 2, 0.02, 1.2, 6, 0.6, glare=True), p)
        # as a webcam image: the card occupies the guide frame (82% of the width) but with soft focus
        add(base + '_soft_focus', on_desk(back, 0.82, 0, 0, 2.2, 6, 0.85), p)

p = persons[0]
tp = td3('A12345678', 'DZA', p[1], p[2], p[3], p[4], p[5])
add('passport_consola', on_desk(passport_page(tp, fonts['consola']), 0.75, 1, 0, 1.0, 4, 0.9), p, 'td3')
print(len(expect), 'images')
import json
json.dump(expect, open(os.path.join(OUT, 'expect.json'), 'w'))
