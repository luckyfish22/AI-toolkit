@echo off
REM =============================================================================
REM Model Downloader - Launcher script for Windows Task Scheduler
REM Triggered daily at 23:30. Downloads AI models via huggingface_hub SDK.
REM Full workflow documented in CLAUDE.md (auto-read by Claude Code agent).
REM =============================================================================
setlocal enabledelayedexpansion

REM --- Get script directory ---
set "SCRIPT_DIR=%~dp0"

REM --- Generate timestamp for log ---
REM date /t format: "<weekday> YYYY/MM/DD"
for /f "tokens=1-4 delims=/.- " %%a in ('date /t') do (
    set "YY=%%b" & set "MM=%%c" & set "DD=%%d"
)
for /f "tokens=1-2 delims=:. " %%a in ('time /t') do (
    set "HH=%%a" & set "MI=%%b"
)
set "DATE_STR=%YY%-%MM%-%DD%"
set "TIME_STR=%HH%-%MI%"
set "LOG_DIR=%SCRIPT_DIR%logs"
set "LOG_FILE=%LOG_DIR%\download_%DATE_STR%_%TIME_STR%.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM --- Terminal feedback ---
echo.
echo =============================================
echo   Model Downloader
echo   Started: %DATE_STR% %TIME_STR%
echo   Log   : %LOG_FILE%
echo =============================================
echo.

REM --- Log header ---
> "%LOG_FILE%" (
    echo =============================================================================
    echo  Model Downloader - Started: %DATE_STR% %TIME_STR%
    echo =============================================================================
    echo.
)

REM --- Run Claude Code agent ---
echo [1/3] Starting Claude Code agent...
>> "%LOG_FILE%" echo [1/3] Starting Claude Code agent...
echo [2/3] Claude is working, this may take a while...
>> "%LOG_FILE%" echo [2/3] Claude is working, this may take a while...
echo        Check live progress: tail -f "%LOG_FILE%"
echo.

cd /d "%SCRIPT_DIR%"

call claude --permission-mode bypassPermissions -p "Execute model download tasks. Read download_tasks.md for pending models, follow the workflow in CLAUDE.md. Write logs to %LOG_FILE%. Update download_tasks.md status after completion." >> "%LOG_FILE%" 2>&1

REM --- Record result ---
echo.
echo [3/3] Done. Claude exit code: %ERRORLEVEL%
echo.

>> "%LOG_FILE%" (
    echo.
    echo [EXIT] Claude Code exit code: %ERRORLEVEL%
    echo [DONE] Finished at: %date% %time%
)

echo =============================================
echo   Log saved to: %LOG_FILE%
echo =============================================
echo.

endlocal
