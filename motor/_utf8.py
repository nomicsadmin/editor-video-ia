"""Windows usa cp1252 por padrão: acento, emoji e nome de arquivo com "Í" quebram. Isto deixa tudo em UTF-8.
Importado no topo de cada script do motor (no Mac não muda nada)."""
import builtins
import os
import subprocess
import sys

if os.name == "nt":
    os.environ.setdefault("PYTHONUTF8", "1")  # para os processos filhos
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    _open = builtins.open

    def _open_utf8(f, mode="r", *a, **k):
        if "b" not in mode and not a and "encoding" not in k:
            k["encoding"] = "utf-8"
        return _open(f, mode, *a, **k)

    builtins.open = _open_utf8
    _run = subprocess.run

    def _run_utf8(*a, **k):
        if (k.get("text") or k.get("universal_newlines")) and "encoding" not in k:
            k["encoding"] = "utf-8"; k.setdefault("errors", "replace")
        return _run(*a, **k)

    subprocess.run = _run_utf8
