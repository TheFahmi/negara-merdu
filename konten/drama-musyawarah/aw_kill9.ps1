$p = Get-CimInstance Win32_Process -Filter "ProcessId=229744"
if ($p) {
  $o = Invoke-CimMethod -InputObject $p -MethodName GetOwner
  Write-Output ("owner 229744: " + $o.Domain + "\" + $o.User)
  $r = Invoke-CimMethod -InputObject $p -MethodName Terminate
  Write-Output ("WMI Terminate ReturnValue: " + $r.ReturnValue)
}
Start-Sleep -Seconds 2
taskkill /F /PID 229744 2>&1 | Out-String | Write-Output
taskkill /F /PID 237456 2>&1 | Out-String | Write-Output
Start-Sleep -Seconds 2
$sisa = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -like '*cap-profile*' -or $_.CommandLine -like '*ep8test-profile*'
}
Write-Output ("sisa capture: " + $sisa.Count)
$sisa | ForEach-Object { Write-Output ("  PID " + $_.ProcessId) }
netstat -ano | Select-String '9333'
whoami
