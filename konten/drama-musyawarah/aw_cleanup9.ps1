# Matikan SEMUA Chrome instance capture (profil *cap-profile / ep8test) — zombie dari
# produksi kenalan + drama Trans Merdu. Chrome utama user (profil default) TIDAK disentuh.
$korban = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -like '*cap-profile*' -or $_.CommandLine -like '*ep8test-profile*'
}
Write-Output ("instance capture ditemukan: " + $korban.Count)
$korban | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 3
$sisa = (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -like '*cap-profile*' -or $_.CommandLine -like '*ep8test-profile*'
}).Count
Write-Output "sisa chrome capture: $sisa"
$semua = (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'").Count
Write-Output "total chrome.exe tersisa (termasuk user): $semua"
netstat -ano | Select-String '9333'
