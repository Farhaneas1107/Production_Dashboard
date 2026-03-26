$token = "aaad4edbd7e57de0f34d035176a52842900d3216"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$base = "https://app.enlyze.com/api/v2"

$json = Get-Content "c:\Users\Salam\Desktop\Production\Project_Anti\machines_config.json" -Raw | ConvertFrom-Json
$machinesProps = $json.PSObject.Properties

$exportData = @{}

# Keywords for micro-metrics
$keywords = @("Sollwert", "Speed", "Parameter", "Temp", "Druck", "Press", "Flow", "Quantity", "Scrap", "Waste", "Set", "Menge")

foreach ($p in $machinesProps) {
    $m = $p.Value.machine
    $vars = $p.Value.variables

    # Filter variables
    $targetVars = @()
    foreach ($v in $vars) {
        $name = $v.display_name
        if ($name) {
            foreach ($kw in $keywords) {
                if ($name -match "(?i)$kw") {
                    $targetVars += $v
                    break
                }
            }
        }
    }
    
    if ($targetVars.Count -eq 0) {
        continue
    }
    if ($targetVars.Count -gt 50) {
        $targetVars = $targetVars[0..49]
    }

    Write-Host "Machine $($m.name) (UUID: $($m.uuid)) target variables: $($targetVars.Count)"

    # We'll query the last 90 days in 3 chunks of 30 days
    $mTimeseries = @()
    for ($i = 0; $i -lt 3; $i++) {
        $endObj = (Get-Date).AddDays(-($i * 30)).ToUniversalTime()
        $startObj = (Get-Date).AddDays(-(($i + 1) * 30)).ToUniversalTime()
        
        # Round minutes to nearest 10 for timeseries aligned start/end
        $endMinute = [math]::Floor($endObj.Minute / 10) * 10
        $endObj = $endObj.AddMinutes($endMinute - $endObj.Minute).AddSeconds(-$endObj.Second).AddMilliseconds(-$endObj.Millisecond)
        
        $startMinute = [math]::Floor($startObj.Minute / 10) * 10
        $startObj = $startObj.AddMinutes($startMinute - $startObj.Minute).AddSeconds(-$startObj.Second).AddMilliseconds(-$startObj.Millisecond)

        $end = $endObj.ToString("yyyy-MM-ddTHH:mm:ssZ")
        $start = $startObj.ToString("yyyy-MM-ddTHH:mm:ssZ")

        $varList = @()
        foreach ($tv in $targetVars) {
            $varList += @{ "uuid" = $tv.uuid; "resampling_method" = "avg" }
        }

        $body = @{
            machine = $m.uuid
            start = $start
            end = $end
            resampling_interval = 600
            variables = $varList
        } | ConvertTo-Json -Depth 5 -Compress

        try {
            $tsRes = Invoke-RestMethod -Uri "$base/timeseries" -Headers $headers -Method POST -Body $body
            if ($tsRes -and $tsRes.data) {
                $mTimeseries += $tsRes.data
            }
        } catch {
            Write-Host "Error fetching timeseries for $($m.name) chunk $i : $_"
        }
    }
    
    if ($mTimeseries.Count -gt 0) {
        $exportData[$m.uuid] = @{
            machine_name = $m.name
            variables = $targetVars
            timeseries = $mTimeseries
        }
        Write-Host "Collected timeseries for $($m.name)"
    }
}

$exportData | ConvertTo-Json -Depth 10 | Out-File -FilePath "c:\Users\Salam\Desktop\Production\Project_Anti\micro_metrics_export.json" -Encoding utf8
Write-Host "Done exporting to micro_metrics_export.json"
