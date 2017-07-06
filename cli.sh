#!/bin/bash

set -o errexit -o nounset
cd ../open-event-content
./convert2.py
cd ../open-event-webapp
cp ../open-event-content/limmud2017.zip uploads/upload.zip
GH_TIMEOUT="${GH_TIMEOUT:-15s}"
node cli.js & timeout $GH_TIMEOUT npm run start;
