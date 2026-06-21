const http = require('http');
const endpoints = [
  { path: '/dashboard', method: 'GET' },
  { path: '/products', method: 'GET' },
  { path: '/categories', method: 'GET' },
  { path: '/orders', method: 'GET' },
  { path: '/branches', method: 'GET' },
  { path: '/inventory', method: 'GET' },
  { path: '/reports/sales', method: 'GET' }
];

function request(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('Checking port 3000...');
  try {
    const res = await request('/dashboard', 'GET');
    console.log('/dashboard', res.status, res.body.slice(0, 500));
  } catch (err) {
    console.error('/dashboard ERROR', err.message);
    process.exit(1);
  }

  for (const endpoint of endpoints) {
    try {
      const res = await request(endpoint.path, endpoint.method);
      console.log(endpoint.path, res.status, res.body.slice(0, 300));
    } catch (err) {
      console.error(endpoint.path, 'ERROR', err.message);
    }
  }
})();