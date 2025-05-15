class ConnectionManager {
  private connections: Map<string, CustomWebSocket> = new Map();

  /**
   * Add a new WebSocket connection
   * @param username - The username associated with the connection
   * @param ws - The WebSocket connection
   */
  addConnection(username: string, ws: CustomWebSocket): void {
    ws.username = username;
    this.connections.set(username, ws);
    console.log(`Connection added for ${username} (Total: ${this.connections.size})`);
  }

  /**
   * Remove a WebSocket connection by username
   * @param username - The username to remove
   */
  removeConnection(username: string): boolean {
    const result = this.connections.delete(username);
    if (result) {
      console.log(`Connection removed for ${username} (Total: ${this.connections.size})`);
    }
    return result;
  }

  /**
   * Get a connection by username
   * @param username - The username to look up
   * @returns The WebSocket connection or undefined if not found
   */
  getConnection(username: string): CustomWebSocket | undefined {
    return this.connections.get(username);
  }

  /**
   * Get all active WebSocket connections
   * @returns Array of all WebSocket connections
   */
  getAllConnections(): CustomWebSocket[] {
    return Array.from(this.connections.values());
  }

  /**
   * Send message to all connections except optional excluded one
   * @param message - The message object to send (will be JSON stringified)
   * @param excludeUsername - Optional username to exclude from broadcast
   */
  broadcast(message: unknown, excludeUsername?: string): void {
    this.connections.forEach((conn, username) => {
      if (username !== excludeUsername && conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Send message to a specific connection
   * @param username - The username of the connection to send to
   * @param message - The message object to send (will be JSON stringified)
   */
    sendToConnection(username: string, message: unknown): void {
        const conn = this.connections.get(username);
        if (conn && conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify(message));
        } else {
        console.error(`Connection for ${username} not found or not open`);
        }
      }

  /**
   * Get the total number of active connections
   */
  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a username has an active connection
   */
  hasConnection(username: string): boolean {
    return this.connections.has(username);
  }
}

export const connectionManager = new ConnectionManager();