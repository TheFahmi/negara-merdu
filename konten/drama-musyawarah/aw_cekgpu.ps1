$p = Get-Process -Id 127564 -ErrorAction SilentlyContinue
if (-not $p) { Write-Output "PID 127564: sudah tidak ada"; exit 0 }
Write-Output ("ada: CPU=" + $p.CPU + " StartTime=" + $p.StartTime + " Threads=" + $p.Threads.Count)
$c1 = $p.CPU
Start-Sleep -Seconds 5
$p2 = Get-Process -Id 127564 -ErrorAction SilentlyContinue
if ($p2) { Write-Output ("CPU sesudah 5 dtk: " + $p2.CPU + " (delta " + ($p2.CPU - $c1) + ")") } else { Write-Output "hilang saat tunggu" }
try { Stop-Process -Id 127564 -Force -ErrorAction Stop; Write-Output "Stop-Process: OK" } catch { Write-Output ("Stop-Process gagal: " + $_.Exception.Message) }
Start-Sleep -Seconds 3
$p3 = Get-Process -Id 127564 -ErrorAction SilentlyContinue
Write-Output ("sesudah Stop-Process: " + $(if ($p3) { "MASIH ADA" } else { "sudah mati" }))
