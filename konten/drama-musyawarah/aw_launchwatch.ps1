$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\alienware\aw_watchcap.ps1' }
Write-Output ("watcher launch rc: " + $r.ReturnValue + " PID: " + $r.ProcessId)
Start-Sleep -Seconds 5
if (Test-Path C:\Users\alienware\ep9cap\watch_status.txt) { Get-Content C:\Users\alienware\ep9cap\watch_status.txt } else { Write-Output "status file belum ada" }
