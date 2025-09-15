import { useCallback, useEffect, useMemo, useState } from 'react';

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

function clearHash(){
  history.replaceState({}, document.title, `${location.pathname}${location.search}`);
}

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const profile: Profile | null = useMemo(() => user ? getUserProfile(user) : null, [user]);

  const login = useCallback(() => {
    const ssoUrl = HUB_URL.replace(/\/$/, ''); // Remover slash final si existe
    const targetUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${ssoUrl}/?target=${targetUrl}`;
  }, []);

  const logout = useCallback(async () => {
    // Limpiar datos locales
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
        if (access_token) {
          console.log('🔄 Procesando tokens del Hub SSO...');
          
          // Decodificar el JWT para obtener información del usuario
          try {
            const payload = JSON.parse(atob(access_token.split('.')[1]));
            console.log('📋 Payload del JWT:', payload);
            
            // Crear un objeto de usuario a partir del JWT
            const hubUser = {
              id: payload.sub,
              email: payload.email,
              user_metadata: {
                name: payload.user_metadata?.full_name || payload.user_metadata?.name || payload.email?.split('@')[0],
                full_name: payload.user_metadata?.full_name,
                email: payload.email,
                picture: payload.user_metadata?.picture || payload.user_metadata?.avatar_url,
                preferred_username: payload.user_metadata?.preferred_username
              },
              app_metadata: payload.app_metadata || {}
            };
            
            // Guardar tokens y usuario en localStorage para persistencia
            localStorage.setItem('sso_access_token', access_token);
            if (refresh_token) {
              localStorage.setItem('sso_refresh_token', refresh_token);
            }
            localStorage.setItem('sso_user', JSON.stringify(hubUser));
            
            setUser(hubUser);
            clearHash();
            console.log('✅ Usuario establecido desde tokens del Hub');
            
          } catch (decodeError) {
            console.error('❌ Error decodificando JWT:', decodeError);
            throw new Error('Token JWT inválido');
          }
        } else {
          // Verificar si hay tokens guardados en localStorage
          const savedToken = localStorage.getItem('sso_access_token');
          const savedUser = localStorage.getItem('sso_user');
          
          if (savedToken && savedUser) {
            try {
              const parsedUser = JSON.parse(savedUser);
              setUser(parsedUser);
              console.log('✅ Usuario restaurado desde localStorage');
            } catch {
              // Limpiar datos corruptos
              localStorage.removeItem('sso_access_token');
              localStorage.removeItem('sso_refresh_token');
              localStorage.removeItem('sso_user');
            }
          } else {
            console.log('ℹ️ No hay tokens ni sesión guardada');
          }
        }
      } catch(e: any) {
        console.error('❌ Error procesando tokens:', e);
        setError(`Error de autenticación: ${e?.message || String(e)}`);
        // Limpiar datos en caso de error
        localStorage.removeItem('sso_access_token');
        localStorage.removeItem('sso_refresh_token');
        localStorage.removeItem('sso_user');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
