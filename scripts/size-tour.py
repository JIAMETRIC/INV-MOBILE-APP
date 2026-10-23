"""Drive the app through every screen at a given window size and save screenshots.
Usage: python -I scripts/size-tour.py <out_dir> <tag> <WxH px> <density>
       python -I scripts/size-tour.py <out_dir> reset        (restore the phone size)

Profiles used by /size-check (dp = px / (density / 160)):
  xs      640x1136  320   320 x 568 dp   xs   smallest supported phone
  sm      720x1600  320   360 x 800 dp   sm   common budget phone
  phone5  720x1280  320   360 x 640 dp   sm   5-inch phone (short)
  phone   1080x2400 420   411 x 914 dp   sm   the default emulator (baseline)
  phoneL  2400x1080 420   914 x 411 dp   lg   phone in landscape (tablet two-pane layout)
  tab8P   800x1280  213   601 x 961 dp   md   8-inch portrait
  tab8L   1280x800  213   961 x 601 dp   xl   8-inch landscape
  tab10P  1200x1920 240   800 x 1280 dp  lg   10-inch portrait
  tab10L  1920x1200 240   1280 x 800 dp  xxl  10-inch landscape
Needs: the phone emulator running on the host GPU (`emulator -avd Medium_Phone_API_37.0`),
the debug app installed, Metro on 8081 with `adb reverse tcp:8081 tcp:8081`.
The running emulator is resized with `wm size` / `wm density` (what the layout
code reads), the app is relaunched, and controls are found by accessibility
label (content-desc) or text through uiautomator."""
import os, re, subprocess, sys, time

ADB = os.path.join(os.environ["LOCALAPPDATA"], "Android", "Sdk", "platform-tools", "adb.exe")
if len(sys.argv) == 3 and sys.argv[2] == "reset":
    ADB_ = os.path.join(os.environ["LOCALAPPDATA"], "Android", "Sdk", "platform-tools", "adb.exe")
    subprocess.run([ADB_, "-e", "shell", "wm size reset"]); subprocess.run([ADB_, "-e", "shell", "wm density reset"])
    sys.exit(0)
OUT, TAG, SIZE, DENSITY = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
PKG = "com.jiametric.invoiceerp"
LINK = "invoiceerp://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
os.makedirs(OUT, exist_ok=True)
log = []

def adb(*a, capture=False, timeout=60):
    r = subprocess.run([ADB, "-e", *a], capture_output=True, timeout=timeout)
    return r.stdout if capture else None

def shell(cmd):
    return adb("shell", cmd, capture=True).decode("utf-8", "replace")

def find(label=None, text=None, nth=0):
    xml = adb("exec-out", "uiautomator", "dump", "/dev/tty", capture=True).decode("utf-8", "replace")
    hits = []
    for n in re.findall(r'<node [^>]*/?>', xml):
        d = re.search(r'content-desc="([^"]*)"', n)
        t = re.search(r' text="([^"]*)"', n)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        dv = d.group(1) if d else ""
        tv = t.group(1) if t else ""
        if (label and dv == label) or (text and tv == text):
            x1, y1, x2, y2 = map(int, b.groups())
            hits.append(((x1 + x2) // 2, (y1 + y2) // 2))
    if nth < 0:
        return hits[nth] if len(hits) >= -nth else None
    return hits[nth] if len(hits) > nth else None

def tap(label=None, text=None, nth=0, wait=2.5):
    p = find(label=label, text=text, nth=nth)
    if not p:
        log.append(f"MISSING {label or text}")
        return False
    adb("shell", "input", "tap", str(p[0]), str(p[1]))
    time.sleep(wait)
    return True

def shot(name):
    png = adb("exec-out", "screencap", "-p", capture=True)
    with open(os.path.join(OUT, f"{TAG}_{name}.png"), "wb") as f:
        f.write(png)
    log.append(f"shot {name} ({len(png)} bytes)")

def relaunch():
    shell(f"am force-stop {PKG}")
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", LINK, PKG)
    time.sleep(28)

shell(f"wm size {SIZE}")
shell(f"wm density {DENSITY}")
time.sleep(2)
relaunch()
shot("S1_dashboard")
tap(label="Invoices") and shot("S2_invoices")
if tap(label="Date range"):
    shot("S2_invoices_dates")
    tap(label="Date range (set)") or tap(label="Date range")
if tap(text="aSAsda"):
    shot("S3_detail")
    # One-pane sizes open S3 as an overlay under an "Invoice" back bar: go back to the list.
    if find(text="Invoice"):
        adb("shell", "input", "keyevent", "4"); time.sleep(2)
if tap(label="New invoice") or tap(text="New invoice"):
    shot("S4_create")
    if tap(text="Items"):
        shot("S4_items")
        if tap(text="Add from products"):
            shot("P2_catalog")
            adb("shell", "input", "keyevent", "4"); time.sleep(2)
    # Leave without changes: tablets have the rail; phones go Back.
    if not tap(label="Products"):
        adb("shell", "input", "keyevent", "4"); time.sleep(2)
        adb("shell", "input", "keyevent", "4"); time.sleep(2)
        tap(label="Products")
shot("S5_products")
if tap(text="Acid Wash T-Shirt"):
    shot("P3_editor")
    # The sheet has two "Close" nodes (the scrim and the ✕ button); the button is the last.
    if find(label="Close", nth=-1):
        tap(label="Close", nth=-1)
tap(label="Settings") and shot("S6_settings")
if tap(text="Company"):
    shot("S6_company")
tap(label="Home")
print("\n".join(log))
