/**
 * auth.js
 * Client-side authentication logic for EziTom Portfolio.
 */

const AUTH_KEY = 'ezitom_admin_auth';
const SESSION_KEY = 'ezitom_session';

// Only this email is authorized to access the admin dashboard
const ADMIN_EMAIL = 'oniebenezer1@gmail.com';

const AuthManager = {
    /**
     * Helper to retrieve all cached accounts from localStorage (backward-compatible)
     */
    getAccounts() {
        const stored = localStorage.getItem(AUTH_KEY);
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            // Backward compatibility for single-account format
            if (parsed && typeof parsed === 'object' && parsed.email) {
                return [parsed];
            }
            return [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Helper to save accounts back to localStorage
     */
    saveAccounts(accounts) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(accounts));
    },

    /**
     * Synchronize registered accounts from Google Sheets
     */
    async syncAccountsFromServer() {
        const scriptUrl = window.CONFIG?.GOOGLE_SCRIPT_URL;
        if (!scriptUrl) {
            console.log('[dev.folio DEBUG] No GOOGLE_SCRIPT_URL configured. Sync disabled.');
            return;
        }

        try {
            console.log('[dev.folio DEBUG] Syncing accounts from Google Sheets...');
            const response = await fetch(scriptUrl + '?action=getAccounts');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const serverAccounts = await response.json();
            if (Array.isArray(serverAccounts)) {
                const localAccounts = this.getAccounts();
                let updated = false;

                serverAccounts.forEach(srvAcc => {
                    if (!srvAcc.email || !srvAcc.password) return;
                    
                    const emailNormalized = srvAcc.email.toLowerCase();
                    const localIndex = localAccounts.findIndex(locAcc => locAcc.email === emailNormalized);

                    if (localIndex === -1) {
                        // Register new server account locally
                        localAccounts.push({
                            email: emailNormalized,
                            password: srvAcc.password,
                            timestamp: srvAcc.timestamp || new Date().toISOString()
                        });
                        updated = true;
                    } else {
                        // Update local password if different from server
                        if (localAccounts[localIndex].password !== srvAcc.password) {
                            localAccounts[localIndex].password = srvAcc.password;
                            updated = true;
                        }
                    }
                });

                if (updated) {
                    this.saveAccounts(localAccounts);
                    console.log('[dev.folio DEBUG] Accounts synced successfully.');
                } else {
                    console.log('[dev.folio DEBUG] Accounts are already up-to-date.');
                }
            }
        } catch (e) {
            console.error('[dev.folio DEBUG] Error synchronizing accounts from server:', e);
        }
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const session = localStorage.getItem(SESSION_KEY);
        if (!session) return false;
        
        try {
            const data = JSON.parse(session);
            // Check if session is expired (e.g., 24 hours)
            const now = Date.now();
            if (now > data.expiry) {
                this.logout();
                return false;
            }
            // Only the authorized admin email can access the dashboard
            if (data.email.toLowerCase() !== ADMIN_EMAIL) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Signup a new user (Gmail only)
     */
    async signup(email, password) {
        const emailNormalized = email.toLowerCase().trim();
        if (!emailNormalized.endsWith('@gmail.com')) {
            return { success: false, message: 'Only Gmail addresses are allowed.' };
        }

        const accounts = this.getAccounts();
        if (accounts.some(acc => acc.email === emailNormalized)) {
            return { success: false, message: 'This email is already registered.' };
        }

        const newAccount = {
            email: emailNormalized,
            password: password,
            timestamp: new Date().toISOString()
        };

        accounts.push(newAccount);
        this.saveAccounts(accounts);

        // Sync registration to Google Sheets (Web App)
        const scriptUrl = window.CONFIG?.GOOGLE_SCRIPT_URL;
        if (scriptUrl) {
            try {
                await fetch(scriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'saveAccount',
                        account: newAccount
                    })
                });
                console.log('[dev.folio DEBUG] Signup synced to Google Sheets.');
            } catch (e) {
                console.error('[dev.folio DEBUG] Failed syncing signup to server:', e);
            }
        }

        return { success: true, message: 'Account created successfully!' };
    },

    /**
     * Login the user
     */
    login(email, password, rememberMe = false) {
        const emailNormalized = email.toLowerCase().trim();
        const accounts = this.getAccounts();
        
        if (accounts.length === 0) {
            return { success: false, message: 'No accounts found. Please sign up.' };
        }

        const auth = accounts.find(acc => acc.email === emailNormalized);
        if (!auth) {
            return { success: false, message: 'No account found with this email.' };
        }

        if (auth.password === password) {
            const expiry = rememberMe ? Date.now() + (30 * 24 * 60 * 60 * 1000) : Date.now() + (24 * 60 * 60 * 1000);
            localStorage.setItem(SESSION_KEY, JSON.stringify({ email: emailNormalized, expiry }));

            // Only the authorized admin email gets dashboard access
            if (emailNormalized === ADMIN_EMAIL) {
                return { success: true, isAdmin: true };
            } else {
                // Accept the login silently but flag as non-admin
                return { success: true, isAdmin: false };
            }
        }

        return { success: false, message: 'Invalid email or password.' };
    },

    /**
     * Reset password
     */
    async resetPassword(email, newPassword) {
        const emailNormalized = email.toLowerCase().trim();
        const accounts = this.getAccounts();
        const index = accounts.findIndex(acc => acc.email === emailNormalized);
        
        if (index === -1) {
            return { success: false, message: 'User not found.' };
        }

        accounts[index].password = newPassword;
        accounts[index].timestamp = new Date().toISOString();
        this.saveAccounts(accounts);

        // Sync update to Google Sheets
        const scriptUrl = window.CONFIG?.GOOGLE_SCRIPT_URL;
        if (scriptUrl) {
            try {
                await fetch(scriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'saveAccount',
                        account: accounts[index]
                    })
                });
                console.log('[dev.folio DEBUG] Password reset synced to Google Sheets.');
            } catch (e) {
                console.error('[dev.folio DEBUG] Failed syncing password reset to server:', e);
            }
        }

        return { success: true, message: 'Password updated successfully!' };
    },

    logout() {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = 'login.html';
    }
};

window.AuthManager = AuthManager;
