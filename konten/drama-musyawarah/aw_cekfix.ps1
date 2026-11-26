$w = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*aw_watchcap*' }
Write-Output ("watcher aktif: " + $w.Count)
$w | ForEach-Object { Write-Output ("  watcher PID " + $_.ProcessId + " mulai " + $_.CreationDate) }
$remotion = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*remotion*' }
$chs = Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'"
Write-Output ("remotion: " + ($remotion -ne $null) + " | chs: " + ($chs -ne $null))
$drv = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*dm_capture*' }
Write-Output ("driver capture aktif: " + $drv.Count)
