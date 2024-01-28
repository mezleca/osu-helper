import PromptSync from "prompt-sync";
import fs from "fs";
import path from "path";

import { osu_db, collections_db } from "./definitions.js";

const prompt = PromptSync();

export class OsuReader {

    type = "";
    offset = 0;

    constructor(buffer, type) {
        type = type || "";
        buffer = buffer || null;
        /** @type {osu_db} */
        this.osu = [];
        /** @type {collections_db} */
        this.collections = [];
    }

    set_buffer = (buffer) => {
        this.buffer = Buffer.from(buffer);
    }

    set_type = (type) => {
        this.type = type;
    }

    set_directory = (directory) => {
        this.directory = path.resolve(directory);
    }

    #readByte(){
        const value = this.buffer.readUint8(this.offset);
        this.offset += 1;
        return value;
    }

    #readShort(){
        const value = this.buffer.readUint16LE(this.offset);
        this.offset += 2; 
        return value;
    }

    #readInt(){
        const value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;     
        return value;
    }

    #readLong(){
        const value = Number(this.buffer.readBigInt64LE(this.offset));
        this.offset += 8;       
        return value;
    }

    #readULEB128() {
        let result = 0;
        let shift = 0;
    
        do {
            const byte = this.buffer.readUInt8(this.offset);
            result |= (byte & 0x7F) << shift;
            shift += 7;
            this.offset += 1;
        } while (this.buffer.readUInt8(this.offset - 1) & 0x80);
          
        return { value: result, bytesRead: this.offset };
    }

    #readSingle(){
        const value = this.buffer.readFloatLE(this.offset);
        this.offset += 4;
        return value;
    }

    #readDouble(){
        const value = this.buffer.readDoubleLE(this.offset);
        this.offset += 8; 
        return value;
    }

    #readBool(){
        const value = this.#readByte() == 0x00 ? false : true;
        return value;
    }

    #readString(){
        
        const is_present = this.#readByte() == 0x00 ? false : true;
        if (!is_present) {
            return null;
        }
    
        const length = this.#readULEB128();
        const value =  this.buffer.toString('utf-8', this.offset, this.offset + length.value);
        this.offset += length.value;
    
        return value;
    }

    #Skip(b) {
        this.offset += b;     
    }

    #getMD5(count){
        return new Promise(async (r, rj) => {

            const md5 = [];
            for (let i = 0; i < count; i++) {
                const map = this.#readString();
                md5.push(map);
            }

            r(md5);
        });
    }

    #writeByte(value){
        const buffer = Buffer.alloc(1);
        buffer.writeUInt8(value, 0);
        return buffer;
    }

    #writeShort(value){
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16LE(value, 0);
        return buffer;
    }

    #writeInt(value){
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(value, 0);
        return buffer;
    }

    #writeLong(value){
        const buffer = Buffer.alloc(8);
        buffer.writeBigInt64LE(BigInt(value), 0);
        return buffer;
    }

    #writeSingle(value){
        const buffer = Buffer.alloc(4);
        buffer.writeFloatLE(value, 0);
        return buffer;
    }

    #writeDouble(value){
        const buffer = Buffer.alloc(8);
        buffer.writeDoubleLE(value, 0);
        return buffer;
    }

    #writeBool(value){
        return this.#writeByte(value ? 0x01 : 0x00);
    }

    #writeString(value){
        if (value === null) {
            return this.#writeByte(0x00);
        }
        const lengthBuffer = this.#writeULEB128(value.length);
        const stringBuffer = Buffer.from(value, 'utf-8');
        return Buffer.concat([this.#writeByte(0x0B), lengthBuffer, stringBuffer]);
    }

    #writeULEB128(value) {
        const buffer = Buffer.alloc(5); // max 5 bytes for 32-bit number
        let offset = 0;
        do {
            let byte = value & 0x7F;
            value >>>= 7;
            if (value !== 0) { /* more bytes to come */
                byte |= 0x80;
            }
            buffer.writeUInt8(byte, offset++);
        } while (value !== 0);
        return buffer.slice(0, offset); // remove unused bytes
    }

    write_collections_data = () => {
        
        return new Promise(async (r, rj) => {

            if (!this.collections) {
                console.log("No collections found");
                return;
            }

            // reset
            this.offset = 0;
            const buffer_array = [];
            const data = this.collections;

            buffer_array.push(this.#writeInt(data.version));
            buffer_array.push(this.#writeInt(data.beatmaps.length)); 

            for (let i = 0; i < data.length; i++) {
                    
                const collection = data.beatmaps[i];

                buffer_array.push(this.#writeString(collection.name));
                buffer_array.push(this.#writeInt(collection.maps.length));

                for (let i = 0; i < collection.maps.length; i++) {
                    const data = this.#writeString(collection.maps[i]);
                    buffer_array.push(data);
                }
            };

            this.buffer = Buffer.concat(buffer_array);

            r(this.buffer);
        });
    };

    get_osu_data = (limit) => {

        return new Promise(async (r, rj) => {

            const beatmaps = [];

            const version = this.#readInt();
            const folders = this.#readInt();
            const account_unlocked = this.#readBool();

            // skip date_time cuz why not
            this.#Skip(8);

            const player_name = this.#readString();
            const beatmaps_count = this.#readInt();

            const modes = {
                "1": "osu!",
                "2": "taiko",
                "3": "ctb",
                "4": "mania",
            };

            for (let i = 0; i < beatmaps_count; i++) {

                const data = {
                    entry: version < 20191106 ? this.#readInt() : 0,
                    artist_name: this.#readString(),
                    artist_name_unicode: this.#readString(),
                    song_title: this.#readString(),
                    song_title_unicode: this.#readString(),
                    creator_name: this.#readString(),
                    difficulty: this.#readString(),
                    audio_file_name: this.#readString(),
                    md5: this.#readString(),
                    file: this.#readString(),
                    status: this.#readByte(),
                    hitcircle: this.#readShort(),
                    sliders: this.#readShort(),
                    spinners: this.#readShort(),
                    last_modification: this.#readLong(),
                    approach_rate: version < 20140609 ? this.#readByte() : this.#readSingle(),
                    circle_size: version < 20140609 ? this.#readByte() : this.#readSingle(),
                    hp: version < 20140609 ? this.#readByte() : this.#readSingle(),
                    od: version < 20140609 ? this.#readByte() : this.#readSingle(),
                    slider_velocity: this.#readDouble(),
                    sr: [],
                    timing_points: [],
                };

                for (let i = 0; i < 4; i++) {

                    const length = this.#readInt();
                    const diffs = [];

                    for (let i = 0; i < length; i++) {
                        this.#readByte();
                        const mod = this.#readInt();
                        this.#readByte();
                        const diff = this.#readDouble();
                        
                        diffs.push({ mod, diff });
                    }

                    data.sr.push({
                        mode: modes[i + 1],
                        sr: diffs,
                    });
                }

                data.drain_time = this.#readInt();
                data.total_time = this.#readInt();
                data.audio_preview = this.#readInt();

                const timing_points = this.#readInt();
                
                for (let i = 0; i < timing_points; i++) {

                    const bpm = this.#readDouble();
                    const offset = this.#readDouble();
                    const idk_bool = this.#readBool();

                    if (data.timing_points.length < 6) {
                        if (data.timing_points.length == 6) {
                            data.timing_points.push(["..."]);
                        } else {
                            data.timing_points.push({ bpm, offset, idk_bool });
                        }
                    }
                } 

                data.difficulty_id = this.#readInt();
                data.beatmap_id = this.#readInt();
                data.thread_id = this.#readInt();
                data.grade_standard = this.#readByte();
                data.grade_taiko = this.#readByte();
                data.grade_ctb = this.#readByte();
                data.grade_mania = this.#readByte();
                data.local_offset = this.#readShort();
                data.stack_leniency = this.#readSingle();
                data.mode = this.#readByte();
                data.source = this.#readString();
                data.tags = this.#readString();
                data.online_offset = this.#readShort();
                data.font = this.#readString();
                data.unplayed = this.#readBool();
                data.last_played = this.#readLong();
                data.is_osz2 = this.#readBool();
                data.folder_name = this.#readString();
                data.last_checked = this.#readLong();
                data.ignore_sounds = this.#readBool();
                data.ignore_skin = this.#readBool();
                data.disable_storyboard = this.#readBool();
                data.disable_video = this.#readBool();
                data.visual_override = this.#readBool();

                if (version < 20140609) {
                    data.unknown = this.#readShort();
                }

                data.last_modified = this.#readInt();	
                data.mania_scroll_speed = this.#readByte();

                beatmaps.push(data);
            }

            if (limit) {
                beatmaps.slice(0, limit);
            }

            const permissions_id = this.#readInt();
            let permission = "";

            switch (permissions_id) {
                case 0:
                    permission = "None"
                    break;
                case 1: 
                    permission = "Normal"
                    break;
                case 2: 
                    permission = "Moderator"
                    break;
                case 4:
                    permission = "Supporter"
                    break;
                case 8: 
                    permission = "Friend"
                    break;
                case 16:
                    permission = "Peppy"
                    break;
                case 32:
                    permission = "World Cup Staff"
                    break;
            }

            this.offset = 0;
            this.osu = { version, folders, account_unlocked, player_name, beatmaps_count, beatmaps, permissions_id, permission };

            r(this.osu);
        });
    };

    get_collections_data = (limit) => {

        return new Promise(async (r, rj) => {

            const beatmaps = [];

            const version = this.#readInt();
            const count = this.#readInt();

            for (let i = 0; i < count; i++) {

                const name = this.#readString();
                const bm_count = this.#readInt();
                
                const md5 = await this.#getMD5(bm_count);

                beatmaps.push({
                    name: name,
                    maps: [...md5],
                }); 
            }

            if (limit) {
                beatmaps.slice(0, limit);
            }

            this.offset = 0;
            this.collections = { version, length: count, beatmaps };

            r(this.collections);
        });
    };

    initialize = async () => {

        if (this.type != "" && this.type != "osu" && this.type != "collection") {
            return console.log("Invalid type");
        }

        if (!this.buffer && !this.type) {

            const type = Number(prompt("osu! or collection? ( 1 - 2 ): "));
            if (!type || isNaN(type)) {
                return console.log("Invalid type");
            }

            this.type = type == 1 ? "osu" : "collection";

            if (!this.buffer) {
                
                const file_path = prompt("Osu path: ");
                if (!file_path) {
                    return console.log("Invalid path");
                }

                const file = fs.readFileSync(path.join(file_path, this.type == "osu" ? "osu!.db" : "collection.db"));
                this.buffer = Buffer.from(file);
            }
        }

        const limit = Number(prompt("Beatmap Limit: ")) || null;
        
        if (this.type == "osu") { 
            this.osu = await this.get_osu_data(limit);
            return;
        }
        
        if (this.type == "collection") {
            this.collections = await this.get_collections_data(limit);
            return;
        }

        return { error: "Something went wrong" };
    };
};