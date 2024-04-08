@echo off

set "modules_path=%cd%\node_modules"

if exist "%modules_path%" (
    npm start
) else (
    echo installing dependencies
    npm install
    if %errorlevel% neq 0 (
        echo error
    ) else (
        npm start
    )
)

pause