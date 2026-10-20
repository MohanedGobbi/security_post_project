# Makes synthetic Algerian-style ID card FRONTS (Arabic and Latin text, 18-digit national number) under webcam conditions,
# to compare local OCR engines on the text that has no machine-readable zone. Stand-ins, not real cards: the layout, fonts and
# printing of real cards differ, so use the numbers for comparing engines, not as the accuracy on real cards.
# Usage: py make_fronts.py <output folder>      (needs numpy, opencv-python, Pillow, arabic-reshaper, python-bidi; Windows fonts)
import json, os, random, sys
import numpy as np
import cv2
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont
from desk import on_desk

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
random.seed(11)
np.random.seed(11)

AR_DIGITS = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')


def ar(text):
    """Arabic text prepared for Pillow without libraqm: letters joined, then put in display order."""
    return get_display(arabic_reshaper.reshape(text))


# (national number, birth date, sex, Arabic surname, Latin surname, Arabic given names, Latin given names, Arabic birth place, Latin birth place)
PEOPLE = [
    ('109610140123456789', '1996-06-14', 'F', 'بن يوسف', 'BENYOUCEF', 'خديجة', 'KHADIDJA', 'غرداية', 'GHARDAIA'),
    ('108903020987654321', '1989-03-02', 'M', 'باحاز', 'BAHAZ', 'رشيد', 'RACHID', 'متليلي', 'METLILI'),
    ('110209270405118273', '2002-09-27', 'F', 'حاج سعيد', 'HADJ SAID', 'أمينة', 'AMINA', 'القرارة', 'EL GUERRARA'),
    ('108507190660221934', '1985-07-19', 'M', 'قرين', 'GUERINE', 'عبد الرحمن', 'ABDERRAHMANE', 'بريان', 'BERRIANE'),
]

FONTS = {'tahoma': r'C:\Windows\Fonts\tahoma.ttf', 'arial': r'C:\Windows\Fonts\arial.ttf', 'trado': r'C:\Windows\Fonts\trado.ttf'}


def front(p, font_path, w=1011, h=638):
    nin, birth, sex, ar_sur, lat_sur, ar_giv, lat_giv, ar_pl, lat_pl = p
    img = Image.new('RGB', (w, h), (236, 238, 228))
    d = ImageDraw.Draw(img)
    f = lambda s: ImageFont.truetype(font_path, s)
    ink, grey = (20, 20, 20), (75, 75, 75)
    right, left = w - 40, 330
    d.rectangle([40, 170, 300, 480], outline=(120, 120, 120), width=3)   # photo
    d.text((right, 16), ar('الجمهورية الجزائرية الديمقراطية الشعبية'), fill=ink, font=f(28), anchor='ra')
    d.text((right, 54), 'REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', fill=grey, font=f(20), anchor='ra')
    d.text((right, 86), ar('بطاقة التعريف الوطنية'), fill=ink, font=f(32), anchor='ra')
    d.text((right, 128), "CARTE NATIONALE D'IDENTITE", fill=grey, font=f(20), anchor='ra')
    dd, mm, yyyy = birth[8:], birth[5:7], birth[:4]
    # (Arabic label, Arabic value or None, Latin label, Latin value)
    rows = [
        ('رقم التعريف الوطني', None, 'N.I.N', nin),
        ('اللقب', ar(ar_sur), 'Nom', lat_sur),
        ('الاسم', ar(ar_giv), 'Prenom', lat_giv),
        ('تاريخ الميلاد', f'{dd}.{mm}.{yyyy}'.translate(AR_DIGITS), 'Date de naissance', f'{dd}.{mm}.{yyyy}'),
        ('مكان الميلاد', ar(ar_pl), 'Lieu de naissance', lat_pl),
    ]
    y = 168
    for ar_label, ar_value, lat_label, lat_value in rows:
        d.text((right, y), ar(ar_label), fill=grey, font=f(22), anchor='ra')
        d.text((left, y), lat_label, fill=grey, font=f(22))
        if ar_value:
            d.text((right, y + 26), ar_value, fill=ink, font=f(36), anchor='ra')
        d.text((left, y + 26), lat_value, fill=ink, font=f(36))
        y += 90
    return np.array(img)[:, :, ::-1]


CONDITIONS = {
    'flat': dict(scale=0.80, angle=0, persp=0, blur=0.0, noise=2, contrast=1.0),
    'small': dict(scale=0.55, angle=1.5, persp=0, blur=0.8, noise=4, contrast=0.9),
    'tilted': dict(scale=0.65, angle=-3, persp=0.04, blur=1.0, noise=5, contrast=0.85),
    'glare': dict(scale=0.70, angle=2, persp=0.02, blur=1.2, noise=6, contrast=0.7, glare=True),
}

expect = {}
for fname, fpath in FONTS.items():
    for pi, p in enumerate(PEOPLE):
        card = front(p, fpath)
        for cname, kw in CONDITIONS.items():
            name = f'front_{fname}_p{pi}_{cname}'
            cv2.imwrite(os.path.join(OUT, name + '.jpg'), on_desk(card, **kw), [cv2.IMWRITE_JPEG_QUALITY, 88])
            expect[name] = {'nin': p[0], 'birth': p[1], 'arSurname': p[3], 'latSurname': p[4], 'arGiven': p[5], 'latGiven': p[6], 'arPlace': p[7], 'latPlace': p[8]}
json.dump(expect, open(os.path.join(OUT, 'expect.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(len(expect), 'images')
