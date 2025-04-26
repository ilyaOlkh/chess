export const onlineGameText = {
    title: "Гра онлайн",
    waitingTitle: "Очікування суперника",
    inviteInstructions: "Запросіть друга, надіславши йому це посилання:",
    copyButton: "Копіювати",
    copiedButton: "Скопійовано!",
};

export const playerRoles = {
    first: "first",
    second: "second",
    spectator: "spectator",
} as const;

export type PlayerRole = (typeof playerRoles)[keyof typeof playerRoles];

export const gameEventTypes = {
    player_joined: "player_joined",
    move_made: "move_made",
    game_status_changed: "game_status_changed",
} as const;

export type GameEventType =
    (typeof gameEventTypes)[keyof typeof gameEventTypes];
