# temp test
path = r"c:\Users\THANUS\Documents\Projects\ESP-NEW_HOPE - FRONTEND - BACKUP -\HIDROWAVE-main\src\app\automacao\AutomacaoPageClient.tsx"
with open(path, encoding="utf-8") as f:
    line = f.readlines()[2017]
import re
m = re.search(r">([^<]+)<", line)
text = m.group(1)
print("raw:", [hex(ord(c)) for c in text])
for i in range(len(text)):
    seg = text[: i + 1]
    try:
        seg.encode("latin-1")
    except Exception as e:
        print("break at", i, repr(text[i]), e)
        break
try:
    fixed = text[:4].encode("latin-1").decode("utf-8")
    print("first4 fixed:", repr(fixed))
except Exception as e:
    print("first4 err", e)
