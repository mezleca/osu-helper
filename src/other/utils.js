import fs from "fs";

import { config } from "./config.js";
import { auth } from "osu-api-extended"

import PromptSync from "prompt-sync";

const prompt = PromptSync();
const missing_config = [];

export const check_login = async () => {

    try {
        
        const login = await auth.login(config.get("osu_id"), config.get("osu_secret"), ['public']);
        if (login.access_token) { 
            return login;  
        }
             
        console.log("hmm it seems your osu_id / osu_secret is invalid...\nmake sure to use the correct shit in the config.js file");
        process.exit(1);
        
    } catch (err) {
        process.exit(1);
    }
};

export const check_config = () => {

    for (const [key, value] of config.entries()) {
        if (value === '') {
            console.log(`config for ${key} not found!`);
            missing_config.push(key);
        }
    }
    
    if (missing_config.length > 0) {

        console.log("\n");
    
        for (const key of missing_config) {
            const value = prompt(`Insert the ${key} Value: `).replace(/\\/g, '\\\\');
            config.set(key, value);
        }
    
        // yep this is still pretty bad
        const text = `import { check_config } from "./utils.js";\nexport const config = new Map();\n\n// Update the config files HEREE!!!!!!!!!!!!!!!:\n${Array.from(config).map(([k, v]) => `config.set("${k}", "${v}");`).join('\n')}\ncheck_config();`
    
        // update the config.js file
        fs.writeFileSync("./src/config.js", text);
    }
};

export const check_path = () => {

    const osu_path_exist   = fs.existsSync(config.get("osu_path"));
    const songs_path_exist = fs.existsSync(config.get("osu_songs_folder"));

    if (osu_path_exist && songs_path_exist) {
        return;
    }

    console.clear();
    console.log("your osu path is invalid!\nplease update your config.js file with the osu / osu songs correct path");

    // exit
    process.exit(1);
};