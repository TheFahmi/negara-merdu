$env:PROBE = "1"
$p = Start-Process -FilePath "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe" -ArgumentList "C:\Users\alienware\ep6cap\ep6_capture_aw.py" -WorkingDirectory "C:\Users\alienware\ep6cap" -RedirectStandardOutput "C:\Users\alienware\ep6cap\probe_out.log" -RedirectStandardError "C:\Users\alienware\ep6cap\probe_err.log" -PassThru -NoNewWindow
Write-Output "probe pid: $($p.Id)"
