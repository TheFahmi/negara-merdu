$w = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*aw_watchcap*' }
Write-Output ("watcher ditemukan: " + $w.Count)
$w | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
$remotion = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*remotion*' }
$chs = Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'"
Write-Output ("remotion node aktif: " + ($remotion -ne $null) + " | chs aktif: " + ($chs -ne $null))
if (-not $remotion -and -not $chs) {
  Write-Output "CELAH ADA SEKARANG"
} else {
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\alienware\aw_watchcap.ps1' }
  Write-Output ("satu watcher diluncurkan PID: " + $r.ProcessId)
}
