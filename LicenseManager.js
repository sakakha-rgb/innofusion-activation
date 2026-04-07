class LicenseManager {
  constructor() {
    // Set the Vercel endpoint for activation
    this.apiEndpoint = 'https://innofusion-activation.vercel.app/api';
    console.log('LicenseManager initialized');
  }

  // Method to generate a hardware ID
  async getHardwareId() {
    const info = navigator.userAgent + screen.width + screen.height;
    let hash = 0;
    for (let i = 0; i < info.length; i++) {
      const char = info.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
    }
    return 'HW-' + Math.abs(hash).toString(16).toUpperCase();
  }

  // Validate license format
  validateFormat(key) {
    return /^INNO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
  }

  // Activate the license by sending a request to the Vercel API
  async activateLicense(key, hardwareId) {
    try {
      const response = await fetch(this.apiEndpoint + '/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: key,
          hardwareId: hardwareId,
        }),
      });

      const data = await response.json();
      if (response.status === 200) {
        alert('Activation Successful!');
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error during activation:', error);
    }
  }
}