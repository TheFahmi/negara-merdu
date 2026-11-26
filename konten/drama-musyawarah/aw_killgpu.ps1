$p = Get-Process -Id 127564 -ErrorAction SilentlyContinue
if ($p) {
  & taskkill /F /PID 127564 2>&1 | Out-String | Write-Output
  Start-Sleep -Seconds 5
}
$sisa = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' }
Write-Output ("sisa ep9cap: " + $sisa.Count)
foreach ($x in $sisa) { Write-Output ("PID " + $x.ProcessId) }
