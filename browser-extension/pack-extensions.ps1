# =============================================================================
# FlakeSecure Browser Extension Packager (Chrome & Firefox)
# =============================================================================
# Packs browser-extension/extension and browser-extension-firefox/extension
# into server/public/FlakeSecure_chrome-v<version>.zip and
# server/public/FlakeSecure_firefox-v<version>.zip with:
#   - Explicit forward-slash ('/') entry names (ZIP specification compliant)
#   - Explicit directory entries ('icons/', 'lib/', 'styles/')
#   - Cross-platform Unix + DOS ExternalAttributes (0x41ED0010 dirs, 0x81B60020 files)
#   - Full SHA-256 round-trip extraction and PNG signature verification
# =============================================================================

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PublicDir = Join-Path $RepoRoot 'server\public'

$ExcludePatterns = @('*.DS_Store', 'Thumbs.db', 'desktop.ini', '*.pem', '*.crx', '*.bak', '*.tmp')

function Test-Excluded($fileName) {
  foreach ($pattern in $ExcludePatterns) {
    if ($fileName -like $pattern) { return $true }
  }
  return $false
}

function Pack-ExtensionFolder {
  param(
    [Parameter(Mandatory=$true)][string]$SourceDir,
    [Parameter(Mandatory=$true)][string]$Prefix
  )

  $resolvedSource = (Resolve-Path $SourceDir).Path
  $manifestPath = Join-Path $resolvedSource 'manifest.json'
  if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found in $resolvedSource"
  }

  $manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
  $version = $manifest.version
  if (-not $version) {
    throw "No version field in $manifestPath"
  }

  $zipName = "${Prefix}-v${version}.zip"
  $destZip = Join-Path $PublicDir $zipName

  if (Test-Path $destZip) {
    Remove-Item -Force $destZip
  }

  $fs = [System.IO.File]::Open($destZip, [System.IO.FileMode]::CreateNew)
  try {
    $archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
      # 1. Add explicit directory entries with forward slashes and Unix/DOS dir attributes
      $dirs = Get-ChildItem -Path $resolvedSource -Directory -Recurse | Sort-Object FullName
      foreach ($dir in $dirs) {
        $relDir = $dir.FullName.Substring($resolvedSource.Length).TrimStart('\', '/').Replace('\', '/') + '/'
        $dirEntry = $archive.CreateEntry($relDir, [System.IO.Compression.CompressionLevel]::NoCompression)
        $dirEntry.LastWriteTime = [DateTimeOffset]$dir.LastWriteTime
        # Unix drwxr-xr-x (040755 << 16) | DOS Directory (0x10) = 0x41ED0010
        $dirEntry.ExternalAttributes = 0x41ED0010
      }

      # 2. Add all files with forward slashes and Unix/DOS file attributes
      $files = Get-ChildItem -Path $resolvedSource -File -Recurse | Sort-Object FullName
      foreach ($file in $files) {
        if (Test-Excluded $file.Name) { continue }
        $relFile = $file.FullName.Substring($resolvedSource.Length).TrimStart('\', '/').Replace('\', '/')
        $entry = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
          $archive,
          $file.FullName,
          $relFile,
          [System.IO.Compression.CompressionLevel]::Optimal
        )
        # Unix -rw-rw-rw- (0100666 << 16) | DOS Archive (0x20) = 0x81B60020
        $entry.ExternalAttributes = 0x81B60020
      }
    } finally {
      $archive.Dispose()
    }
  } finally {
    $fs.Dispose()
  }

  # 3. Verify ZIP by extracting with Expand-Archive and checking hashes & PNG signatures
  $tempExtract = Join-Path ([System.IO.Path]::GetTempPath()) ("fs_verify_" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempExtract | Out-Null
  try {
    Expand-Archive -Path $destZip -DestinationPath $tempExtract -Force

    # Verify all source files match extracted files byte-for-byte
    $sourceFiles = Get-ChildItem -Path $resolvedSource -File -Recurse | Where-Object { -not (Test-Excluded $_.Name) }
    foreach ($sf in $sourceFiles) {
      $rel = $sf.FullName.Substring($resolvedSource.Length).TrimStart('\', '/')
      $extractedFile = Join-Path $tempExtract $rel
      if (-not (Test-Path $extractedFile)) {
        throw "Verification failed: Missing extracted file '$rel' from $zipName"
      }
      $srcHash = (Get-FileHash -Algorithm SHA256 $sf.FullName).Hash
      $extHash = (Get-FileHash -Algorithm SHA256 $extractedFile).Hash
      if ($srcHash -ne $extHash) {
        throw "Verification failed: Hash mismatch for '$rel' in $zipName ($srcHash vs $extHash)"
      }
    }

    # Verify manifest icon paths resolve and have valid PNG signatures
    $pngSig = @(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    $iconProps = $manifest.icons.PSObject.Properties
    foreach ($prop in $iconProps) {
      $iconRel = $prop.Value
      $iconPath = Join-Path $tempExtract ($iconRel -replace '/', '\')
      if (-not (Test-Path $iconPath)) {
        throw "Verification failed: Manifest icon '$iconRel' does not resolve in $zipName"
      }
      $bytes = [System.IO.File]::ReadAllBytes($iconPath)
      if ($bytes.Length -lt 8) {
        throw "Verification failed: Icon '$iconRel' is too small ($($bytes.Length) bytes)"
      }
      for ($i = 0; $i -lt 8; $i++) {
        if ($bytes[$i] -ne $pngSig[$i]) {
          throw "Verification failed: Invalid PNG signature in '$iconRel'"
        }
      }
    }
  } finally {
    if (Test-Path $tempExtract) {
      Remove-Item -Recurse -Force $tempExtract
    }
  }

  Write-Host "[OK] Packed and verified $zipName ($((Get-Item $destZip).Length) bytes)"
}

Pack-ExtensionFolder -SourceDir (Join-Path $RepoRoot 'browser-extension\extension') -Prefix 'FlakeSecure_chrome'
Pack-ExtensionFolder -SourceDir (Join-Path $RepoRoot 'browser-extension-firefox\extension') -Prefix 'FlakeSecure_firefox'
