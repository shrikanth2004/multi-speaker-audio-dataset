$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$env:PYTHONPATH = $backend
Set-Location $backend
& (Join-Path $backend ".venv\Scripts\python.exe") main.py
