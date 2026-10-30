// The only bridge between the status page and the host (contextIsolation on,
// no Node in the page).
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('host', {
  status: () => ipcRenderer.invoke('host:status'),
  pair: () => ipcRenderer.invoke('host:pair'),
  setBlocked: (deviceId: string, blocked: boolean) => ipcRenderer.invoke('host:block', deviceId, blocked),
  setStartWithWindows: (on: boolean) => ipcRenderer.invoke('app:startWithWindows', on),
  openDataFolder: () => ipcRenderer.invoke('app:openData'),
  users: () => ipcRenderer.invoke('users:list'),
  saveUser: (u: unknown) => ipcRenderer.invoke('users:save', u),
});
