# Rebuild interlocking ledger-page identity from shared cubic Bezier geometry.
# The app and favicon use the same geometry; maskable art stays inside 80% safe area.
Add-Type -AssemblyName System.Drawing
$brandRoot = Join-Path $PSScriptRoot '../public'
$utf8 = [System.Text.UTF8Encoding]::new($false)
$contours = @(
  @(24,10, 44,10, 50.627,10,56,15.373,56,22, 56,30, 56,36.627,50.627,42,44,42, 34,42, 34,32, 44,32, 45.105,32,46,31.105,46,30, 46,22, 46,20.895,45.105,20,44,20, 24,20),
  @(40,54, 20,54, 13.373,54,8,48.627,8,42, 8,34, 8,27.373,13.373,22,20,22, 30,22, 30,32, 20,32, 18.895,32,18,32.895,18,34, 18,42, 18,43.105,18.895,44,20,44, 40,44)
)
$commands = @('L','C','L','C','L','L','L','C','L','C','L')
$paths = '<path d="M24 10H44C50.627 10 56 15.373 56 22V30C56 36.627 50.627 42 44 42H34V32H44C45.105 32 46 31.105 46 30V22C46 20.895 45.105 20 44 20H24Z"/><path d="M40 54H20C13.373 54 8 48.627 8 42V34C8 27.373 13.373 22 20 22H30V32H20C18.895 32 18 32.895 18 34V42C18 43.105 18.895 44 20 44H40Z"/>'
$symbol = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="#91B8ED">' + $paths + '</svg>'
[IO.File]::WriteAllText((Join-Path $brandRoot 'brand/symbol.svg'), $symbol, $utf8)
$favicon = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#17212D"/><g fill="#91B8ED">' + $paths + '</g></svg>'
[IO.File]::WriteAllText((Join-Path $brandRoot 'favicon.svg'), $favicon, $utf8)
function Write-BrandPng([string]$name, [int]$size, [bool]$maskable = $false) {
  $scale = 4
  $bitmap = [Drawing.Bitmap]::new($size * $scale, $size * $scale)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#17212D'))
    $factor = $size * $scale / 64.0
    $inset = 0.0
    if ($maskable) { $factor *= 0.8; $inset = $size * $scale * 0.1 }
    $brush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#91B8ED'))
    try {
      foreach ($contour in $contours) {
        $path = [Drawing.Drawing2D.GraphicsPath]::new()
        try {
          $x = $contour[0]*$factor+$inset; $y = $contour[1]*$factor+$inset
          $cursor = 2
          foreach ($command in $commands) {
            if ($command -eq 'L') {
              $nx = $contour[$cursor]*$factor+$inset; $ny = $contour[$cursor+1]*$factor+$inset
              $path.AddLine([float]$x,[float]$y,[float]$nx,[float]$ny)
              $x=$nx; $y=$ny; $cursor+=2
            } else {
              $x1=$contour[$cursor]*$factor+$inset; $y1=$contour[$cursor+1]*$factor+$inset
              $x2=$contour[$cursor+2]*$factor+$inset; $y2=$contour[$cursor+3]*$factor+$inset
              $nx=$contour[$cursor+4]*$factor+$inset; $ny=$contour[$cursor+5]*$factor+$inset
              $path.AddBezier([float]$x,[float]$y,[float]$x1,[float]$y1,[float]$x2,[float]$y2,[float]$nx,[float]$ny)
              $x=$nx; $y=$ny; $cursor+=6
            }
          }
          $path.CloseFigure()
          $graphics.FillPath($brush,$path)
        } finally { $path.Dispose() }
      }
      $output = [Drawing.Bitmap]::new($size, $size)
      $outputGraphics = [Drawing.Graphics]::FromImage($output)
      try {
        $outputGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $outputGraphics.DrawImage($bitmap, 0, 0, $size, $size)
        $output.Save((Join-Path $brandRoot $name), [Drawing.Imaging.ImageFormat]::Png)
      } finally { $outputGraphics.Dispose(); $output.Dispose() }
    } finally { $brush.Dispose() }
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
Write-BrandPng 'pwa-64x64.png' 64
Write-BrandPng 'pwa-192x192.png' 192
Write-BrandPng 'pwa-512x512.png' 512
Write-BrandPng 'apple-touch-icon-180x180.png' 180
Write-BrandPng 'maskable-icon-512x512.png' 512 $true
Write-BrandPng 'brand/icon-48.png' 48
$png = [IO.File]::ReadAllBytes((Join-Path $brandRoot 'brand/icon-48.png'))
$stream = [IO.File]::Create((Join-Path $brandRoot 'favicon.ico'))
$writer = [IO.BinaryWriter]::new($stream)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
  $writer.Write([byte]48); $writer.Write([byte]48); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write($png)
} finally { $writer.Dispose(); $stream.Dispose() }
Write-Output 'Brand SVG, ICO, Apple and PWA icons generated.'

foreach ($mode in @('dark','light')) {
  $ink = if ($mode -eq 'dark') { '#EDF0F3' } else { '#222930' }
  $accent = if ($mode -eq 'dark') { '#91B8ED' } else { '#315F9E' }
  $lockup = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="88" viewBox="0 0 360 88" role="img" aria-label="잔고플랜"><g fill="' + $accent + '" transform="translate(4 8) scale(1.1)">' + $paths + '</g><text x="90" y="57" fill="' + $ink + '" font-family="Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif" font-size="43" font-weight="750" letter-spacing="-1.8">잔고플랜</text></svg>'
  [IO.File]::WriteAllText((Join-Path $brandRoot ('brand/logo-' + $mode + '.svg')), $lockup, $utf8)
}
