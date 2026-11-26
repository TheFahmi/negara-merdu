# Tes prioritas: naikkan Chrome capture ep9cap + driver ke High (proses milik sesi
# capture sendiri), lalu jalankan SATU shot ist untuk diukur.
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' } | ForEach-Object {
  try { (Get-Process -Id $_.ProcessId).PriorityClass = 'High' } catch {}
}
Write-Output "prioritas chrome ep9cap -> High"
$py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
$cmd = "cmd /c set DM_MODE=full && set DM_SHOTS=ist && `"$py`" C:\Users\alienware\ep9cap\dm_capture_aw.py"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep9cap" }
Write-Output ("driver tes PID: " + $r.ProcessId)
Start-Sleep -Seconds 6
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*dm_capture*' } | ForEach-Object {
  try { (Get-Process -Id $_.ProcessId).PriorityClass = 'High' } catch {}
  Write-Output ("driver python PID " + $_.ProcessId + " -> High")
}
