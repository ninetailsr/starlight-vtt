export const migrateWorld = async () => {
    const schemaVersion = 8;
    const worldSchemaVersion = Number(game.settings.get("dark-heresy", "worldSchemaVersion"));
    if (worldSchemaVersion !== schemaVersion && game.user.isGM) {
        await game.settings.set("dark-heresy", "worldSchemaVersion", schemaVersion);
        ui.notifications.info("World schema set to current version.");
    }
};
