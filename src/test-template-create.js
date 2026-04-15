import axios from 'axios';
import { config } from './config.js';

const apiKey = config.instawp.apiKey;
const url = 'https://app.instawp.io/api/v2/sites/template';

console.log('Testing InstaWP site creation with snapshot_slug: waas-template-zero-click\n');

const body = {
  snapshot_slug: 'waas-template-zero-click',
  site_name: `test-${Date.now()}`,
  is_shared: false,
  is_reserved: true,
};

console.log('Request:', JSON.stringify(body, null, 2));

try {
  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  console.log('\nSUCCESS:', JSON.stringify(res.data, null, 2));
} catch (err) {
  console.log(`\nFAILED: ${err.response?.status} - ${err.response?.data?.message}`);
  console.log('Response:', JSON.stringify(err.response?.data, null, 2));
}
