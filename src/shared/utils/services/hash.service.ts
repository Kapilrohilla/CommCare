import bcrypt from 'bcrypt';

export class HashService {
    public static async hash(data: string): Promise<string> {
        return await bcrypt.hash(data, 10);
    }

    public static async compare(data: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(data, hash);
    }
}