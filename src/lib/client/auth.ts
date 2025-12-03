import { trpc, handleTRPCError } from '.';

class AuthService {
    private readonly SESSION_COOKIE = 'guppy_session';
    
    async login(username: string, password: string): Promise<boolean> {
        try {
            const sessionToken = await trpc.validateCredentials.query({ username, password });

            if (sessionToken) {
                // Store session in a secure cookie
                this.setSessionCookie(sessionToken);
                return true;
            } else {
                console.log('Invalid credentials');
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    async logout() {
        try {
            // Call server to destroy session
            await trpc.logout.mutate();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Always remove the session cookie
            document.cookie = `${this.SESSION_COOKIE}=; max-age=0; path=/; SameSite=Strict`;
        }
    }

    getSession(): string | null {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === this.SESSION_COOKIE) {
                return value;
            }
        }
        return null;
    }

    isAuthenticated(): boolean {
        return this.getSession() !== null;
    }

    private setSessionCookie(token: string) {
        // Set cookie with security flags
        // For production, add 'Secure' flag when using HTTPS
        const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
        document.cookie = `${this.SESSION_COOKIE}=${token}; max-age=${maxAge}; path=/; SameSite=Strict`;
    }
}

export const authService = new AuthService();