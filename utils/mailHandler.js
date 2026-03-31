const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "745e7f8d23ce25",
        pass: "65e47f3866764b",
    },
});

module.exports = {
    sendMail: async (to,url) => {
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "request resetpassword email",
            text: "click vao day de reset", // Plain-text version of the message
            html: "click vao <a href="+url+">day</a> de reset", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendPasswordMail: async (to, password) => {
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "Your New Account Password",
            text: `Welcome! Your new account password is: ${password}`, // Plain-text version of the message
            html: `Welcome! Your new account password is: <b>${password}</b><br/>Please login and change your password.`, // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    }
}