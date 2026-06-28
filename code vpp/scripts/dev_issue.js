(async () => {
  try {
    const payload = { orderNumber: 'ORD-1782287598231-497' };
    const res = await fetch('http://localhost:3000/dev/gtgt-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('Status', res.status);
    console.log(text);
  } catch (e) {
    console.error('Error', e);
  }
})();
