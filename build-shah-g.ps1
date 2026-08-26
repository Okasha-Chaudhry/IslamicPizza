# build-shah-g.ps1 - Shah G Foods build with auto-revert
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "== Applying Shah G Foods branding ==" -ForegroundColor Cyan

$m = (Get-Content .\package.json -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace('"name": "restaurant-pos"', '"name": "shah-g-foods-pos"')
[System.IO.File]::WriteAllText("$PSScriptRoot\package.json", $m)

$m = (Get-Content .\electron-builder.yml -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace('appId: com.okasha.restaurantpos', 'appId: com.okasha.shahgfoodspos')
$m = $m.Replace('productName: Restaurant POS', 'productName: Shah G Foods POS')
$m = $m.Replace('artifactName: restaurant-pos-1.1-setup.', 'artifactName: shah-g-foods-pos-1.1.1-setup.')
[System.IO.File]::WriteAllText("$PSScriptRoot\electron-builder.yml", $m)

$m = (Get-Content .\src\renderer\src\pages\ActivationScreen.tsx -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace('<h1 className="text-2xl font-bold">Restaurant POS</h1>', '<h1 className="text-2xl font-bold">Shah G Foods POS</h1>')
[System.IO.File]::WriteAllText("$PSScriptRoot\src\renderer\src\pages\ActivationScreen.tsx", $m)

# Enable menu seeding (remove the early return)
$m = (Get-Content .\src\main\db\seed.ts -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace("export function seedIfEmpty(): void {`n  return`n", "export function seedIfEmpty(): void {`n")
[System.IO.File]::WriteAllText("$PSScriptRoot\src\main\db\seed.ts", $m)

$m = (Get-Content .\src\main\services\settings.service.ts -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace("  restaurantName: 'My Restaurant',", "  restaurantName: 'Shah G Foods',")
$m = $m.Replace("  address: '',", "  address: 'Islamabad',")
$m = $m.Replace("  phone: '',", "  phone: '051-2321728 / 0302-9199938',")
[System.IO.File]::WriteAllText("$PSScriptRoot\src\main\services\settings.service.ts", $m)

Write-Host "== Building ==" -ForegroundColor Cyan
try {
  npm run build:win
} finally {
  Write-Host "== Reverting branding (always) ==" -ForegroundColor Yellow
  git checkout -- package.json electron-builder.yml src/main/db/seed.ts src/renderer/src/pages/ActivationScreen.tsx src/main/services/settings.service.ts
  git status
}
Write-Host "== DONE ==" -ForegroundColor Green
Get-ChildItem .\dist\shah-g-foods-pos-1.1.1-setup.exe | Select-Object Name, LastWriteTime