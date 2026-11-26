Compress-Archive -Path C:\Users\alienware\ep9cap\frames\prob_*.jpg -DestinationPath C:\Users\alienware\ep9cap\probe.zip -Force
Write-Output ("probe.zip: " + (Get-Item C:\Users\alienware\ep9cap\probe.zip).Length + " bytes")
