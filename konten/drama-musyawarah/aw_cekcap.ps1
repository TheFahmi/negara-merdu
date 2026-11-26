Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -like '*cap-profile*' -or $_.CommandLine -like '*ep8test-profile*'
} | ForEach-Object {
  $cl = $_.CommandLine
  $prof = "?"
  if ($cl -match 'user-data-dir=([^\s"]+)') { $prof = $Matches[1] }
  $tipe = "browser"
  if ($cl -match '--type=([^\s"]+)') { $tipe = $Matches[1] }
  Write-Output ("PID " + $_.ProcessId + " | " + $prof + " | " + $tipe + " | mulai " + $_.CreationDate)
}
netstat -ano | Select-String '9333'
