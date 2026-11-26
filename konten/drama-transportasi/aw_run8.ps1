param([string]$Mode = "recon", [string]$Shots = "")
$py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
$script = "C:\Users\alienware\ep8cap\dt_capture_aw.py"
$envs = "set DT_MODE=$Mode && "
if ($Shots -ne "") { $envs += "set DT_SHOTS=$Shots && " }
$cmd = "cmd /c $envs`"$py`" $script"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep8cap" }
Write-Output "driver WMI ReturnValue: $($r.ReturnValue) ProcessId: $($r.ProcessId)"
