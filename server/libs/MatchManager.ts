import { MatchPhase } from "../enums/MatchPhase.ts";
import { players, removePlayer } from "./PlayerHandler.ts";
import { connectionManager } from "./ConnectionManager.ts";
import { MessageTypeEnum } from "../../shared/MessageTypeEnum.ts";
import sqlHandler from "./SqlHandler.ts";
import { CONFIG } from "../../shared/Config.ts";
import {
  DEFAULT_GAMEPLAY_DURATION,
  DEFAULT_RESULT_DURATION,
  DEFAULT_WARMUP_DURATION,
} from "../config/config.ts";

interface MatchSettings {
  warmupDuration: number; // Duration in milliseconds
  gameplayDuration: number; // Duration in milliseconds
  resultsDuration: number; // Duration in milliseconds
}

interface PlayerMatchStats {
  kills: number;
  deaths: number;
  headshots: number;
  bodyshots: number;
  missedshots: number;
}

interface MatchState {
  matchId: number;
  phase: MatchPhase;
  startTime: number;
  endTime: number | null;
  playerStats: Map<string, PlayerMatchStats>;
  disconnectedPlayerStats: Map<string, PlayerMatchStats>;
  settings: MatchSettings;
  timerHandle: number | null;
}

export class MatchManager {
  private activeMatches: Map<number, MatchState> = new Map();
  private currentMatchId: number = 1;
  private defaultSettings: MatchSettings;
  private waitingCheckInterval: number | null = null;
  private readonly MIN_PLAYERS_TO_START = 2;

  constructor() {
    this.defaultSettings = {
      warmupDuration: DEFAULT_WARMUP_DURATION,
      gameplayDuration: DEFAULT_GAMEPLAY_DURATION,
      resultsDuration: DEFAULT_RESULT_DURATION,
    };
  }

  /**
   * Initializes a new match
   * @returns Promise<number> Match ID of the created match
   */
  async initializeMatch(): Promise<number> {
    const matchResult = await sqlHandler.createMatch();
    const matchId = matchResult[0][0] as number;

    console.log(`Creating new match with ID: ${matchId}`);

    const matchState: MatchState = {
      matchId,
      phase: MatchPhase.WAITING_FOR_PLAYERS,
      startTime: Date.now(),
      endTime: null,
      playerStats: new Map(),
      disconnectedPlayerStats: new Map(),
      settings: { ...this.defaultSettings },
      timerHandle: null,
    };

    this.activeMatches.set(matchId, matchState);
    this.currentMatchId = matchId;

    this.startWaitingForPlayers(matchId);

    return matchId;
  }

  /**
   * Starts the waiting for players phase
   * Checks periodically if there are enough players to start the match
   * @param matchId The match ID
   */
  private startWaitingForPlayers(matchId: number): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    if (this.waitingCheckInterval !== null) {
      clearInterval(this.waitingCheckInterval);
      this.waitingCheckInterval = null;
    }

    console.log(
      `Match ${matchId} waiting for at least ${this.MIN_PLAYERS_TO_START} players to join`,
    );

    connectionManager.broadcast({
      type: MessageTypeEnum.MATCH_PHASE_CHANGE,
      phase: MatchPhase.WAITING_FOR_PLAYERS,
      matchId: matchId,
      minPlayers: this.MIN_PLAYERS_TO_START,
      currentPlayers: Object.keys(players).length,
    });

    this.waitingCheckInterval = setInterval(() => {
      const playerCount = Object.keys(players).length;

      connectionManager.broadcast({
        type: MessageTypeEnum.MATCH_TIMER_UPDATE,
        matchId: matchId,
        currentPlayers: playerCount,
        minPlayers: this.MIN_PLAYERS_TO_START,
        waiting: true,
      });

      if (playerCount >= this.MIN_PLAYERS_TO_START) {
        console.log(
          `Enough players (${playerCount}) have joined, starting warmup phase`,
        );
        clearInterval(this.waitingCheckInterval!);
        this.waitingCheckInterval = null;
        this.startMatchPhase(matchId, MatchPhase.WARMUP);
      }
    }, 1000);
  }

  /**
   * Called when a player joins the game
   */
  playerJoined(): void {
    const matchId = this.currentMatchId;
    if (!matchId) return;

    const match = this.activeMatches.get(matchId);
    if (!match) return;

    // Initialize match stats record for each new player
    Object.keys(players).forEach((playerName) => {
      try {
        const userId = sqlHandler.getUserByName(playerName);
        if (userId > 0) {
          sqlHandler.recordPlayerMatchData(userId, matchId, 0, 0, 0, 0, 0);
        }
      } catch (_error) {
        // Handle error if needed
      }
    });

    if (match.phase === MatchPhase.WAITING_FOR_PLAYERS) {
      const playerCount = Object.keys(players).length;
      console.log(
        `Player joined. Current count: ${playerCount}/${this.MIN_PLAYERS_TO_START}`,
      );

      if (playerCount >= this.MIN_PLAYERS_TO_START) {
        console.log(`Enough players have joined, starting warmup phase`);
        if (this.waitingCheckInterval !== null) {
          clearInterval(this.waitingCheckInterval);
          this.waitingCheckInterval = null;
        }
        this.startMatchPhase(matchId, MatchPhase.WARMUP);
      } else {
        connectionManager.broadcast({
          type: MessageTypeEnum.MATCH_TIMER_UPDATE,
          matchId: matchId,
          currentPlayers: playerCount,
          minPlayers: this.MIN_PLAYERS_TO_START,
          waiting: true,
        });
      }
    }
  }

  /**
   * Updates a player's match statistics
   * @param playerName The player's name
   * @param statUpdates The stat updates to apply
   */
  updatePlayerMatchStats(
    playerName: string,
    statUpdates: Partial<PlayerMatchStats>,
  ): void {
    const matchId = this.currentMatchId;
    if (!matchId) return;

    const match = this.activeMatches.get(matchId);
    if (!match) return;

    if (match.phase !== MatchPhase.GAMEPLAY) return;

    let playerStats = match.playerStats.get(playerName);
    if (!playerStats) {
      playerStats = {
        kills: 0,
        deaths: 0,
        headshots: 0,
        bodyshots: 0,
        missedshots: 0,
      };
      match.playerStats.set(playerName, playerStats);
    }

    const statsToUpdate = {
      kills: statUpdates.kills || 0,
      deaths: statUpdates.deaths || 0,
      headshots: statUpdates.headshots || 0,
      bodyshots: statUpdates.bodyshots || 0,
      missedshots: statUpdates.missedshots || 0,
    };

    // Update in-memory stats
    Object.assign(playerStats, statUpdates);
    match.playerStats.set(playerName, playerStats);

    if (players[playerName]) {
      sqlHandler.updateUserStats(
        playerName,
        matchId,
        statsToUpdate.kills,
        statsToUpdate.deaths,
        statsToUpdate.headshots,
        statsToUpdate.bodyshots,
        statsToUpdate.missedshots,
      );
    }
  }

  /**
   * Handle player disconnection by saving their stats
   * @param playerName The player's name
   */
  playerDisconnected(playerName: string): void {
    const matchId = this.currentMatchId;
    if (!matchId) return;

    const match = this.activeMatches.get(matchId);
    if (!match) return;

    const playerStats = match.playerStats.get(playerName);
    if (playerStats) {
      match.disconnectedPlayerStats.set(playerName, { ...playerStats });
      console.log(`Saved stats for disconnected player: ${playerName}`);
    }
  }

  /**
   * Starts a specific phase for a match
   * @param matchId The match ID
   * @param phase The phase to start
   */
  private startMatchPhase(matchId: number, phase: MatchPhase): void {
    const match = this.activeMatches.get(matchId);
    if (!match) {
      console.error(`Match ${matchId} not found when starting phase ${phase}`);
      return;
    }

    if (match.timerHandle !== null) {
      clearTimeout(match.timerHandle);
      match.timerHandle = null;
    }

    console.log(`Match ${matchId} entering phase: ${phase}`);

    match.phase = phase;

    connectionManager.broadcast({
      type: MessageTypeEnum.MATCH_PHASE_CHANGE,
      phase: phase,
      matchId: matchId,
      timeRemaining: this.getPhaseTimeRemaining(matchId),
    });

    let duration: number;
    let nextPhase: MatchPhase | null;

    switch (phase) {
      case MatchPhase.WARMUP:
        duration = match.settings.warmupDuration;
        nextPhase = MatchPhase.GAMEPLAY;
        break;

      case MatchPhase.GAMEPLAY:
        duration = match.settings.gameplayDuration;
        nextPhase = MatchPhase.RESULTS;

        this.startTimerUpdates(matchId);
        this.startPeriodicStatsBroadcast(matchId);
        break;

      case MatchPhase.RESULTS:
        duration = match.settings.resultsDuration;
        nextPhase = null;

        this.broadcastMatchStats(matchId);
        break;

      default:
        return;
    }

    match.timerHandle = setTimeout(() => {
      if (nextPhase !== null) {
        this.startMatchPhase(matchId, nextPhase);
      } else {
        this.endMatch(matchId);
      }
    }, duration);
  }

  /**
   * Starts periodic timer updates to clients
   * @param matchId The match ID
   */
  private startTimerUpdates(matchId: number): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    const updateInterval = 1000; // Update every second

    const sendUpdate = () => {
      const timeRemaining = this.getPhaseTimeRemaining(matchId);

      connectionManager.broadcast({
        type: MessageTypeEnum.MATCH_TIMER_UPDATE,
        matchId: matchId,
        timeRemaining: timeRemaining,
      });

      if (match.phase !== MatchPhase.GAMEPLAY || timeRemaining <= 0) {
        return;
      }

      setTimeout(sendUpdate, updateInterval);
    };

    sendUpdate();
  }

  /**
   * Starts periodic match stats updates to clients
   * @param matchId The match ID
   */
  private startPeriodicStatsBroadcast(matchId: number): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    const updateInterval = 5000;

    const sendStatsUpdate = () => {
      this.broadcastMatchStats(matchId);

      if (match.phase !== MatchPhase.GAMEPLAY) {
        return;
      }

      setTimeout(sendStatsUpdate, updateInterval);
    };

    sendStatsUpdate();
  }

  /**
   * Ends a match and prepares for the next one
   * @param matchId The match ID
   */
  private endMatch(matchId: number): void {
    const match = this.activeMatches.get(matchId);
    if (!match) {
      console.error(`Match ${matchId} not found when ending match`);
      return;
    }

    console.log(`Ending match ${matchId}`);
    match.endTime = Date.now();

    sqlHandler.endMatch(matchId);

    Object.keys(players).forEach((playerName) => {
      if (players[playerName].isDisconnected) {
        removePlayer(playerName);
      }
    });

    connectionManager.broadcast({
      type: MessageTypeEnum.MATCH_END,
      matchId: matchId,
    });

    this.activeMatches.delete(matchId);
    this.currentMatchId = 1;

    setTimeout(() => {
      this.initializeMatch();
    }, 5000);
  }

  /**
   * Broadcasts match statistics to all players
   * @param matchId The match ID
   */
  private broadcastMatchStats(matchId: number): void {
    const stats = this.getMatchStats(matchId);

    connectionManager.broadcast({
      type: MessageTypeEnum.MATCH_STATS_UPDATE,
      matchId: matchId,
      stats: stats,
    });
  }

  /**
   * Gets statistics for all players in the match, including disconnected ones
   * @param matchId The match ID
   * @returns Array of player statistics sorted by kills
   */
  getMatchStats(matchId: number): {
    name: string;
    kills: number;
    deaths: number;
    headshots: number;
    bodyshots: number;
    missedshots: number;
    ratio: string;
    active: boolean;
  }[] {
    const match = this.activeMatches.get(matchId);
    if (!match) return [];

    const combinedStats = new Map<string, {
      name: string;
      kills: number;
      deaths: number;
      headshots: number;
      bodyshots: number;
      missedshots: number;
      ratio: string;
      active: boolean;
    }>();

    Object.keys(players).forEach((playerName) => {
      const matchStats = sqlHandler.getUserMatchStats(playerName, matchId);
      combinedStats.set(playerName, {
        name: playerName,
        kills: matchStats.kills,
        deaths: matchStats.deaths,
        headshots: matchStats.headshots,
        bodyshots: matchStats.bodyshots,
        missedshots: matchStats.missedshots,
        ratio: matchStats.deaths > 0
          ? (matchStats.kills / matchStats.deaths).toFixed(2)
          : matchStats.kills.toFixed(2),
        active: true,
      });
    });

    match.disconnectedPlayerStats.forEach((stats, name) => {
      if (!combinedStats.has(name)) {
        combinedStats.set(name, {
          name,
          kills: stats.kills,
          deaths: stats.deaths,
          headshots: stats.headshots,
          bodyshots: stats.bodyshots,
          missedshots: stats.missedshots,
          ratio: stats.deaths > 0
            ? (stats.kills / stats.deaths).toFixed(2)
            : stats.kills.toFixed(2),
          active: false,
        });
      }
    });

    // Sort all players by kills
    return Array.from(combinedStats.values()).sort((a, b) => b.kills - a.kills);
  }

  /**
   * Gets the current match ID
   * @returns The current match ID or null if no match is active
   */
  getCurrentMatchId(): number {
    return this.currentMatchId;
  }

  /**
   * Gets the current phase of a match
   * @param matchId The match ID
   * @returns The current phase or null if match not found
   */
  getMatchPhase(matchId: number): MatchPhase | null {
    const match = this.activeMatches.get(matchId);
    return match ? match.phase : null;
  }

  /**
   * Gets the time remaining in the current phase
   * @param matchId The match ID
   * @returns Time remaining in milliseconds
   */
  getPhaseTimeRemaining(matchId: number): number {
    const match = this.activeMatches.get(matchId);
    if (!match) return 0;

    const now = Date.now();
    const elapsed = now - match.startTime;

    switch (match.phase) {
      case MatchPhase.WARMUP: {
        return Math.max(0, match.settings.warmupDuration - elapsed);
      }

      case MatchPhase.GAMEPLAY: {
        const gameplayStart = match.settings.warmupDuration;
        const gameplayEnd = gameplayStart + match.settings.gameplayDuration;
        return Math.max(0, gameplayEnd - elapsed);
      }

      case MatchPhase.RESULTS: {
        const resultsStart = match.settings.warmupDuration +
          match.settings.gameplayDuration;
        const resultsEnd = resultsStart + match.settings.resultsDuration;
        return Math.max(0, resultsEnd - elapsed);
      }

      default: {
        return 0;
      }
    }
  }

  /**
   * Checks if actions can be registered (during gameplay phase)
   * @param playerName The player's name
   * @returns Whether actions can be registered
   */
  canRegisterActions(): boolean {
    const matchId = this.currentMatchId;
    if (!matchId) return false;

    const match = this.activeMatches.get(matchId);
    if (!match) return false;

    return match.phase === MatchPhase.GAMEPLAY;
  }

  /**
   * Tries to recover an active match from the database
   * @returns Promise<number|null> Match ID if recovered, null otherwise
   */
  tryRecoverActiveMatch(): number | null {
    const activeMatch = sqlHandler.getActiveMatch();

    if (!activeMatch) {
      return null;
    }

    try {
      const dbDateString = activeMatch.startTime;

      const startTime = new Date(dbDateString).getTime();
      const now = Date.now();
      const elapsedMs = now - startTime;

      const matchState: MatchState = {
        matchId: activeMatch.matchId,
        phase: MatchPhase.WAITING_FOR_PLAYERS,
        startTime: startTime,
        endTime: null,
        playerStats: new Map(),
        disconnectedPlayerStats: new Map(),
        settings: { ...this.defaultSettings },
        timerHandle: null,
      };

      const warmupEnd = this.defaultSettings.warmupDuration;
      const gameplayEnd = warmupEnd + this.defaultSettings.gameplayDuration;
      const resultsEnd = gameplayEnd + this.defaultSettings.resultsDuration;

      let timeRemaining = 0;

      if (elapsedMs < 0) {
        matchState.startTime = now;
        timeRemaining = warmupEnd;
        matchState.phase = MatchPhase.WARMUP;
      } else if (elapsedMs < warmupEnd) {
        matchState.phase = MatchPhase.WARMUP;
        timeRemaining = warmupEnd - elapsedMs;
      } else if (elapsedMs < gameplayEnd) {
        matchState.phase = MatchPhase.GAMEPLAY;
        timeRemaining = gameplayEnd - elapsedMs;
      } else if (elapsedMs < resultsEnd) {
        matchState.phase = MatchPhase.RESULTS;
        timeRemaining = resultsEnd - elapsedMs;
      } else {
        sqlHandler.endMatch(activeMatch.matchId);
        return null;
      }

      console.log(
        `Recovered match ${activeMatch.matchId} in ${matchState.phase} phase with ${timeRemaining}ms remaining`,
      );

      this.activeMatches.set(activeMatch.matchId, matchState);
      this.currentMatchId = activeMatch.matchId;

      if (matchState.phase === MatchPhase.WAITING_FOR_PLAYERS as MatchPhase) {
        this.startWaitingForPlayers(activeMatch.matchId);
      } else {
        this.startMatchPhaseWithTime(
          activeMatch.matchId,
          matchState.phase,
          timeRemaining,
        );
      }

      return activeMatch.matchId;
    } catch (error) {
      console.error(`Error recovering match ${activeMatch.matchId}:`, error);
      return null;
    }
  }

  /**
   * Starts a specific phase for a match with a custom time remaining
   * @param matchId The match ID
   * @param phase The phase to start
   * @param remainingTime Time remaining in milliseconds
   */
  private startMatchPhaseWithTime(
    matchId: number,
    phase: MatchPhase,
    remainingTime: number,
  ): void {
    const match = this.activeMatches.get(matchId);
    if (!match) {
      console.error(`Match ${matchId} not found when starting phase ${phase}`);
      return;
    }

    if (match.timerHandle !== null) {
      clearTimeout(match.timerHandle);
      match.timerHandle = null;
    }

    console.log(
      `Match ${matchId} entering phase: ${phase} with ${remainingTime}ms remaining`,
    );

    match.phase = phase;

    connectionManager.broadcast({
      type: MessageTypeEnum.MATCH_PHASE_CHANGE,
      phase: phase,
      matchId: matchId,
      timeRemaining: remainingTime,
    });

    let nextPhase: MatchPhase | null;

    switch (phase) {
      case MatchPhase.WARMUP:
        nextPhase = MatchPhase.GAMEPLAY;
        break;

      case MatchPhase.GAMEPLAY:
        nextPhase = MatchPhase.RESULTS;
        Object.keys(players).forEach((playerName) => {
          if (players[playerName]) {
            players[playerName].ammo = CONFIG.MAX_AMMO;
            connectionManager.sendToConnection(playerName, {
              type: MessageTypeEnum.AMMO_UPDATE,
              ammo: CONFIG.MAX_AMMO,
              maxAmmo: CONFIG.MAX_AMMO,
            });
          }
        });

        this.startTimerUpdates(matchId);
        this.startPeriodicStatsBroadcast(matchId);
        break;

      case MatchPhase.RESULTS:
        nextPhase = null;

        this.broadcastMatchStats(matchId);
        break;

      default:
        return;
    }

    match.timerHandle = setTimeout(() => {
      if (nextPhase !== null) {
        this.startMatchPhase(matchId, nextPhase);
      } else {
        this.endMatch(matchId);
      }
    }, remainingTime);
  }
}

export const matchManager = new MatchManager();
