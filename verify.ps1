[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$requiredFiles = @(
    '.gitignore',
    'README.md',
    'bootstrap.ps1',
    'export.ps1',
    'verify.ps1',
    'config\settings.json',
    'config\models.json',
    'config\mcp.json.template',
    'manifests\pi.json',
    'manifests\pi-packages.json',
    'manifests\skills.json',
    'manifests\extensions.json',
    'skills\systems-coding-style\SKILL.md'
)

foreach ($relativeFile in $requiredFiles) {
    $fullPath = Join-Path $repoRoot $relativeFile
    if (!(Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Required file is missing: $relativeFile"
    }
}

$jsonFiles = @(
    'config\settings.json',
    'config\models.json',
    'config\mcp.json.template',
    'manifests\pi.json',
    'manifests\pi-packages.json',
    'manifests\skills.json',
    'manifests\extensions.json'
)
foreach ($relativeFile in $jsonFiles) {
    Get-Content -Raw -LiteralPath (Join-Path $repoRoot $relativeFile) | ConvertFrom-Json | Out-Null
}

$forbiddenNames = Get-ChildItem -LiteralPath $repoRoot -File -Recurse -Force | Where-Object {
    $_.FullName -notmatch '[\\/]\.git[\\/]' -and
    ($_.Name -eq 'auth.json' -or $_.Name -match '(?i)\.pem$|\.key$|^\.env($|\.)')
}
if ($forbiddenNames) {
    throw "Forbidden credential file found: $($forbiddenNames.FullName -join ', ')"
}

$secretPatterns = @(
    '(?i)"(?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|credential|authorization)"\s*:\s*"(?!\{\{)[^"]+"',
    '(?i)\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}',
    '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
)
$textFiles = Get-ChildItem -LiteralPath $repoRoot -File -Recurse -Force | Where-Object {
    $_.FullName -notmatch '[\\/]\.git[\\/]'
}
foreach ($textFile in $textFiles) {
    $text = Get-Content -Raw -LiteralPath $textFile.FullName
    foreach ($pattern in $secretPatterns) {
        if ($text -match $pattern) {
            throw "Potential secret found in $($textFile.FullName)"
        }
    }
}

$escapedProfile = [regex]::Escape($env:USERPROFILE)
foreach ($relativeFile in @('config\mcp.json.template', 'config\settings.json', 'config\models.json')) {
    $text = Get-Content -Raw -LiteralPath (Join-Path $repoRoot $relativeFile)
    if ($text -match $escapedProfile) {
        throw "Machine-specific user path found in $relativeFile"
    }
}

foreach ($scriptName in @('bootstrap.ps1', 'export.ps1', 'verify.ps1')) {
    $scriptText = Get-Content -Raw -LiteralPath (Join-Path $repoRoot $scriptName)
    [scriptblock]::Create($scriptText) | Out-Null
}

$skillPath = Join-Path $repoRoot 'skills\systems-coding-style\SKILL.md'
$skillText = Get-Content -Raw -LiteralPath $skillPath
if ($skillText -notmatch '(?s)^---\s*\r?\nname:\s*systems-coding-style\s*\r?\ndescription:\s*.+?\r?\n---') {
    throw 'systems-coding-style has invalid or incomplete frontmatter.'
}

Write-Host 'PASS: repository structure, JSON, scripts, skill frontmatter, portability, and secret checks.' -ForegroundColor Green
