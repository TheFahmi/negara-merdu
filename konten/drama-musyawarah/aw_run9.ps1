param([string]$Mode = "probe", [string]$Shots = "")
$py = "C:\Users\alienware\AppData\Local\Programs\Python\Python312\python.exe"
$script = "C:\Users\alienware\ep9cap\dm_capture_aw.py"
$envs = "set DM_MODE=$Mode && "
if ($Shots -ne "") { $envs += "set DM_SHOTS=$Shots && " }
$cmd = "cmd /c $envs`"$py`" $script"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "C:\Users\alienware\ep9cap" }
Write-Output "driver WMI ReturnValue: $($r.ReturnValue) ProcessId: $($r.ProcessId)"
