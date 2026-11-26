Write-Output ("frames: " + (Get-ChildItem C:\Users\alienware\ep6cap\frames -ErrorAction SilentlyContinue).Count)
Write-Output ("frames_a1b: " + (Get-ChildItem C:\Users\alienware\ep6cap\frames_a1b -ErrorAction SilentlyContinue).Count)
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ForEach-Object { Write-Output ($_.ProcessId.ToString() + " " + $_.CreationDate + " " + $_.CommandLine) }
Get-Content C:\Users\alienware\ep6cap\capture.log -Tail 4
