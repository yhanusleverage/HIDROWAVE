#!/usr/bin/env python3
"""Fix UTF-8 mojibake (cp1252/latin-1 misinterpretation) in source files."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
MARKERS = ("Ã", "â", "ðŸ", "ï¸", "â€", "Â", "âŒ", "â–", "â„", "âœ", "âš", "âž")

PT_REPLACEMENTS = [
    ("Ã§Ãµes", "ções"),
    ("Ã§Ã£o", "ção"),
    ("Ãµes", "ões"),
    ("Ã£o", "ão"),
    ("Ã¡", "á"),
    ("Ã­", "í"),
    ("Ã©", "é"),
    ("Ãª", "ê"),
    ("Ãµ", "õ"),
    ("Ã¢", "â"),
    ("Ã³", "ó"),
    ("Ãº", "ú"),
    ("Ã§", "ç"),
    ("Ã ", "à"),
    ("Ã‰", "É"),
    ("Ã“", "Ó"),
    ("Ã—", "×"),
    ("Â±", "±"),
    ("Âµ", "µ"),
    ("â€\u201d", "\u2014"),
    ("âˆ\u2019", "\u2212"),
    ("â†\u2019", "\u2192"),
]


def try_decode_chunk(chunk: str) -> str:
    for enc in ("cp1252", "latin-1"):
        try:
            return chunk.encode(enc).decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
    return chunk


def fix_line(line: str) -> str:
    if not any(m in line for m in MARKERS):
        return line

    for old, new in PT_REPLACEMENTS:
        line = line.replace(old, new)

    if not any(m in line for m in MARKERS):
        return line

    fixed = try_decode_chunk(line)
    if fixed != line:
        return fixed

    def repl_run(match: re.Match[str]) -> str:
        chunk = match.group(0)
        decoded = try_decode_chunk(chunk)
        return decoded if decoded != chunk else chunk

    line = re.sub(r"[\u0080-\u024f\u2000-\u20ff]{2,}", repl_run, line)
    line = re.sub(r"â[\u0080-\uffff]{1,8}", repl_run, line)
    line = re.sub(r"ðŸ[\u0080-\uffff]{1,8}", repl_run, line)

    for old, new in PT_REPLACEMENTS:
        line = line.replace(old, new)

    return line


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    lines = [fix_line(l) for l in original.splitlines()]
    fixed = "\n".join(lines)
    if original.endswith("\n"):
        fixed += "\n"
    if fixed != original:
        path.write_text(fixed, encoding="utf-8", newline="\n")
        return True
    return False


def main() -> int:
    changed = 0
    for path in sorted(ROOT.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if process_file(path):
            print("fixed:", path)
            changed += 1
    print("total:", changed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
