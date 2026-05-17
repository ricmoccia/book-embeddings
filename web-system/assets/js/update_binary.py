"""
update_binary.py - Patcher di binary.js generato da Emscripten

Cosa fa:
  1. Tiene un backup di binary.js "pulito" (post-emcc, pre-patch) in
     binary.original.js. La prima volta che lo lanci dopo aver compilato
     fa il backup; le volte successive ripristina da quel backup prima di
     ripatchare. Cosi' puoi rilanciarlo quante volte vuoi senza che si
     duplichi nulla.
  2. Sostituisce le chiamate a "out(...)" dentro put_char/fsync della
     default_tty_ops con chiamate a getDataFromWasm(...): in questo modo
     ogni riga che il C++ scrive su stdout passa attraverso il nostro
     parser JS invece di andare direttamente in console.
  3. Appende code_to_append.js alla fine di binary.js, dove abbiamo
     getDataFromWasm, drawLayout, drawBCT, ecc.

Compatibile con:
  - Emscripten 3.x (sintassi "put_char:function(tty,val){...}")
  - Emscripten 4.x (sintassi method-shorthand "put_char(tty,val){...}")

NOTA su Module.noInitialRun:
  In Emscripten 4.x non esiste piu' la variabile shouldRunNow. Per evitare
  che main() parta automaticamente al caricamento della pagina senza
  argomenti, ricompila con il flag -s INVOKE_RUN=0 (gia' aggiunto allo
  compile-wasm.ps1 aggiornato).
"""

import os
import shutil


# Coppie (vecchio, nuovo). Coprono SIA la sintassi Emscripten 3.x SIA 4.x;
# una delle due nella maggior parte dei casi non trovera' niente da
# sostituire, e va bene cosi'.
substitutions = {
    # Emscripten 4.x: method shorthand (sintassi ES6)
    "put_char(tty,val){if(val===null||val===10){out(":
        "put_char(tty,val){if(val===null||val===10){getDataFromWasm(",
    "fsync(tty){if(tty.output?.length>0){out(":
        "fsync(tty){if(tty.output?.length>0){getDataFromWasm(",

    # Emscripten 3.x: sintassi classica (per retrocompatibilita')
    ",put_char:function(tty,val){if(val===null||val===10){out":
        ",put_char:function(tty,val){if(val===null||val===10){getDataFromWasm",
    "var shouldRunNow=true":
        "var shouldRunNow=false",
}


binary_path   = "./binary.js"
original_path = "./binary.original.js"
append_path   = "./code_to_append.js"


# --- Step 1: gestione del backup -------------------------------------------
# Se non esiste binary.original.js, lo creiamo come copia dell'attuale
# binary.js (che assumiamo essere "pulito", appena uscito da emcc).
# Se esiste, lo usiamo come sorgente fresca e sovrascriviamo binary.js.
if not os.path.exists(original_path):
    if not os.path.exists(binary_path):
        print(f"errore: non trovo {binary_path}")
        raise SystemExit(1)
    shutil.copy(binary_path, original_path)
    print(f"creato backup pulito: {original_path}")
else:
    # Ripristiniamo da backup PRIMA di applicare le sostituzioni.
    # ATTENZIONE: questo significa che se hai ricompilato il C++ devi
    # cancellare a mano binary.original.js, altrimenti i tuoi nuovi
    # binary.js vengono sovrascritti da quello vecchio. Per sicurezza
    # confrontiamo le date.
    bin_mtime  = os.path.getmtime(binary_path)
    orig_mtime = os.path.getmtime(original_path)
    if bin_mtime > orig_mtime + 1:  # binary.js piu' nuovo di almeno 1 sec
        print(f"binary.js piu' recente del backup: aggiorno {original_path}")
        shutil.copy(binary_path, original_path)
    else:
        shutil.copy(original_path, binary_path)
        print(f"ripristinato {binary_path} dal backup pulito")


# --- Step 2: leggi binary.js e applica le sostituzioni --------------------
with open(binary_path, "r", encoding="utf-8") as f:
    content = f.read()

n_substitutions_done = 0
for old, new in substitutions.items():
    if old in content:
        content = content.replace(old, new)
        n_substitutions_done += 1
        print(f"  applicata sostituzione su: {old[:60]}...")
    else:
        print(f"  saltata (pattern non trovato): {old[:60]}...")

if n_substitutions_done == 0:
    print("ATTENZIONE: nessuna sostituzione applicata! Controlla i pattern.")


# --- Step 3: appendi code_to_append.js ------------------------------------
if not os.path.exists(append_path):
    print(f"errore: non trovo {append_path}")
    raise SystemExit(1)

with open(append_path, "r", encoding="utf-8") as f:
    code_to_append = f.read()

content += "\n" + code_to_append

with open(binary_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"OK: {binary_path} patchato e appeso a {append_path}")