Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep6cap-profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 2
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" }
if (-not (Test-Path $chrome)) { $chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" }
$args = @("--headless=new","--remote-debugging-port=9333","--remote-debugging-address=0.0.0.0","--user-data-dir=C:\Users\alienware\ep6cap-profile","--window-size=720,1280","--use-angle=d3d11","--hide-scrollbars","--mute-audio","--no-first-run","--disable-extensions","about:blank")
Start-Process $chrome -ArgumentList $args
Start-Sleep -Seconds 4
try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9333/json/version -TimeoutSec 8).Content } catch { "PORT9333_FAIL: $_" }
