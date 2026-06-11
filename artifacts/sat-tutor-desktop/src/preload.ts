import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronBridge", {
  platform: process.platform,
  isElectron: true,
});
