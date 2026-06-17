@echo off
chcp 65001 >nul
cd /d %~dp0

echo.
echo   ██╗███╗   ███╗██╗   ██╗     ██████╗  ██████╗
echo   ██║████╗ ████║╚██╗ ██╔╝    ██╔════╝ ██╔════╝
echo   ██║██╔████╔██║ ╚████╔╝     ██║      ██║
echo   ██║██║╚██╔╝██║  ╚██╔╝      ██║      ██║
echo   ██║██║ ╚═╝ ██║   ██║       ╚██████╗ ╚██████╗
echo   ╚═╝╚═╝     ╚═╝   ╚═╝        ╚═════╝  ╚═════╝
echo.
echo   Claude Chat Viewer — 本地聊天记录浏览器
echo   =========================================
echo.

REM 杀掉占用 3000 端口的旧进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo 正在关闭旧进程...
    taskkill /F /PID %%a >nul 2>&1
)

echo [1/2] 正在构建前端...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo 构建失败，请检查 Node.js 是否安装
    pause
    exit /b 1
)

echo [2/2] 正在启动服务器...
start http://localhost:3000
echo.
echo   服务已启动: http://localhost:3000
echo   关闭此窗口即可停止服务
echo.
node server/main.js
pause