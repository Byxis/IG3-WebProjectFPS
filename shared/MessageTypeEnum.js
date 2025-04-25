export var MessageTypeEnum;
(function (MessageTypeEnum) {
    MessageTypeEnum["POSITION_CORRECTION"] = "POSITION_CORRECTION";
    MessageTypeEnum["NEW_PLAYER"] = "NEW_PLAYER";
    MessageTypeEnum["UPDATE_PLAYER_KEYBINDS"] = "UPDATE_PLAYER_KEYBINDS";
    MessageTypeEnum["VERIFY_POSITION"] = "VERIFY_POSITION";
    MessageTypeEnum["REMOVE_PLAYER"] = "REMOVE_PLAYER";
    MessageTypeEnum["DISCONNECT"] = "DISCONNECT";
    MessageTypeEnum["ADD_NEW_PLAYER"] = "ADD_NEW_PLAYER";
    MessageTypeEnum["PLAYER_MOVEMENT"] = "PLAYER_MOVEMENT";
    MessageTypeEnum["AMMO_UPDATE"] = "AMMO_UPDATE";
    MessageTypeEnum["HEALTH_UPDATE"] = "HEALTH_UPDATE";
})(MessageTypeEnum || (MessageTypeEnum = {}));
