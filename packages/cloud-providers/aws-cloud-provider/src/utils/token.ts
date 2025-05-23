import jwt from "jsonwebtoken";

export function decode(token: string) {
    return jwt.decode(token);
}