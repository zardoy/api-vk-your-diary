import * as crypto from "crypto";
import * as dotenv from "dotenv";
import { schema, settings, use } from "nexus";
import { prisma } from "nexus-plugin-prisma";
import * as path from "path";

dotenv.config({
    path: path.resolve(__dirname, "../prisma/.env")
});

if (!process.env.VK_SECRET_KEY) throw new TypeError(`Environment variable VK_SECRET_KEY is not provided.`);
if (!process.env.VK_SERVICE_TOKEN) throw new Error("Env variable VK_SERVICE_TOKEN is not defined.");
if (process.env.NEXUS_STAGE === "production" && process.env.CORS_FRONTEND_DOMAIN)
    throw new TypeError(`Environment variable CORS_FRONTEND_DOMAIN is not provided in prod.`);

settings.change({
    schema: {
        nullable: {
            inputs: false,
            outputs: false
        }
    },
    server: process.env.NEXUS_STAGE === "production" ? {
        cors: {
            origin: process.env.CORS_FRONTEND_DOMAIN,
            allowedHeaders: "authorization"
        }
    } : undefined
});


schema.addToContext(({ req }) => {
    //todo not safe
    if (process.env.NEXUS_STAGE === "test" || process.env.NEXUS_STAGE === "dev") {
        return {
            userId: process.env.TEST_USER_ID || "35039"
        };
    };

    if (!req.headers.authorization) throw new TypeError(`Authorization header must be defined in production!`);

    const vkParams = new URLSearchParams(req.headers.authorization);

    const SIGN_SECRET_URL_PARAM = vkParams.get("sign");
    vkParams.forEach((_paramValue, paramKey) => {
        if (!paramKey.startsWith("vk_")) vkParams.delete(paramKey);
    });
    vkParams.sort();

    const paramsHash = crypto
        .createHmac("sha256", process.env.VK_SECRET_KEY!)
        .update(vkParams.toString())
        .digest()
        .toString("base64")
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=$/, "");

    if (paramsHash !== SIGN_SECRET_URL_PARAM) throw new TypeError(`Wrong sign param.`);

    const userId = +vkParams.get("user_id")!;
    if (!isFinite(userId)) throw new TypeError(`user_id param is not a number: ${userId}`);

    return {
        userId: userId.toString()
    };
});

use(
    prisma()
);