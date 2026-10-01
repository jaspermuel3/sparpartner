$envs = @(
  @{ Name = "NEXT_PUBLIC_SUPABASE_URL"; Value = "https://pwwzjfbcdmhhzozaznlk.supabase.co"; Type = "config" },
  @{ Name = "NEXT_PUBLIC_SUPABASE_ANON_KEY"; Value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3d3pqZmJjZG1oaHpvemF6bmxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTQ1OTcsImV4cCI6MjEwNjQzMDU5N30.jpqPC7oYUNPq7us_tqojHrUftxEGbT9xQz3WO5zNbHU"; Type = "config" },
  @{ Name = "SUPABASE_SERVICE_ROLE_KEY"; Value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3d3pqZmJjZG1oaHpvemF6bmxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDg1NDU5NywiZXhwIjoyMTA2NDMwNTk3fQ.E322FlXIfRvhf95OyheYEVLfYU4Ia1LqykJ5c4lTxLg"; Type = "secret" }
)
$targets = @("development","preview","production")
foreach ($e in $envs) {
  Write-Host "`n=== Setting $($e.Name) ($($e.Type)) ==="
  foreach ($t in $targets) {
    $tmp = [IO.Path]::GetTempFileName()
    try {
      [IO.File]::WriteAllText($tmp, $e.Value)
      $raw = Get-Content -Raw $tmp
      $raw | & npx --yes vercel@62.1.0 env add $e.Name $t --yes --type $e.Type 2>&1 | Out-Host
      Write-Host "  -> $t exit $LASTEXITCODE"
    } finally {
      Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
  }
}
