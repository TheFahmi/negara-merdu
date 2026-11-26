# Jalankan sisa shot (kop,mal,plzA,plzB,p9) dengan prioritas High; matikan watcher
# supaya tidak ada driver ganda. ist sudah terekam bagus (257 frame, tes prioritas).
$w = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*aw_watchcap*' }
$w | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Output ("watcher dimatikan: " + $w.Count)
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' } | ForEach-Object {
  try { (Get-Process -Id $_.ProcessId).PriorityClass = 'High' } catch {}
}
$py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
$cmd = "cmd /c set DM_MODE=full && set DM_SHOTS=kop,mal,plzA,plzB,p9 && `"$py`" C:\Users\alienware\ep9cap\dm_capture_aw.py"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep9cap" }
Write-Output ("driver full PID: " + $r.ProcessId)
Start-Sleep -Seconds 6
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*dm_capture*' } | ForEach-Object {
  try { (Get-Process -Id $_.ProcessId).PriorityClass = 'High' } catch {}
  Write-Output ("driver python PID " + $_.ProcessId + " -> High")
}
"capture full jalan $(Get-Date -Format HH:mm:ss) - prioritas High" | Out-File C:\Users\alienware\ep9cap\watch_status.txt
