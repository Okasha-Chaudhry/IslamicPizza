# build-islamic-pizza.ps1 - Islamic Pizza build with auto-revert
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "== Applying Islamic Pizza branding ==" -ForegroundColor Cyan
$m = (Get-Content .\package.json -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace('"name": "restaurant-pos"', '"name": "islamic-pizza-pos"')
[System.IO.File]::WriteAllText("$PSScriptRoot\package.json", $m)

$m = (Get-Content .\electron-builder.yml -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace('appId: com.okasha.restaurantpos', 'appId: com.okasha.islamicpizzapos')
$m = $m.Replace('productName: Restaurant POS', 'productName: Islamic Pizza POS')
$m = $m.Replace('artifactName: restaurant-pos-1.1-setup.', 'artifactName: islamic-pizza-pos-1.1.1-setup.')
[System.IO.File]::WriteAllText("$PSScriptRoot\electron-builder.yml", $m)

$m = (Get-Content .\src\renderer\src\pages\ActivationScreen.tsx -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace('<h1 className="text-2xl font-bold">Restaurant POS</h1>', '<h1 className="text-2xl font-bold">Islamic Pizza POS</h1>')
[System.IO.File]::WriteAllText("$PSScriptRoot\src\renderer\src\pages\ActivationScreen.tsx", $m)

$m = (Get-Content .\src\main\db\seed.ts -Raw -Encoding UTF8) -replace "`r`n","`n"
$rm = "  // Generic build: no menu seeding. Client menu entered at delivery.`n  // (Islamic Pizza menu kept below; remove this return for their builds.)`n  return`n"
$m = $m.Replace($rm, "")
[System.IO.File]::WriteAllText("$PSScriptRoot\src\main\db\seed.ts", $m)

$m = (Get-Content .\src\main\services\settings.service.ts -Raw -Encoding UTF8) -replace "`r`n","`n"
$m = $m.Replace("  restaurantName: 'My Restaurant',", "  restaurantName: 'Islamic Pizza & Fast Food',")
$m = $m.Replace("  address: '',", "  address: 'Muqabil Allah Wali Market, Jatoi Road, Shehar Sultan',")
$m = $m.Replace("  phone: '',", "  phone: '0305-1415678 / 0306-1415678',")
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
Get-ChildItem .\dist\islamic-pizza-pos-1.1.1-setup.exe | Select-Object Name, LastWriteTime