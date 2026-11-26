$p = Get-CimInstance Win32_Process -Filter "ProcessId=246708"
if ($p) {
  Write-Output ("nama: " + $p.Name)
  Write-Output ("mulai: " + $p.CreationDate)
  Write-Output ("parent: " + $p.ParentProcessId)
  Write-Output ("cmd: " + $p.CommandLine)
} else { Write-Output "PID 246708 tidak ada" }
Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'" | ForEach-Object {
  Write-Output ("CHS PID " + $_.ProcessId + " mulai " + $_.CreationDate + " parent " + $_.ParentProcessId)
}
