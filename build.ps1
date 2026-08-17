# Build omp-models-editor (Wails v2, no npm needed).
# Produces build\bin\omp-models-editor.exe, then compresses with UPX.
$ErrorActionPreference = "Stop"
wails build -clean
if (Get-Command upx -ErrorAction SilentlyContinue) {
    upx --best "build\bin\omp-models-editor.exe"
} else {
    Write-Host "upx not found - skipping compression"
}
Get-Item "build\bin\omp-models-editor.exe" | Select-Object FullName, @{N='SizeMB';E={[math]::Round($_.Length/1MB, 2)}}
