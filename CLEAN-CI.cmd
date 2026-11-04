@echo off
rem Double click to empty the CI work folders in C:\ci when the disk runs full.
rem The runners stop for a few seconds, then build again while the old files delete in the background.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\clean-ci.ps1"
pause
