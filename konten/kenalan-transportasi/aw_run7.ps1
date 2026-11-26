param([string]$Mode = "recon", [string]$Shots = "")
$py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
$script = "C:\Users\alienware\ep7cap\kt_capture_aw.py"
$envs = "set KT_MODE=$Mode && "
if ($Shots -ne "") { $envs += "set KT_SHOTS=$Shots && " }
$cmd = "cmd /c $envs`"$py`" $script"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep7cap" }
Write-Output "driver WMI ReturnValue: $($r.ReturnValue) ProcessId: $($r.ProcessId)"
