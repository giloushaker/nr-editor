// Import the necessary Electron components.
const contextBridge = require("electron").contextBridge;
const ipcRenderer = require("electron").ipcRenderer;
contextBridge.exposeInMainWorld(
  // Allowed 'ipcRenderer' methods.
  "electron",
  {
    // From render to main.
    send: (channel, args) => {
      return ipcRenderer.send(channel, args);
    },
    // From main to render.
    receive: (channel, listener) => {
      return ipcRenderer.on(channel, (event, ...args) => listener(...args));
    },
    // From render to main and back again.
    invoke: (channel, args) => {
      return ipcRenderer.invoke(channel, args);
    },
  }
);
