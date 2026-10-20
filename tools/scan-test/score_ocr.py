# Scores the output of the ocr_*.{mjs,ps1,py} runners against what the synthetic card fronts say.
# A field counts as found when its text appears anywhere in the engine's output (order and layout are not judged):
# this measures what the engine can SEE, which is what decides whether a field-extraction step can work at all.
# Usage: py score_ocr.py <fronts folder (with expect.json)> <result.json> [<result.json> ...]
import json, os, re, sys

folder, results = sys.argv[1], sys.argv[2:]
expect = json.load(open(os.path.join(folder, 'expect.json'), encoding='utf-8'))
ARABIC_INDIC = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')


def latin(s):
    s = s.upper().translate(ARABIC_INDIC)
    return re.sub(r'[^A-Z0-9]', '', s)


def arabic(s):
    s = re.sub(r'[ً-ٰٟـ]', '', s)                    # diacritics, tatweel
    s = re.sub('[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')       # letter variants OCR engines mix up
    return re.sub(r'[^ء-ي]', '', s)


def words(norm, text):
    return [w for w in (norm(x) for x in text.split()) if w]


# a name counts as found when every one of its words is in the text, in any order: Arabic engines often return the words of a
# line in the opposite order, which a later step can fix (the card layout says which line is the surname)
FIELDS = [
    ('nin', 'national number', lambda e: [latin(e['nin'])], latin),
    ('birth', 'birth date', lambda e: [latin(e['birth'][8:] + e['birth'][5:7] + e['birth'][:4])], latin),
    ('latSurname', 'Latin surname', lambda e: words(latin, e['latSurname']), latin),
    ('latGiven', 'Latin given name', lambda e: words(latin, e['latGiven']), latin),
    ('arSurname', 'Arabic surname', lambda e: words(arabic, e['arSurname']), arabic),
    ('arGiven', 'Arabic given name', lambda e: words(arabic, e['arGiven']), arabic),
]
CONDITIONS = ['flat', 'small', 'tilted', 'glare']
FONTS = ['tahoma', 'arial', 'trado']


def table(title, combined, secs, groups, group_of):
    print(f'\n=== {title}  ({len(combined)} pictures' + (f', {sum(secs) / len(secs):.1f} s per picture)' if secs else ')'))
    print('field'.ljust(20) + ''.join(g.rjust(8) for g in groups) + '   all')
    for key, label, want, norm in FIELDS:
        cells, tot, n = [], 0, 0
        for g in groups:
            names = [k for k in expect if group_of(k) == g and k in combined]
            hit = sum(1 for k in names if all(w in norm(combined[k]) for w in want(expect[k])))
            cells.append(f'{hit}/{len(names)}'.rjust(8))
            tot, n = tot + hit, n + len(names)
        print(label.ljust(20) + ''.join(cells) + f'   {100 * tot // max(n, 1)}%')


by_condition = lambda k: k.rsplit('_', 1)[1]
by_font = lambda k: k.split('_')[1]
loaded = {}
for path in results:
    data = json.load(open(path, encoding='utf-8-sig'))   # PowerShell writes a BOM
    # every recognizer language of an engine is read: the text of the engine is all of them together
    loaded[os.path.basename(path)] = {n: '\n'.join(v['texts'].values()) for n, v in data.items()}, [v['sec'] for v in data.values()]
for name, (combined, secs) in loaded.items():
    table(name + ' by picture condition', combined, secs, CONDITIONS, by_condition)
    table(name + ' by font', combined, [], FONTS, by_font)
if len(loaded) > 1:
    names = set.intersection(*(set(c) for c, _ in loaded.values()))
    both = {n: '\n'.join(c[n] for c, _ in loaded.values()) for n in names}
    table('ALL ENGINES TOGETHER (a field is found if any engine saw it)', both, [], CONDITIONS, by_condition)
