const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("diffsDesktop", {
  request: (route, method, body) =>
    ipcRenderer.invoke("git-request", route, method, body),
  chooseProject: () => ipcRenderer.invoke("choose-project"),
  onOpenProject: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("open-project", listener);
    return () => ipcRenderer.removeListener("open-project", listener);
  },
});
