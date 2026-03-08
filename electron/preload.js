const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  environment: 'electron-terminal'
});
