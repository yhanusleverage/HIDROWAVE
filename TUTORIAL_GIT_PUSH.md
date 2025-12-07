# 📚 TUTORIAL: Subir Cambios a GitHub

## 🎯 **OBJETIVO**
Subir los cambios del proyecto HIDROWAVE a GitHub, incluyendo la actualización de seguridad de Next.js.

---

## 📋 **PASOS PASO A PASO**

### **1. Abrir Terminal PowerShell**

Abre PowerShell en el directorio del proyecto:
```powershell
cd "c:\Users\THANUS\Documents\Projects\ESP-NEW_HOPE - FRONTEND - BACKUP\HIDROWAVE-main - copia"
```
git 
---

### **2. Verificar Estado Actual**

Ver qué archivos fueron modificados:
```powershell
git status
```

**Salida esperada:**
- Archivos modificados (en rojo o con `M`)
- Archivos nuevos (en verde o con `??`)

---

### **3. Agregar Archivos al Staging**

Agregar todos los archivos modificados:
```powershell
git add .
```

**O agregar archivos específicos:**
```powershell
git add package.json package-lock.json
git add STATUS_PROJETO_COMPLETO.md
git add scripts/
```

---

### **4. Verificar lo que se va a Commitear**

Ver qué archivos están en staging:
```powershell
git status
```

**Salida esperada:**
- Archivos en verde (listos para commit)

---

### **5. Crear Commit**

Crear un commit con un mensaje descriptivo:
```powershell
git commit -m "🔒 Security: Actualizar Next.js a 15.5.7 para corregir CVE-2025-66478"
```

**O con un mensaje más detallado:**
```powershell
git commit -m "🔒 Security: Actualizar Next.js a 15.5.7 para corregir CVE-2025-66478

- Actualizado Next.js de 16.0.7 a 15.5.7 (versión parcheada)
- Actualizado eslint-config-next a 15.5.7
- Corregida vulnerabilidad CVE-2025-66478
- Mejoras en documentación del proyecto"
```

---

### **6. Verificar el Repositorio Remoto**

Verificar que el remote está configurado:
```powershell
git remote -v
```

**Salida esperada:**
```
origin  https://github.com/yhanusleverage/HIDROWAVE.git (fetch)
origin  https://github.com/yhanusleverage/HIDROWAVE.git (push)
```

**Si no está configurado, agregarlo:**
```powershell
git remote add origin https://github.com/yhanusleverage/HIDROWAVE.git
```

---

### **7. Verificar la Rama Actual**

Ver en qué rama estás:
```powershell
git branch
```

**Asegurarte de estar en `main`:**
```powershell
git branch -M main
```

---

### **8. Hacer Push a GitHub**

Subir los cambios al repositorio remoto:
```powershell
git push -u origin main
```

**Si es la primera vez, puede pedir autenticación:**
- Usuario: `yhanusleverage`
- Contraseña: Usa un **Personal Access Token** (no tu contraseña de GitHub)

---

## 🔐 **AUTENTICACIÓN EN GITHUB**

### **Opción 1: Personal Access Token (Recomendado)**

1. Ve a GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click en **Generate new token (classic)**
3. Nombre: `HIDROWAVE-Push`
4. Permisos: Marca solo `repo`
5. Click en **Generate token**
6. **Copia el token** (solo se muestra una vez)
7. Cuando Git pida contraseña, **pega el token** (no tu contraseña)

### **Opción 2: Configurar Git Credential Manager**

```powershell
git config --global credential.helper manager-core
```

Esto guardará tus credenciales para futuros pushes.

---

## ✅ **VERIFICACIÓN POST-PUSH**

### **1. Verificar el Push**

Ver los últimos commits:
```powershell
git log --oneline -5
```

### **2. Verificar en GitHub**

1. Ve a: https://github.com/yhanusleverage/HIDROWAVE
2. Verifica que aparezcan tus commits
3. Verifica que los archivos estén actualizados

---

## 🚨 **SOLUCIÓN DE PROBLEMAS**

### **Error: "remote origin already exists"**

```powershell
git remote set-url origin https://github.com/yhanusleverage/HIDROWAVE.git
```

### **Error: "failed to push some refs"**

Si el repositorio remoto tiene cambios que no tienes localmente:

```powershell
# Primero hacer pull
git pull origin main --allow-unrelated-histories

# Resolver conflictos si los hay, luego:
git push origin main
```

### **Error: "authentication failed"**

1. Verifica que el token tenga permisos `repo`
2. Usa el token como contraseña (no tu contraseña de GitHub)
3. O configura SSH en lugar de HTTPS

---

## 📝 **COMANDOS RÁPIDOS (Copy & Paste)**

```powershell
# 1. Ir al directorio
cd "c:\Users\THANUS\Documents\Projects\ESP-NEW_HOPE - FRONTEND - BACKUP\HIDROWAVE-main - copia"

# 2. Ver estado
git status

# 3. Agregar archivos
git add .

# 4. Crear commit
git commit -m "🔒 Security: Actualizar Next.js a 15.5.7 para corregir CVE-2025-66478"

# 5. Verificar remote
git remote -v

# 6. Asegurar rama main
git branch -M main

# 7. Hacer push
git push -u origin main
```

---

## 🎯 **RESUMEN**

1. ✅ `git status` - Ver qué cambió
2. ✅ `git add .` - Agregar cambios
3. ✅ `git commit -m "mensaje"` - Crear commit
4. ✅ `git push origin main` - Subir a GitHub

---

## 📌 **NOTAS IMPORTANTES**

- ⚠️ **Nunca hagas push de archivos sensibles** (`.env`, passwords, etc.)
- ✅ **Siempre verifica** con `git status` antes de hacer commit
- ✅ **Usa mensajes descriptivos** en los commits
- ✅ **Haz push frecuentemente** para no perder trabajo

---

**¡Listo! Con estos pasos podrás subir tus cambios a GitHub sin problemas.** 🚀
