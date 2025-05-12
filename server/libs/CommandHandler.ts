import { playerExists, RoleLevel } from "./PlayerHandler.ts";
import { players } from "./PlayerHandler.ts";
import sqlHandler from "./SqlHandler.ts";
import { CommandEffectType } from "../enums/CommandEffectType.ts";

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
      if (!playerExists(playerName)) {
        return {
          message: `Erreur: Le joueur ${playerName} n'existe pas`,
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
        reason = args.slice(2).join(" ") || "Aucune raison spécifiée";
      } else {
        reason = args.slice(1).join(" ") || "Aucune raison spécifiée";
      }

      const durationText = durationResult.expiryDate instanceof Date
        ? `pendant ${durationResult.durationStr} (jusqu'au ${durationResult.expiryDate.toLocaleString()})`
        : "définitivement";

      return {
        message:
          `Le joueur ${playerName} a été banni ${durationText} par ${sender} pour la raison: ${reason}`,
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
              message: `${sender} s'est suicidé`,
              effect: {
                type: CommandEffectType.KILL,
                target: sender,
                reason: "Suicide",
              },
            };
          }

          if (args.length < 1) {
            return {
              message: "Usage pour modérateur/admin: /kill <playerName>",
              effect: { type: CommandEffectType.NONE, target: "", reason: "" },
            };
          }

          const playerName = args[0];
          if (!playerExists(playerName)) {
            return {
              message: `Erreur: Le joueur ${playerName} n'existe pas`,
              effect: { type: CommandEffectType.NONE, target: "", reason: "" },
            };
          }

          return {
            message: `Le joueur ${playerName} a été tué par ${sender}`,
            effect: {
              type: CommandEffectType.KILL,
              target: playerName,
              reason: "Tué par modérateur",
            },
          };
        } else {
          if (args.length > 0) {
            return {
              message:
                "En tant que joueur, vous ne pouvez utiliser /kill que pour vous suicider",
              effect: { type: CommandEffectType.NONE, target: "", reason: "" },
            };
          }

          return {
            message: `${sender} s'est suicidé`,
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
      if (!playerExists(playerName)) {
        return {
          message: `Erreur: Le joueur ${playerName} n'existe pas`,
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
        reason = args.slice(2).join(" ") || "Aucune raison spécifiée";
      } else {
        reason = args.slice(1).join(" ") || "Aucune raison spécifiée";
      }

      const durationText = durationResult.expiryDate instanceof Date
        ? `pendant ${durationResult.durationStr} (jusqu'au ${durationResult.expiryDate.toLocaleString()})`
        : "définitivement";

      return {
        message:
          `Le joueur ${playerName} a été rendu muet ${durationText} par ${sender} pour la raison: ${reason}`,
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
          message: `Erreur: Le joueur ${playerName} n'existe pas`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const banStatus = sqlHandler.isBanned(userId);
      if (!banStatus.banned) {
        return {
          message: `Le joueur ${playerName} n'est pas banni actuellement`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      sqlHandler.removeBan(userId);

      return {
        message: `Le joueur ${playerName} a été débanni par ${sender}`,
        effect: {
          type: CommandEffectType.UNBAN,
          target: playerName,
          reason: "Débannissement",
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
            message: `Erreur: Le joueur ${playerName} n'existe pas`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        }

        const muteStatus = sqlHandler.isMuted(userId);
        if (!muteStatus.muted) {
          return {
            message: `Le joueur ${playerName} n'est pas muet actuellement`,
            effect: { type: CommandEffectType.NONE, target: "", reason: "" },
          };
        }

        sqlHandler.removeMute(userId);

        return {
          message: `Le joueur ${playerName} a été démuté par ${sender}`,
          effect: {
            type: CommandEffectType.UNMUTE,
            target: playerName,
            reason: "Démutage",
          },
        };
      },
    );

    this.registerCommand(
      "stats",
      RoleLevel.USER,
      (args, sender) => {
        if (args.length === 0) {
          const statsMsg =
            `Kills: ${players[sender].kills} (Streak:${
              players[sender].killStreak
            })<br>` +
            `Deaths: ${players[sender].deaths} (Ratio: ${
              players[sender].deaths > 0
                ? (players[sender].kills / players[sender].deaths).toFixed(2)
                : players[sender].kills
            })<br>` +
            `Headshots accuracy: ${
              players[sender].bodyshots + players[sender].headshots > 0
                ? (players[sender].headshots /
                  (players[sender].bodyshots + players[sender].headshots))
                  .toFixed(2)
                : 0
            }<br>` +
            `Shots accuracy: ${
              players[sender].missedshots + players[sender].bodyshots +
                    players[sender].headshots > 0
                ? ((players[sender].bodyshots + players[sender].headshots) /
                  (players[sender].missedshots + players[sender].bodyshots +
                    players[sender].headshots)).toFixed(2)
                : 0
            }`;
          return {
            message: `Statistiques du joueur ${sender}: <br>${statsMsg}`,
            effect: {
              type: CommandEffectType.NONE,
              target: sender,
              reason: "Suicide",
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
              message: `Statistiques du joueur ${playerName}: <br>${statsMsg}`,
              effect: { type: CommandEffectType.NONE, target: playerName, reason: "" },
            };
          }
          return {
            message: `Erreur: Le joueur ${playerName} n'existe pas`,
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
          message: `Statistiques du joueur ${playerName}: <br>${statsMsg}`,
          effect: { type: CommandEffectType.NONE, target: sender, reason: "" },
        };
      },
    );

    this.registerCommand("help", RoleLevel.USER, (_, __, senderRole) => {
      let helpText = "Commandes disponibles:<br>";
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
          message: "Erreur: Le message est trop long (max 255 caractères)",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      if (!playerExists(targetPlayer)) {
        return {
          message:
            `Erreur: Le joueur ${targetPlayer} n'existe pas ou n'est pas connecté`,
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      if (targetPlayer === sender) {
        return {
          message: "Vous ne pouvez pas vous envoyer de message à vous-même",
          effect: { type: CommandEffectType.NONE, target: "", reason: "" },
        };
      }

      const senderId = sqlHandler.getUserByName(sender);
      const receiverId = sqlHandler.getUserByName(targetPlayer);

      if (senderId > 0 && receiverId > 0) {
        sqlHandler.sendPrivateMessage(senderId, receiverId, messageText);
      }

      return {
        message: `MP à ${targetPlayer} : ${messageText}`,
        effect: {
          type: CommandEffectType.PRIVATE_MESSAGE,
          target: targetPlayer,
          reason: messageText,
        },
      };
    });

    this.registerCommand("logout", RoleLevel.USER, (_, sender) => {
      return {
        message: `${sender} s'est déconnecté.`,
        effect: {
          type: CommandEffectType.LOGOUT,
          target: sender,
          reason: "Déconnexion volontaire",
        },
      };
    });
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
        message: `Commande inconnue: ${cmdName}`,
        effect: { type: CommandEffectType.NONE, target: "", reason: "" },
      };
    }

    if (senderRole < command.minRole) {
      return {
        message: "Vous n'avez pas la permission d'utiliser cette commande",
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
        `Erreur lors de l'exécution de la commande ${cmdName}:`,
        error,
      );
      return {
        message: `Erreur: ${errorMessage}`,
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
