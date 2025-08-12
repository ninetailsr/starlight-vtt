export const migrateWorld = async () => {
    const schemaVersion = 8;
    const worldSchemaVersion = Number(game.settings.get("dark-heresy", "worldSchemaVersion"));
    if (worldSchemaVersion !== schemaVersion && game.user.isGM) {
        ui.notifications.info("Upgrading the world, please wait...");
        for (let actor of game.actors.contents) {
            try {
                const update = migrateActorData(actor, worldSchemaVersion);
                if (!isObjectEmpty(update)) {
                    await actor.update(update, {enforceTypes: false});
                }
            } catch(e) {
                console.error(e);
            }
        }
        for (let pack of
            game.packs.filter(p => p.metadata.package === "world" && ["Actor"].includes(p.metadata.type))) {
            await migrateCompendium(pack, worldSchemaVersion);
        }
        game.settings.set("dark-heresy", "worldSchemaVersion", schemaVersion);
        ui.notifications.info("Upgrade complete!");
    }
};

const migrateActorData = (actor, worldSchemaVersion) => {
    const update = {};
    if (worldSchemaVersion < 1) {
        if (actor.data.type === "acolyte" || actor.data.type === "npc") {
            actor.data.skills.psyniscience.characteristics = ["Per", "WP"];
            update["system.skills.psyniscience"] = actor.data.data.skills.psyniscience;
        }
    }
    if (worldSchemaVersion < 2) {
        if (actor.data.type === "acolyte" || actor.data.type === "npc") {

            let characteristic = actor.data.characteristics.intelligence.base;
            let advance = -20;
            let total = characteristic.total + advance;

            if (actor.data.data.skills?.forbiddenLore?.specialities) {
                actor.data.data.skills.forbiddenLore.specialities.officioAssassinorum = {
                label: "Officio Assassinorum",
                isKnown: false,
                advance: advance,
                total: total,
                cost: 0
            };
            actor.data.data.skills.forbiddenLore.specialities.pirates = {
                label: "Pirates",
                isKnown: false,
                advance: advance,
                total: total,
                cost: 0
            };
            actor.data.data.skills.forbiddenLore.specialities.psykers = {
                label: "Psykers",
                isKnown: false,
                advance: advance,
                total: total,
                cost: 0
            };
            actor.data.data.skills.forbiddenLore.specialities.theWarp = {
                label: "The Warp",
                isKnown: false,
                advance: advance,
                total: total,
                cost: 0
            };
            actor.data.data.skills.forbiddenLore.specialities.xenos = {
                label: "Xenos",
                isKnown: false,
                advance: advance,
                total: total,
                cost: 0
            };
            update["system.skills.forbiddenLore"] = actor.data.data.skills.forbiddenLore;
            }
        }

    }

    // v7: Remove Linguistics, Forbidden Lore, Scholastic Lore; (originally renamed Common Lore -> Lore)
    if (worldSchemaVersion < 7) {
        if (actor.type === "acolyte" || actor.type === "npc") {
            const skills = actor.data.data.skills || {};
            const updateSkills = foundry.utils.duplicate(skills);
            // Remove
            delete updateSkills.forbiddenLore;
            delete updateSkills.linguistics;
            delete updateSkills.scholasticLore;
            // Remove Common Lore (no Lore alias)
            delete updateSkills.commonLore;
            update["system.skills"] = updateSkills;
        }
    }

    // // migrate aptitudes
    if (worldSchemaVersion < 4) {
        if (actor.data.type === "acolyte" || actor.data.type === "npc") {

            let textAptitudes = actor.data.data?.aptitudes;

            if (textAptitudes !== null && textAptitudes !== undefined) {
                let aptitudeItemsData =
                    Object.values(textAptitudes)
                    // Be extra careful and filter out bad data because the existing data is bugged
                        ?.filter(textAptitude =>
                            "id" in textAptitude
                        && textAptitude?.name !== null
                        && textAptitude?.name !== undefined
                        && typeof textAptitude?.name === "string"
                        && 0 !== textAptitude?.name?.trim().length)
                        ?.map(textAptitude => {
                            return {
                                name: textAptitude.name,
                                type: "aptitude",
                                isAptitude: true,
                                img: "systems/dark-heresy/asset/icons/aptitudes/aptitude400.png"
                            };
                        });
                if (aptitudeItemsData !== null && aptitudeItemsData !== undefined) {
                    actor.createEmbeddedDocuments("Item", [aptitudeItemsData]);
                }
            }
            update["system.-=aptitudes"] = null;
        }
    }
    if (worldSchemaVersion < 3) {
        actor.prepareData();
        update["system.armour"] = actor.data.armour;
    }

    if (worldSchemaVersion < 5) {
        actor.prepareData();
        let experience = actor.data.data?.experience;
        let value = (experience?.value || 0) + (experience?.totalspent || 0);
        // In case of an Error in the calculation don't do anything loosing data is worse
        // than doing nothing in this case since the user can easily do this himself
        if (!isNaN(value) && value !== undefined) {
            update["system.experience.value"] = value;
        }
    }

    if (worldSchemaVersion < 6) {
        actor.prepareData();
        if (actor.type === "npc") {
            if (actor.system.bio?.notes) {
                actor.system.notes = actor.system.bio.notes;
            }
        }
    }

    // v8: Normalize Navigate to a non-specialist Int-based skill (remove specialities) and remove Lore
    if (worldSchemaVersion < 8) {
        if (actor.type === "acolyte" || actor.type === "npc") {
            const skills = actor.data.data.skills || {};
            // Remove any existing lore key if present
            if (skills.lore) {
                update["system.skills.-=lore"] = null;
            }
            // Rename aptitude references Psyker -> Psychic in characteristics/skills
            const characteristics = actor.data.data.characteristics || {};
            for (const ch of Object.values(characteristics)) {
                if (Array.isArray(ch.aptitudes)) {
                    ch.aptitudes = ch.aptitudes.map(a => a === "Psyker" ? "Psychic" : a);
                }
            }
            for (const sk of Object.values(skills)) {
                if (Array.isArray(sk.aptitudes)) {
                    sk.aptitudes = sk.aptitudes.map(a => a === "Psyker" ? "Psychic" : a);
                }
            }
            update["system.characteristics"] = characteristics;
            update["system.skills"] = skills;
            const normalizeSkill = (key, chars) => {
                if (!skills[key]) return;
                skills[key].isSpecialist = false;
                skills[key].characteristics = chars;
                skills[key].specialities = {};
                if (typeof skills[key].advance !== "number") skills[key].advance = -20;
                if (typeof skills[key].cost !== "number") skills[key].cost = 0;
                if (typeof skills[key].starter !== "boolean") skills[key].starter = false;
                update[`system.skills.${key}`] = skills[key];
            };
            normalizeSkill("navigate", ["Int"]);
            normalizeSkill("operate", ["Ag"]);
            normalizeSkill("trade", ["Int"]);
        }
    }

    return update;
};

/**
 * Migrate Data in Compendiums
 * @param {CompendiumCollection} pack
 * @param {number} worldSchemaVersion
 * @returns {Promise<void>}
 */
export const migrateCompendium = async function(pack, worldSchemaVersion) {
    const entity = pack.metadata.type;

    await pack.migrate();
    const content = await pack.getContent();

    for (let ent of content) {
        let updateData = {};
        if (entity === "Actor") {
            updateData = migrateActorData(ent, worldSchemaVersion);
        }
        if (!isObjectEmpty(updateData)) {
            foundry.utils.expandObject(updateData);
            updateData._id = ent.id;
            await pack.updateEntity(updateData);
        }
    }
};
