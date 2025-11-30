# Script para crear usuario administrador inicial

Este script te ayudará a crear un usuario administrador para probar el sistema.

## Usando cURL (Windows PowerShell):

```powershell
$body = @{
    correo = "admin@sistema.com"
    nombre = "Administrador"
    carrera = "Administración"
    rol = "administrador"
    contraseña = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/usuarios" -Method POST -Body $body -ContentType "application/json"
```

## Usando cURL (Command Line):

```bash
curl -X POST http://localhost:3000/usuarios -H "Content-Type: application/json" -d "{\"correo\":\"admin@sistema.com\",\"nombre\":\"Administrador\",\"carrera\":\"Administración\",\"rol\":\"administrador\",\"contraseña\":\"admin123\"}"
```

## Crear usuario docente:

```powershell
$body = @{
    correo = "docente@test.com"
    nombre = "Juan Pérez"
    carrera = "Ingeniería"
    rol = "docente"
    contraseña = "123456"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/usuarios" -Method POST -Body $body -ContentType "application/json"
```

## Crear usuario alumno:

```powershell
$body = @{
    correo = "alumno@test.com"
    nombre = "María García"
    carrera = "Sistemas"
    rol = "alumno"
    contraseña = "123456"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/usuarios" -Method POST -Body $body -ContentType "application/json"
```

## Probar login:

```powershell
# Login administrador
$credentials = @{
    correo = "admin@sistema.com"
    contraseña = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/auth/admin/login" -Method POST -Body $credentials -ContentType "application/json"
$token = $response.access_token
Write-Host "Token: $token"

# Obtener perfil con token
Invoke-RestMethod -Uri "http://localhost:3000/auth/profile" -Method GET -Headers @{Authorization="Bearer $token"}
```

## Listar usuarios (requiere autenticación):

```powershell
# Primero hacer login y obtener token
$credentials = @{
    correo = "admin@sistema.com"
    contraseña = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -Body $credentials -ContentType "application/json"
$token = $response.access_token

# Listar usuarios
Invoke-RestMethod -Uri "http://localhost:3000/usuarios" -Method GET -Headers @{Authorization="Bearer $token"}
```
