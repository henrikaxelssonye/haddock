param(
  [Parameter(Mandatory = $true)]
  [string]$PromptFile,

  [string]$OutputFile = ".\tmp\claude_verify_out.json",
  [string]$ErrorFile = ".\tmp\claude_verify_err.log",
  [string]$Model = "opus",
  [string]$WorkingDirectory = (Get-Location).Path,
  [switch]$SkipPermissions = $true
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PromptFile)) {
  throw "Prompt file not found: $PromptFile"
}

$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
  throw "Could not find 'claude' on PATH."
}

$outputDir = Split-Path -Parent $OutputFile
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$errorDir = Split-Path -Parent $ErrorFile
if ($errorDir -and -not (Test-Path -LiteralPath $errorDir)) {
  New-Item -ItemType Directory -Path $errorDir -Force | Out-Null
}

$promptText = Get-Content -LiteralPath $PromptFile -Raw
# Pass prompt as a single normalized argument to avoid truncation with multiline input.
$promptText = $promptText -replace "`r`n", "`n"

$args = @(
  "-p",
  "--chrome",
  "--output-format", "json",
  "--model", $Model
)

$args += $promptText
if ($SkipPermissions) {
  $args += "--dangerously-skip-permissions"
}

$proc = Start-Process `
  -FilePath $claudeCmd.Source `
  -ArgumentList $args `
  -WorkingDirectory $WorkingDirectory `
  -RedirectStandardOutput $OutputFile `
  -RedirectStandardError $ErrorFile `
  -NoNewWindow `
  -PassThru

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputFile)
$resolvedError = [System.IO.Path]::GetFullPath($ErrorFile)

[PSCustomObject]@{
  Pid = $proc.Id
  PromptFile = (Resolve-Path -LiteralPath $PromptFile).Path
  OutputFile = $resolvedOutput
  ErrorFile = $resolvedError
  Model = $Model
  ChromeEnabled = $true
}
