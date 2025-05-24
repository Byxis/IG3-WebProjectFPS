import { playerExists } from "./PlayerHandler.ts";
import { players } from "./PlayerHandler.ts";
import sqlHandler from "./SqlHandler.ts";
import { CommandEffectType } from "../enums/CommandEffectType.ts";
import { RoleLevel } from "../enums/RoleLevel.ts";
import { matchManager } from "./MatchManager.ts";

export interface CommandEffect {
  type: CommandEffectType;
  target: string;
  reason: string;
  expiryDate?: Date;
}

export interface CommandResult {
  message: string;
  effect: CommandEffect;
}

type CommandHandlerFn = (
  args: string[],
  sender: string,
  senderRole: number,
) => CommandResult;

export class CommandHandler {
  private commands = new Map<string, {
    minRole: RoleLevel;
    handler: CommandHandlerFn;
  }>();

  /**
   ** Creates a new command handler with built-in commands
   */
  constructor() {
    this.registerCommand("ban", RoleLevel.ADMIN, (args, sender) => {
      if (args.length < 1) {
        return {
          message: "Usage: /ban <playerName> [duration] [reason]",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const playerName = args[0];
      if (!playerExists(playerName) && !sqlHandler.doUserExists(playerName)) {
        return {
          message: `Error: Player ${playerName} does not exist`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      let reason = "";
      let durationResult: { durationStr: string; expiryDate?: Date } = {
        durationStr: "",
      };

      // Check if the second argument is a duration
      if (args.length > 1 && /^\d+[mhdw]$/.test(args[1])) {
        durationResult = this.parseDuration(args[1]);
        reason = args.slice(2).join(" ") || "No reason specified";
      } else {
        reason = args.slice(1).join(" ") || "No reason specified";
      }

      const durationText = durationResult.expiryDate instanceof Date
        ? `for ${durationResult.durationStr} (until ${durationResult.expiryDate.toLocaleString()})`
        : "permanently";

      return {
        message:
          `Player ${playerName} has been banned ${durationText} by ${sender} for the reason: ${reason}`,
        effect: {
          type: CommandEffectType.BAN,
          target: playerName,
          reason,
          expiryDate: durationResult.expiryDate,
        },
      };
    });

    this.registerCommand(
      "kill",
      RoleLevel.USER,
      (args, sender, senderRole) => {
        if (senderRole >= RoleLevel.MODERATOR) {
          if (args.length === 0) {
            return {
              message: `${sender} committed suicide`,
              effect: {
                type: CommandEffectType.KILL,
                target: sender,
                reason: "Suicide",
              },
            };
          }

          if (args.length < 1) {
            return {
              message: "Usage for moderator/admin: /kill <playerName>",
              effect: { type: CommandEffectType.NONE, target: "", reason: "" },
            };
          }

          const playerName = args[0];
          if (!playerExists(playerName)) {
            return {
              message: `Error: Player ${playerName} is not online`,
              effect: { type: CommandEffectType.NONE, target: "", reason: "" },
            };
          }

          return {
            message: `Player ${playerName} was killed by ${sender}`,
            effect: {
              type: CommandEffectType.KILL,
              target: playerName,
              reason: "Killed by moderator",
            },
          };
        } else {
          if (args.length > 0) {
            return {
              message: "As a player, you can only use /kill to commit suicide",
              effect: { type: CommandEffectType.NONE, target: "", reason: "" },
            };
          }

          return {
            message: `${sender} committed suicide`,
            effect: {
              type: CommandEffectType.KILL,
              target: sender,
              reason: "Suicide",
            },
          };
        }
      },
    );

    this.registerCommand("mute", RoleLevel.MODERATOR, (args, sender) => {
      if (args.length < 1) {
        return {
          message: "Usage: /mute <playerName> [duration] [reason]",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }
      const playerName = args[0];
      if (!playerExists(playerName) && !sqlHandler.doUserExists(playerName)) {
        return {
          message: `Error: Player ${playerName} does not exist`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      let reason = "";
      let durationResult: { durationStr: string; expiryDate?: Date } = {
        durationStr: "",
      };

      // Check if the second argument is a duration
      if (args.length > 1 && /^\d+[mhdw]$/.test(args[1])) {
        durationResult = this.parseDuration(args[1]);
        reason = args.slice(2).join(" ") || "No reason specified";
      } else {
        reason = args.slice(1).join(" ") || "No reason specified";
      }

      const durationText = durationResult.expiryDate instanceof Date
        ? `for ${durationResult.durationStr} (until ${durationResult.expiryDate.toLocaleString()})`
        : "permanently";

      return {
        message:
          `Player ${playerName} has been muted ${durationText} by ${sender} for the reason: ${reason}`,
        effect: {
          type: CommandEffectType.MUTE,
          target: playerName,
          reason,
          expiryDate: durationResult.expiryDate,
        },
      };
    });

    this.registerCommand("unban", RoleLevel.ADMIN, (args, sender) => {
      if (args.length < 1) {
        return {
          message: "Usage: /unban <playerName>",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const playerName = args[0];
      const userId = sqlHandler.getUserByName(playerName);

      if (userId <= 0) {
        return {
          message: `Error: Player ${playerName} does not exist`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const banStatus = sqlHandler.isBanned(userId);
      if (!banStatus.banned) {
        return {
          message: `Player ${playerName} is not currently banned`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      sqlHandler.removeBan(userId);

      return {
        message: `Player ${playerName} has been unbanned by ${sender}`,
        effect: {
          type: CommandEffectType.UNBAN,
          target: playerName,
          reason: "Unbanning",
        },
      };
    });

    this.registerCommand(
      "unmute",
      RoleLevel.MODERATOR,
      (args, sender) => {
        if (args.length < 1) {
          return {
            message: "Usage: /unmute <playerName>",
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        }

        const playerName = args[0];
        const userId = sqlHandler.getUserByName(playerName);

        if (userId <= 0) {
          return {
            message: `Error: Player ${playerName} does not exist`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        }

        const muteStatus = sqlHandler.isMuted(userId);
        if (!muteStatus.muted) {
          return {
            message: `Player ${playerName} is not currently muted`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        }

        sqlHandler.removeMute(userId);

        return {
          message: `Player ${playerName} has been unmuted by ${sender}`,
          effect: {
            type: CommandEffectType.UNMUTE,
            target: playerName,
            reason: "Unmuting",
          },
        };
      },
    );

    this.registerCommand(
      "stats",
      RoleLevel.USER,
      (args, sender) => {
        if (args.length === 0) {
          const stats = sqlHandler.getUserStats(sender);
          const statsMsg =
            `Kills: ${stats.kills} (Killstreak : ${
              players[sender].killStreak
            })<br>` +
            `Deaths: ${stats.deaths} (Ratio: ${
              stats.deaths > 0
                ? (stats.kills / stats.deaths).toFixed(2)
                : stats.kills
            })<br>` +
            `Headshots accuracy: ${
              stats.bodyshots + stats.headshots > 0
                ? (stats.headshots / (stats.bodyshots + stats.headshots))
                  .toFixed(2)
                : 0
            }<br>` +
            `Shots accuracy: ${
              stats.missedshots + stats.bodyshots + stats.headshots > 0
                ? ((stats.bodyshots + stats.headshots) /
                  (stats.missedshots + stats.bodyshots + stats.headshots))
                  .toFixed(2)
                : 0
            }`;
          return {
            message: `Player statistics ${sender}: <br>${statsMsg}`,
            effect: {
              type: CommandEffectType.NONE,
              target: sender,
              reason: "",
            },
          };
        }

        const playerName = args[0];
        if (!playerExists(playerName)) {
          if (sqlHandler.doUserExists(playerName)) {
            const stats = sqlHandler.getUserStats(playerName);
            const statsMsg = `Kills: ${stats.kills}<br>` +
              `Deaths: ${stats.deaths} (Ratio: ${
                stats.deaths > 0
                  ? (stats.kills / stats.deaths).toFixed(2)
                  : stats.kills
              })<br>` +
              `Headshots accuracy: ${
                stats.bodyshots + stats.headshots > 0
                  ? (stats.headshots / (stats.bodyshots + stats.headshots))
                    .toFixed(2)
                  : 0
              }<br>` +
              `Shots accuracy: ${
                stats.missedshots + stats.bodyshots + stats.headshots > 0
                  ? ((stats.bodyshots + stats.headshots) /
                    (stats.missedshots + stats.bodyshots + stats.headshots))
                    .toFixed(2)
                  : 0
              }`;
            return {
              message: `Player statistics ${playerName}: <br>${statsMsg}`,
              effect: {
                type: CommandEffectType.NONE,
                target: playerName,
                reason: "",
              },
            };
          }
          return {
            message: `Error: Player ${playerName} does not exist`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        }

        const statsMsg =
          `Kills: ${players[playerName].kills} (Streak:${
            players[playerName].killStreak
          })<br>` +
          `Deaths: ${players[playerName].deaths} (Ratio: ${
            players[playerName].deaths > 0
              ? (players[playerName].kills / players[playerName].deaths)
                .toFixed(2)
              : players[playerName].kills
          })<br>` +
          `Headshots accuracy: ${
            players[playerName].bodyshots + players[playerName].headshots > 0
              ? (players[playerName].headshots /
                (players[playerName].bodyshots + players[playerName].headshots))
                .toFixed(2)
              : 0
          }<br>` +
          `Shots accuracy: ${
            players[playerName].missedshots + players[playerName].bodyshots +
                  players[playerName].headshots > 0
              ? ((players[playerName].bodyshots +
                players[playerName].headshots) /
                (players[playerName].missedshots +
                  players[playerName].bodyshots +
                  players[playerName].headshots)).toFixed(2)
              : 0
          }`;
        return {
          message: `Player statistics ${playerName}: <br>${statsMsg}`,
          effect: { type: CommandEffectType.NONE, target: sender, reason: "" },
        };
      },
    );

    this.registerCommand("help", RoleLevel.USER, (_, __, senderRole) => {
      let helpText = "Available commands:<br>";
      for (const [cmd, info] of this.commands.entries()) {
        if (senderRole >= info.minRole) {
          helpText += `/${cmd}<br>`;
        }
      }
      return {
        message: helpText,
        effect: { type: CommandEffectType.NONE, target: "", reason: "" },
      };
    });

    this.registerCommand("msg", RoleLevel.USER, (args, sender) => {
      if (args.length < 2) {
        return {
          message: "Usage: /msg <playerName> <message>",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const targetPlayer = args[0];
      const messageText = args.slice(1).join(" ");

      if (messageText.length > 255) {
        return {
          message: "Error: The message is too long (max 255 characters)",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      if (!playerExists(targetPlayer)) {
        return {
          message:
            `Error: Player ${targetPlayer} does not exist or is not connected`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      if (targetPlayer === sender) {
        return {
          message: "You cannot send a message to yourself",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const senderId = sqlHandler.getUserByName(sender);
      const receiverId = sqlHandler.getUserByName(targetPlayer);

      if (senderId > 0 && receiverId > 0) {
        sqlHandler.sendPrivateMessage(senderId, receiverId, messageText);
      }

      return {
        message: `PM to ${targetPlayer}: ${messageText}`,
        effect: {
          type: CommandEffectType.PRIVATE_MESSAGE,
          target: targetPlayer,
          reason: messageText,
        },
      };
    });

    this.registerCommand("logout", RoleLevel.USER, (_, sender) => {
      return {
        message: `${sender} has logged out.`,
        effect: {
          type: CommandEffectType.LOGOUT,
          target: sender,
          reason: "Voluntary logout",
        },
      };
    });

    this.registerCommand("promote", RoleLevel.ADMIN, (args, sender) => {
      if (args.length < 1) {
        return {
          message: "Error: You must specify a player name to promote",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const playerName = args[0];
      if (!sqlHandler.doUserExists(playerName)) {
        return {
          message: `Error: Player ${playerName} does not exist`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const userId = sqlHandler.getUserByName(playerName);
      const currentRole = sqlHandler.getUserRole(userId);

      if (currentRole === -1) {
        return {
          message: `Error: Could not retrieve role for player ${playerName}`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      let newRole: number;
      let roleText: string;

      switch (currentRole) {
        case RoleLevel.USER:
          newRole = RoleLevel.MODERATOR;
          roleText = "Moderator";
          break;
        case RoleLevel.MODERATOR:
          newRole = RoleLevel.ADMIN;
          roleText = "Administrator";
          break;
        case RoleLevel.ADMIN:
          return {
            message: `Error: Player ${playerName} is already at the highest role level`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        default:
          return {
            message: `Error: Invalid role level for player ${playerName}`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
      }

      const success = sqlHandler.changeUserRole(userId, newRole);
      if (!success) {
        return {
          message: `Error: Failed to promote player ${playerName}`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      return {
        message: `Player ${playerName} has been promoted to ${roleText} by ${sender}`,
        effect: {
          type: CommandEffectType.ROLE_CHANGE,
          target: playerName,
          reason: `Promoted to ${roleText}`,
        },
      };
    });

    this.registerCommand("demote", RoleLevel.ADMIN, (args, sender) => {
      if (args.length < 1) {
        return {
          message: "Error: You must specify a player name to demote",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const playerName = args[0];
      
      if (playerName.toLowerCase() === "byxis") {
        return {
          message: "Error: Byxis cannot be demoted",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      if (!sqlHandler.doUserExists(playerName)) {
        return {
          message: `Error: Player ${playerName} does not exist`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const userId = sqlHandler.getUserByName(playerName);
      const currentRole = sqlHandler.getUserRole(userId);

      if (currentRole === -1) {
        return {
          message: `Error: Could not retrieve role for player ${playerName}`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      let newRole: number;
      let roleText: string;

      switch (currentRole) {
        case RoleLevel.ADMIN:
          newRole = RoleLevel.MODERATOR;
          roleText = "Moderator";
          break;
        case RoleLevel.MODERATOR:
          newRole = RoleLevel.USER;
          roleText = "User";
          break;
        case RoleLevel.USER:
          return {
            message: `Error: Player ${playerName} is already at the lowest role level`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        default:
          return {
            message: `Error: Invalid role level for player ${playerName}`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
      }

      const success = sqlHandler.changeUserRole(userId, newRole);
      if (!success) {
        return {
          message: `Error: Failed to demote player ${playerName}`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      return {
        message: `Player ${playerName} has been demoted to ${roleText} by ${sender}`,
        effect: {
          type: CommandEffectType.ROLE_CHANGE,
          target: playerName,
          reason: `Demoted to ${roleText}`,
        },
      };
    });

    this.registerCommand(
      "settings",
      RoleLevel.USER,
      (args, sender, senderRole) => {
        if (args.length < 2) {
          return {
            message:
              "Usage: /settings <setting> <value><br>Available settings:<br>- sensitivity <float><br>- match_duration <minutes> (admin only)<br>- player_start_nb <number> (admin only)",
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        }

        const setting = args[0].toLowerCase();
        const value = args[1];

        switch (setting) {
          case "sensitivity": {
            const sensitivity = parseFloat(value);
            if (isNaN(sensitivity) || sensitivity <= 0 || sensitivity > 10) {
              return {
                message:
                  "Error: Sensitivity must be a number between 0.01 and 10",
                effect: {
                  type: CommandEffectType.NONE,
                  target: "",
                  reason: "",
                },
              };
            }

            return {
              message: `Mouse sensitivity set to ${sensitivity}`,
              effect: {
                type: CommandEffectType.SETTINGS_UPDATE,
                target: sender,
                reason: JSON.stringify({
                  type: "sensitivity",
                  value: sensitivity,
                }),
              },
            };
          }
          case "match_duration": {
            if (senderRole < RoleLevel.ADMIN) {
              return {
                message: "Error: Only administrators can change match duration",
                effect: {
                  type: CommandEffectType.NONE,
                  target: "",
                  reason: "",
                },
              };
            }

            const duration = parseInt(value);
            if (isNaN(duration) || duration < 1 || duration > 60) {
              return {
                message:
                  "Error: Match duration must be between 1 and 60 minutes",
                effect: {
                  type: CommandEffectType.NONE,
                  target: "",
                  reason: "",
                },
              };
            }

            matchManager.updateMatchDuration(duration * 60 * 1000);

            return {
              message: `Match duration set to ${duration} minutes`,
              effect: {
                type: CommandEffectType.SETTINGS_UPDATE,
                target: "all",
                reason: JSON.stringify({
                  type: "match_duration",
                  value: duration,
                }),
              },
            };
          }

          case "player_start_nb": {
            if (senderRole < RoleLevel.ADMIN) {
              return {
                message:
                  "Error: Only administrators can change minimum player count",
                effect: {
                  type: CommandEffectType.NONE,
                  target: "",
                  reason: "",
                },
              };
            }

            const playerCount = parseInt(value);
            if (isNaN(playerCount) || playerCount < 1 || playerCount > 20) {
              return {
                message: "Error: Minimum player count must be between 1 and 20",
                effect: {
                  type: CommandEffectType.NONE,
                  target: "",
                  reason: "",
                },
              };
            }

            matchManager.updateMinPlayers(playerCount);

            return {
              message: `Minimum players to start match set to ${playerCount}`,
              effect: {
                type: CommandEffectType.SETTINGS_UPDATE,
                target: "all",
                reason: JSON.stringify({
                  type: "player_start_nb",
                  value: playerCount,
                }),
              },
            };
          }

          default: {
            return {
              message:
                `Error: Unknown setting '${setting}'. Available settings: sensitivity, match_duration (admin), player_start_nb (admin)`,
              effect: { type: CommandEffectType.NONE, target: "", reason: "" },
            };
          }
        }
      },
    );
  }

  /**
   ** Registers a new command
   * @param {string} name - Command name
   * @param {RoleLevel} minRole - Minimum role level required
   * @param {CommandHandlerFn} handler - Command handler function
   */
  public registerCommand(
    name: string,
    minRole: RoleLevel,
    handler: CommandHandlerFn,
  ) {
    this.commands.set(name.toLowerCase(), { minRole, handler });
  }

  /**
   ** Executes a command
   * @param {string} commandLine - Full command text including arguments
   * @param {string} sender - Username of command sender
   * @param {number} senderRole - Role level of sender
   * @returns {Promise<CommandResult>} Command execution result
   */
  public async executeCommand(
    commandLine: string,
    sender: string,
    senderRole: number,
  ): Promise<CommandResult> {
    const { cmdName, args } = this.parseCommand(commandLine);

    const command = this.commands.get(cmdName);
    if (!command) {
      return {
        message: `Unknown command: ${cmdName}`,
        effect: { type: CommandEffectType.NONE, target: "", reason: "" },
      };
    }

    if (senderRole < command.minRole) {
      return {
        message: "You do not have permission to use this command",
        effect: { type: CommandEffectType.NONE, target: "", reason: "" },
      };
    }

    try {
      return await command.handler(args, sender, senderRole);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error(
        `Error while executing command ${cmdName}:`,
        error,
      );
      return {
        message: `Error: ${errorMessage}`,
        effect: { type: CommandEffectType.NONE, target: "", reason: "" },
      };
    }
  }

  /**
   ** Parses a command string into name and arguments
   * @param {string} commandLine - Command string to parse
   * @returns {object} Command name and arguments
   */
  private parseCommand(
    commandLine: string,
  ): { cmdName: string; args: string[] } {
    const args = commandLine.trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase() || "";
    return { cmdName, args };
  }

  /**
   ** Checks if a command exists
   * @param {string} name - Command name
   * @returns {boolean} True if command exists
   */
  public hasCommand(name: string): boolean {
    return this.commands.has(name.toLowerCase());
  }

  /**
   ** Parses a duration string into expiry date
   * @param {string} durationStr - Duration string (e.g. "5m", "2h")
   * @returns {object} Formatted duration string and expiry date
   */
  private parseDuration(
    durationStr: string,
  ): { durationStr: string; expiryDate?: Date } {
    const match = durationStr.match(/^(\d+)([mhdw])$/);
    if (!match) {
      return { durationStr: "" };
    }

    const value = parseInt(match[1]);
    const unit = match[2];
    const expiryDate = new Date();

    switch (unit) {
      case "m": // minutes
        expiryDate.setMinutes(expiryDate.getMinutes() + value);
        break;
      case "h": // hours
        expiryDate.setHours(expiryDate.getHours() + value);
        break;
      case "d": // days
        expiryDate.setDate(expiryDate.getDate() + value);
        break;
      case "w": // weeks
        expiryDate.setDate(expiryDate.getDate() + (value * 7));
        break;
    }

    return { durationStr, expiryDate };
  }
}

const commandHandler = new CommandHandler();
export default commandHandler;
