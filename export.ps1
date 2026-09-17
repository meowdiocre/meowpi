[CmdletBinding()]
param(
    [string]$PiHome = (Join-Path $env:USERPROFILE '.pi\agent')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$configRoot = Join-Path $repoRoot 'config'
$manifestRoot = Join-Path $repoRoot 'manifests'
$sensitiveKeyPattern = '^(?i:api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|credential|authorization)$'

function Assert-NoSensitiveJsonKeys {
    param(
        $Value,
        [string]$JsonPath = '$'
    )
    if ($null -eq $Value) {
        return
    }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        foreach ($property in $Value.PSObject.Properties) {
            $propertyPath = "$JsonPath.$($property.Name)"
            if ($property.Name -match $sensitiveKeyPattern) {
                throw "Refusing to export credential-shaped property: $propertyPath"
            }
            Assert-NoSensitiveJsonKeys $property.Value $propertyPath
        }
        return
    }
    if (($Value -is [System.Collections.IEnumerable]) -and ($Value -isnot [string])) {
        $index = 0
        foreach ($item in $Value) {
            Assert-NoSensitiveJsonKeys $item "$JsonPath[$index]"
            $index++
        }
    }
}

function ConvertTo-PortableValue {
    param($Value)

    if ($null -eq $Value) {
        return $null
    }
    if ($Value -is [string]) {
        $portable = $Value
        if (${env:ProgramFiles(x86)}) {
            $portable = $portable.Replace(${env:ProgramFiles(x86)}, '{{PROGRAMFILES_X86}}')
        }
        if ($env:USERPROFILE) {
            $portable = $portable.Replace($env:USERPROFILE, '{{USERPROFILE}}')
        }
        if ($env:SystemDrive) {
            $portable = $portable.Replace($env:SystemDrive, '{{SYSTEMDRIVE}}')
        }
        return $portable
    }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        foreach ($property in $Value.PSObject.Properties) {
            $property.Value = ConvertTo-PortableValue $property.Value
        }
        return $Value
    }
    if (($Value -is [System.Collections.IEnumerable]) -and ($Value -isnot [string])) {
        return @($Value | ForEach-Object { ConvertTo-PortableValue $_ })
    }
    return $Value
}

function Export-SafeJson {
    param(
        [string]$SourceFile,
        [string]$TargetFile,
        [switch]$PortablePaths,
        [string[]]$RemoveProperties = @()
    )
    if (!(Test-Path -LiteralPath $SourceFile -PathType Leaf)) {
        throw "Source file is missing: $SourceFile"
    }
    $jsonObject = Get-Content -Raw -LiteralPath $SourceFile | ConvertFrom-Json
    Assert-NoSensitiveJsonKeys $jsonObject
    foreach ($propertyName in $RemoveProperties) {
        $jsonObject.PSObject.Properties.Remove($propertyName)
    }
    if ($PortablePaths) {
        $jsonObject = ConvertTo-PortableValue $jsonObject
    }
    $jsonObject | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $TargetFile -Encoding UTF8
    Write-Host "exported: $TargetFile"
}

New-Item -ItemType Directory -Path $configRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $configRoot 'extensions') -Force | Out-Null

Export-SafeJson (Join-Path $PiHome 'settings.json') (Join-Path $configRoot 'settings.json') -RemoveProperties @('lastChangelogVersion')
Export-SafeJson (Join-Path $PiHome 'models.json') (Join-Path $configRoot 'models.json')
Export-SafeJson (Join-Path $PiHome 'mcp.json') (Join-Path $configRoot 'mcp.json.template') -PortablePaths

$extensionManifest = Get-Content -Raw -LiteralPath (Join-Path $manifestRoot 'extensions.json') | ConvertFrom-Json
foreach ($extensionName in $extensionManifest) {
    $sourceExtension = Join-Path $PiHome "extensions\$extensionName"
    if (!(Test-Path -LiteralPath $sourceExtension -PathType Leaf)) {
        throw "Configured extension is missing: $sourceExtension"
    }
    Copy-Item -LiteralPath $sourceExtension -Destination (Join-Path $configRoot "extensions\$extensionName") -Force
    Write-Host "exported: config\extensions\$extensionName"
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$packageListing = (& $npmCommand --prefix (Join-Path $PiHome 'npm') list --depth=0 --json | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    throw "npm package inventory failed with code $LASTEXITCODE"
}
$packageManifestPath = Join-Path $manifestRoot 'pi-packages.json'
$packageManifest = Get-Content -Raw -LiteralPath $packageManifestPath | ConvertFrom-Json
foreach ($package in $packageManifest) {
    $installedProperty = $packageListing.dependencies.PSObject.Properties[[string]$package.name]
    if (!$installedProperty) {
        throw "Pinned Pi package is not installed: $($package.name)"
    }
    $package.version = [string]$installedProperty.Value.version
}
$packageManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $packageManifestPath -Encoding UTF8

$piManifestPath = Join-Path $manifestRoot 'pi.json'
$piManifest = Get-Content -Raw -LiteralPath $piManifestPath | ConvertFrom-Json
$globalListing = (& $npmCommand list --global --depth=0 --json | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    throw "global npm inventory failed with code $LASTEXITCODE"
}
$piProperty = $globalListing.dependencies.PSObject.Properties[[string]$piManifest.package]
if (!$piProperty) {
    throw "Configured Pi package is not globally installed: $($piManifest.package)"
}
$piManifest.version = [string]$piProperty.Value.version
$piManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $piManifestPath -Encoding UTF8

& (Join-Path $repoRoot 'verify.ps1')
Write-Host 'Safe Pi snapshot refreshed. Review git diff before committing.' -ForegroundColor Green
