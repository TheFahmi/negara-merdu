$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' }
foreach ($p in $procs) {
  $tipe = "?"
  if ($p.CommandLine -match '--type=([\w-]+)') { $tipe = $Matches[1] }
  Write-Output ("sisa PID " + $p.ProcessId + " type=" + $tipe)
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 6
$sisa = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ep9cap-profile*' }
Write-Output ("sisa akhir: " + $sisa.Count)
foreach ($p in $sisa) { Write-Output ("masih ada PID " + $p.ProcessId) }
