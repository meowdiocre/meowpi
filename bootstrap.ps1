[CmdletBinding()]
param(
    [string]$PiHome = (Join-Path $env:USERPROFILE '.pi\agent'),
    [switch]$SkipPiInstall,
    [switch]$SkipPackages,
    [switch]$SkipSkills,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$manifestRoot = Join-Path $repoRoot 'manifests'
$configRoot = Join-Path $repoRoot 'config'
$backupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $PiHome "portable-backups\$backupStamp"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Ensure-Directory {
    param([string]$DirectoryPath)
    if ($DryRun) {
        Write-Host "[dry-run] create directory $DirectoryPath"
        return
    }
    New-Item -ItemType Directory -Path $DirectoryPath -Force | Out-Null
}

function Get-NativeCommand {
    param([string]$CommandName)
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    if ($DryRun) {
        return $CommandName
    }
    throw "Required command not found: $CommandName"
}

function Invoke-NativeCommand {
    param(
        [string]$Executable,
        [string[]]$ArgumentList
    )
    Write-Host ("> {0} {1}" -f $Executable, ($ArgumentList -join ' '))
    if ($DryRun) {
        return
    }
    & $Executable @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable exited with code $LASTEXITCODE"
    }
}

function Backup-ExistingFile {
    param([string]$TargetFile)
    if (!(Test-Path -LiteralPath $TargetFile -PathType Leaf)) {
        return
    }
    Ensure-Directory $backupRoot
    $backupName = (Split-Path -Leaf (Split-Path -Parent $TargetFile)) + '-' + (Split-Path -Leaf $TargetFile)
    $backupFile = Join-Path $backupRoot $backupName
    if ($DryRun) {
        Write-Host "[dry-run] back up $TargetFile to $backupFile"
        return
    }
    Copy-Item -LiteralPath $TargetFile -Destination $backupFile -Force
}

function Install-ManagedFile {
    param(
        [string]$SourceFile,
        [string]$TargetFile
    )
    if (!(Test-Path -LiteralPath $SourceFile -PathType Leaf)) {
        throw "Managed source file is missing: $SourceFile"
    }
    $targetDirectory = Split-Path -Parent $TargetFile
    Ensure-Directory $targetDirectory

    if ((Test-Path -LiteralPath $TargetFile -PathType Leaf) -and !$DryRun) {
        $sourceHash = (Get-FileHash -LiteralPath $SourceFile -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -LiteralPath $TargetFile -Algorithm SHA256).Hash
        if ($sourceHash -eq $targetHash) {
            Write-Host "unchanged: $TargetFile"
            return
        }
    }

    Backup-ExistingFile $TargetFile
    if ($DryRun) {
        Write-Host "[dry-run] install $SourceFile -> $TargetFile"
        return
    }
    Copy-Item -LiteralPath $SourceFile -Destination $TargetFile -Force
    Write-Host "installed: $TargetFile"
}

function Expand-TemplateValue {
    param($Value)

    if ($null -eq $Value) {
        return $null
    }
    if ($Value -is [string]) {
        $expanded = $Value.Replace('{{USERPROFILE}}', $env:USERPROFILE)
        $expanded = $expanded.Replace('{{PROGRAMFILES_X86}}', ${env:ProgramFiles(x86)})
        $expanded = $expanded.Replace('{{SYSTEMDRIVE}}', $env:SystemDrive)
        return $expanded
    }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        foreach ($property in $Value.PSObject.Properties) {
            $property.Value = Expand-TemplateValue $property.Value
        }
        return $Value
    }
    if (($Value -is [System.Collections.IEnumerable]) -and ($Value -isnot [string])) {
        return @($Value | ForEach-Object { Expand-TemplateValue $_ })
    }
    return $Value
}

Write-Step 'Validate repository'
& (Join-Path $repoRoot 'verify.ps1')

$npmCommand = Get-NativeCommand 'npm.cmd'
$npxCommand = Get-NativeCommand 'npx.cmd'

if (!$SkipPiInstall) {
    Write-Step 'Install pinned Pi CLI'
    $piManifest = Get-Content -Raw -LiteralPath (Join-Path $manifestRoot 'pi.json') | ConvertFrom-Json
    $piSpec = '{0}@{1}' -f $piManifest.package, $piManifest.version
    Invoke-NativeCommand $npmCommand @('install', '--global', '--ignore-scripts', $piSpec)
}

$piCommand = Get-NativeCommand 'pi.cmd'
Ensure-Directory $PiHome

if (!$SkipPackages) {
    Write-Step 'Install pinned Pi packages'
    $packageManifest = Get-Content -Raw -LiteralPath (Join-Path $manifestRoot 'pi-packages.json') | ConvertFrom-Json
    foreach ($package in $packageManifest) {
        $packageSpec = 'npm:{0}@{1}' -f $package.name, $package.version
        Invoke-NativeCommand $piCommand @('install', $packageSpec)
    }
}

Write-Step 'Restore portable Pi configuration'
Install-ManagedFile (Join-Path $configRoot 'settings.json') (Join-Path $PiHome 'settings.json')
Install-ManagedFile (Join-Path $configRoot 'models.json') (Join-Path $PiHome 'models.json')

$mcpTemplatePath = Join-Path $configRoot 'mcp.json.template'
$mcpTargetPath = Join-Path $PiHome 'mcp.json'
$mcpObject = Get-Content -Raw -LiteralPath $mcpTemplatePath | ConvertFrom-Json
$mcpObject = Expand-TemplateValue $mcpObject
if ($DryRun) {
    Write-Host "[dry-run] render $mcpTemplatePath -> $mcpTargetPath"
}
else {
    Backup-ExistingFile $mcpTargetPath
    $mcpObject | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $mcpTargetPath -Encoding UTF8
    Write-Host "installed: $mcpTargetPath"
}

$extensionManifest = Get-Content -Raw -LiteralPath (Join-Path $manifestRoot 'extensions.json') | ConvertFrom-Json
foreach ($extensionName in $extensionManifest) {
    Install-ManagedFile (Join-Path $configRoot "extensions\$extensionName") (Join-Path $PiHome "extensions\$extensionName")
}

if (!$SkipSkills) {
    Write-Step 'Install third-party skills'
    $skillManifest = Get-Content -Raw -LiteralPath (Join-Path $manifestRoot 'skills.json') | ConvertFrom-Json
    foreach ($collection in $skillManifest.collections) {
        $skillArguments = @('--yes', 'skills', 'add', [string]$collection.source, '--global', '--yes', '--skill')
        $skillArguments += @($collection.skills | ForEach-Object { [string]$_ })
        $skillArguments += '--agent'
        $skillArguments += @($collection.agents | ForEach-Object { [string]$_ })
        Invoke-NativeCommand $npxCommand $skillArguments
    }

    Write-Step 'Install repository-owned skills'
    foreach ($skillName in $skillManifest.localSkills) {
        $localSkillRoot = Join-Path $repoRoot "skills\$skillName"
        $targets = @(
            (Join-Path $env:USERPROFILE ".agents\skills\$skillName"),
            (Join-Path $PiHome "skills\$skillName"),
            (Join-Path $env:USERPROFILE ".claude\skills\$skillName")
        )
        $localFiles = Get-ChildItem -LiteralPath $localSkillRoot -File -Recurse
        foreach ($targetRoot in $targets) {
            foreach ($localFile in $localFiles) {
                $relativeName = $localFile.FullName.Substring($localSkillRoot.Length).TrimStart([char[]]@('\', '/'))
                Install-ManagedFile $localFile.FullName (Join-Path $targetRoot $relativeName)
            }
        }
    }
}

Write-Step 'Complete'
Write-Host 'Portable Pi configuration is installed.' -ForegroundColor Green
Write-Host 'Credentials were not restored. Start pi.cmd and authenticate providers on this device.'
if (!$DryRun -and (Test-Path -LiteralPath $backupRoot)) {
    Write-Host "Previous files were backed up to $backupRoot"
}
