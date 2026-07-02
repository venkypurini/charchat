Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get current script directory
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Start Backend server silently (0 = hide command window)
WshShell.Run "cmd /c cd /d """ & strPath & "\backend"" && npm run dev", 0, False

' Start Frontend server silently (0 = hide command window)
WshShell.Run "cmd /c cd /d """ & strPath & "\frontend"" && npm run dev", 0, False

' Wait 3.5 seconds for servers to initialize
WScript.Sleep 3500

' Check for Google Chrome or Microsoft Edge paths
strChrome1 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
strChrome2 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
strChrome3 = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")
strEdge1 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
strEdge2 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")

If objFSO.FileExists(strChrome1) Then
    WshShell.Run """" & strChrome1 & """ http://localhost:5173", 1, False
ElseIf objFSO.FileExists(strChrome2) Then
    WshShell.Run """" & strChrome2 & """ http://localhost:5173", 1, False
ElseIf objFSO.FileExists(strChrome3) Then
    WshShell.Run """" & strChrome3 & """ http://localhost:5173", 1, False
ElseIf objFSO.FileExists(strEdge1) Then
    WshShell.Run """" & strEdge1 & """ http://localhost:5173", 1, False
ElseIf objFSO.FileExists(strEdge2) Then
    WshShell.Run """" & strEdge2 & """ http://localhost:5173", 1, False
Else
    WshShell.Run "cmd /c start chrome http://localhost:5173 2>nul || start msedge http://localhost:5173 2>nul || start http://localhost:5173", 0, False
End If
