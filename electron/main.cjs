const { app, BrowserWindow, net, protocol, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

protocol.registerSchemesAsPrivileged([{ scheme: 'feuerrot', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

app.whenReady().then(() => {
  const dist = path.join(__dirname, '..', 'dist')
  protocol.handle('feuerrot', (request) => {
    const url = new URL(request.url)
    const relativ = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const datei = path.normalize(path.join(dist, relativ))
    if (!datei.startsWith(dist)) return new Response('Nicht erlaubt', { status: 403 })
    return net.fetch(pathToFileURL(datei).toString())
  })

  const fenster = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#17211c',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'dist', 'pokeball-app-icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  void fenster.loadURL('feuerrot://app/index.html')
  fenster.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('feuerrot://')) {
      event.preventDefault()
      if (url.startsWith('https://')) void shell.openExternal(url)
    }
  })
  fenster.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
