@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===============================================================
echo  Publish: put this page on the web, once.
echo ===============================================================
echo.
echo   publish.bat                 create the repository and push
echo   publish.bat --repo URL      ... into one you made yourself
echo   publish.bat --dry-run       say what would happen, do nothing
echo.
echo  Afterwards, updates are one command from the tracker folder:
echo    refresh.bat --publish
echo.
py publish.py %* 2>nul || python publish.py %*
pause
