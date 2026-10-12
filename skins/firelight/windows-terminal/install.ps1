[CmdletBinding()]
param(
    [ValidateSet('Coal', 'Smoulder', 'Ash')]
    [string]$Variant = 'Coal',
    [string]$ProfileName = 'Windows PowerShell',
    [string]$SettingsPath,
    [switch]$SkipFont
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$FontZip = 'https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip'

function Test-FontInstalled([string]$Name) {
    foreach ($key in 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts', 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts') {
        $fonts = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if ($fonts -and ($fonts.PSObject.Properties.Name -like "$Name *")) { return $true }
    }
    return $false
}

function Install-JetBrainsMono {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $work = Join-Path ([IO.Path]::GetTempPath()) ('firelight-font-' + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $work | Out-Null
    try {
        $zip = Join-Path $work 'font.zip'
        Invoke-WebRequest -Uri $FontZip -OutFile $zip -UseBasicParsing
        Expand-Archive -Path $zip -DestinationPath (Join-Path $work 'x')
        $fontDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
        New-Item -ItemType Directory -Path $fontDir -Force | Out-Null
        $registry = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts'
        if (-not (Test-Path $registry)) { New-Item -Path $registry -Force | Out-Null }
        Add-Type -Namespace Firelight -Name Gdi -MemberDefinition '[DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern int AddFontResource(string file);'
        foreach ($file in Get-ChildItem -Path (Join-Path $work 'x\fonts\ttf') -Filter '*.ttf') {
            $target = Join-Path $fontDir $file.Name
            Copy-Item -LiteralPath $file.FullName -Destination $target -Force
            $family, $style = $file.BaseName -split '-', 2
            $familyName = if ($family -eq 'JetBrainsMonoNL') { 'JetBrains Mono NL' } else { 'JetBrains Mono' }
            $styleName = $style -creplace '([a-z])([A-Z])', '$1 $2'
            New-ItemProperty -Path $registry -Name "$familyName $styleName (TrueType)" -Value $target -PropertyType String -Force | Out-Null
            [void][Firelight.Gdi]::AddFontResource($target)
        }
    }
    finally {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    }
}

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

$skin = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'firelight.json') | ConvertFrom-Json
try {
    $settings = Get-Content -Raw -Encoding UTF8 $settingsPath | ConvertFrom-Json
}
catch {
    throw "Could not read $settingsPath as plain JSON (it may contain comments). Copy the values from firelight.json into it by hand instead."
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

$fontFace = $skin.profile.font.face
if ($SkipFont) {
    $skin.profile.font.face = 'Cascadia Mono'
}
elseif (Test-FontInstalled $fontFace) {
    Write-Host "$fontFace is already installed."
}
else {
    Write-Host "Installing $fontFace for your account..."
    Install-JetBrainsMono
    Write-Host "$fontFace is installed."
}

$backup = "$settingsPath.$(Get-Date -Format 'yyyyMMdd-HHmmss-fff').bak"
Copy-Item -LiteralPath $settingsPath -Destination $backup

$name = "Firelight $Variant"
$schemeNames = @($skin.schemes | ForEach-Object { $_.name })
$themeNames = @($skin.themes | ForEach-Object { $_.name })
Set-Member $settings 'schemes' (@(@($settings.schemes) | Where-Object { $_ -and $schemeNames -notcontains $_.name }) + @($skin.schemes))
Set-Member $settings 'themes' (@(@($settings.themes) | Where-Object { $_ -and $themeNames -notcontains $_.name }) + @($skin.themes))
Set-Member $settings 'theme' $name
foreach ($property in $skin.profile.PSObject.Properties) {
    Set-Member $target $property.Name $property.Value
}
Set-Member $target 'colorScheme' $name

$json = $settings | ConvertTo-Json -Depth 32
[System.IO.File]::WriteAllText($settingsPath, $json, (New-Object System.Text.UTF8Encoding $false))

Write-Host "$name is applied to the '$ProfileName' profile."
Write-Host "All three Firelight schemes are installed, so you can switch between them in Windows Terminal's settings."
Write-Host "Colors and spacing change right away. Close and reopen Windows Terminal if the font doesn't switch."
Write-Host "To undo, copy the backup over your settings:"
Write-Host "  Copy-Item '$backup' '$settingsPath'"
