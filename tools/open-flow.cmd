@echo off
rem Opens RAG Lab Flow mode in the default browser, starting the local
rem server (node serve.js, port 5173) first if it is not already running.
cd /d "%~dp0.."
netstat -an | findstr /r /c:":5173 .*LISTENING" >nul
if errorlevel 1 (
  start "RAG Lab server (close this window to stop)" /min cmd /k node serve.js
  ping -n 3 127.0.0.1 >nul
)
start "" http://localhost:5173/flow.html
