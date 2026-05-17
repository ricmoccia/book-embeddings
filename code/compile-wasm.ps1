# compile-wasm.ps1
# ----------------------------------------------------------------------
# Compila main_enum.cpp per WebAssembly usando l'OGDF buildato in
# build-wasm. Produce binary.js + binary.wasm direttamente dentro
# web-system\assets\js\ così non devi spostarli a mano.
#
# Prerequisiti (devi farli una volta sola in ogni nuovo terminale):
#   cd C:\Users\riccardo\Desktop\book-embeddings\book-embeddings\emsdk
#   .\emsdk_env.ps1
#
# Uso:
#   .\compile-wasm.ps1
# ----------------------------------------------------------------------

$ErrorActionPreference = "Stop"

# --- Path della tua installazione ---
$ProjectRoot = "C:\Users\riccardo\Desktop\book-embeddings\book-embeddings"
$OutputDir   = "$ProjectRoot\web-system\assets\js"
$Source      = "$ProjectRoot\code\main_enum.cpp"

$OgdfRoot   = "C:\Users\riccardo\Desktop\book-embeddings\ogdf"
$OgdfBuild  = "$OgdfRoot\build-wasm"

# --- Sanity check ---
if (-not (Get-Command em++ -ErrorAction SilentlyContinue)) {
    Write-Error "em++ non trovato. Hai eseguito .\emsdk_env.ps1 in emsdk\ in questa sessione?"
    exit 1
}
if (-not (Test-Path $Source))             { Write-Error "Non trovo $Source";       exit 1 }
if (-not (Test-Path "$OgdfBuild\libOGDF.a")) { Write-Error "Non trovo libOGDF.a in $OgdfBuild"; exit 1 }
if (-not (Test-Path "$OgdfBuild\libCOIN.a")) { Write-Error "Non trovo libCOIN.a in $OgdfBuild"; exit 1 }
if (-not (Test-Path "$OgdfBuild\include\ogdf-release\ogdf\basic\internal\config_autogen.h")) {
    Write-Error "Non trovo config_autogen.h sotto ogdf-release. Hai buildato in Release? Se hai usato Debug, cambia 'ogdf-release' in 'ogdf-debug' nello script."
    exit 1
}
if (-not (Test-Path $OutputDir))          { Write-Error "Non trovo $OutputDir";    exit 1 }

Push-Location $OutputDir
try {
    Write-Host "===> Compilo $Source" -ForegroundColor Cyan
    em++ -O3 `
        -I"$OgdfRoot\include" `
        -I"$OgdfRoot\src" `
        -I"$OgdfBuild\include\ogdf-release" `
        -c $Source -o file.o
    if ($LASTEXITCODE -ne 0) { throw "Compilazione fallita (codice $LASTEXITCODE)" }

    Write-Host "===> Linko con libOGDF + libCOIN" -ForegroundColor Cyan
    em++ -O3 `
        -o binary.js `
        -L"$OgdfBuild" `
        file.o `
        -lOGDF -lCOIN `
        -s ALLOW_MEMORY_GROWTH=1 `
        -s NO_DISABLE_EXCEPTION_CATCHING `
        -s "EXPORTED_FUNCTIONS=['_main']" `
        -s "EXPORTED_RUNTIME_METHODS=['callMain','ccall']"
    if ($LASTEXITCODE -ne 0) { throw "Link fallito (codice $LASTEXITCODE)" }

    Remove-Item file.o -ErrorAction SilentlyContinue
    Write-Host "===> OK: binary.js + binary.wasm in $OutputDir" -ForegroundColor Green
    Write-Host "===> Prossimo step: python update_binary.py" -ForegroundColor Yellow
}
finally {
    Pop-Location
}