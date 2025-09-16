# Mini App SSO Demo

Demo de integración con Hub SSO usando React + TypeScript + Vite.

## 🚀 Características

- ✅ Autenticación SSO con Hub SSO
- ✅ Manejo de tokens JWT
- ✅ Persistencia de sesión en localStorage
- ✅ Logout completo con limpieza de tokens
- ✅ Interfaz moderna y responsive

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_HUB_URL=https://sso-dev.jeivian.com/
```

### Instalación

```bash
npm install
npm run dev
```

## 🔐 Flujo de Autenticación SSO

### 1. Proceso de Login

**Paso 1: Redirección al Hub SSO**
```javascript
const login = () => {
  const ssoUrl = HUB_URL.replace(/\/$/, '');
  const targetUrl = encodeURIComponent(window.location.origin);
  window.location.href = `${ssoUrl}/?target=${targetUrl}`;
};
```

**Paso 2: El Hub SSO procesa la autenticación**
- El usuario ingresa sus credenciales en el Hub SSO
- El Hub SSO valida las credenciales
- Si es exitoso, redirige de vuelta a la aplicación

**Paso 3: Recepción de tokens**
```javascript
// Los tokens llegan en el hash de la URL
// Ejemplo: https://tu-app.com/#access_token=xxx&refresh_token=yyy

function handleSSOReturn() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  
  return { access_token, refresh_token };
}
```

### 2. Procesamiento de Tokens

**Decodificación del JWT:**
```javascript
// El access_token es un JWT que contiene información del usuario
const payload = JSON.parse(atob(access_token.split('.')[1]));

// Estructura típica del payload:
{
  sub: "user-id",
  email: "usuario@ejemplo.com",
  user_metadata: {
    name: "Nombre Usuario",
    full_name: "Nombre Completo",
    picture: "https://avatar-url.com/image.jpg",
    preferred_username: "usuario"
  },
  app_metadata: {},
  exp: 1234567890,
  iat: 1234567890
}
```

**Creación del objeto usuario:**
```javascript
const hubUser = {
  id: payload.sub,
  email: payload.email,
  user_metadata: {
    name: payload.user_metadata?.full_name || payload.user_metadata?.name,
    full_name: payload.user_metadata?.full_name,
    email: payload.email,
    picture: payload.user_metadata?.picture,
    preferred_username: payload.user_metadata?.preferred_username
  },
  app_metadata: payload.app_metadata || {}
};
```

### 3. Almacenamiento de Tokens

Los tokens se guardan en `localStorage` para persistencia:

```javascript
// Guardar tokens
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);
localStorage.setItem('sso_user', JSON.stringify(hubUser));
```

**Estructura de almacenamiento:**
- `access_token`: JWT con información del usuario y permisos
- `refresh_token`: Token para renovar el access_token cuando expire
- `sso_user`: Objeto completo del usuario parseado del JWT

### 4. Restauración de Sesión

Al cargar la aplicación, se verifica si hay una sesión guardada:

```javascript
useEffect(() => {
  // 1. Verificar si hay tokens en la URL (nuevo login)
  const { access_token, refresh_token } = handleSSOReturn();
  
  if (access_token) {
    // Procesar nuevo login
    processTokens(access_token, refresh_token);
  } else {
    // 2. Verificar tokens guardados en localStorage
    const savedToken = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('sso_user');
    
    if (savedToken && savedUser) {
      // Restaurar sesión existente
      setUser(JSON.parse(savedUser));
    }
  }
}, []);
```

## 🚪 Proceso de Logout

### 1. Limpieza Local

```javascript
const logout = async () => {
  // 1. Limpiar estado de la aplicación
  setUser(null);
  
  // 2. Limpiar todos los tokens del localStorage
  localStorage.clear();
  
  // 3. Redirigir al Hub SSO para logout completo
  const ssoUrl = HUB_URL.replace(/\/$/, '');
  const targetUrl = encodeURIComponent(window.location.origin);
  window.location.href = `${ssoUrl}/?logout=true&target=${targetUrl}`;
};
```

### 2. Logout Completo en el Hub

**¿Por qué redirigir al Hub SSO?**
- Invalida la sesión en el servidor del Hub SSO
- Limpia cookies de sesión del Hub
- Cierra sesión en todas las aplicaciones conectadas (Single Sign-Out)
- Redirige de vuelta a la aplicación ya deslogueado

**Parámetros del logout:**
- `logout=true`: Indica al Hub que debe procesar un logout
- `target=${targetUrl}`: URL de retorno después del logout

## 🔄 Manejo de Errores

La aplicación maneja varios tipos de errores:

```javascript
try {
  // Procesar tokens
} catch (error) {
  console.error('Error procesando tokens:', error);
  
  // Limpiar datos corruptos
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('sso_user');
  
  setError(`Error de autenticación: ${error.message}`);
}
```

**Tipos de errores comunes:**
- JWT malformado o inválido
- Tokens expirados
- Datos corruptos en localStorage
- Problemas de conectividad con el Hub SSO

## 🛠️ Desarrollo

### Estructura del Proyecto

```
src/
├── App.tsx          # Componente principal con lógica SSO
├── main.tsx         # Punto de entrada
├── index.css        # Estilos globales
└── vite-env.d.ts    # Tipos de TypeScript
```

### Scripts Disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # Linting con ESLint
```

### Tecnologías Utilizadas

- **React 18** - Biblioteca de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **ESLint** - Linting de código

## 🔒 Seguridad

### Buenas Prácticas Implementadas

1. **Validación de JWT**: Se verifica la estructura del token antes de usarlo
2. **Limpieza de URL**: Se remueve el hash con tokens después de procesarlos
3. **Manejo de errores**: Limpieza automática de datos corruptos
4. **Logout completo**: Invalidación en el servidor del Hub SSO

### Consideraciones de Seguridad

- Los tokens se almacenan en `localStorage` (considera `httpOnly cookies` para mayor seguridad en producción)
- Implementa renovación automática de tokens cuando sea necesario
- Valida siempre la expiración de los tokens
- Usa HTTPS en producción

## 📚 Documentación Adicional

Para más información sobre la integración con Hub SSO, consulta la documentación oficial del Hub SSO de tu organización.