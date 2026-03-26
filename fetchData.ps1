$token = "aaad4edbd7e57de0f34d035176a52842900d3216"
$headers = @{ "Authorization" = "Bearer $token"; "Accept" = "application/json" }
$base = "https://app.enlyze.com/api/v2"

Write-Host "Starting continuous ENLYZE data bridge..."
while ($true) {
    try {
        $sites = Invoke-RestMethod -Uri "$base/sites" -Headers $headers
        $machines = Invoke-RestMethod -Uri "$base/machines" -Headers $headers
        $products = Invoke-RestMethod -Uri "$base/products" -Headers $headers

        # 30-day historical window to support deep V4 analysis
        $end = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        $start = (Get-Date).AddDays(-30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

        $runs = Invoke-RestMethod -Uri "$base/production-runs?start=$start&end=$end" -Headers $headers
        $downtimes = Invoke-RestMethod -Uri "$base/downtimes?start=$start&end=$end" -Headers $headers

        $export = @{
            plants = $sites.data
            machines = $machines.data
            products = $products.data
            orders = $runs.data
            downtimes = $downtimes.data
        }

        # Save atomically
        $tempFile = "c:\Users\Salam\Desktop\Production\Project_Anti\live_data_temp.json"
        $targetFile = "c:\Users\Salam\Desktop\Production\Project_Anti\live_data.json"
        
        $export | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempFile -Encoding utf8
        Move-Item -Path $tempFile -Destination $targetFile -Force
        
        Write-Host "Data synced at $(Get-Date)"
    } catch {
        Write-Host "Error syncing: $_"
    }

    Start-Sleep -Seconds 15
}
