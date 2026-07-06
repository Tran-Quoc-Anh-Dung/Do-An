(async () => {
  const nodemailer = require('nodemailer');
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });

    const orderNumber = 'ORD-1782287598231-497';
    const toEmail = 'test@example.com';
    const origin = 'http://localhost:3000';
    const invoiceUrl = `${origin}/gtgt_invoice.html?orderNumber=${encodeURIComponent(orderNumber)}`;
    const info = await transporter.sendMail({
      from: `Test <${testAccount.user}>`,
      to: toEmail,
      subject: `Hóa đơn GTGT - ${orderNumber}`,
      text: `Xem hóa đơn: ${invoiceUrl}`,
      html: `<p>Xem hóa đơn: <a href="${invoiceUrl}">${invoiceUrl}</a></p>`
    });
    console.log('MessageId:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  } catch (e) {
    console.error(e);
  }
})();
