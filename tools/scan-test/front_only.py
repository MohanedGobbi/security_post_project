# Calls only the printed-text reader (scan.readFront) on every picture of a folder, through the real app, and prints what came back:
# source (mrz = a machine-readable zone validated by its check digits; ocr = fields from the text; none), complete flag, seconds.
# Usage: py front_only.py <folder> <scratch data folder>
import base64, json, os, subprocess, sys, time, shutil
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CARDS, DATA = sys.argv[1], sys.argv[2]
shutil.rmtree(DATA, ignore_errors=True)
os.makedirs(DATA)
proc = subprocess.Popen([os.path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), '.', '--remote-debugging-port=9339'],
                        cwd=ROOT, env=dict(os.environ, SECREG_DATA_DIR=DATA))
try:
    with sync_playwright() as p:
        browser = None
        for _ in range(60):
            try:
                browser = p.chromium.connect_over_cdp('http://127.0.0.1:9339')
                if browser.contexts and browser.contexts[0].pages:
                    break
            except Exception:
                pass
            time.sleep(0.5)
        page = browser.contexts[0].pages[0]
        page.wait_for_function('() => !!window.api', timeout=20000)
        page.wait_for_timeout(2000)
        page.evaluate("async () => { await window.api.auth.loginPin('246810') }")
        for name in sorted(n for n in os.listdir(CARDS) if n.lower().endswith(('.jpg', '.jpeg', '.png'))):
            b64 = base64.b64encode(open(os.path.join(CARDS, name), 'rb').read()).decode()
            t0 = time.time()
            r = page.evaluate("async (b) => { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return window.api.scan.readFront(u) }", b64)
            print(name.ljust(40), r['source'].ljust(5), 'valid' if r['valid'] else '     ', 'complete' if r.get('complete') else '        ',
                  f'{time.time() - t0:.2f}s', json.dumps(r['fields'], ensure_ascii=False)[:110], flush=True)
        browser.close()
finally:
    subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
