# Runs every card made by make_cards.py through the real desktop app (the "import a photo" path of the Visitor entry screen,
# which is the same code as the camera) and compares what the form shows with what the card says.
# Usage: py run_cards.py <cards folder> <scratch data folder> <results.json> [only-this-name-part]
# Needs: the app built (npm run build), Playwright for Python and Google Chrome's driver (pip install playwright).
import json, os, subprocess, sys, time, shutil
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CARDS, DATA, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
only = sys.argv[4] if len(sys.argv) > 4 else ''
shutil.rmtree(DATA, ignore_errors=True)
os.makedirs(DATA)
expect = json.load(open(os.path.join(CARDS, 'expect.json'), encoding='utf-8'))
proc = subprocess.Popen([os.path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), '.', '--remote-debugging-port=9336'],
                        cwd=ROOT, env=dict(os.environ, SECREG_DATA_DIR=DATA))
rows = []
try:
    with sync_playwright() as p:
        browser = None
        for _ in range(60):
            try:
                browser = p.chromium.connect_over_cdp('http://127.0.0.1:9336')
                if browser.contexts and browser.contexts[0].pages:
                    break
            except Exception:
                pass
            time.sleep(0.5)
        page = browser.contexts[0].pages[0]
        page.wait_for_function('() => !!window.api', timeout=20000)
        page.wait_for_timeout(2000)
        # the program creates its own accounts at the first start (starting PIN of the administrator: src/shared/faculty.ts)
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
            page.set_input_files('input[type=file]', os.path.join(CARDS, name + '.jpg'))
            try:
                page.wait_for_selector('.camera-busy', timeout=4000)
            except Exception:
                pass
            page.wait_for_selector('.camera-busy', state='detached', timeout=180000)
            page.wait_for_timeout(300)
            dt = time.time() - t0
            vals = page.evaluate("() => [...document.querySelectorAll('form.visitor-form input, form.visitor-form select')].map(i => i.value)")
            text = ' '.join(vals).replace(' ', '').lower()
            got_doc = e['doc'] in text
            got_name = e['surname'].replace(' ', '').lower() in text and e['given'].replace(' ', '').lower() in text
            yy = int(e['birth'][:2])
            got_birth = ('19' if yy > 26 else '20') + e['birth'][:2] + '-' + e['birth'][2:4] + '-' + e['birth'][4:6] in ' '.join(vals)
            rows.append({'case': name, 'doc': got_doc, 'name': got_name, 'birth': got_birth, 'sec': round(dt, 1)})
            print('OK ' if got_doc and got_name else 'BAD', name, 'doc' if got_doc else '-', 'name' if got_name else '-', 'birth' if got_birth else '-', f'{dt:.1f}s', flush=True)
        browser.close()
finally:
    subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
    json.dump(rows, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
ok = sum(1 for r in rows if r['doc'] and r['name'])
print(f'{ok}/{len(rows)} read correctly (document number and name)')
