$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' }
$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 3
$sisa = (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' }).Count
Write-Output "chrome ep9cap dibunuh: $($procs.Count), sisa: $sisa"
try { (Invoke-WebRequest -Uri http://127.0.0.1:9333/json/version -TimeoutSec 4).StatusCode } catch { Write-Output "CDP 9333: mati (sesuai harapan)" }
