# Long-running helper of the desktop program: reads pictures with the OCR built into Windows, offline.
# Protocol (one line each way, UTF-8):
#   start  ->  {"ready":true,"languages":["ar-SA","en-GB"]}
#   stdin  <-  <JPEG or PNG picture as base64>
#   stdout ->  {"ok":true,"texts":{"ar-SA":"line\nline","en-GB":"line"}}      or {"ok":false,"error":"..."}
# The picture is handled in memory only: nothing is written to disk.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }

$engines = [ordered]@{}
foreach ($l in [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages) {
    $e = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($l)
    if ($e) { $engines[$l.LanguageTag] = $e }
}
[Console]::Out.WriteLine((@{ ready = $true; languages = @($engines.Keys) } | ConvertTo-Json -Compress))
[Console]::Out.Flush()

while ($null -ne ($line = [Console]::In.ReadLine())) {
    try {
        $bytes = [Convert]::FromBase64String($line.Trim())
        $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
        $writer = New-Object Windows.Storage.Streams.DataWriter($stream)
        $writer.WriteBytes($bytes)
        [void](Await ($writer.StoreAsync()) ([uint32]))
        $stream.Seek(0)
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $texts = [ordered]@{}
        foreach ($tag in $engines.Keys) {
            $r = Await ($engines[$tag].RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
            $texts[$tag] = ($r.Lines | ForEach-Object { $_.Text }) -join "`n"
        }
        $writer.Dispose(); $stream.Dispose()
        [Console]::Out.WriteLine((@{ ok = $true; texts = $texts } | ConvertTo-Json -Compress -Depth 4))
    } catch {
        [Console]::Out.WriteLine((@{ ok = $false; error = "$($_.Exception.Message)" } | ConvertTo-Json -Compress))
    }
    [Console]::Out.Flush()
}
