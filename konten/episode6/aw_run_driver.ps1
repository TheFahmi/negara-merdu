param([string]$Mode = "PROBE")
$py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
$script = "C:\Users\alienware\ep6cap\ep6_capture_aw.py"
if ($Mode -eq "PROBE") { $cmd = "cmd /c set PROBE=1 && `"$py`" $script" }
elseif ($Mode -eq "A1") { $cmd = "cmd /c set EP6_SEGS=a1 && set EP6_CFG=blocks_a1.json && set EP6_OUT=frames_a1b && set EP6_META=meta_a1.json && `"$py`" $script" }
else { $cmd = "`"$py`" $script" }
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep6cap" }
Write-Output "driver WMI ReturnValue: $($r.ReturnValue) ProcessId: $($r.ProcessId)"
