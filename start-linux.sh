#!/bin/bash

modules_path="$PWD/node_modules"

if [ -d "$modules_path" ]; then
    npm start
else
    echo "installing depedencies..."
    npm install
    if [ $? -eq 0 ]; then
        npm start
    else
        echo "error while installing dependencies :("
    fi
fi

read -p "press enter to leave..."