import { auth } from "osu-api-extended";
import { config } from "../config.js";

const login = await auth.login(config.osu_id, config.osu_secret, ['public']);

console.log(login);