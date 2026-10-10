[CmdletBinding()]
param(
    [string]$ProfileName = 'Windows PowerShell',
    [string]$SettingsPath
)

$ErrorActionPreference = 'Stop'

$candidates = @(
    $SettingsPath,
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json"
)
$settingsPath = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $settingsPath) {
    throw 'Could not find Windows Terminal settings. Open Windows Terminal once, then run this again.'
}

$skin = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'ember.json') | ConvertFrom-Json
try {
    $settings = Get-Content -Raw -Encoding UTF8 $settingsPath | ConvertFrom-Json
}
catch {
    throw "Could not read $settingsPath as plain JSON (it may contain comments). Copy the values from ember.json into it by hand instead."
}

function Set-Member($Object, [string]$Name, $Value) {
    if ($Object.PSObject.Properties[$Name]) { $Object.$Name = $Value }
    else { $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value }
}

$target = @($settings.profiles.list) | Where-Object { $_.name -eq $ProfileName } | Select-Object -First 1
if (-not $target) {
    $names = (@($settings.profiles.list) | ForEach-Object { $_.name }) -join "', '"
    throw "There is no Windows Terminal profile named '$ProfileName'. Pass -ProfileName with one of: '$names'."
}

$backup = "$settingsPath.$(Get-Date -Format 'yyyyMMdd-HHmmss-fff').bak"
Copy-Item -LiteralPath $settingsPath -Destination $backup

Set-Member $settings 'schemes' (@(@($settings.schemes) | Where-Object { $_ -and $_.name -ne $skin.scheme.name }) + $skin.scheme)
Set-Member $settings 'themes' (@(@($settings.themes) | Where-Object { $_ -and $_.name -ne $skin.theme.name }) + $skin.theme)
Set-Member $settings 'theme' $skin.theme.name
foreach ($property in $skin.profile.PSObject.Properties) {
    Set-Member $target $property.Name $property.Value
}

$json = $settings | ConvertTo-Json -Depth 32
[System.IO.File]::WriteAllText($settingsPath, $json, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Ember is applied to the '$ProfileName' profile. Windows Terminal picks it up right away."
Write-Host "To undo, copy the backup over your settings:"
Write-Host "  Copy-Item '$backup' '$settingsPath'"
