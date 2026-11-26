# Penjaga celah CPU: tunggu sampai render Remotion (chrome-headless-shell / node remotion)
# tidak aktif, lalu jalankan capture PENUH drama musyawarah. Status ditulis ke watch_status.txt.
$status = "C:\Users\alienware\ep9cap\watch_status.txt"
$deadline = (Get-Date).AddHours(3)
"menunggu celah sejak $(Get-Date -Format HH:mm:ss)" | Out-File $status
while ((Get-Date) -lt $deadline) {
  $remotion = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*remotion*' }
  $chs = Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'"
  if (-not $remotion -and -not $chs) {
    Start-Sleep -Seconds 20
    $remotion2 = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*remotion*' }
    $chs2 = Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'"
    if (-not $remotion2 -and -not $chs2) {
      "celah ketemu $(Get-Date -Format HH:mm:ss) - capture dimulai" | Out-File $status
      $py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
      $cmd = "cmd /c set DM_MODE=full && `"$py`" C:\Users\alienware\ep9cap\dm_capture_aw.py"
      $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep9cap" }
      "driver full jalan PID $($r.ProcessId)" | Out-File $status -Append
      exit 0
    }
  }
  Start-Sleep -Seconds 20
}
"TIMEOUT 3 jam tanpa celah" | Out-File $status
