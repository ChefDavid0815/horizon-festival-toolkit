$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path $PSScriptRoot -Parent
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#212321'))
$pink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#ed1680'))
$lime = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#d9ff00'))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#f6f6f2'))
$graphics.FillRectangle($pink,0,232,256,24)
$graphics.FillPolygon($white,[System.Drawing.Point[]]@(@{X=65;Y=44},@{X=83;Y=44},@{X=52;Y=205},@{X=34;Y=205}))
$graphics.FillPolygon($lime,[System.Drawing.Point[]]@(@{X=91;Y=44},@{X=219;Y=44},@{X=182;Y=88},@{X=200;Y=132},@{X=74;Y=132}))
$graphics.FillPolygon($pink,[System.Drawing.Point[]]@(@{X=170;Y=152},@{X=209;Y=152},@{X=195;Y=205},@{X=156;Y=205}))
$png = Join-Path $taskRoot 'build\icon.png'
$bitmap.Save($png,[System.Drawing.Imaging.ImageFormat]::Png)
$bytes = [System.IO.File]::ReadAllBytes($png)
$stream = [System.IO.File]::Create((Join-Path $taskRoot 'build\icon.ico'))
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$bytes.Length); $writer.Write([UInt32]22)
$writer.Write($bytes); $writer.Dispose()
$graphics.Dispose(); $bitmap.Dispose(); $pink.Dispose(); $lime.Dispose(); $white.Dispose()
