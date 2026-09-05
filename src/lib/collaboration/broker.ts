export interface Collaborator {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  role: 'viewer' | 'editor' | 'admin';
  cursor?: {
    fileId: string;
    lineNumber: number;
    column: number;
  };
  lastActive: number;
}

export interface CollabMessage {
  type: 'presence' | 'cursor' | 'file_change' | 'chat';
  sender: Collaborator;
  payload: any;
  timestamp: number;
}

export class CollaborationBroker {
  private channel: BroadcastChannel | null = null;
  private currentProject: string = 'default-project';
  private currentUser: Collaborator;
  private collaborators: Map<string, Collaborator> = new Map();
  private listeners: Set<(collaborators: Collaborator[], message?: CollabMessage) => void> = new Set();

  constructor(user?: Partial<Collaborator>) {
    const randomId = Math.random().toString(36).substring(2, 9);
    const colors = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
    const chosenColor = colors[Math.floor(Math.random() * colors.length)];

    this.currentUser = {
      id: user?.id || `user_${randomId}`,
      name: user?.name || `Dev_${randomId.slice(0, 4)}`,
      color: user?.color || chosenColor,
      role: user?.role || 'editor',
      lastActive: Date.now(),
    };

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(`cortex-collab-${this.currentProject}`);
      this.channel.onmessage = (event: MessageEvent<CollabMessage>) => {
        this.handleIncoming(event.data);
      };
      // Broadcast join
      this.broadcast({
        type: 'presence',
        sender: this.currentUser,
        payload: { action: 'join' },
        timestamp: Date.now(),
      });
    }
  }

  public subscribe(fn: (collaborators: Collaborator[], message?: CollabMessage) => void) {
    this.listeners.add(fn);
    fn(Array.from(this.collaborators.values()));
    return () => this.listeners.delete(fn);
  }

  public updateCursor(fileId: string, lineNumber: number, column: number) {
    this.currentUser.cursor = { fileId, lineNumber, column };
    this.currentUser.lastActive = Date.now();
    this.broadcast({
      type: 'cursor',
      sender: this.currentUser,
      payload: { fileId, lineNumber, column },
      timestamp: Date.now(),
    });
  }

  public broadcastFileChange(fileId: string, content: string) {
    this.broadcast({
      type: 'file_change',
      sender: this.currentUser,
      payload: { fileId, content },
      timestamp: Date.now(),
    });
  }

  public sendChat(text: string) {
    this.broadcast({
      type: 'chat',
      sender: this.currentUser,
      payload: { text },
      timestamp: Date.now(),
    });
  }

  public getCurrentUser(): Collaborator {
    return this.currentUser;
  }

  private broadcast(msg: CollabMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        console.error('Failed to post collaboration message', e);
      }
    }
    // Also notify self listeners for chat
    if (msg.type === 'chat') {
      this.notify(msg);
    }
  }

  private handleIncoming(msg: CollabMessage) {
    if (msg.sender.id === this.currentUser.id) return;

    this.collaborators.set(msg.sender.id, {
      ...msg.sender,
      lastActive: Date.now(),
    });

    this.notify(msg);
  }

  private notify(msg?: CollabMessage) {
    const list = Array.from(this.collaborators.values());
    this.listeners.forEach((listener) => listener(list, msg));
  }

  public destroy() {
    if (this.channel) {
      this.broadcast({
        type: 'presence',
        sender: this.currentUser,
        payload: { action: 'leave' },
        timestamp: Date.now(),
      });
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}
