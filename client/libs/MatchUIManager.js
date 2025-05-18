class MatchUIManager {
  /**
   * @constructor
   */
  constructor() {
    this.matchPhaseElement = document.getElementById("match-phase");
    this.matchTimerElement = document.getElementById("match-timer");
    this.scoreboardElement = document.getElementById("scoreboard");
    this.scoreboardBodyElement = document.getElementById("scoreboard-body");
    this.scoreboardCloseButton = document.getElementById("scoreboard-close");

    if (!this.matchPhaseElement || !this.matchTimerElement) {
      console.warn("Match UI elements not found in DOM, creating dynamically");
      this.createMatchInfoUI();
    }

    if (!this.scoreboardElement || !this.scoreboardBodyElement) {
      console.warn(
        "Scoreboard elements not found in DOM, creating dynamically",
      );
      this.createScoreboardUI();
    }

    this.currentMatchId = null;
    this.currentPhase = null;
    this.timeRemaining = 0;
    this.isScoreboardVisible = false;
    this.timerInterval = null;
    this.playerStats = new Map();

    this.setupEventListeners();
  }

  /**
   ** Creates the match info UI
   * @returns {void}
   */
  createMatchInfoUI() {
    const matchInfo = document.createElement("div");
    matchInfo.id = "match-info";
    matchInfo.className = "onTop";

    const matchPhase = document.createElement("div");
    matchPhase.id = "match-phase";
    matchPhase.textContent = "Waiting for players";

    const matchTimer = document.createElement("div");
    matchTimer.id = "match-timer";
    matchTimer.textContent = "--:--";

    matchInfo.appendChild(matchPhase);
    matchInfo.appendChild(matchTimer);

    document.body.appendChild(matchInfo);

    this.matchPhaseElement = matchPhase;
    this.matchTimerElement = matchTimer;
  }

  /**
   ** Creates the scoreboard UI
   * @returns {void}
   */
  createScoreboardUI() {
    const scoreboard = document.createElement("div");
    scoreboard.id = "scoreboard";
    scoreboard.className = "game-ui";

    const header = document.createElement("div");
    header.className = "scoreboard-header";

    const title = document.createElement("h2");
    title.textContent = "Scoreboard";

    const closeBtn = document.createElement("span");
    closeBtn.id = "scoreboard-close";
    closeBtn.textContent = "×";

    header.appendChild(title);
    header.appendChild(closeBtn);

    const table = document.createElement("table");
    table.id = "scoreboard-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    ["Player", "Kills", "Deaths", "K/D"].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);

    const tbody = document.createElement("tbody");
    tbody.id = "scoreboard-body";

    table.appendChild(thead);
    table.appendChild(tbody);

    scoreboard.appendChild(header);
    scoreboard.appendChild(table);

    document.body.appendChild(scoreboard);

    this.scoreboardElement = scoreboard;
    this.scoreboardBodyElement = tbody;
    this.scoreboardCloseButton = closeBtn;
  }

  /**
   ** Sets up event listeners for the scoreboard
   * @returns {void}
   */
  setupEventListeners() {
    document.addEventListener("keydown", (event) => {
      if (event.code === "Tab") {
        event.preventDefault();
        this.toggleScoreboard(true);
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.code === "Tab") {
        event.preventDefault();
        this.toggleScoreboard(false);
      }
    });

    if (this.scoreboardCloseButton) {
      this.scoreboardCloseButton.addEventListener("click", () => {
        this.toggleScoreboard(false);
      });
    }
  }

  /**
   * Updates the match phase display
   * @param {string} phase - Current match phase
   * @param {number} matchId - Match ID
   */
  updateMatchPhase(phase, matchId) {
    this.currentMatchId = matchId;
    this.currentPhase = phase;

    if (!this.matchPhaseElement) return;

    this.matchPhaseElement.classList.remove(
      "phase-waiting",
      "phase-warmup",
      "phase-gameplay",
      "phase-results",
    );

    let phaseText = "";

    switch (phase) {
      case "WAITING_FOR_PLAYERS":
        phaseText = "Waiting for players";
        this.matchPhaseElement.classList.add("phase-waiting");
        break;

      case "WARMUP":
        phaseText = "Warmup Phase";
        this.matchPhaseElement.classList.add("phase-warmup");
        break;

      case "GAMEPLAY":
        phaseText = "Match in Progress";
        this.matchPhaseElement.classList.add("phase-gameplay");
        this.toggleScoreboard(false, false);
        break;

      case "RESULTS":
        phaseText = "Match Results";
        this.matchPhaseElement.classList.add("phase-results");
        this.toggleScoreboard(true, true);
        break;

      default:
        phaseText = phase || "Unknown Phase";
    }

    this.matchPhaseElement.textContent = phaseText;
  }

  /**
   * Updates the match timer display
   * @param {number} timeRemainingMs - Time remaining in milliseconds
   */
  updateMatchTimer(timeRemainingMs) {
    this.timeRemaining = timeRemainingMs;

    if (!this.matchTimerElement) return;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const updateTimerDisplay = () => {
      if (this.timeRemaining <= 0) {
        this.matchTimerElement.textContent = "00:00";
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        return;
      }

      const minutes = Math.floor(this.timeRemaining / 60000);
      const seconds = Math.floor((this.timeRemaining % 60000) / 1000);

      this.matchTimerElement.textContent = `${
        minutes.toString().padStart(2, "0")
      }:${seconds.toString().padStart(2, "0")}`;

      if (this.timeRemaining <= 30000 && this.currentPhase === "GAMEPLAY") {
        this.matchTimerElement.classList.add("timer-warning");
      } else {
        this.matchTimerElement.classList.remove("timer-warning");
      }

      this.timeRemaining -= 1000;
    };

    updateTimerDisplay();
    this.timerInterval = setInterval(updateTimerDisplay, 1000);
  }

  /**
   * Updates player stats in the match
   * @param {Array} statsData - Array of player statistics
   */
  updateMatchStats(statsData) {
    if (!statsData || !Array.isArray(statsData)) return;

    this.playerStats.clear();
    statsData.forEach((playerStat) => {
      this.playerStats.set(playerStat.name, playerStat);
    });

    this.updateScoreboard();
  }

  /**
   * Toggles the scoreboard visibility
   * @param {boolean} visible - Whether the scoreboard should be visible
   * @param {boolean} [persist=false] - Whether to keep the scoreboard open
   */
  toggleScoreboard(visible, persist = false) {
    if (!this.scoreboardElement) return;

    this.isScoreboardVisible = visible || persist;

    if (visible || persist) {
      this.scoreboardElement.style.display = "block";
      this.updateScoreboard();

      if (persist) {
        this.scoreboardElement.classList.add("persistent");
      } else {
        this.scoreboardElement.classList.remove("persistent");
      }
    } else if (
      !persist || !this.scoreboardElement.classList.contains("persistent")
    ) {
      this.scoreboardElement.style.display = "none";
    }
  }

  /**
   * Updates the scoreboard with current player stats
   */
  updateScoreboard() {
    if (!this.scoreboardBodyElement || !this.isScoreboardVisible) return;

    this.scoreboardBodyElement.innerHTML = "";

    const sortedPlayers = Array.from(this.playerStats.values())
      .sort((a, b) => b.kills - a.kills);

    sortedPlayers.forEach((player) => {
      const row = document.createElement("tr");

      if (player.name === localStorage.getItem("username")) {
        row.classList.add("current-player");
      }

      if (player.active === false) {
        row.classList.add("inactive-player");
      }

      row.innerHTML = `
        <td>${player.name}</td>
        <td>${player.kills}</td>
        <td>${player.deaths}</td>
        <td>${player.ratio}</td>
      `;

      this.scoreboardBodyElement.appendChild(row);
    });
  }

  /**
   * Handles match phase change events from the server
   * @param {Object} data - Match phase change data
   */
  handleMatchPhaseChange(data) {
    this.updateMatchPhase(data.phase, data.matchId);

    if (data.timeRemaining) {
      this.updateMatchTimer(data.timeRemaining);
    }
  }

  /**
   * Handles match timer update events from the server
   * @param {Object} data - Timer update data
   */
  handleMatchTimerUpdate(data) {
    if (data.timeRemaining) {
      this.updateMatchTimer(data.timeRemaining);
    }
  }

  /**
   * Handles match stats update events from the server
   * @param {Object} data - Stats update data
   */
  handleMatchStatsUpdate(data) {
    if (data.stats) {
      this.updateMatchStats(data.stats);
    }
  }

  /**
   * Handles the end of a match
   * @param {Object} data - Match end data
   */
  handleMatchEnd(data) {
    this.updateMatchPhase("RESULTS", data.matchId);

    this.toggleScoreboard(true, true);

    if (this.matchTimerElement) {
      this.matchTimerElement.textContent = "Match Complete";
      this.matchTimerElement.classList.remove("timer-warning");
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

const matchUIManager = new MatchUIManager();
export default matchUIManager;
