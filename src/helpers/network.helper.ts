import axios from 'axios';
import os from 'os';

export const getIPAddress = (): string => {
  const interfaces = os.networkInterfaces();
  for (const iface in interfaces) {
    const ifaceInfo = interfaces[iface];
    if (ifaceInfo) {
      for (const alias of ifaceInfo) {
        if (alias.family === 'IPv4' && !alias.internal && alias.address.startsWith('192.168')) {
          return alias.address;
        }
      }
    }
  }
  return '127.0.0.1';
};

export const isOnline = async (): Promise<boolean> => {
  try {
    await axios.get('https://www.google.com', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
};
