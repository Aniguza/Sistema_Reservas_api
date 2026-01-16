# Instalación de Fuentes para Gráficos Chart.js en Railway

## Problema
Los gráficos generados con `chartjs-node-canvas` mostraban "cuadritos" (caracteres inválidos) en lugar de texto legible en producción debido a que faltaban las fuentes Arial en el servidor Linux.

## Solución
Se implementaron dos métodos para instalar las fuentes Arial en Railway:

### Método 1: Archivo nixpacks.toml (Recomendado)
Railway usa Nixpacks para construir automáticamente las aplicaciones Node.js. El archivo `nixpacks.toml` configura las dependencias del sistema.

**Archivo creado:** `nixpacks.toml`
```toml
[phases.setup]
nixPkgs = ["fontconfig", "freetype", "libpng", "libjpeg", "giflib", "librsvg", "pango", "cairo", "gdk-pixbuf"]

[phases.install]
cmds = [
  "apt-get update && apt-get install -y fonts-liberation fonts-dejavu-core ttf-mscorefonts-installer",
  "echo 'ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true' | debconf-set-selections",
  "fc-cache -f -v",
  "fc-list | grep -i arial || echo 'Advertencia: Fuentes Arial no encontradas'"
]

[start]
cmd = "npm start"
```

### Método 2: Script de postinstall
Se agregó un script que se ejecuta automáticamente después de `npm install`.

**Modificación en package.json:**
```json
{
  "scripts": {
    "postinstall": "node scripts/install-fonts.js"
  }
}
```

**Archivo creado:** `scripts/install-fonts.js`
- Detecta automáticamente el sistema operativo
- Instala fuentes Arial en Linux
- Maneja errores gracefully sin detener el deployment

## Cómo funciona en Railway

1. **Build automático**: Railway detecta el archivo `nixpacks.toml` y usa Nixpacks
2. **Instalación de dependencias**: Se instalan las librerías necesarias para gráficos
3. **Instalación de fuentes**: Se descargan e instalan las fuentes Microsoft (Arial)
4. **Cache de fuentes**: Se actualiza el cache de Fontconfig
5. **Verificación**: Se verifica que Arial esté disponible

## Verificación

Después del deployment, puedes verificar que las fuentes se instalaron correctamente revisando los logs de Railway durante el build. Deberías ver:

```
✅ Fuentes básicas instaladas
✅ Fuentes Microsoft (Arial) instaladas
✅ Cache de fuentes actualizado
✅ Fuentes Arial encontradas: /usr/share/fonts/truetype/msttcorefonts/arial.ttf: Arial:style=Regular
```

## Testing

Una vez desplegado, prueba descargar el Excel del dashboard. Los gráficos deberían mostrar texto legible sin cuadritos.

## Troubleshooting

Si aún aparecen cuadritos después del deployment:

1. **Revisa los logs de Railway** durante el build para ver si hubo errores en la instalación de fuentes
2. **Verifica que el deployment usó Nixpacks** (no un Dockerfile personalizado)
3. **Prueba hacer un redeploy** forzando un rebuild completo

## Desarrollo local

En desarrollo local (Windows/macOS), las fuentes Arial ya están disponibles por defecto, por lo que no se requiere instalación adicional.