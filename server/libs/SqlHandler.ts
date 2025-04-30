import { DB } from "https://deno.land/x/sqlite/mod.ts";

export class SqlHandler {
  private db: DB;

  constructor(dbPath: string = "server/database/database.db") {
    this.db = new DB(dbPath);
    this.initDatabase();
  }

  private initDatabase(): void {

    this.db.execute(`
        CREATE TABLE IF NOT EXISTS roles (
          role_id INTEGER PRIMARY KEY AUTOINCREMENT,
          role_name TEXT UNIQUE NOT NULL
        );
      `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        time_played INTEGER DEFAULT 0,
        player_role INTEGER DEFAULT 1,
        FOREIGN KEY (player_role) REFERENCES roles(role_id)
      );
    `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS matches (
        match_id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        status TEXT DEFAULT 'active'
      );
    `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS player_matches (
        user_id INTEGER NOT NULL,
        match_id INTEGER NOT NULL,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        headshots INTEGER DEFAULT 0,
        bodyshots INTEGER DEFAULT 0,
        missedshots INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, match_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
      );
    `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        cmsg_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        match_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        FOREIGN KEY (sender_id) REFERENCES users(user_id),
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
      );
    `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS private_messages (
        pmsg_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_text TEXT NOT NULL,
        FOREIGN KEY (sender_id) REFERENCES users(user_id),
        FOREIGN KEY (receiver_id) REFERENCES users(user_id)
      );
    `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS bans (
        ban_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ban_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expiry_date TIMESTAMP NULL, -- NULL means permanent ban
        banned_by INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (banned_by) REFERENCES users(user_id)
      );
    `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS mutes (
        mute_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        mute_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expiry_date TIMESTAMP NULL, -- NULL means permanent mute
        muted_by INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (muted_by) REFERENCES users(user_id)
      );
    `);

    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_player_matches_user ON player_matches(user_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_player_matches_match ON player_matches(match_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_messages_match ON chat_messages(match_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_private_messages_sender ON private_messages(sender_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_private_messages_receiver ON private_messages(receiver_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_private_messages_timestamp ON private_messages(timestamp);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(player_role);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_matches_time ON matches(start_time);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_bans_user ON bans(user_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_bans_date ON bans(ban_date);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_mutes_user ON mutes(user_id);`);
    this.db.execute(`CREATE INDEX IF NOT EXISTS idx_mutes_date ON mutes(mute_date);`);

    this.db.execute(`
      INSERT OR IGNORE INTO roles (role_name) VALUES ('user'), ('moderator'), ('admin');
    `);
  }

  async createUser(username: string, passwordHash: string): Promise<any[]> {
    console.log(username);
    return this.db.query(
      "INSERT INTO users (username, password_hash, player_role) VALUES (?, ?, 1) RETURNING user_id",
      [username, passwordHash]
    );
  }

  async doUserExists(username: string): Promise<boolean> {
    const result = this.db.query(
      "SELECT user_id FROM users WHERE username = ?",
      [username]
    );
    return result.length > 0;
  }

  async doUserIdExists(username: number): Promise<boolean> {
    const result = this.db.query(
      "SELECT user_id FROM users WHERE user_id = ?",
      [username]
    );
    return result.length > 0;
  }

  async getUserByName(username: string): Promise<number> {
    const result = this.db.query(
        "SELECT user_id FROM users WHERE username = ?",
        [username]
        );
    if (result.length > 0) {
        return result[0][0] as number;
    }
    return -1;
  }

  async getUserRole(userId: number): Promise<number> {
    const result = this.db.query(
      "SELECT player_role FROM users WHERE user_id = ?",
      [userId]
    );
    if (result.length > 0) {
      return result[0][0] as number;
    }
    return -1;
  }

  async getUserStats(username: String): Promise<{
    kills: number;
    deaths: number;
    headshots: number;
    bodyshots: number;
    missedshots: number;
  }> {
    const result = this.db.query(
      `SELECT kills, deaths, headshots, bodyshots, missedshots
       FROM player_matches pm
        JOIN users u ON pm.user_id = u.user_id
        WHERE u.username = ?`,
      [username]
    );
    if (result.length > 0) {
      return {
        kills: result[0][0] as number,
        deaths: result[0][1] as number,
        headshots: result[0][2] as number,
        bodyshots: result[0][3] as number,
        missedshots: result[0][4] as number,
      };
    }
    return {
      kills: 0,
      deaths: 0,
      headshots: 0,
      bodyshots: 0,
      missedshots: 0,
    };
  }

  async changeUserRole(userId: number, roleId: number): Promise<boolean> {
    const result = this.db.query(
      "UPDATE users SET player_role = ? WHERE user_id = ?",
      [roleId, userId]
    );
    return result.length > 0;
  }

  async updateUserLoginTime(userId: number): Promise<boolean> {
    const result = this.db.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
      [userId]
    );
    return result.length > 0;
  }

  async updateUserToker(userId: number, token: string): Promise<boolean> {
    const result = this.db.query(
      "UPDATE users SET token = ? WHERE user_id = ?",
      [token, userId]
    );
    return result.length > 0;
  }

  async addTimePlayed(userId: number, from: Date, to: Date): Promise<boolean> {
    const time = Math.floor((to.getTime() - from.getTime()) / 1000);
    if (time < 0) return false;
    const result = this.db.query(
      "UPDATE users SET time_played = time_played + ? WHERE user_id = ?",
      [time, userId]
    );
    return result.length > 0;
  }

  async createMatch(): Promise<any[]> {
    return this.db.query(
      "INSERT INTO matches (status) VALUES ('active') RETURNING match_id"
    );
  }

  async recordPlayerMatchData(userId: number, matchId: number, kills: number, deaths: number, headshots: number, bodyshots: number, missedshots: number): Promise<any[]> {
    return this.db.query(
      `INSERT INTO player_matches 
       (user_id, match_id, kills, deaths, headshots, bodyshots, missedshots) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, matchId, kills, deaths, headshots, bodyshots, missedshots]
    );
  }

  async doMatchExists(matchId: number): Promise<boolean> {
    const result = this.db.query(
      "SELECT match_id FROM matches WHERE match_id = ?",
      [matchId]
    );
    return result.length > 0;
  }

  async endMatch(matchId: number): Promise<boolean> {
    const result = this.db.query(
      "UPDATE matches SET end_time = CURRENT_TIMESTAMP, status = 'completed' WHERE match_id = ?",
      [matchId]
    );
    return result.length > 0;
  }

  async addChatMessage(senderId: number, matchId: number, messageText: string): Promise<any[]> {
    
    const userExists = await this.doUserIdExists(senderId);
    const matchExists = await this.doMatchExists(matchId);
    
    if (!userExists) {
      throw new Error(`User with ID ${senderId} does not exist.`);
    }
    if (!matchExists) {
        throw new Error(`Match with ID ${matchId} does not exist.`);
    }

    
    return this.db.query(
      "INSERT INTO chat_messages (sender_id, match_id, message_text) VALUES (?, ?, ?)",
      [senderId, matchId, messageText]
    );
  }

  async getChatMessages(matchId: number): Promise<{ name: string, message: string, role: number }[]> {
    const result = this.db.query(
      `SELECT u.username, c.message_text, u.player_role 
       FROM chat_messages c 
       JOIN users u ON c.sender_id = u.user_id 
       WHERE c.match_id = ? 
       ORDER BY c.timestamp ASC`,
      [matchId]
    );
    return result.map((row) => {
      return {
        name: row[0] as string,
        message: row[1] as string,
        role: row[2] as number,
      };
    });
  }

  async sendPrivateMessage(senderId: number, receiverId: number, messageText: string): Promise<any[]> {
    return this.db.query(
      "INSERT INTO private_messages (sender_id, receiver_id, message_text) VALUES (?, ?, ?)",
      [senderId, receiverId, messageText]
    );
  }

  async getPrivateMessages(userId: number): Promise<any[]> {
    return this.db.query(
      `SELECT * FROM private_messages 
       WHERE sender_id = ? OR receiver_id = ? 
       ORDER BY timestamp DESC`,
      [userId, userId]
    );
  }

  async addBan(userId: number, reason: string, bannedBy: number, expiryDate?: Date): Promise<any[]> {
    const expiryDateString = expiryDate ? expiryDate.toISOString() : null;
    return this.db.query(
      "INSERT INTO bans (user_id, reason, banned_by, expiry_date) VALUES (?, ?, ?, ?)",
      [userId, reason, bannedBy, expiryDateString]
    );
  }

  async isBanned(userId: number): Promise<{ banned: boolean, reason?: string, expiry?: Date }> {
    const result = this.db.query(
      `SELECT reason, expiry_date 
       FROM bans 
       WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP) 
       ORDER BY ban_date DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (result.length > 0) {
      return {
        banned: true,
        reason: result[0][0] as string,
        expiry: result[0][1] ? new Date(result[0][1] as string) : undefined
      };
    }
    
    return { banned: false };
  }

  async addMute(userId: number, reason: string, mutedBy: number, expiryDate?: Date): Promise<any[]> {
    const expiryDateString = expiryDate ? expiryDate.toISOString() : null;
    return this.db.query(
      "INSERT INTO mutes (user_id, reason, muted_by, expiry_date) VALUES (?, ?, ?, ?)",
      [userId, reason, mutedBy, expiryDateString]
    );
  }

  async isMuted(userId: number): Promise<{ muted: boolean, reason?: string, expiry?: Date }> {
    const result = this.db.query(
      `SELECT reason, expiry_date 
       FROM mutes 
       WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP) 
       ORDER BY mute_date DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (result.length > 0) {
      return {
        muted: true,
        reason: result[0][0] as string,
        expiry: result[0][1] ? new Date(result[0][1] as string) : undefined
      };
    }
    
    return { muted: false };
  }

  async removeBan(userId: number): Promise<boolean> {
    const result = this.db.query(
      "UPDATE bans SET expiry_date = CURRENT_TIMESTAMP WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)",
      [userId]
    );
    return result.length > 0;
  }

  async removeMute(userId: number): Promise<boolean> {
    const result = this.db.query(
      "UPDATE mutes SET expiry_date = CURRENT_TIMESTAMP WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)",
      [userId]
    );
    return result.length > 0;
  }

  close(): void {
    this.db.close();
  }
}

const sqlHandler = new SqlHandler();
export default sqlHandler;