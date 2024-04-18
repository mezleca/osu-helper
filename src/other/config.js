import { check_config } from "./utils.js";
export const config = new Map();

// Update the config files HEREE!!!!!!!!!!!!!!!:
config.set("osu_id", "");
config.set("osu_secret", "");
config.set("osu_path", "");
config.set("osu_songs_folder", "");

await check_config();