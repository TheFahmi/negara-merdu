$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$prof = "C:\Users\alienware\ep6cap-profile2"
$args = @("--headless=new","--remote-debugging-port=9333","--remote-debugging-address=0.0.0.0","--user-data-dir=$prof","--window-size=720,1280","--use-angle=d3d11","--hide-scrollbars","--mute-audio","--no-first-run","about:blank")
$p = Start-Process $chrome -ArgumentList $args -RedirectStandardError "C:\Users\alienware\ep6cap\chrome_err.log" -PassThru
Write-Output "launcher pid: $($p.Id)"
Start-Sleep -Seconds 6
Write-Output "exited: $($p.HasExited)"
if ($p.HasExited) { Write-Output "exitcode: $($p.ExitCode)" }
$n = (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep6cap-profile2*' }).Count
Write-Output "proc profile2: $n"
try { $v = (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9333/json/version -TimeoutSec 6).Content; Write-Output "CDP OK" } catch { Write-Output "CDP FAIL: $($_.Exception.Message)" }
Get-Content "C:\Users\alienware\ep6cap\chrome_err.log" -Tail 6 -ErrorAction SilentlyContinue
