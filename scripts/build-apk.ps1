# Gera o APK de debug do treinolog.
# Requisitos: JDK 21, Android SDK (platform 36 + build-tools 36) e Node 22+.
# O script usa .tools\jdk21 e .tools\android-sdk quando existirem.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:JAVA_HOME -and (Test-Path "$root\.tools\jdk21")) {
  $env:JAVA_HOME = "$root\.tools\jdk21"
}
if (-not $env:ANDROID_HOME -and (Test-Path "$root\.tools\android-sdk")) {
  $env:ANDROID_HOME = "$root\.tools\android-sdk"
}

if (-not $env:JAVA_HOME) {
  throw "JAVA_HOME nao definido. Instale o JDK 21 ou rode o setup em .tools."
}
if (-not $env:ANDROID_HOME) {
  throw "ANDROID_HOME nao definido. Instale o Android SDK ou rode o setup em .tools."
}

$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$sdkPath = $env:ANDROID_HOME.Replace("\", "\\").Replace(":", "\:")
Set-Content -Path "android\local.properties" -Value "sdk.dir=$sdkPath" -Encoding ASCII

if (-not (Test-Path "node_modules")) {
  npm install
}

npx cap sync

Push-Location android
try {
  .\gradlew.bat assembleDebug
} finally {
  Pop-Location
}

$apk = "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
  throw "APK nao encontrado em $apk."
}

New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item $apk "dist\treinolog-debug.apk" -Force

Write-Output "APK gerado: $root\dist\treinolog-debug.apk"
