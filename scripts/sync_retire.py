"""Bring "Will My Money Be Enough?" into Money Tracking as public/retire/ (English only, works offline).

The calculator lives in its own repository (popo54321/will-my-money-be-enough). This script copies it in and
adapts it to run inside the app, so the same content can be pulled in again whenever the calculator changes:

    python3 scripts/sync_retire.py <path to the calculator checkout> [<folder with chart.umd.js and html2canvas.min.js>]

What it changes (every step checks that the text it replaces is there, so a changed source fails loudly):
- English only: the Thai and Chinese files and the language buttons are left out.
- Offline: Chart.js and html2canvas come from vendor/ and Nunito from fonts/ instead of the internet.
- No second installable app: the calculator's own service worker and manifest are left out.
- Inside the app: saving and sharing go through Money Tracking (an app's built-in browser can't download files
  or open the share menu), share links point to the public page, and it starts in the app's light or dark look
  until the person picks a look in the calculator.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'retire'
PUBLIC_URL = 'https://popo54321.github.io/will-my-money-be-enough/'


def rep(text: str, old: str, new: str, name: str, count: int = 1) -> str:
    if old not in text:
        sys.exit(f'sync_retire: expected text not found in {name}:\n{old[:200]}')
    return text.replace(old, new, count)


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).resolve()
    vendor_src = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else OUT / 'vendor'
    for f in ['index.html', 'css/styles.css', 'js/app.js', 'js/icons.js', 'js/i18n/en.js']:
        if not (src / f).exists():
            sys.exit(f'sync_retire: {src / f} is missing; is this the calculator checkout?')

    # keep the vendored libraries while the rest is replaced
    keep = {}
    for lib in ['chart.umd.js', 'html2canvas.min.js']:
        p = vendor_src / lib
        if not p.exists():
            sys.exit(f'sync_retire: {p} is missing (download Chart.js 4.4.1 and html2canvas 1.4.1)')
        keep[lib] = p.read_bytes()
    # the themes (themes/) are made in Money Tracking, not in the calculator: keep them
    themes = None
    if (OUT / 'themes').exists():
        themes = ROOT / 'node_modules' / '.retire-themes-keep'
        if themes.exists():
            shutil.rmtree(themes)
        shutil.copytree(OUT / 'themes', themes)
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / 'js' / 'i18n').mkdir(parents=True)
    (OUT / 'css').mkdir()
    (OUT / 'vendor').mkdir()
    (OUT / 'fonts').mkdir()
    for lib, data in keep.items():
        (OUT / 'vendor' / lib).write_bytes(data)
    if themes:
        shutil.copytree(themes, OUT / 'themes')
        shutil.rmtree(themes)
    font = ROOT / 'node_modules' / '@fontsource-variable' / 'nunito' / 'files' / 'nunito-latin-wght-normal.woff2'
    shutil.copy(font, OUT / 'fonts' / 'nunito.woff2')
    shutil.copy(src / 'js' / 'icons.js', OUT / 'js' / 'icons.js')
    shutil.copy(src / 'js' / 'i18n' / 'en.js', OUT / 'js' / 'i18n' / 'en.js')

    # ---- index.html
    name = 'index.html'
    h = (src / name).read_text(encoding='utf-8')
    h = re.sub(r'<link rel="preconnect"[^>]*>\n', '', h)
    h = rep(h, re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n', h).group(0), '', name)
    h = rep(h, '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>',
            '<script src="vendor/chart.umd.js"></script>', name)
    h = rep(h, '<link rel="manifest" href="manifest.webmanifest">\n', '', name)
    h = re.sub(r'<link rel="(icon|apple-touch-icon)"[^>]*>\n', '', h)
    h = rep(h, re.search(r'  <div class="langbar".*?</div></div>\n', h, re.S).group(0), '', name)
    h = rep(h, '<script src="js/i18n/th.js"></script>\n', '', name)
    h = rep(h, '<script src="js/i18n/zh.js"></script>\n', '', name)
    # the app's six themes: their look, and per theme the names, words and pictures (themes/loader.js picks one)
    h = rep(h, '<link rel="stylesheet" href="css/styles.css">', '<link rel="stylesheet" href="css/styles.css">\n<link rel="stylesheet" href="themes/themes.css">', name)
    h = rep(h, '<script src="js/icons.js"></script>\n', '<script src="js/icons.js"></script>\n<script src="themes/loader.js"></script>\n', name)
    (OUT / name).write_text(h, encoding='utf-8')

    # ---- css/styles.css
    name = 'css/styles.css'
    c = (src / name).read_text(encoding='utf-8')
    c = c.replace('"Nunito","Noto Sans Thai","Noto Sans SC",system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif',
                  '"Nunito",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif')
    # the language bar's own rules (whole rules only; one shared rule just loses its .langbar part)
    c = rep(c, ',:root[data-look="night"] .langbar', '', name)
    c = re.sub(r'(?m)^\.langbar[^{]*\{[^}]*\}\n?', '', c)
    if '.langbar' in c:
        sys.exit('sync_retire: a .langbar rule is left in styles.css; update the script')
    c = ('/* Nunito ships with the app, so the page looks the same offline */\n'
         '@font-face{font-family:"Nunito";font-style:normal;font-display:swap;font-weight:200 1000;'
         'src:url("../fonts/nunito.woff2") format("woff2");}\n') + c
    (OUT / name).write_text(c, encoding='utf-8')

    # ---- js/app.js
    name = 'js/app.js'
    a = (src / name).read_text(encoding='utf-8')
    a = rep(a, '''const FONT = '"Nunito", "Noto Sans Thai", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';''',
            '''const FONT = '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif';''', name)
    # English only
    a = rep(a, "    $('langSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === LANG)));\n", '', name)
    a = rep(a, "    lang: navLang.startsWith('th') ? 'th' : (navLang.startsWith('zh') ? 'zh' : 'en')};",
            "    lang: 'en', lookSet: false};", name)
    a = rep(a, "      if (saved.ui.lang && I18N[saved.ui.lang]) ui.lang = saved.ui.lang;\n", '', name)
    a = rep(a, "      if (saved.ui.look === 'night') ui.look = 'night';",
            "      if (saved.ui.look === 'night') ui.look = 'night';\n      if (saved.ui.lookSet) ui.lookSet = true;", name)
    a = rep(a, "  LANG = ui.lang;\n",
            "  LANG = ui.lang = 'en';\n"
            "  // inside Money Tracking: start in the app's light or dark look until the person picks a look here\n"
            "  const appLook = new URLSearchParams(location.search).get('look');\n"
            "  if (appLook === 'night' || appLook === 'cream') ui.look = appLook;\n", name)
    # each theme brings its own colours for the level pictures' circles
    a = rep(a, "  const TIER_BG = ['#EFE6D8', '#F7DFCB', '#D3EEDC', '#F6E6B4'], GOD_BG = '#EAE2FA';",
            "  const TH = window.MMA.theme || {};\n"
            "  const TIER_BG = TH.tiers || ['#EFE6D8', '#F7DFCB', '#D3EEDC', '#F6E6B4'], GOD_BG = TH.godBg || '#EAE2FA';", name)
    a = rep(a, "const tierBg = n => n === GOD ? GOD_BG : n === LABOUR ? '#EDE3D3' : TIER_BG",
            "const tierBg = n => n === GOD ? GOD_BG : n === LABOUR ? (TH.labourBg || '#EDE3D3') : TIER_BG", name)
    a = rep(a, "(qq.god ? GOD_BG : '#F6E6B4')", "(qq.god ? GOD_BG : TIER_BG[3])", name)
    a = rep(a, re.search(r"  \$\('langSeg'\)\.addEventListener\('click', e => \{.*?\n  \}\);\n", a, re.S).group(0), '', name)
    a = rep(a, "    ui.look = b.dataset.v === 'night' ? 'night' : 'cream'; applyLook();",
            "    ui.look = b.dataset.v === 'night' ? 'night' : 'cream'; ui.lookSet = true; applyLook();", name)
    # offline libraries
    a = rep(a, "const H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';",
            "const H2C = 'vendor/html2canvas.min.js';", name)
    # no service worker of its own: Money Tracking already keeps every file for offline use
    a = rep(a, re.search(r"  // hosted on its own, the page can be added.*?\n  \}\n", a, re.S).group(0),
            "  // inside Money Tracking the app saves and shares files (its built-in browser can't download or share),\n"
            "  // and links point to the public page\n"
            "  const HOST = (() => { try { return window.parent !== window && window.parent.mtCalcHost ? window.parent.mtCalcHost : null; } catch(e){ return null; } })();\n"
            f"  const PUBLIC_URL = '{PUBLIC_URL}';\n", name)
    a = rep(a, "  async function saveBlob(blob, name){\n    name = name || IMG_SHORT;\n",
            "  async function saveBlob(blob, name){\n    name = name || IMG_SHORT;\n"
            "    if (HOST){ await HOST.saveFile(blob, name); return; }\n", name)
    a = rep(a, "  const pageUrl = () => /^https?:$/.test(location.protocol) ? location.href.split('#')[0] : '';",
            "  const pageUrl = () => HOST ? PUBLIC_URL : (/^https?:$/.test(location.protocol) ? location.href.split('#')[0] : '');", name)
    a = rep(a, "  function shareSafe(){\n    if (!imgSafe || !navigator.canShare) return false;\n",
            "  function shareSafe(){\n"
            "    if (HOST && imgSafe){\n"
            "      const url = pageUrl();\n"
            "      HOST.shareFile(imgSafe, IMG_SHORT, url ? shareText() + ' ' + url : shareText()).then(() => { $('pdfMsg').textContent = ''; }).catch(() => {});\n"
            "      return true;\n"
            "    }\n"
            "    if (!imgSafe || !navigator.canShare) return false;\n", name)
    a = rep(a, "    const canShare = !!(navigator.share && navigator.canShare);",
            "    const canShare = !!HOST || !!(navigator.share && navigator.canShare);", name)
    (OUT / name).write_text(a, encoding='utf-8')

    # where it came from, for the next sync
    try:
        head = subprocess.run(['git', '-C', str(src), 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        head = ''
    (OUT / 'SOURCE.json').write_text(json.dumps({'repo': 'popo54321/will-my-money-be-enough', 'commit': head,
                                                  'note': 'Made by scripts/sync_retire.py; change the calculator there, then sync.'},
                                                 indent=1) + '\n')
    print(f'ok: {OUT.relative_to(ROOT)} from {head[:7] or src}')


if __name__ == '__main__':
    main()
