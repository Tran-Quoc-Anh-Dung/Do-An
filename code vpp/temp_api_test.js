const http = require('http');
const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
const loginOpts = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = http.request(loginOpts, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('LOGIN', res.statusCode, body);
    if (res.statusCode !== 200) return;
    let token;
    try {
      token = JSON.parse(body).token;
    } catch (err) {
      console.error('TOKEN_PARSE_ERROR', err.message);
      return;
    }
    const userOpts = {
      hostname: 'localhost',
      port: 3000,
      path: '/users',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token }
    };
    const userReq = http.request(userOpts, userRes => {
      let userBody = '';
      userRes.on('data', chunk => userBody += chunk);
      userRes.on('end', () => {
        console.log('USERS', userRes.statusCode, userBody);
      });
    });
    userReq.on('error', err => console.error('USERS_ERROR', err.message));
    userReq.end();
  });
});
loginReq.on('error', err => console.error('LOGIN_ERROR', err.message));
loginReq.write(loginData);
loginReq.end();
