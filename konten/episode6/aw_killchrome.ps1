$n = 0
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep6cap-profile2*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $n++ }
Write-Output "chrome capture ditutup: $n proses"
