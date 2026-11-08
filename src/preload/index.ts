import { contextBridge, ipcRenderer } from 'electron'
import { buildApi } from '@shared/buildApi'

contextBridge.exposeInMainWorld('api', buildApi((channel) => (...args) => ipcRenderer.invoke(channel, ...args)))
