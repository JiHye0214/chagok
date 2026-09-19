import { betterAuth } from "better-auth";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
    database: pool,

    user: {
        modelName: "users",
        fields: {
            name: "name",
            email: "email",
            emailVerified: "email_verified",
            image: "image",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },

    advanced: {
        database: {
            generateId: "uuid",
        },
    },

    emailAndPassword: {
        enabled: true,
    },
});
