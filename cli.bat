set HTTP_PROXY=
set HTTPS_PROXY=
if not "%~1" == "--skip-sheets" (
  cd ..\open-event-content
  c:\Python36-32\python.exe convert2.py
  cd ..\open-event-webapp
  copy ..\open-event-content\limmud2019.zip uploads\upload.zip
)
set PATH=c:\Program Files\nodejs;%PATH%
start npm run start
node cli.js
timeout /t 5
"c:\Program Files (x86)\Google\Chrome\Application\chrome.exe"  http://localhost:5000/live/preview/limmud2019/
rem taskkill /im node.exe /f