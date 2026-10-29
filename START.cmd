@echo off
rem Double click to start the CI runners and the status page, then open http://localhost:4280.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\start.ps1"
if errorlevel 1 pause
