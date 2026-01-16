const { execSync } = require('child_process');
const os = require('os');

console.log('🚀 Instalando fuentes para gráficos de Chart.js...');

const platform = os.platform();

try {
  if (platform === 'linux') {
    console.log('📦 Detectado sistema Linux. Instalando fuentes...');

    // Actualizar repositorios
    try {
      execSync('apt-get update', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  No se pudo actualizar apt. Intentando continuar...');
    }

    // Instalar fuentes básicas
    try {
      execSync('apt-get install -y fonts-liberation fonts-dejavu-core', { stdio: 'inherit' });
      console.log('✅ Fuentes básicas instaladas');
    } catch (error) {
      console.log('⚠️  No se pudieron instalar fuentes básicas:', error.message);
    }

    // Instalar fuentes Microsoft (Arial)
    try {
      // Aceptar licencia automáticamente
      execSync('echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections', { stdio: 'inherit' });

      execSync('apt-get install -y ttf-mscorefonts-installer', { stdio: 'inherit' });
      console.log('✅ Fuentes Microsoft (Arial) instaladas');
    } catch (error) {
      console.log('⚠️  No se pudieron instalar fuentes Microsoft:', error.message);
    }

    // Actualizar cache de fuentes
    try {
      execSync('fc-cache -f -v', { stdio: 'inherit' });
      console.log('✅ Cache de fuentes actualizado');
    } catch (error) {
      console.log('⚠️  No se pudo actualizar cache de fuentes:', error.message);
    }

    // Verificar instalación
    try {
      const result = execSync('fc-list | grep -i arial | head -3', { encoding: 'utf8' });
      if (result.trim()) {
        console.log('✅ Fuentes Arial encontradas:', result.trim());
      } else {
        console.log('⚠️  No se encontraron fuentes Arial');
      }
    } catch (error) {
      console.log('⚠️  No se pudo verificar instalación de fuentes');
    }

  } else if (platform === 'darwin') {
    console.log('🍎 Detectado macOS. Las fuentes deberían estar disponibles por defecto.');
  } else if (platform === 'win32') {
    console.log('🪟 Detectado Windows. Las fuentes Arial deberían estar disponibles por defecto.');
  } else {
    console.log(`⚠️  Plataforma no reconocida: ${platform}. Instalación de fuentes omitida.`);
  }

  console.log('🎉 Instalación de fuentes completada!');

} catch (error) {
  console.error('❌ Error durante la instalación de fuentes:', error.message);
  console.log('ℹ️  Los gráficos podrían mostrar caracteres incorrectos, pero la aplicación seguirá funcionando.');
  process.exit(0); // No fallar el build por esto
}