// Flexible storage abstraction - can switch between localStorage and DB
export interface StorageAdapter {
  saveMessage(roomId: string, message: any): Promise<void>;
  getMessages(roomId: string): Promise<any[]>;
  saveFile(roomId: string, filename: string, content: string): Promise<void>;
  getFile(roomId: string, filename: string): Promise<string | null>;
  getFiles(roomId: string): Promise<string[]>;
  addLog(roomId: string, log: any): Promise<void>;
  getLogs(roomId: string): Promise<any[]>;
}

// LocalStorage implementation
class LocalStorageAdapter implements StorageAdapter {
  private getKey(prefix: string, roomId: string, key?: string) {
    return `collabcode:${prefix}:${roomId}${key ? `:${key}` : ""}`;
  }

  async saveMessage(roomId: string, message: any): Promise<void> {
    const key = this.getKey("messages", roomId);
    const messages = JSON.parse(localStorage.getItem(key) || "[]");
    messages.push({ ...message, id: Date.now(), timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(messages));
  }

  async getMessages(roomId: string): Promise<any[]> {
    const key = this.getKey("messages", roomId);
    return JSON.parse(localStorage.getItem(key) || "[]");
  }

  async saveFile(roomId: string, filename: string, content: string): Promise<void> {
    const key = this.getKey("files", roomId, filename);
    localStorage.setItem(key, content);

    // Keep track of filenames
    const filesKey = this.getKey("files", roomId);
    const files = JSON.parse(localStorage.getItem(filesKey) || "[]");
    if (!files.includes(filename)) {
      files.push(filename);
      localStorage.setItem(filesKey, JSON.stringify(files));
    }
  }

  async getFile(roomId: string, filename: string): Promise<string | null> {
    const key = this.getKey("files", roomId, filename);
    return localStorage.getItem(key);
  }

  async getFiles(roomId: string): Promise<string[]> {
    const key = this.getKey("files", roomId);
    return JSON.parse(localStorage.getItem(key) || "[]");
  }

  async addLog(roomId: string, log: any): Promise<void> {
    const key = this.getKey("logs", roomId);
    const logs = JSON.parse(localStorage.getItem(key) || "[]");
    logs.push({ ...log, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(logs));
  }

  async getLogs(roomId: string): Promise<any[]> {
    const key = this.getKey("logs", roomId);
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
}

// Export singleton instance
export const storage: StorageAdapter = new LocalStorageAdapter();
