$port = 8085
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host ""
Write-Host "=========================================="
Write-Host "ENLYZE API Proxy Running on port $port"
Write-Host "Local access: http://localhost:$port/"
Write-Host "=========================================="
Write-Host ""

$folder = "c:\Users\Salam\Desktop\Production\Project_Anti"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        $path = $req.Url.LocalPath

        # CORS Options Preflight
        if ($req.HttpMethod -eq "OPTIONS") {
            $res.AddHeader("Access-Control-Allow-Origin", "*")
            $res.AddHeader("Access-Control-Allow-Headers", "*")
            $res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $res.StatusCode = 200
            $res.Close()
            continue
        }

        # API Proxy to ENLYZE
        if ($path -match "^/proxy/(.*)") {
            $targetUrl = "https://app.enlyze.com/api/v2/" + $matches[1] + $req.Url.Query
            
            $proxyReq = [System.Net.WebRequest]::Create($targetUrl)
            $proxyReq.Method = $req.HttpMethod
            
            # Always inject the bearer token server-side (fallback for any client)
            $proxyReq.Headers.Add("Authorization", "Bearer aaad4edbd7e57de0f34d035176a52842900d3216")
            $proxyReq.Accept = "application/json"
            
            if ($req.HasEntityBody) {
                $proxyReq.ContentType = $req.ContentType
                if ($req.ContentLength64 -gt 0) {
                    $proxyReq.ContentLength = $req.ContentLength64
                }
                $clientStream = $req.InputStream
                $targetStream = $proxyReq.GetRequestStream()
                $clientStream.CopyTo($targetStream)
                $targetStream.Close()
            }
            
            try {
                $proxyRes = $proxyReq.GetResponse()
                $stream = $proxyRes.GetResponseStream()
                $res.ContentType = "application/json"
                $res.AddHeader("Access-Control-Allow-Origin", "*")
                $stream.CopyTo($res.OutputStream)
            } catch {
                $errRes = $_.Exception.Response
                if ($errRes) {
                    $res.StatusCode = [int]$errRes.StatusCode
                } else {
                    $res.StatusCode = 500
                }
            }
            $res.Close()
            continue
        }

        # Serve Dashboard Static Files
        if ($path -eq "/") { $path = "/index.html" }
        $fullPath = Join-Path $folder $path

        if (Test-Path $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            if ($ext -match "\.html$") { $res.ContentType = "text/html" }
            elseif ($ext -match "\.js$") { $res.ContentType = "application/javascript" }
            elseif ($ext -match "\.css$") { $res.ContentType = "text/css" }
            
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404")
            $res.OutputStream.Write($err, 0, $err.Length)
        }
        $res.Close()
    } catch {
        # Keep alive on dropped connections
    }
}
