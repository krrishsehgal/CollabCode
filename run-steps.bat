@echo off
cd /d "c:\Users\Mannan Bajaj\Downloads\cipher-aura-flow"

REM Step 1: Remove lockfiles and node_modules
echo Step 1: Removing lockfiles and node_modules...
if exist bun.lock del /f bun.lock
if exist bun.lockb del /f bun.lockb
if exist package-lock.json del /f package-lock.json
if exist node_modules rmdir /s /q node_modules
echo Cleanup complete

REM Step 2: npm install
echo.
echo Step 2: Running npm install...
call npm install
if errorlevel 1 (
    echo npm install failed with error level %errorlevel%
    exit /b 1
)
echo npm install complete

REM Step 3: Search lockfiles for forbidden terms
echo.
echo Step 3: Searching lockfiles for forbidden terms...
if exist package-lock.json (
    findstr /i "loveable lovable collaborator" package-lock.json > nul
    if not errorlevel 1 (
        echo FOUND FORBIDDEN TERMS IN package-lock.json
        exit /b 1
    )
)
if exist bun.lock (
    findstr /i "loveable lovable collaborator" bun.lock > nul
    if not errorlevel 1 (
        echo FOUND FORBIDDEN TERMS IN bun.lock
        exit /b 1
    )
)
if exist bun.lockb (
    findstr /i "loveable lovable collaborator" bun.lockb > nul
    if not errorlevel 1 (
        echo FOUND FORBIDDEN TERMS IN bun.lockb
        exit /b 1
    )
)
if exist pnpm-lock.yaml (
    findstr /i "loveable lovable collaborator" pnpm-lock.yaml > nul
    if not errorlevel 1 (
        echo FOUND FORBIDDEN TERMS IN pnpm-lock.yaml
        exit /b 1
    )
)
if exist yarn.lock (
    findstr /i "loveable lovable collaborator" yarn.lock > nul
    if not errorlevel 1 (
        echo FOUND FORBIDDEN TERMS IN yarn.lock
        exit /b 1
    )
)
echo Lockfile search complete - no forbidden terms found

REM Step 4: npm run lint
echo.
echo Step 4: Running npm run lint...
call npm run lint
if errorlevel 1 (
    echo npm run lint failed with error level %errorlevel%
    exit /b 1
)
echo npm run lint complete

REM Step 5: npm run test -- --run
echo.
echo Step 5: Running npm run test -- --run...
call npm run test -- --run
if errorlevel 1 (
    echo npm run test failed with error level %errorlevel%
    exit /b 1
)
echo npm run test complete

REM Step 6: npm run build
echo.
echo Step 6: Running npm run build...
call npm run build
if errorlevel 1 (
    echo npm run build failed with error level %errorlevel%
    exit /b 1
)
echo npm run build complete

echo.
echo SUCCESS: All steps completed
exit /b 0
