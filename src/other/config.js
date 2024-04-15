import { check_config } from "./utils.js";
export const config = new Map();

// Update the config files HEREE!!!!!!!!!!!!!!!:
config.set("osu_id", "24421");
config.set("osu_secret", "czIiGGe79VeLEZhYSfAQSfnWGOQPWpvfAYGm3Bt2");
config.set("osu_path", "/home/rel/.local/share/osu-wine/osu!/");
config.set("osu_songs_folder", "/home/rel/.local/share/osu-wine/osu!/Songs");

check_config();