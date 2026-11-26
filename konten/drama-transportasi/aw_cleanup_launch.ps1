# Bersihkan SEMUA Chrome instance capture (ep7cap/ep8cap/ep8test) — BUKAN Chrome user
# (profil default tidak disentuh) — lalu luncurkan satu instance ep8cap segar.
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -like '*ep7cap-profile*' -or $_.CommandLine -like '*ep8cap-profile*' -or $_.CommandLine -like '*ep8test-profile*'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 3
$sisa = (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -like '*ep*cap-profile*' -or $_.CommandLine -like '*ep8test-profile*'
}).Count
Write-Output "sisa chrome capture: $sisa"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cmd = "`"$chrome`" --headless=new --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 --user-data-dir=C:\Users\alienware\ep8cap-profile --window-size=720,1280 --use-angle=d3d11 --hide-scrollbars --mute-audio --no-first-run --disable-extensions about:blank"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
Write-Output "WMI create ReturnValue: $($r.ReturnValue) ProcessId: $($r.ProcessId)"
Start-Sleep -Seconds 8
try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9333/json/version -TimeoutSec 8).StatusCode } catch { "CDP_FAIL" }
netstat -ano | Select-String '9333'
