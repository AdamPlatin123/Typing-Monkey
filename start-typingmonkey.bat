@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
for %%I in ("%ROOT%.") do set "ROOT=%%~fI"

set "RUN_MIGRATE=0"
set "ONLY_CHECK=0"
set "NO_OPEN=0"

for %%A in (%*) do (
  if /i "%%~A"=="--migrate" set "RUN_MIGRATE=1"
  if /i "%%~A"=="--check" set "ONLY_CHECK=1"
  if /i "%%~A"=="--no-open" set "NO_OPEN=1"
)

color 0B
title TypingMonkey Launcher

call :banner
call :line
echo [INFO] Project root: %ROOT%
echo [INFO] Mode: No-Docker local startup

pushd "%ROOT%" >nul
if errorlevel 1 (
  echo [FAIL] Cannot enter project directory
  goto :fatal
)

where node >nul 2>nul
if errorlevel 1 (
  echo [FAIL] Node.js not found. Please install Node.js 20+
  goto :fatal
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [FAIL] npm not found. Please reinstall Node.js
  goto :fatal
)

echo [OK] Node / npm detected

if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [WARN] .env was missing and has been created from .env.example
  ) else (
    echo [FAIL] Missing both .env and .env.example
    goto :fatal
  )
)

if not exist "node_modules" (
  echo [STEP] Installing dependencies: npm install
  call npm install
  if errorlevel 1 (
    echo [FAIL] npm install failed
    goto :fatal
  )
) else (
  echo [OK] node_modules already exists
)

echo [STEP] Generating Prisma client
call npm run prisma:generate
if errorlevel 1 (
  echo [FAIL] prisma:generate failed
  goto :fatal
)

if "%RUN_MIGRATE%"=="1" (
  echo [STEP] Running database migration
  call npm run prisma:migrate
  if errorlevel 1 (
    echo [FAIL] prisma:migrate failed
    goto :fatal
  )
)

where soffice >nul 2>nul
if errorlevel 1 (
  echo [WARN] soffice not found. .ppt conversion will fail. Install LibreOffice or set LIBREOFFICE_PATH in .env
) else (
  echo [OK] LibreOffice detected (soffice)
)

where 7z >nul 2>nul
if errorlevel 1 (
  echo [WARN] 7z not found. .7z/.rar extraction will fail. Install 7-Zip or set SEVEN_ZIP_PATH in .env
) else (
  echo [OK] 7-Zip detected (7z)
)

set "REDIS_UP=0"
set "S3_UP=0"
echo [STEP] Checking local ports: 6379 9000
for %%P in (6379 9000) do (
  netstat -ano | findstr /r /c:":%%P .*LISTENING" >nul
  if errorlevel 1 (
    echo    [WARN] Port %%P is not listening
  ) else (
    echo    [OK]   Port %%P is listening
    if "%%P"=="6379" set "REDIS_UP=1"
    if "%%P"=="9000" set "S3_UP=1"
  )
)

if "%ONLY_CHECK%"=="1" (
  call :line
  echo [OK] Check mode complete
  goto :done
)

call :line
if "%REDIS_UP%"=="1" (
  echo [STEP] Starting worker window
  start "TypingMonkey Worker" cmd /k "cd /d ""%ROOT%"" && npm run worker"
) else (
  echo [WARN] Redis is offline, worker startup skipped
)

echo [STEP] Starting dev server window
start "TypingMonkey Dev" cmd /k "cd /d ""%ROOT%"" && npm run dev"

if not "%NO_OPEN%"=="1" (
  timeout /t 2 >nul
  start "" "http://localhost:3000"
)

call :line
echo [OK] Startup commands sent
echo [INFO] Web: http://localhost:3000
if not "%S3_UP%"=="1" echo [WARN] S3 endpoint (9000) is offline, file upload will fail
echo [INFO] Check only: start-typingmonkey.bat --check
echo [INFO] With migrate: start-typingmonkey.bat --migrate
goto :done

:banner
echo.
echo  ###############################################################
echo  #                                                             #
echo  #                   T Y P I N G M O N K E Y                   #
echo  #                       L A U N C H E R                       #
echo  #                                                             #
echo  ###############################################################
echo.
exit /b

:line
echo ===============================================================================
exit /b

:fatal
call :line
echo [FAIL] Startup aborted. Press any key to exit.
popd >nul
pause >nul
exit /b 1

:done
popd >nul
exit /b 0
