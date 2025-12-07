import envProps from '$lib/server/envProps';

export function validateCredentials(username: string, password: string): boolean {
    return username === envProps.AUTH_USERNAME && password === envProps.AUTH_PASSWORD;
}