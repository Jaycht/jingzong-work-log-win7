!macro customInit
  ; 强制默认安装目录为 D:\Program Files\JingZhenWork
  ; 用户仍可在安装时自定义路径（allowToChangeInstallationDirectory: true）
  StrCpy $INSTDIR "D:\Program Files\JingZhenWork"
!macroend

!macro customUnInstall
  ; 卸载时询问是否删除用户数据（localStorage + IndexedDB + 附件）
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "是否同时删除所有用户数据（工作记录、附件、设置）？$\n$\n选择「是」将清除所有本地数据，不可恢复。$\n选择「否」则保留数据，下次安装可继续使用。" \
    IDNO skip_userdata
  RMDir /r "$APPDATA\jingzong-work-log"
  skip_userdata:
!macroend
