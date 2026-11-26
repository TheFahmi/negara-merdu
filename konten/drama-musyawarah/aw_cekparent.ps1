foreach ($id in 241456, 226784) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
  if ($p) {
    Write-Output ("PID " + $id + " nama: " + $p.Name + " mulai: " + $p.CreationDate)
    Write-Output ("  cmd: " + $p.CommandLine)
  } else { Write-Output "PID $id tidak ada" }
}
