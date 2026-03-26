$port = 8082
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)

try {
    $listener.Start()
} catch {
    Write-Host "Failed to start socket server on port $port."
    exit
}

# Obtain the correct Local IP Address to share
$ipObj = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet|LAN" -and $_.IPAddress -notmatch "^169\.254|^127" } | Select-Object -First 1
$ip = if ($ipObj) { $ipObj.IPAddress } else { "127.0.0.1" }

Write-Host "`n=========================================================="
Write-Host "🚀 NAUE ADMIN-FREE NETWORK SERVER ONLINE! 🚀"
Write-Host "=========================================================="
Write-Host "No Admin / Password required! Successfully bypassed Windows Security."
Write-Host "Please give THIS exact link below to your shift leaders!"
Write-Host ""
Write-Host "      👉   http://${ip}:${port}/   👈"
Write-Host ""
Write-Host "=========================================================="
Write-Host "(Keep this window running to keep the dashboard online)`n"

# Pop open the user's browser automatically to verify locally
Start-Process "http://localhost:$port/"

$folder = $PWD.Path

while ($true) {
    if (-not $listener.Pending()) {
        Start-Sleep -Milliseconds 100
        continue
    }
    
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)

    try {
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }
        
        $reqParts = $requestLine.Split(" ")
        if ($reqParts.Length -lt 2) { $client.Close(); continue }
        
        $path = $reqParts[1].Split("?")[0]
        if ($path -eq "/") { $path = "/index.html" }
        
        # Security: prevent directory traversal
        $path = $path.Replace("..", "")
        $safePath = $path.TrimStart("/")
        $fullPath = Join-Path $folder $safePath

        if ($path -match "^/proxy/") {
            # Forward all /proxy/* requests to the ENLYZE proxy on 8085
            try {
                $rawLine = $requestLine
                $method = $reqParts[0]
                $fullQuery = $reqParts[1]
                $proxyUrl = "http://127.0.0.1:8085" + $fullQuery
                $proxyReq = [System.Net.WebRequest]::Create($proxyUrl)
                $proxyReq.Method = $method

                # Read remaining headers and body from the client stream
                $headerLines = @()
                $line = ""
                while (($line = $reader.ReadLine()) -ne "") {
                    if ($line -eq $null) { break }
                    $headerLines += $line
                }
                # Check for Content-Length and read body if present
                $clHeader = $headerLines | Where-Object { $_ -match "^Content-Length:" }
                if ($clHeader) {
                    $bodyLen = [int]($clHeader -split ":")[1].Trim()
                    if ($bodyLen -gt 0) {
                        $proxyReq.ContentType = "application/json"
                        $proxyReq.ContentLength = $bodyLen
                        $bodyBuf = New-Object byte[] $bodyLen
                        $rawStream = $stream
                        $total = 0
                        while ($total -lt $bodyLen) {
                            $read = $rawStream.Read($bodyBuf, $total, $bodyLen - $total)
                            if ($read -le 0) { break }
                            $total += $read
                        }
                        $ps = $proxyReq.GetRequestStream()
                        $ps.Write($bodyBuf, 0, $total)
                        $ps.Close()
                    }
                }

                $proxyRes = $proxyReq.GetResponse()
                $proxyStream = $proxyRes.GetResponseStream()
                $ms = New-Object System.IO.MemoryStream
                $proxyStream.CopyTo($ms)
                $proxyStream.Close()
                $proxyRes.Close()
                $bytes = $ms.ToArray()

                $header = "HTTP/1.1 200 OK`r`n"
                $header += "Content-Type: application/json`r`n"
                $header += "Content-Length: $($bytes.Length)`r`n"
                $header += "Access-Control-Allow-Origin: *`r`n"
                $header += "Connection: close`r`n`r`n"
                $hb = [System.Text.Encoding]::UTF8.GetBytes($header)
                $stream.Write($hb, 0, $hb.Length)
                $stream.Write($bytes, 0, $bytes.Length)
            } catch {
                $errBody = [System.Text.Encoding]::UTF8.GetBytes("{""error"":""proxy failed""}")
                $errHdr = "HTTP/1.1 502 Bad Gateway`r`nContent-Length: $($errBody.Length)`r`nConnection: close`r`n`r`n"
                $eb = [System.Text.Encoding]::UTF8.GetBytes($errHdr)
                $stream.Write($eb, 0, $eb.Length)
                $stream.Write($errBody, 0, $errBody.Length)
            }
        } elseif (Test-Path $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            
            $mime = "text/plain"
            if ($ext -match "\.html$") { $mime = "text/html; charset=utf-8" }
            elseif ($ext -match "\.js$") { $mime = "application/javascript; charset=utf-8" }
            elseif ($ext -match "\.css$") { $mime = "text/css; charset=utf-8" }
            elseif ($ext -match "\.json$") { $mime = "application/json; charset=utf-8" }

            $header = "HTTP/1.1 200 OK`r`n"
            $header += "Content-Type: $mime`r`n"
            $header += "Content-Length: $($bytes.Length)`r`n"
            $header += "Access-Control-Allow-Origin: *`r`n"
            $header += "Connection: close`r`n`r`n"
            
            $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
        } else {
            $err = "HTTP/1.1 404 Not Found`r`nConnection: close`r`n`r`n"
            $errBytes = [System.Text.Encoding]::ASCII.GetBytes($err)
            $stream.Write($errBytes, 0, $errBytes.Length)
        }
    } catch {
        # ignore missing files or closed streams safely
    } finally {
        $client.Close()
    }
}
