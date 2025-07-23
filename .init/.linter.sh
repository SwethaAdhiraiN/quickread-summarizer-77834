#!/bin/bash
cd /home/kavia/workspace/code-generation/quickread-summarizer-77834/frontend_react_app
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

