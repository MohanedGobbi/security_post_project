# Runs every card FRONT made by make_fronts.py through the real desktop app (the "import a photo" path of the Visitor entry
# screen) and compares the form with what the card says. Needs Windows OCR for the real path; the app falls back to Tesseract.
# Usage: py run_fronts.py <fronts folder> <scratch data folder> <results.json> [only-this-name-part]
import json, os, re, subprocess, sys, time, shutil
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CARDS, DATA, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
only = sys.argv[4] if len(sys.argv) > 4 else ''
shutil.rmtree(DATA, ignore_errors=True)
os.makedirs(DATA)
# with expect.json (made by make_fronts.py) every field is checked; without it (real cards) the values read are only printed
EXPECT = os.path.join(CARDS, 'expect.json')
expect = json.load(open(EXPECT, encoding='utf-8')) if os.path.exists(EXPECT) else {os.path.splitext(n)[0]: None for n in os.listdir(CARDS) if n.lower().endswith(('.jpg', '.jpeg', '.png'))}
FILES = {os.path.splitext(n)[0]: n for n in os.listdir(CARDS)}
proc = subprocess.Popen([os.path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), '.', '--remote-debugging-port=9338'],
                        cwd=ROOT, env=dict(os.environ, SECREG_DATA_DIR=DATA))
AR = lambda s: re.sub(r'\s+', ' ', re.sub('[أإآٱ]', 'ا', re.sub('[ً-ٰٟـ]', '', s)).replace('ى', 'ي').replace('ة', 'ه')).strip()
title = lambda s: re.sub(r"(^|[\s'-])(\w)", lambda m: m.group(1) + m.group(2).upper(), s.lower())
rows = []
try:
    with sync_playwright() as p:
        browser = None
        for _ in range(60):
            try:
                browser = p.chromium.connect_over_cdp('http://127.0.0.1:9338')
                if browser.contexts and browser.contexts[0].pages:
                    break
            except Exception:
                pass
            time.sleep(0.5)
        page = browser.contexts[0].pages[0]
        page.wait_for_function('() => !!window.api', timeout=20000)
        page.wait_for_timeout(2000)
        page.evaluate("async () => { await window.api.auth.loginPin('246810') }")
        page.reload()
        page.wait_for_timeout(2500)
        for name in sorted(expect):
            if only and only not in name:
                continue
            e = expect[name]
            page.keyboard.press('Escape')
            page.keyboard.press('F2')
            page.wait_for_selector('input[type=file]', state='attached', timeout=10000)
            t0 = time.time()
            page.set_input_files('input[type=file]', os.path.join(CARDS, FILES[name]))
            try:
                page.wait_for_selector('.camera-busy', timeout=4000)
            except Exception:
                pass
            page.wait_for_selector('.camera-busy', state='detached', timeout=180000)
            page.wait_for_timeout(300)
            dt = time.time() - t0
            v = page.evaluate("() => Object.fromEntries(['fullName', 'fullNameAlt', 'idNumber', 'birthDate', 'nationality'].map(k => [k, document.getElementById('f-' + k)?.value ?? '']))")
            if e is None:
                print(name, json.dumps(v, ensure_ascii=False), f'{dt:.1f}s', flush=True)
                rows.append({'case': name, 'sec': round(dt, 1), 'got': v})
                continue
            r = {
                'case': name,
                'nin': v['idNumber'] == e['nin'],
                'birth': v['birthDate'] == e['birth'],
                'latin': v['fullName'] == title(f"{e['latGiven']} {e['latSurname']}"),
                'arabic': AR(v['fullNameAlt']) == AR(f"{e['arGiven']} {e['arSurname']}"),
                'sec': round(dt, 1), 'got': v,
            }
            rows.append(r)
            print('OK ' if r['nin'] and r['latin'] else 'BAD', name, *(k if r[k] else '-' for k in ('nin', 'birth', 'latin', 'arabic')), f'{dt:.1f}s', flush=True)
        browser.close()
finally:
    subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
    json.dump(rows, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = len(rows) or 1
if any(v is not None for v in expect.values()):
    for k, label in (('nin', 'national number'), ('birth', 'birth date'), ('latin', 'Latin name'), ('arabic', 'Arabic name')):
        print(f'{label}: {sum(1 for r in rows if r.get(k))}/{len(rows)}')
print(f'average {sum(r["sec"] for r in rows) / n:.1f} s per card')
