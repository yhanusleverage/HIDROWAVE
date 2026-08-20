import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def w(rel, content):
    path = os.path.join(ROOT, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content.strip() + "\n")
    print("wrote", rel)

# master-relay-options
w("src/lib/master-relay-options.ts", open(os.path.join(ROOT, "src/lib/rule-procedure/types.ts")).read() if False else "")
