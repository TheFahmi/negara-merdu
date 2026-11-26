# Penjaga celah v2: ukur beban CPU nyata dari pohon render (chrome-headless-shell +
# node + ffmpeg) selama jendela 8 dtk; celah = total < 2,0 dtk CPU dalam 2 jendela
# berurutan. Lalu jalankan capture PENUH drama musyawarah. Deadline 6 jam.
$status = "C:\Users\alienware\ep9cap\watch_status.txt"
$deadline = (Get-Date).AddHours(6)
"menunggu celah v2 sejak $(Get-Date -Format HH:mm:ss)" | Out-File $status

function BebanRender {
  $a = @{}
  Get-Process | Where-Object { $_.ProcessName -in 'chrome-headless-shell','node','ffmpeg' } | ForEach-Object { $a[$_.Id] = $_.CPU }
  Start-Sleep -Seconds 8
  $tot = 0.0
  Get-Process | Where-Object { $_.ProcessName -in 'chrome-headless-shell','node','ffmpeg' } | ForEach-Object {
    if ($a.ContainsKey($_.Id)) { $tot += ($_.CPU - $a[$_.Id]) }
  }
  return $tot
}

while ((Get-Date) -lt $deadline) {
  $b1 = BebanRender
  if ($b1 -lt 2.0) {
    $b2 = BebanRender
    if ($b2 -lt 2.0) {
      "celah ketemu $(Get-Date -Format HH:mm:ss) beban=$b1/$b2 - capture dimulai" | Out-File $status
      $py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
      $cmd = "cmd /c set DM_MODE=full && `"$py`" C:\Users\alienware\ep9cap\dm_capture_aw.py"
      $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep9cap" }
      "driver full jalan PID $($r.ProcessId)" | Out-File $status -Append
      exit 0
    }
  }
  Start-Sleep -Seconds 10
}
"TIMEOUT 6 jam tanpa celah" | Out-File $status
