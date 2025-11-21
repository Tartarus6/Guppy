import { env } from '$env/dynamic/private';

export function validateCredentials(username: string, password: string): boolean {
    return username === env.AUTH_USERNAME && password === env.AUTH_PASSWORD;
}