Set WshShell = CreateObject("WScript.Shell")

' Kill Node.js processes running on ports 5000 and 5173 silently
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %a 2>nul", 0, True
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %a 2>nul", 0, True

MsgBox "CharChat servers have been shut down successfully.", 64, "CharChat Stopped"
