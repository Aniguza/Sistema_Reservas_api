# Fuentes para Gráficos Chart.js

## Problema
Los gráficos generados en producción mostraban "cuadritos" (caracteres inválidos) en lugar de texto legible porque faltaban las fuentes apropiadas.

## Solución: Fuentes Embebidas
En lugar de depender de las fuentes del sistema operativo (que no están disponibles en Railway), ahora el proyecto incluye sus propias fuentes Lato.

## Fuentes Disponibles
El proyecto ya incluye fuentes **Lato** completas en `src/fonts/`:
- `Lato-Regular.ttf` (Regular)
- `Lato-Bold.ttf` (Bold)
- `Lato-Italic.ttf` (Italic)
- `Lato-BoldItalic.ttf` (Bold Italic)
- `Lato-Light.ttf`, `Lato-Black.ttf`, etc.

**Chart.js está configurado para usar `Lato` automáticamente.**

## ¿Quieres usar Arial en su lugar?

### Opción 1: Descargar Arial (Recomendado)
Si tienes una licencia válida de Microsoft Office o Windows:

1. **En Windows**: Copia los archivos `.ttf` de Arial desde `C:\Windows\Fonts\`
   - `arial.ttf` (Arial Regular)
   - `arialbd.ttf` (Arial Bold)
   - `ariali.ttf` (Arial Italic)
   - `arialbi.ttf` (Arial Bold Italic)

2. **Pégalos en esta carpeta** (`fonts/`)

### Opción 2: Usar fuentes libres similares
Si no tienes Arial, puedes usar estas alternativas gratuitas:

#### Liberation Sans (muy similar a Arial):
```bash
# Descargar desde terminal
curl -L -o arial.ttf "https://github.com/liberationfonts/liberation-fonts/releases/download/2.1.5/liberation-fonts-ttf-2.1.5.tar.gz"
tar -xzf liberation-fonts-ttf-2.1.5.tar.gz
cp liberation-fonts-ttf-2.1.5/LiberationSans-Regular.ttf ./arial.ttf
```

#### Arimo (de Google Fonts, muy similar):
```bash
curl -L -o arial.ttf "https://github.com/google/fonts/raw/main/apache/arimo/Arimo-Regular.ttf"
curl -L -o arialbd.ttf "https://github.com/google/fonts/raw/main/apache/arimo/Arimo-Bold.ttf"
```

## Nombres de archivo recomendados
- `arial.ttf` → Arial Regular
- `arialbd.ttf` → Arial Bold
- `ariali.ttf` → Arial Italic
- `arialbi.ttf` → Arial Bold Italic

## Cómo funciona

1. **Build time**: El script `scripts/install-fonts.js` registra automáticamente todas las fuentes `.ttf` del directorio `fonts/`
2. **Runtime**: Chart.js usa estas fuentes embebidas en lugar de las del sistema
3. **Producción**: Las fuentes viajan con el código, no dependen del servidor

## Verificación

Después de agregar las fuentes y redeployar:

1. **Logs de Railway** deberían mostrar:
   ```
   ✅ Fuente registrada: arial (arial.ttf)
   ✅ Fuente registrada: arialbd (arialbd.ttf)
   ```

2. **Excel descargado** debería mostrar texto legible en los gráficos

## Troubleshooting

- **¿Los gráficos siguen mostrando cuadritos?**
  - Verifica que los archivos `.ttf` sean válidos
  - Asegúrate de que tengan permisos de lectura
  - Revisa los logs por errores de registro de fuentes

- **¿Las fuentes no se registran?**
  - El directorio `fonts/` debe estar en la raíz del proyecto
  - Los archivos deben tener extensión `.ttf` o `.otf`
  - El script `install-fonts.js` se ejecuta automáticamente en `npm install`

## Licencias

- **Arial**: Propiedad de Microsoft, requiere licencia válida
- **Liberation Sans**: SIL Open Font License (gratuito)
- **Arimo**: Apache License 2.0 (gratuito)