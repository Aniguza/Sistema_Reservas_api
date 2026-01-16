const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🚀 Configurando fuentes para gráficos de Chart.js...');

const platform = os.platform();
const fontsDir = path.join(__dirname, '..', 'fonts');

try {
  // Verificar si existe el directorio de fuentes
  if (!fs.existsSync(fontsDir)) {
    console.log('📁 Creando directorio fonts...');
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  // Buscar fuentes disponibles en el directorio fonts/
  const fontFiles = fs.readdirSync(fontsDir).filter(file => file.endsWith('.ttf') || file.endsWith('.otf'));

  if (fontFiles.length > 0) {
    console.log(`📄 Fuentes encontradas en /fonts: ${fontFiles.join(', ')}`);

    // Intentar registrar las fuentes con Canvas
    try {
      const { registerFont } = require('canvas');

      fontFiles.forEach(fontFile => {
        const fontPath = path.join(fontsDir, fontFile);
        const fontName = path.parse(fontFile).name;

        try {
          registerFont(fontPath, { family: fontName });
          console.log(`✅ Fuente registrada: ${fontName} (${fontFile})`);
        } catch (error) {
          console.log(`⚠️  No se pudo registrar ${fontFile}:`, error.message);
        }
      });
    } catch (error) {
      console.log('⚠️  Canvas no disponible para registro de fuentes:', error.message);
    }
  } else {
    console.log('⚠️  No se encontraron fuentes en el directorio /fonts');
    console.log('ℹ️  Para mejores gráficos, agrega archivos .ttf al directorio fonts/');
  }

  // En Linux, intentar instalar fuentes del sistema como fallback
  if (platform === 'linux') {
    console.log('🐧 Detectado Linux. Instalando fuentes del sistema como fallback...');

    const { execSync } = require('child_process');

    try {
      execSync('apt-get update && apt-get install -y fonts-liberation fonts-dejavu-core', { stdio: 'inherit' });
      console.log('✅ Fuentes del sistema instaladas');
    } catch (error) {
      console.log('⚠️  No se pudieron instalar fuentes del sistema:', error.message);
    }

    try {
      execSync('fc-cache -f -v', { stdio: 'inherit' });
      console.log('✅ Cache de fuentes actualizado');
    } catch (error) {
      console.log('⚠️  No se pudo actualizar cache de fuentes');
    }
  }

  console.log('🎉 Configuración de fuentes completada!');

} catch (error) {
  console.error('❌ Error durante la configuración de fuentes:', error.message);
  console.log('ℹ️  Los gráficos podrían mostrar caracteres incorrectos, pero la aplicación seguirá funcionando.');
  process.exit(0); // No fallar el build por esto
}