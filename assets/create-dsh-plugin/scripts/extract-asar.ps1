#requires -Version 5.1
<#
.SYNOPSIS
Read or extract files from a DeepSeek Harness app.asar.

.DESCRIPTION
The asar archive is a regular file, but shell commands, rg, glob, and Node cannot
open paths inside it. Only the Host's own file reader (the `read` tool) can, and
it needs exact paths. This script parses the archive header directly so it can
list or extract whole subtrees, after which ordinary rg/read works on the copy.

.PARAMETER List
Asar-relative directory (or file) path to list, e.g.
"dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar".

.PARAMETER Paths
One or more asar-relative paths to extract (directories are recursive).

.PARAMETER OutDir
Destination directory for -Paths. Files keep their archive-relative path.

.PARAMETER Archive
Path to app.asar. Defaults to the desktop installation location.

.EXAMPLE
pwsh -File extract-asar.ps1 -List "dsh/node_modules/@deepseek-ai"

.EXAMPLE
pwsh -File extract-asar.ps1 -Paths "dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace" -OutDir "./asar-src"
# Then: rg -n "data-row-key|_sidebar" ./asar-src
# Delete the scratch directory when done.
#>
[CmdletBinding(DefaultParameterSetName = 'Extract')]
param(
  [Parameter(Mandatory = $true, ParameterSetName = 'List')]
  [string]$List,

  [Parameter(Mandatory = $true, ParameterSetName = 'Extract')]
  [string[]]$Paths,

  [Parameter(Mandatory = $true, ParameterSetName = 'Extract')]
  [string]$OutDir,

  [string]$Archive
)

$ErrorActionPreference = 'Stop'

if (-not $Archive) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\app.asar'),
    (Join-Path ${env:ProgramFiles} 'DeepSeek Harness\resources\app.asar')
  )
  $Archive = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Archive -or -not (Test-Path $Archive)) {
  throw "app.asar not found. Pass -Archive <path-to-app.asar>."
}

# --- parse the asar header ---------------------------------------------------
# Layout: uint32 4 | uint32 headerSize | [uint32 jsonLen | utf8 JSON | padding] | file data
$stream = [System.IO.File]::OpenRead($Archive)
try {
  $sizeBuf = New-Object byte[] 8
  [void]$stream.Read($sizeBuf, 0, 8)
  $headerSize = [BitConverter]::ToUInt32($sizeBuf, 4)

  $headerBuf = New-Object byte[] $headerSize
  [void]$stream.Read($headerBuf, 0, $headerSize)
  $jsonLen = [BitConverter]::ToUInt32($headerBuf, 4)
  $json = [System.Text.Encoding]::UTF8.GetString($headerBuf, 8, $jsonLen)
  $tree = ($json | ConvertFrom-Json).files
  $dataStart = 8 + $headerSize

  function Resolve-Node([string]$fullPath) {
    $node = $null
    $current = @{ files = $tree }
    foreach ($part in $fullPath.Trim('/').Split('/')) {
      if ($null -eq $current.files) { return $null }
      $node = $current.files.$part
      if ($null -eq $node) { return $null }
      $current = $node
    }
    return $node
  }

  if ($PSCmdlet.ParameterSetName -eq 'List') {
    $node = Resolve-Node $List
    if ($null -eq $node) { throw "no such asar path: $List" }
    if ($null -eq $node.files) {
      Write-Host "FILE $List ($($node.size) bytes)"
      return
    }
    Write-Host "DIR  $List"
    foreach ($property in $node.files.PSObject.Properties) {
      $child = $property.Value
      if ($null -ne $child.files) { Write-Host "  dir   $($property.Name)" }
      else { Write-Host "  file  $($property.Name)  $($child.size) bytes" }
    }
    return
  }

  function Save-Node($node, [string]$relativePath) {
    if ($null -ne $node.files) {
      foreach ($property in $node.files.PSObject.Properties) {
        $childPath = if ($relativePath -eq '') { $property.Name } else { "$relativePath/$($property.Name)" }
        Save-Node $property.Value $childPath
      }
      return
    }
    if ($null -eq $node.offset) { return }
    $outFile = Join-Path $OutDir $relativePath
    $parent = Split-Path $outFile -Parent
    if (-not (Test-Path $parent)) { [void](New-Item -ItemType Directory -Path $parent -Force) }
    $offset = [long]$node.offset
    $size = [long]$node.size
    $buffer = New-Object byte[] $size
    [void]$stream.Seek($dataStart + $offset, 'Begin')
    $read = 0
    while ($read -lt $size) {
      $count = $stream.Read($buffer, $read, $size - $read)
      if ($count -le 0) { break }
      $read += $count
    }
    [System.IO.File]::WriteAllBytes($outFile, $buffer)
    Write-Host "extracted $relativePath ($size bytes)"
  }

  foreach ($path in $Paths) {
    $node = Resolve-Node $path
    if ($null -eq $node) { Write-Warning "no such asar path: $path"; continue }
    Write-Host "== $path"
    Save-Node $node $path
  }
}
finally {
  $stream.Dispose()
}
