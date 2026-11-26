$a = @{}
Get-Process | ForEach-Object { $a[$_.Id] = $_.CPU }
Start-Sleep -Seconds 6
$rows = Get-Process | ForEach-Object {
  if ($a.ContainsKey($_.Id)) {
    $d = $_.CPU - $a[$_.Id]
    if ($d -gt 0.3) { [PSCustomObject]@{ Nama = $_.ProcessName; PID = $_.Id; CPUdtk = [math]::Round($d, 1) } }
  }
} | Sort-Object CPUdtk -Descending | Select-Object -First 8
$rows | ForEach-Object { Write-Output ($_.Nama + " PID " + $_.PID + " +" + $_.CPUdtk + "s/6s") }
$load = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
Write-Output "CPU load %: $load"
$core = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
Write-Output "logical processors: $core"
