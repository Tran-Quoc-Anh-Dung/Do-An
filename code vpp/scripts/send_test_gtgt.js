(async () => {
  try {
    const payload = {
      orderNumber: 'ORD-1782287598231-497',
      customerName: 'KH Test',
      customerPhone: '0356985246',
      customerEmail: 'test@example.com',
      customerCompany: 'ABC Co',
      customerTaxCode: '123456789'
    };
    const res = await fetch('http://localhost:3000/gtgt-requests', {
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
