$items = @("C:\Users\alienware\ep9cap\frames") + (Get-ChildItem C:\Users\alienware\ep9cap\meta_*.json | ForEach-Object { $_.FullName }) + @("C:\Users\alienware\ep9cap\events.json")
Compress-Archive -Path $items -DestinationPath C:\Users\alienware\ep9cap_full.zip -Force
"zip selesai $(Get-Date -Format HH:mm:ss) ukuran $((Get-Item C:\Users\alienware\ep9cap_full.zip).Length)" | Out-File C:\Users\alienware\ep9cap\zip_status.txt
