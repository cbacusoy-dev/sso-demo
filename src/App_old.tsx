import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

// Configuración del Hub SSO según documentación oficial
const HUB_URL = import.meta.env.VITE_HUB_URL || 'https://sso-dev.jeivian.com/';

type Profile = { name?: string; email?: string; picture?: string };

function getUserProfile(user: any): Profile {
    const meta = user?.user_metadata || {};
    const full = meta.name || meta.full_name || meta.preferred_username || '';
    const email = user?.email || '';
    const name = full || (email ? email.split('@')[0] : 'Usuario');
    const picture = meta.avatar_url || meta.picture || '';
    return { name, email, picture };
}

function parseHashTokens(): { access_token?: string; refresh_token?: string } {
    const h = (location.hash || '').replace(/^#/, '');
    const p = new URLSearchParams(h);
    const tokens = {
        access_token: p.get('access_token') || undefined,
        refresh_token: p.get('refresh_token') || undefined,
    };

    if (tokens.access_token || tokens.refresh_token) {
        console.log('🔍 Tokens recibidos del Hub SSO:', {
            access_token: tokens.access_token ? `${tokens.access_token.substring(0, 20)}...` : 'no',
            refresh_token: tokens.refresh_token ? `${tokens.refresh_token.substring(0, 20)}...` : 'no',
            url: window.location.href
        });
    }

    return tokens;
}

function clearHash() {
    history.replaceState({}, document.title, `${location.pathname}${location.search}`);
}

function App() {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const profile: Profile | null = useMemo(() => user ? getUserProfile(user) : null, [user]);

    const fetchUser = useCallback(async () => {
        const { data } = await supabase.auth.getUser();
        setUser(data.user ?? null);
    }, []);

    const login = useCallback(() => {
        const ssoUrl = HUB_URL.replace(/\/$/, ''); // Remover slash final si existe
        const targetUrl = encodeURIComponent(window.location.origin);
        window.location.href = `${ssoUrl}/?target=${targetUrl}`;
    }, []);

    const logout = useCallback(async () => {
        // Limpiar sesión local de Supabase
        await supabase.auth.signOut();
        setUser(null);

        // Limpiar tokens locales como recomienda la documentación
        localStorage.clear();

        // Redirigir al Hub SSO para logout completo
        const ssoUrl = HUB_URL.replace(/\/$/, ''); // Remover slash final si existe
        const targetUrl = encodeURIComponent(window.location.origin);
        window.location.href = `${ssoUrl}/?logout=true&target=${targetUrl}`;
    }, []);

    useEffect(() => {
        const { access_token, refresh_token } = parseHashTokens();
        (async () => {
            try {
                if (refresh_token) {
                    console.log('🔄 Estableciendo sesión con tokens del Hub...');

                    // Primero intentar con ambos tokens si están disponibles
                    if (access_token) {
                        try {
                            const { error } = await supabase.auth.setSession({
                                access_token,
                                refresh_token
                            });
                            if (!error) {
                                clearHash();
                                console.log('✅ Sesión establecida con ambos tokens');
                                return;
                            }
                            console.warn('⚠️ Error con setSession, intentando con refresh_token:', error.message);
                        } catch (setSessionError: any) {
                            console.warn('⚠️ setSession falló, intentando refresh:', setSessionError.message);
                        }
                    }

                    // Si setSession falla o solo tenemos refresh_token, usar refreshSession
                    console.log('🔄 Usando refresh_token para establecer sesión...');
                    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
                    if (error) throw error;

                    clearHash();
                    console.log('✅ Sesión establecida con refresh_token');
                } else {
                    console.log('ℹ️ No hay tokens en el hash, verificando sesión existente...');
                }
            } catch (e: any) {
                console.error('❌ Error estableciendo sesión:', e);
                // Solo mostrar error si es algo diferente al problema de session_id
                if (!e?.message?.includes('Session from session_id claim in JWT does not exist')) {
                    setError(`Error de autenticación: ${e?.message || String(e)}`);
                } else {
                    console.log('ℹ️ Error de session_id ignorado - problema conocido del Hub SSO');
                }
                // Limpiar cualquier sesión corrupta
                await supabase.auth.signOut();
            } finally {
                setLoading(false);
                fetchUser();
            }
        })();
    }, [fetchUser]);

    useEffect(() => {
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            console.log(`🔄 Auth event: ${event}`, session?.user?.email || 'no user');

            if (event === 'SIGNED_OUT') {
                setUser(null);
                setError(''); // Limpiar errores al cerrar sesión
            } else if (event === 'SIGNED_IN') {
                setError(''); // Limpiar errores al iniciar sesión
                fetchUser();
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('✅ Token refreshed successfully');
                setError(''); // Limpiar errores tras refresh exitoso
                fetchUser();
            }
        });
        return () => { sub.subscription.unsubscribe(); };
    }, [fetchUser]);

    if (loading) {
        return (
            <div className="app">
                <div className="loading">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="header">
                <div className="brand">
                    <h1>Mini App SSO</h1>
                    <span className="badge">Vite + React + TS</span>
                </div>
                <div className="auth-section">
                    {!user && (
                        <button onClick={login} className="btn btn-primary">
                            Login
                        </button>
                    )}
                    {user && (
                        <div className="user-info">
                            <div className="user-details">
                                <div className="user-name">{profile?.name}</div>
                                <div className="user-email">{profile?.email}</div>
                            </div>
                            {profile?.picture && (
                                <img src={profile.picture} alt="Avatar" className="avatar" />
                            )}
                            {!profile?.picture && (
                                <div className="avatar-placeholder">
                                    {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                            )}
                            <button onClick={logout} className="btn btn-secondary">
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="main">
                {!user && (
                    <div className="welcome">
                        <h2>Bienvenido</h2>
                        <p>Esta es una demo de integración con Hub SSO usando Vite + React + TypeScript.</p>
                        <p>Presiona <strong>Login</strong> para autenticarte.</p>
                    </div>
                )}

                {user && (
                    <div className="dashboard">
                        <h2>¡Hola, {profile?.name}!</h2>
                        <p>Has iniciado sesión exitosamente usando el Hub SSO.</p>
                        <div className="user-card">
                            <h3>Información del usuario</h3>
                            <p><strong>Nombre:</strong> {profile?.name}</p>
                            <p><strong>Email:</strong> {profile?.email}</p>
                            <p><strong>ID:</strong> {user.id}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="error">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Error</h3>
                            <button
                                onClick={() => setError('')}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                                Cerrar
                            </button>
                        </div>
                        <pre>{error}</pre>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            💡 Si ya estás logueado, este error puede ignorarse. Es un problema menor de refresh de tokens.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
