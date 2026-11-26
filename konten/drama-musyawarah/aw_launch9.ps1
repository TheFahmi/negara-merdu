# Luncurkan SATU instance capture bersih ep9cap-profile di port 9333 (pola aw_cleanup_launch).
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cmd = "`"$chrome`" --headless=new --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 --user-data-dir=C:\Users\alienware\ep9cap-profile --window-size=720,1280 --use-angle=d3d11 --hide-scrollbars --mute-audio --no-first-run --disable-extensions --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=IntensiveWakeUpThrottling about:blank"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
Write-Output "WMI create ReturnValue: $($r.ReturnValue) ProcessId: $($r.ProcessId)"
Start-Sleep -Seconds 8
try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9333/json/version -TimeoutSec 8).StatusCode } catch { "CDP_FAIL" }
$inst = (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' }).Count
Write-Output "proses ep9cap-profile: $inst"
