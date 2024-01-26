import fs from "fs";
import path from "path";
import axios from "axios";
import PromptSync from "prompt-sync";

import { OsuReader } from "../reader/reader.js";
import { auth, v2, v1, tools } from 'osu-api-extended';