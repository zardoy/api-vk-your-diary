import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";
//@ts-ignore
import * as pgtools from "pgtools";

dotenv.config({
    path: path.resolve(__dirname, "../prisma/.env")
});

(async () => {
    if (!process.env.DATABASE_URL)
        throw new TypeError(`DATABASE_URL env is not defined! Please check .env file in prisma folder!`);
    const DBConfigFromURL =
        process.env.DATABASE_URL.match(/(?<user>[^:]+):(?<password>[^@]+)@(?<host>[^:]+):(?<port>\d+)\/(?<database>.+)/);
    if (!DBConfigFromURL) throw new TypeError("DATABASE_URL env seems to be not a db url");
    const { database: DATABASE_NAME, ...dbConfig } =
        DBConfigFromURL.groups! as unknown as { [param: string]: string; } & { port: number; };

    dbConfig.port = +dbConfig.port;

    console.log(`Reseting db...`);
    // DROP DB START
    try {
        await pgtools.dropdb(dbConfig, DATABASE_NAME);
    } catch (err) {
        if (!(err instanceof Error)) throw err;
        if (!/Cause: database "[A-z0-9]+" does not exist/i.test(err.message)) throw err;
    }
    // DROP DB END
    await pgtools.createdb(dbConfig, DATABASE_NAME);

    const pgClient = new Client({
        ...dbConfig,
        database: DATABASE_NAME
    });
    await pgClient.connect();
    await pgClient.query(
        (await fs.promises.readFile(
            path.join(__dirname, "../schema.sql")
        )).toString()
    );
    await pgClient.end();
})();