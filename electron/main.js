const { app, BrowserWindow } = require('electron');
const path = require('path');

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  window.loadURL('http://localhost:3001');
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
