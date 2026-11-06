Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Clear to 100% transparent
$g.Clear([System.Drawing.Color]::Transparent)

# Outer glow / boundary
$margin = 28
$rect = New-Object System.Drawing.Rectangle($margin, $margin, ($size - 2 * $margin), ($size - 2 * $margin))

# 1. Subtle Outer Glow
for ($i = 6; $i -ge 1; $i--) {
    $glowAlpha = [int](18 / $i)
    $glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($glowAlpha, 245, 158, 11), (18 + $i * 4))
    $g.DrawEllipse($glowPen, $rect)
    $glowPen.Dispose()
}

# 2. Main Badge Fill (Deep Midnight Charcoal Gradient)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(256, $margin)),
    (New-Object System.Drawing.PointF(256, ($size - $margin))),
    [System.Drawing.Color]::FromArgb(255, 23, 31, 48),
    [System.Drawing.Color]::FromArgb(255, 9, 13, 22)
)
$g.FillEllipse($bgBrush, $rect)
$bgBrush.Dispose()

# 3. Inner Tactical Pattern (Reticle Circles & Crosshair notches)
$reticlePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 245, 158, 11), 3)
$innerRect1 = New-Object System.Drawing.Rectangle(76, 76, 360, 360)
$innerRect2 = New-Object System.Drawing.Rectangle(124, 124, 264, 264)
$g.DrawEllipse($reticlePen, $innerRect1)
$g.DrawEllipse($reticlePen, $innerRect2)

# Crosshair lines
$g.DrawLine($reticlePen, 256, 42, 256, 92)
$g.DrawLine($reticlePen, 256, 420, 256, 470)
$g.DrawLine($reticlePen, 42, 256, 92, 256)
$g.DrawLine($reticlePen, 420, 256, 470, 256)
$reticlePen.Dispose()

# 4. Metallic Gold/Amber Border
$borderBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF($margin, $margin)),
    (New-Object System.Drawing.PointF(($size - $margin), ($size - $margin))),
    [System.Drawing.Color]::FromArgb(255, 254, 240, 138),
    [System.Drawing.Color]::FromArgb(255, 234, 88, 12)
)
$borderPen = New-Object System.Drawing.Pen($borderBrush, 14)
$g.DrawEllipse($borderPen, $rect)
$borderPen.Dispose()
$borderBrush.Dispose()

# Inner thin gold rim
$rimPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 251, 191, 36), 2)
$rimRect = New-Object System.Drawing.Rectangle(($margin + 12), ($margin + 12), ($size - 2 * $margin - 24), ($size - 2 * $margin - 24))
$g.DrawEllipse($rimPen, $rimRect)
$rimPen.Dispose()

# 5. Accent Stars / Dots at top
$starBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
$g.FillEllipse($starBrush, 252, 92, 8, 8)
$g.FillEllipse($starBrush, 232, 98, 6, 6)
$g.FillEllipse($starBrush, 274, 98, 6, 6)
$starBrush.Dispose()

# 6. Main "CS2" Typography
# Try system bold sans fonts (Impact, Arial Black, Trebuchet MS)
$fontFamilyName = "Impact"
$testFont = New-Object System.Drawing.Font($fontFamilyName, 12)
if ($testFont.FontFamily.Name -ne $fontFamilyName) {
    $fontFamilyName = "Arial Black"
}
$testFont.Dispose()

$csFont = New-Object System.Drawing.Font($fontFamilyName, 142, [System.Drawing.FontStyle]::Bold)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

# Drop Shadow for "CS2"
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 0, 0, 0))
$g.DrawString("CS2", $csFont, $shadowBrush, 256, 222, $format)
$g.DrawString("CS2", $csFont, $shadowBrush, 258, 224, $format)
$shadowBrush.Dispose()

# Metallic Gradient for "CS2"
$textBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(256, 120)),
    (New-Object System.Drawing.PointF(256, 310)),
    [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
    [System.Drawing.Color]::FromArgb(255, 245, 158, 11)
)
$g.DrawString("CS2", $csFont, $textBrush, 256, 218, $format)
$textBrush.Dispose()
$csFont.Dispose()

# 7. "MIX HUB" Tactical Badge Pill at bottom
$badgeW = 200
$badgeH = 50
$badgeX = (256 - $badgeW / 2)
$badgeY = 325
$badgeRect = New-Object System.Drawing.RectangleF($badgeX, $badgeY, $badgeW, $badgeH)

# Pill Background (Amber Gradient)
$pillBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF($badgeX, $badgeY)),
    (New-Object System.Drawing.PointF(($badgeX + $badgeW), ($badgeY + $badgeH))),
    [System.Drawing.Color]::FromArgb(255, 245, 158, 11),
    [System.Drawing.Color]::FromArgb(255, 217, 119, 6)
)
# Rounded pill path
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 24
$path.AddArc($badgeX, $badgeY, $r, $r, 180, 90)
$path.AddArc(($badgeX + $badgeW - $r), $badgeY, $r, $r, 270, 90)
$path.AddArc(($badgeX + $badgeW - $r), ($badgeY + $badgeH - $r), $r, $r, 0, 90)
$path.AddArc($badgeX, ($badgeY + $badgeH - $r), $r, $r, 90, 90)
$path.CloseFigure()

$g.FillPath($pillBrush, $path)

$pillBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 254, 240, 138), 3)
$g.DrawPath($pillBorderPen, $path)
$pillBorderPen.Dispose()
$pillBrush.Dispose()
$path.Dispose()

# Pill Text: "MIX HUB"
$subFont = New-Object System.Drawing.Font("Arial Black", 24, [System.Drawing.FontStyle]::Bold)
$subTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 15, 26))
$g.DrawString("MIX HUB", $subFont, $subTextBrush, 256, 350, $format)
$subTextBrush.Dispose()
$subFont.Dispose()

$g.Dispose()

# Output Directory
$outDir = "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub\public"
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

# 1. Save Master 512x512 PNG (100% transparent outside circle)
$masterPath = Join-Path $outDir "favicon-512x512.png"
$bmp.Save($masterPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Generated: $masterPath"

# Function to resize and save
function Resize-Image($src, $targetPath, $newW, $newH) {
    $targetBmp = New-Object System.Drawing.Bitmap($newW, $newH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $tg = [System.Drawing.Graphics]::FromImage($targetBmp)
    $tg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $tg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $tg.Clear([System.Drawing.Color]::Transparent)
    $tg.DrawImage($src, 0, 0, $newW, $newH)
    $tg.Dispose()
    $targetBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $targetBmp.Dispose()
    Write-Host "Generated: $targetPath ($newW x $newH)"
}

Resize-Image $bmp (Join-Path $outDir "favicon-192x192.png") 192 192
Resize-Image $bmp (Join-Path $outDir "apple-touch-icon.png") 180 180
Resize-Image $bmp (Join-Path $outDir "favicon-48x48.png") 48 48
Resize-Image $bmp (Join-Path $outDir "favicon-32x32.png") 32 32
Resize-Image $bmp (Join-Path $outDir "favicon-16x16.png") 16 16
Resize-Image $bmp (Join-Path $outDir "favicon.png") 64 64

# Also create standard favicon.ico (using 32x32)
$icon32 = New-Object System.Drawing.Bitmap(32, 32, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$icong = [System.Drawing.Graphics]::FromImage($icon32)
$icong.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$icong.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$icong.Clear([System.Drawing.Color]::Transparent)
$icong.DrawImage($bmp, 0, 0, 32, 32)
$icong.Dispose()

$hIcon = $icon32.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoStream = [System.IO.File]::Create((Join-Path $outDir "favicon.ico"))
$icon.Save($icoStream)
$icoStream.Dispose()
$icon.Dispose()
$icon32.Dispose()
Write-Host "Generated: $(Join-Path $outDir 'favicon.ico')"

$bmp.Dispose()
Write-Host "All favicon and bookmark icons generated successfully!"
