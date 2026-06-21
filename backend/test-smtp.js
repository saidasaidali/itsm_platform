import nodemailer from 'nodemailer';

console.log("START");

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,

  auth: {
    user: 'saidalisaida92@gmail.com',
    pass: 'tvvi zxsz ycsn szcm'
  },

  logger: true,
  debug: true,

  tls: {
    rejectUnauthorized: false
  }
});

console.log("BEFORE VERIFY");

transporter.verify()
  .then(() => {
    console.log("SMTP OK");
  })
  .catch(err => {
    console.error("SMTP ERROR:", err);
  });

console.log("AFTER VERIFY CALLED");