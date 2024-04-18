import { check_config } from "./utils.js";
export const config = new Map();

// Update the config files HEREE!!!!!!!!!!!!!!!:
config.set("osu_id", "24421");
config.set("osu_secret", "Q1qmXwZwCnD4Iao7VTjv6WNXx0NLxmPpMRvCLjf4");
config.set("osu_path", "C:\\Users\\nameh\\AppData\\Local\\osu!");
config.set("osu_songs_folder", "C:\\Users\\nameh\\AppData\\Local\\osu!\\Songs");

await check_config();