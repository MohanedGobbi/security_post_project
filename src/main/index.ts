import { join } from 'node:path'
import { app, BrowserWindow, dialog, Menu, session, shell } from 'electron'
import { initKey, replaceKey } from './crypto'
import { autoSafetyCopy, setRecovery } from './backup'
import { applyRetention, audit, isFreshInstall, openDb, resetDatabase } from './db'
import { registerIpc } from './ipc'
import { seedFaculty } from './seed'
import { shutdownScanner, warmUpScanner } from './scan'
import { startSyncLoop, stopSyncLoop } from './sync'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0f1720',
    title: 'برنامج إدارة الأمن بالكلية',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
  })
  // never open other sites inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) e.preventDefault()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// optional separate data folder (testing, or a portable install on a USB drive)
if (process.env['SECREG_DATA_DIR']) app.setPath('userData', process.env['SECREG_DATA_DIR'])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) {
      if (w.isMinimized()) w.restore()
      w.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    // the only permission the UI needs is the webcam
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'))
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')

    const keyState = initKey()
    openDb()
    if (keyState === 'lost') {
      if (isFreshInstall()) {
        // killed during the very first seconds: nothing of value was stored yet, so start over
        resetDatabase()
        replaceKey()
        openDb()
      } else {
        // the data key cannot be opened (another Windows account or PC): the program starts in recovery mode, where only
        // restoring a backup file is possible
        setRecovery(true)
        registerIpc()
        createWindow()
        return
      }
    }
    seedFaculty()
    autoSafetyCopy()
    const purged = applyRetention()
    if (Object.values(purged).some(Boolean)) audit(null, 'retention_purge', '', null, JSON.stringify(purged))
    registerIpc()
    createWindow()
    warmUpScanner()
    startSyncLoop()
  })

  app.on('window-all-closed', () => {
    stopSyncLoop()
    shutdownScanner().finally(() => app.quit())
  })
}
