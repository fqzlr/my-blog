@echo off
chcp 65001 >nul
echo ========================================
echo   Obsidian 笔记同步工具
echo ========================================
echo.

cd /d "%~dp0"
node index.js

echo.
pause
