; Lets phones on the shop network reach the host: one inbound rule for TCP
; 7420, private networks only, for this program only. Added on install
; (the installer runs elevated) and removed on uninstall. The data folder
; (%APPDATA%\InvoiceERP) is never touched by the installer or uninstaller.
!macro customInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Invoice ERP Desktop"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Invoice ERP Desktop" dir=in action=allow protocol=TCP localport=7420 profile=private program="$INSTDIR\Invoice ERP Desktop.exe"'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Invoice ERP Desktop"'
!macroend
