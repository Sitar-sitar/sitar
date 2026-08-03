param(
    [Parameter(Mandatory = $true)]
    [string]$Source
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$iconDirectory = Join-Path $projectRoot "icons"
$resolvedSource = (Resolve-Path -LiteralPath $Source).Path
$resolvedIconDirectory = (Resolve-Path -LiteralPath $iconDirectory).Path

function Write-SquareIcon {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Image]$Image,
        [Parameter(Mandatory = $true)]
        [int]$Size,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $target = Join-Path $resolvedIconDirectory $Name
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage($Image, 0, 0, $Size, $Size)
        }
        finally {
            $graphics.Dispose()
        }
        $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $bitmap.Dispose()
    }
}

$sourceImage = [System.Drawing.Image]::FromFile($resolvedSource)
try {
    Write-SquareIcon -Image $sourceImage -Size 1024 -Name "icon-source-1024.png"
    Write-SquareIcon -Image $sourceImage -Size 192 -Name "icon-192.png"
    Write-SquareIcon -Image $sourceImage -Size 512 -Name "icon-512.png"
    Write-SquareIcon -Image $sourceImage -Size 512 -Name "icon-maskable-512.png"
    Write-SquareIcon -Image $sourceImage -Size 180 -Name "apple-touch-icon.png"
}
finally {
    $sourceImage.Dispose()
}

Write-Output "PWA icons generated from $resolvedSource"
