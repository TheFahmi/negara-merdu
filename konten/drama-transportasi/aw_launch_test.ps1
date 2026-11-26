$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cmd = "`"$chrome`" --headless=new --remote-debugging-port=9334 --remote-debugging-address=127.0.0.1 --user-data-dir=C:\Users\alienware\ep8test-profile --window-size=720,1280 --use-angle=d3d11 --hide-scrollbars --mute-audio --no-first-run --disable-extensions about:blank"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
Write-Output "WMI create ReturnValue: $($r.ReturnValue) ProcessId: $($r.ProcessId)"
Start-Sleep -Seconds 6
try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9334/json/version -TimeoutSec 6).StatusCode } catch { "CDP_FAIL" }
