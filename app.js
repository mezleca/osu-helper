import fs from "fs";
import path from "path";

class OsuReader {

    constructor(buffer, type) {
        this.buffer = Buffer.from(buffer);
        this.type = type;
        this.offset = 0;
    }

    readByte(){
        const value = this.buffer.readUint8(this.offset);
        this.offset += 1;
        this.updateBuffer();
        return value;
    }

    readShort(){
        const value = this.buffer.readUint16LE(this.offset);
        this.offset += 2;
        this.updateBuffer();
        return value;
    }

    readInt(){
        const value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        this.updateBuffer();
        return value;
    }

    readLong(){
        const value = Number(this.buffer.readBigInt64LE(this.offset));
        this.offset += 8;
        this.updateBuffer();
        return value;
    }

    readULEB128() {
        let result = 0;
        let shift = 0;
    
        do {
            const byte = this.buffer.readUInt8(this.offset);
            result |= (byte & 0x7F) << shift;
            shift += 7;
            this.offset += 1;
        } while (this.buffer.readUInt8(this.offset - 1) & 0x80);
    
        this.updateBuffer();
        return { value: result, bytesRead: this.offset };
    }

    readSingle(){
        const value = this.buffer.readFloatLE(this.offset);
        this.offset += 4;
        this.updateBuffer();
        return value;
    }

    readDouble(){
        const value = this.buffer.readDoubleLE(this.offset);
        this.offset += 8;
        this.updateBuffer();
        return value;
    }

    readBool(){
        const value = this.readByte() == 0x00 ? false : true;
        this.updateBuffer();
        return value;
    }

    readString(){
        const is_present = this.readByte() == 0x00 ? false : true;

        if (!is_present) {
            return null;
        }

        const length = this.readULEB128();
        const value =  this.buffer.toString('utf-8', this.offset, length.value);
        this.offset += length.value;
        this.updateBuffer();

        return value;
    }

    Skip(b) {
        this.offset += b;
        this.updateBuffer();
    }

    updateBuffer() {
        this.buffer = this.buffer.slice(this.offset);
        this.offset = 0;
    }

    getMD5(count){
        return new Promise(async (r, rj) => {

            const md5 = [];

            for (let i = 0; i < count; i++) {
                const map = this.readString().value;
                md5.push(map);
            }

            r(md5);
        });
    }

    TicksToTime(ticks) {
       // TODO
    }

    initialize = async () => {

        if (this.type == "collection") {

            const beatmaps = [];

            const version = this.readInt();
            const count = this.readInt();

            for (let i = 0; i < count; i++) {

                const name = this.readString().value;
                const bm_count = this.readInt();
                
                const md5 = await this.getMD5(bm_count);

                beatmaps.push({
                    name: name,
                    maps: [...md5],
                });
            }

            return beatmaps;
        }

        if (this.type == "osu") {

            const beatmaps = [];

            const version = this.readInt();
            const folders = this.readInt();
            const account_unlocked = this.readBool();

            // skip date_time cuz why not
            this.Skip(8);

            const player_name = this.readString().value;
            const beatmaps_count = this.readInt();

            const modes = {
                "1": "osu!",
                "2": "taiko",
                "3": "ctb",
                "4": "mania",
            };

            for (let i = 0; i < beatmaps_count; i++) {

                const data = {
                    entry: version < 20191106 ? this.readInt() : 0,
                    artist_name: this.readString(),
                    artist_name_unicode: this.readString(),
                    song_title: this.readString(),
                    song_title_unicode: this.readString(),
                    creator_name: this.readString(),
                    difficulty: this.readString(),
                    audio_file_name: this.readString(),
                    md5: this.readString(),
                    file: this.readString(),
                    status: this.readByte(),
                    hitcircle: this.readShort(),
                    sliders: this.readShort(),
                    spinners: this.readShort(),
                    last_modification: this.readLong(),
                    approach_rate: version < 20140609 ? this.readByte() : this.readSingle(),
                    circle_size: version < 20140609 ? this.readByte() : this.readSingle(),
                    hp: version < 20140609 ? this.readByte() : this.readSingle(),
                    od: version < 20140609 ? this.readByte() : this.readSingle(),
                    slider_velocity: this.readDouble(),
                    sr: [],
                    timing_points: [],
                };

                for (let i = 0; i < 4; i++) {

                    const length = this.readInt();
                    const diffs = [];

                    for (let i = 0; i < length; i++) {
                        this.readByte();
                        const mod = this.readInt();
                        this.readByte();
                        const diff = this.readDouble();
                        
                        diffs.push({ mod, diff });
                    }

                    data.sr.push(diffs);
                }

                data.drain_time = this.readInt();
                data.total_time = this.readInt();
                data.audio_preview = this.readInt();

                const timing_points = this.readInt();
                
                for (let i = 0; i < timing_points; i++) {

                    const bpm = this.readDouble();
                    const offset = this.readDouble();
                    const idk_bool = this.readBool();

                    data.timing_points.push([
                        bpm,
                        offset,
                        idk_bool
                    ]);
                } 

                data.difficulty_id = this.readInt();
                data.beatmap_id = this.readInt();
                data.thread_id = this.readInt();
                data.grade_standard = this.readByte();
                data.grade_taiko = this.readByte();
                data.grade_ctb = this.readByte();
                data.grade_mania = this.readByte();
                data.local_offset = this.readShort();
                data.stack_leniency = this.readSingle();
                data.mode = this.readByte();
                data.source = this.readString();
                data.tags = this.readString();
                data.online_offset = this.readShort();
                data.font = this.readString();
                data.unplayed = this.readBool();
                data.last_played = this.readLong();
                data.is_osz2 = this.readBool();
                data.folder_name = this.readString();
                data.last_checked = this.readLong();
                data.ignore_sounds = this.readBool();
                data.ignore_skin = this.readBool();
                data.disable_storyboard = this.readBool();
                data.disable_video = this.readBool();
                data.visual_override = this.readBool();

                if (version < 20140609) {
                    data.unknown = this.readShort();
                }

                data.last_modified = this.readInt();	
                data.mania_scroll_speed = this.readByte();

                beatmaps.push(data);
            }

            const permissions_id = this.readInt();
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

            return { version, folders, account_unlocked, player_name, beatmaps_count, beatmaps, permissions_id, permission };
        }

        return { error: "invalid type" };
    }
};

const Reader = new OsuReader(fs.readFileSync("./osu!.db"), "osu");
const data = await Reader.initialize();

if (fs.existsSync("./data.json")) {
    fs.writeFileSync("data.json", JSON.stringify({ ...data, type: Reader.type }, null, 2));
} else {
    fs.appendFileSync("data.json", JSON.stringify({ ...data, type: Reader.type }, null, 2));
}