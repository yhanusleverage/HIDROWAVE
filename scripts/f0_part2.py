import os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def w(rel, content):
    path = os.path.join(BASE, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("W", rel)
