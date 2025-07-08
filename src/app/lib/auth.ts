import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export async function hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
}

export function generateToken(email: string) {
    return jwt.sign({ email }, JWT_SECRET, { expiresIn: '2h' });
}

export function verifyToken(token: string) {
    return jwt.verify(token, JWT_SECRET);
}
