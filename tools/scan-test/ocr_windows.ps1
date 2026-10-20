# Reads every .jpg of a folder with the OCR built into Windows (offline), once per installed recognizer language.
# Usage: powershell -File ocr_windows.ps1 <folder> <output.json>
# Output: { "<picture name>": { "texts": { "<language tag>": "<text>" }, "sec": <seconds for all languages> } }
param([string]$Folder, [string]$Out)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }

$engines = @{}
foreach ($l in [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages) {
    $engines[$l.LanguageTag] = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($l)
}
$result = [ordered]@{}
foreach ($f in Get-ChildItem $Folder -Filter *.jpg | Sort-Object Name) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $texts = [ordered]@{}
    foreach ($tag in $engines.Keys) {
        $r = Await ($engines[$tag].RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
        $texts[$tag] = ($r.Lines | ForEach-Object { $_.Text }) -join "`n"
    }
    $stream.Dispose()
    $result[$f.BaseName] = @{ texts = $texts; sec = [math]::Round($sw.Elapsed.TotalSeconds, 2) }
}
$result | ConvertTo-Json -Depth 5 | Set-Content -Path $Out -Encoding utf8
"$($result.Count) pictures, languages: $($engines.Keys -join ', ')"
