const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let backendProcess;

function startBackend() {
  const serverPath = path.join(__dirname, '..', 'backend', 'server.js');
  backendProcess = spawn(process.execPath, [serverPath], {
    env: process.env,
    stdio: 'inherit'
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  window.loadURL('http://127.0.0.1:3001');
}

app.whenReady().then(() => {
  startBackend();
  setTimeout(createWindow, 1200);
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
