$w = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*aw_watchcap*' }
$w | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
$sisa = (Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*aw_watchcap*' }).Count
Write-Output "watcher tersisa: $sisa"
"watcher dimatikan manual $(Get-Date -Format HH:mm:ss) - tes shot langsung" | Out-File C:\Users\alienware\ep9cap\watch_status.txt
