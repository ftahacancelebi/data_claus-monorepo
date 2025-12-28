const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to add use_modular_headers! to Podfile
 * Required for RecaptchaEnterprise Swift pod
 */
const withRecaptchaPodfile = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');
        
        // Add use_modular_headers! after platform line if not already present
        if (!podfileContent.includes('use_modular_headers!')) {
          // Find the line with platform :ios and add use_modular_headers! after it
          podfileContent = podfileContent.replace(
            /(platform :ios.*\n)/,
            '$1\nuse_modular_headers!\n'
          );
          
          fs.writeFileSync(podfilePath, podfileContent);
          console.log('[RecaptchaPodfile] Added use_modular_headers! to Podfile');
        }
      }
      
      return config;
    },
  ]);
};

module.exports = withRecaptchaPodfile;
