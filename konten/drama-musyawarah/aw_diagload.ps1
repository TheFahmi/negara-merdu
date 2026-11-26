$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
Write-Output "CPU load %: $cpu"
Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 | ForEach-Object {
  Write-Output ("  " + $_.ProcessName + " PID " + $_.Id + " CPUtot " + [math]::Round($_.CPU,0) + "s RAM " + [math]::Round($_.WorkingSet64/1MB,0) + "MB")
}
Write-Output "--- chrome capture ---"
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -like '*cap-profile*' -or $_.CommandLine -like '*ep8test-profile*'
} | ForEach-Object {
  $prof = "?"; if ($_.CommandLine -match 'user-data-dir=([^\s"]+)') { $prof = $Matches[1] }
  Write-Output ("  PID " + $_.ProcessId + " " + $prof + " mulai " + $_.CreationDate)
}
nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv
nvidia-smi --query-compute-apps=pid,used_memory --format=csv
