Write-Output ("frames: " + (Get-ChildItem C:\Users\alienware\ep7cap\frames -ErrorAction SilentlyContinue).Count)
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ForEach-Object { Write-Output ($_.ProcessId.ToString() + " " + $_.CommandLine) }
Get-Content C:\Users\alienware\ep7cap\capture.log -Tail 6 -ErrorAction SilentlyContinue
