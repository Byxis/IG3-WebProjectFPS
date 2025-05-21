import { DB, Row } from "https://deno.land/x/sqlite/mod.ts";
import {
  DEFAULT_GAMEPLAY_DURATION,
  DEFAULT_RESULT_DURATION,
  DEFAULT_WARMUP_DURATION,
} from "../config/config.ts";

export class SqlHandler {
  private db: DB;

  /**
   ** Creates a new SqlHandler instance
   * @param {string} dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string = "server/database/database.db") {
    this.db = new DB(dbPath);
    this.initDatabase();
    this.ensureAdmin("Byxis");
  }

  /**
   ** Initializes the database schema
   * Creates tables and indexes if they don't exist
   */
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

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
    `);

    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_player_matches_user ON player_matches(user_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_player_matches_match ON player_matches(match_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_match ON chat_messages(match_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_private_messages_sender ON private_messages(sender_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_private_messages_receiver ON private_messages(receiver_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_private_messages_timestamp ON private_messages(timestamp);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(player_role);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_matches_time ON matches(start_time);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_bans_user ON bans(user_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_bans_date ON bans(ban_date);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_mutes_user ON mutes(user_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_mutes_date ON mutes(mute_date);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);`,
    );

    this.db.execute(`
      INSERT OR IGNORE INTO roles (role_name) VALUES ('user'), ('moderator'), ('admin');
    `);
  }

  /**
   ** Ensures a user has admin role (role_id 3)
   * @param {string} username - The username to make admin
   */
  private ensureAdmin(username: string): void {
    try {
      const userExists = this.doUserExists(username);
      if (!userExists) {
        console.log(`User ${username} doesn't exist yet, can't set as admin`);
        return;
      }

      const userId = this.getUserByName(username);
      if (userId <= 0) {
        console.log(`Couldn't get user ID for ${username}`);
        return;
      }

      const currentRole = this.getUserRole(userId);

      if (currentRole !== 3) {
        this.changeUserRole(userId, 3);
        console.log(`Set ${username} to admin role (3)`);
      } else {
        console.log(`${username} is already an admin`);
      }
    } catch (error) {
      console.error(`Error ensuring admin for ${username}:`, error);
    }
  }

  /**
   ** Creates a new user in the database
   * @param {string} username - The username
   * @param {string} passwordHash - The hashed password
   * @returns {Row[]} SQL query result
   */
  createUser(username: string, passwordHash: string): Row[] {
    return this.db.query(
      "INSERT INTO users (username, password_hash, player_role) VALUES (?, ?, 1) RETURNING user_id",
      [username, passwordHash],
    );
  }

  /**
   ** Checks if a username exists in the database
   * @param {string} username - The username to check
   * @returns {boolean} True if the user exists
   */
  doUserExists(username: string): boolean {
    const result = this.db.query(
      "SELECT user_id FROM users WHERE username = ?",
      [username],
    );
    return result.length > 0;
  }

  /**
   ** Checks if a user ID exists in the database
   * @param {number} userId - The user ID to check
   * @returns {boolean} True if the user ID exists
   */
  doUserIdExists(userId: number): boolean {
    const result = this.db.query(
      "SELECT user_id FROM users WHERE user_id = ?",
      [userId],
    );
    return result.length > 0;
  }

  /**
   ** Gets a user ID by username
   * @param {string} username - The username to look up
   * @returns {number} User ID or -1 if not found
   */
  getUserByName(username: string): number {
    const result = this.db.query(
      "SELECT user_id FROM users WHERE username = ?",
      [username],
    );
    if (result.length > 0) {
      return result[0][0] as number;
    }
    return -1;
  }

  /**
   ** Gets a user's role by user ID
   * @param {number} userId - The user ID
   * @returns {number} Role ID or -1 if not found
   */
  getUserRole(userId: number): number {
    const result = this.db.query(
      "SELECT player_role FROM users WHERE user_id = ?",
      [userId],
    );
    if (result.length > 0) {
      return result[0][0] as number;
    }
    return -1;
  }

  /**
   ** Gets a user's game statistics
   * @param {string} username - The username
   * @returns {object} User statistics
   */
  getUserStats(username: string): {
    kills: number;
    deaths: number;
    headshots: number;
    bodyshots: number;
    missedshots: number;
  } {
    const result = this.db.query(
      `SELECT SUM(kills), SUM(deaths), SUM(headshots), SUM(bodyshots), SUM(missedshots)
       FROM player_matches pm
        JOIN users u ON pm.user_id = u.user_id
        WHERE u.username = ?`,
      [username],
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

  /**
   ** Gets a user's game statistics for a specific match
   * @param {string} username - The username
   * @param {number} matchId - The match ID
   * @returns {object} User statistics for the match
   */
  getUserMatchStats(username: string, matchId: number): {
    kills: number;
    deaths: number;
    headshots: number;
    bodyshots: number;
    missedshots: number;
  } {
    const result = this.db.query(
      `SELECT kills, deaths, headshots, bodyshots, missedshots
       FROM player_matches pm
       JOIN users u ON pm.user_id = u.user_id
       WHERE u.username = ? AND pm.match_id = ?`,
      [username, matchId],
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

  /**
   ** Changes a user's role
   * @param {number} userId - The user ID
   * @param {number} roleId - The new role ID
   * @returns {boolean} Success status
   */
  changeUserRole(userId: number, roleId: number): boolean {
    const result = this.db.query(
      "UPDATE users SET player_role = ? WHERE user_id = ?",
      [roleId, userId],
    );
    return result.length > 0;
  }

  /**
   ** Updates the last login time for a user
   * @param {number} userId - The user ID
   * @returns {boolean} Success status
   */
  updateUserLoginTime(userId: number): boolean {
    const result = this.db.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
      [userId],
    );
    return result.length > 0;
  }

  /**
   ** Updates a user's password
   * @param {number} userId - The user ID
   * @param {string} newPasswordHash - The new password hash
   * @returns {boolean} Success status
   */
  updateUserPassword(
    userId: number,
    newPasswordHash: string,
  ): boolean {
    const result = this.db.query(
      "UPDATE users SET password_hash = ? WHERE user_id = ?",
      [newPasswordHash, userId],
    );
    return result.length > 0;
  }

  /**
   ** Gets a user's password hash
   * @param {number} id - The user ID
   * @returns {string} Password hash or empty string if not found
   */
  getUserPasswordHash(id: number): string {
    const result = this.db.query(
      "SELECT password_hash FROM users WHERE user_id = ?",
      [id],
    );
    if (result.length > 0) {
      return result[0][0] as string;
    }
    return "";
  }

  /**
   ** Adds time played to a user's record
   * @param {number} userId - The user ID
   * @param {Date} from - Start time
   * @param {Date} to - End time
   * @returns {boolean} Success status
   */
  addTimePlayed(userId: number, from: Date, to: Date): boolean {
    const time = Math.floor((to.getTime() - from.getTime()) / 1000);
    if (time < 0) return false;
    const result = this.db.query(
      "UPDATE users SET time_played = time_played + ? WHERE user_id = ?",
      [time, userId],
    );
    return result.length > 0;
  }

  /**
   ** Creates a new match
   * @returns {Row[]} SQL query result with match ID
   */
  createMatch(): Row[] {
    return this.db.query(
      "INSERT INTO matches (status) VALUES ('active') RETURNING match_id",
    );
  }

  /**
   ** Records player data for a match
   * @param {number} userId - The user ID
   * @param {number} matchId - The match ID
   * @param {number} kills - Number of kills
   * @param {number} deaths - Number of deaths
   * @param {number} headshots - Number of headshots
   * @param {number} bodyshots - Number of bodyshots
   * @param {number} missedshots - Number of missed shots
   * @returns {Row[]} SQL query result
   */
  recordPlayerMatchData(
    userId: number,
    matchId: number,
    kills: number,
    deaths: number,
    headshots: number,
    bodyshots: number,
    missedshots: number,
  ): Row[] {
    try {
      // First check if a record already exists
      const existingRecord = this.db.query(
        "SELECT 1 FROM player_matches WHERE user_id = ? AND match_id = ?",
        [userId, matchId],
      );

      // If a record exists, don't try to insert a new one
      if (existingRecord.length > 0) {
        return [];
      }

      // Insert only if no record exists
      return this.db.query(
        `INSERT INTO player_matches 
         (user_id, match_id, kills, deaths, headshots, bodyshots, missedshots) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, matchId, kills, deaths, headshots, bodyshots, missedshots],
      );
    } catch (error) {
      console.error(`Error recording player match data:`, error);
      return [];
    }
  }

  /**
   ** Checks if a match exists
   * @param {number} matchId - The match ID to check
   * @returns {boolean} True if the match exists
   */
  doMatchExists(matchId: number): boolean {
    const result = this.db.query(
      "SELECT match_id FROM matches WHERE match_id = ?",
      [matchId],
    );
    return result.length > 0;
  }

  /**
   ** Marks a match as ended
   * @param {number} matchId - The match ID
   * @returns {boolean} Success status
   */
  endMatch(matchId: number): boolean {
    const result = this.db.query(
      "UPDATE matches SET end_time = CURRENT_TIMESTAMP, status = 'completed' WHERE match_id = ?",
      [matchId],
    );
    return result.length > 0;
  }

  /**
   ** Adds a chat message to a match
   * @param {number} senderId - The sender's user ID
   * @param {number} matchId - The match ID
   * @param {string} messageText - The message text
   * @returns {Row[]} SQL query result
   */
  addChatMessage(
    senderId: number,
    matchId: number,
    messageText: string,
  ): Row[] {
    const userExists = this.doUserIdExists(senderId);
    const matchExists = this.doMatchExists(matchId);

    if (!userExists) {
      throw new Error(`User with ID ${senderId} does not exist.`);
    }
    if (!matchExists) {
      throw new Error(`Match with ID ${matchId} does not exist.`);
    }

    return this.db.query(
      "INSERT INTO chat_messages (sender_id, match_id, message_text) VALUES (?, ?, ?)",
      [senderId, matchId, messageText],
    );
  }

  /**
   ** Gets chat messages for a match
   * @param {number} matchId - The match ID
   * @returns {Array<{name: string, message: string, role: number}>} Array of message objects
   */
  getChatMessages(
    matchId: number,
  ): { name: string; message: string; role: number }[] {
    const result = this.db.query(
      `SELECT u.username, c.message_text, u.player_role 
       FROM chat_messages c 
       JOIN users u ON c.sender_id = u.user_id 
       WHERE c.match_id = ? 
       ORDER BY c.timestamp ASC`,
      [matchId],
    );
    return result.map((row) => {
      return {
        name: row[0] as string,
        message: row[1] as string,
        role: row[2] as number,
      };
    });
  }

  /**
   ** Sends a private message between users
   * @param {number} senderId - The sender's user ID
   * @param {number} receiverId - The receiver's user ID
   * @param {string} messageText - The message text
   * @returns {Row[]} SQL query result
   */
  sendPrivateMessage(
    senderId: number,
    receiverId: number,
    messageText: string,
  ): Row[] {
    return this.db.query(
      "INSERT INTO private_messages (sender_id, receiver_id, message_text) VALUES (?, ?, ?)",
      [senderId, receiverId, messageText],
    );
  }

  /**
   ** Gets private messages for a user
   * @param {number} userId - The user ID
   * @returns {Row[]} SQL query result with messages
   */
  getPrivateMessages(userId: number): Row[] {
    return this.db.query(
      `SELECT * FROM private_messages 
       WHERE sender_id = ? OR receiver_id = ? 
       ORDER BY timestamp DESC`,
      [userId, userId],
    );
  }

  /**
   ** Adds a ban record for a user
   * @param {number} userId - The user ID to ban
   * @param {string} reason - The ban reason
   * @param {number} bannedBy - Admin user ID who enacted the ban
   * @param {Date} [expiryDate] - Optional ban expiry date (null for permanent ban)
   * @returns {Row[]} SQL query result
   */
  addBan(
    userId: number,
    reason: string,
    bannedBy: number,
    expiryDate?: Date,
  ): Row[] {
    const expiryDateString = expiryDate ? expiryDate.toISOString() : null;
    return this.db.query(
      "INSERT INTO bans (user_id, reason, banned_by, expiry_date) VALUES (?, ?, ?, ?)",
      [userId, reason, bannedBy, expiryDateString],
    );
  }

  /**
   ** Checks if a user is banned
   * @param {number} userId - The user ID to check
   * @returns {object} Ban status, reason and expiry date
   */
  isBanned(
    userId: number,
  ): { banned: boolean; reason?: string; expiry?: Date } {
    const result = this.db.query(
      `SELECT reason, expiry_date 
       FROM bans 
       WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP) 
       ORDER BY ban_date DESC 
       LIMIT 1`,
      [userId],
    );

    if (result.length > 0) {
      return {
        banned: true,
        reason: result[0][0] as string,
        expiry: result[0][1] ? new Date(result[0][1] as string) : undefined,
      };
    }

    return { banned: false };
  }

  /**
   ** Adds a mute record for a user
   * @param {number} userId - The user ID to mute
   * @param {string} reason - The mute reason
   * @param {number} mutedBy - Admin user ID who enacted the mute
   * @param {Date} [expiryDate] - Optional mute expiry date (null for permanent mute)
   * @returns {Row[]} SQL query result
   */
  addMute(
    userId: number,
    reason: string,
    mutedBy: number,
    expiryDate?: Date,
  ): Row[] {
    const expiryDateString = expiryDate ? expiryDate.toISOString() : null;
    return this.db.query(
      "INSERT INTO mutes (user_id, reason, muted_by, expiry_date) VALUES (?, ?, ?, ?)",
      [userId, reason, mutedBy, expiryDateString],
    );
  }

  /**
   ** Checks if a user is muted
   * @param {number} userId - The user ID to check
   * @returns {object} Mute status, reason and expiry date
   */
  isMuted(userId: number): { muted: boolean; reason?: string; expiry?: Date } {
    const result = this.db.query(
      `SELECT reason, expiry_date 
       FROM mutes 
       WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP) 
       ORDER BY mute_date DESC 
       LIMIT 1`,
      [userId],
    );

    if (result.length > 0) {
      return {
        muted: true,
        reason: result[0][0] as string,
        expiry: result[0][1] ? new Date(result[0][1] as string) : undefined,
      };
    }

    return { muted: false };
  }

  /**
   ** Removes a ban from a user
   * @param {number} userId - The user ID to unban
   * @returns {boolean} Success status
   */
  removeBan(userId: number): boolean {
    const result = this.db.query(
      "UPDATE bans SET expiry_date = CURRENT_TIMESTAMP WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)",
      [userId],
    );
    return result.length > 0;
  }

  /**
   ** Removes a mute from a user
   * @param {number} userId - The user ID to unmute
   * @returns {boolean} Success status
   */
  removeMute(userId: number): boolean {
    const result = this.db.query(
      "UPDATE mutes SET expiry_date = CURRENT_TIMESTAMP WHERE user_id = ? AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)",
      [userId],
    );
    return result.length > 0;
  }

  /**
   ** Stores a refresh token
   * @param {number} userId - The user ID
   * @param {string} token - The refresh token
   * @param {number} expiresIn - Expiration time in milliseconds
   * @returns {boolean} Success status
   */
  storeRefreshToken(userId: number, token: string, expiresIn: number): boolean {
    const expiresAt = new Date(Date.now() + expiresIn).toISOString();
    try {
      this.db.query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        [userId, token, expiresAt],
      );
      return true;
    } catch (error) {
      console.error("Error storing refresh token:", error);
      return false;
    }
  }

  /**
   ** Verifies a refresh token
   * @param {number} userId - The user ID
   * @param {string} token - The refresh token
   * @returns {boolean} True if token is valid
   */
  verifyRefreshToken(userId: number, token: string): boolean {
    try {
      const result = this.db.query(
        "SELECT token_id FROM refresh_tokens WHERE user_id = ? AND token = ? AND expires_at > datetime('now')",
        [userId, token],
      );
      return result.length > 0;
    } catch (error) {
      console.error("Error verifying refresh token:", error);
      return false;
    }
  }

  /**
   ** Removes a specific refresh token
   * @param {string} token - The token to remove
   * @returns {boolean} Success status
   */
  removeRefreshToken(token: string): boolean {
    try {
      this.db.query("DELETE FROM refresh_tokens WHERE token = ?", [token]);
      return true;
    } catch (error) {
      console.error("Error removing refresh token:", error);
      return false;
    }
  }

  /**
   ** Removes all refresh tokens for a user
   * @param {number} userId - The user ID
   * @returns {boolean} Success status
   */
  removeAllUserRefreshTokens(userId: number): boolean {
    try {
      this.db.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
      return true;
    } catch (error) {
      console.error("Error removing user refresh tokens:", error);
      return false;
    }
  }

  /**
   ** Removes expired refresh tokens
   * @returns {number} Number of tokens removed
   */
  cleanExpiredTokens(): number {
    try {
      const result = this.db.query(
        "DELETE FROM refresh_tokens WHERE expires_at <= datetime('now')",
      );
      return result.length;
    } catch (error) {
      console.error("Error cleaning expired tokens:", error);
      return 0;
    }
  }

  /**
   ** Closes the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   ** Update player stats by adding incremental values
   * @param {string} playerName - The player's name
   * @param {number} matchId - The current match ID
   * @param {number} kills - Kills to add
   * @param {number} deaths - Deaths to add
   * @param {number} headshots - Headshots to add
   * @param {number} bodyshots - Bodyshots to add
   * @param {number} missedshots - Missed shots to add
   */
  updateUserStats(
    playerName: string,
    matchId: number,
    kills: number,
    deaths: number,
    headshots: number,
    bodyshots: number,
    missedshots: number,
  ): boolean {
    try {
      const userId = this.getUserByName(playerName);
      if (userId <= 0) {
        console.error(
          `Cannot update stats for ${playerName}: User does not exist in database`,
        );
        return false;
      }

      if (!this.doMatchExists(matchId)) {
        console.error(
          `Cannot update stats for ${playerName}: Match ${matchId} does not exist`,
        );
        return false;
      }

      this.db.query("BEGIN TRANSACTION");

      const existingRecord = this.db.query(
        "SELECT user_id FROM player_matches WHERE user_id = ? AND match_id = ?",
        [userId, matchId],
      );

      if (existingRecord.length > 0) {
        this.db.query(
          `UPDATE player_matches 
           SET kills = kills + ?, 
               deaths = deaths + ?,
               headshots = headshots + ?,
               bodyshots = bodyshots + ?,
               missedshots = missedshots + ?
           WHERE user_id = ? AND match_id = ?`,
          [kills, deaths, headshots, bodyshots, missedshots, userId, matchId],
        );
      } else {
        this.db.query(
          `INSERT INTO player_matches (user_id, match_id, kills, deaths, headshots, bodyshots, missedshots)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, matchId, kills, deaths, headshots, bodyshots, missedshots],
        );
      }

      this.db.query("COMMIT");

      return true;
    } catch (error) {
      this.db.query("ROLLBACK");
      console.error(
        `Error updating user stats for ${playerName} in match ${matchId}:`,
        error,
      );
      return false;
    }
  }

  /**
   ** Gets the most recent active match from the database
   * @returns {object|null} Match info or null if no active match found
   */
  getActiveMatch(): { matchId: number; startTime: string } | null {
    try {
      const result = this.db.query(
        `SELECT match_id, start_time 
         FROM matches 
         WHERE status = 'active' 
         ORDER BY start_time DESC 
         LIMIT 1`,
      );

      if (result.length > 0) {
        const startTimeStr = result[0][1] as string;
        const formattedTime = startTimeStr.replace(" ", "T") + "Z";

        return {
          matchId: result[0][0] as number,
          startTime: formattedTime,
        };
      }
      return null;
    } catch (error) {
      console.error("Error retrieving active match:", error);
      return null;
    }
  }

  /**
   ** Cleans up stale matches that should have ended already
   * @returns {number} Number of matches cleaned up
   */
  cleanupStaleMatches(): number {
    try {
      const totalMatchDuration = DEFAULT_WARMUP_DURATION +
        DEFAULT_GAMEPLAY_DURATION +
        DEFAULT_RESULT_DURATION;

      const result = this.db.query(
        `UPDATE matches 
         SET end_time = CURRENT_TIMESTAMP, status = 'completed' 
         WHERE status = 'active' 
         AND datetime(start_time, '+${totalMatchDuration} seconds') < datetime('now')`,
      );

      return result.length;
    } catch (error) {
      console.error("Error cleaning up stale matches:", error);
      return 0;
    }
  }
}

const sqlHandler = new SqlHandler();
export default sqlHandler;
