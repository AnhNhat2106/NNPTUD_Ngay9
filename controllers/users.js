let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let bcrypt = require('bcrypt');
let exceljs = require('exceljs');
let crypto = require('crypto');
let mailHandler = require('../utils/mailHandler');
let fs = require('fs');

module.exports = {
    CreateAnUser: async function (username, password, email, role,session,
        fullName, avatarUrl, status, loginCount
    ) {
        let newUser = new userModel({
            username: username,
            password: password,
            email: email,
            fullName: fullName,
            avatarUrl: avatarUrl,
            status: status,
            role: role,
            loginCount: loginCount
        })
        await newUser.save({session});
        return newUser;
    },
    FindUserByUsername: async function (username) {
        return await userModel.findOne({
            isDeleted: false,
            username: username
        })
    }, FindUserByEmail: async function (email) {
        return await userModel.findOne({
            isDeleted: false,
            email: email
        })
    },
    FindUserByToken: async function (token) {
        let result =  await userModel.findOne({
            isDeleted: false,
            forgotPasswordToken: token
        })
        if(result.forgotPasswordTokenExp>Date.now()){
            return result;
        }
        return false
    },
    CompareLogin: async function (user, password) {
        if (bcrypt.compareSync(password, user.password)) {
            user.loginCount = 0;
            await user.save()
            return user;
        }
        user.loginCount++;
        if (user.loginCount == 3) {
            user.lockTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
            user.loginCount = 0;
        }
        await user.save()
        return false;
    },
    GetUserById: async function (id) {
        try {
            let user = await userModel.findOne({
                _id: id,
                isDeleted: false
            }).populate('role')
            return user;
        } catch (error) {
            return false;
        }
    },
    ImportUsersExcel: async function (filePath) {
        try {
            // Validate that we have the role "user"
            let userRole = await roleModel.findOne({ name: 'user', isDeleted: false });
            if (!userRole) {
                // If not found, try finding "USER" or create it
                userRole = await roleModel.findOne({ name: /^user$/i, isDeleted: false });
                if (!userRole) {
                    // Auto-create the user role if it doesn't exist in the database yet
                    userRole = new roleModel({ name: 'user', description: 'Default user role' });
                    await userRole.save();
                }
            }

            const workbook = new exceljs.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0]; // Get the first sheet

            let importedUsers = [];
            let errors = [];
            let rowsToProcess = [];

            // Iterate over all rows that have values in a worksheet
            worksheet.eachRow(function(row, rowNumber) {
                // Skip the header row
                if (rowNumber === 1) return;
                rowsToProcess.push({ row, rowNumber });
            });

            for (let data of rowsToProcess) {
                let row = data.row;
                let rowNumber = data.rowNumber;

                let username = row.getCell(1).value;
                let email = row.getCell(2).value;
                
                let extractString = (val) => {
                    if (!val) return '';
                    if (typeof val !== 'object') return String(val).trim();
                    if (val.result) return String(val.result).trim();
                    if (val.text) return String(val.text).trim();
                    if (val.hyperlink) return String(val.text || val.hyperlink).trim();
                    if (val.richText) return val.richText.map(rt => rt.text).join('').trim();
                    return String(val).trim();
                };

                username = extractString(username);
                email = extractString(email).toLowerCase();

                if (!username || !email) continue;

                // Check if user already exists
                let existingUser = await userModel.findOne({ $or: [{ username }, { email }] });
                if (existingUser) {
                    errors.push(`Row ${rowNumber}: User ${username} or email ${email} already exists.`);
                    continue; // Skip this user
                }

                // Generate random 16-character password
                let generatedPassword = crypto.randomBytes(8).toString('hex'); // 8 bytes -> 16 hex chars

                // Create user
                let newUser = new userModel({
                    username: username,
                    password: generatedPassword,
                    email: email,
                    role: userRole._id
                });
                
                await newUser.save();
                importedUsers.push(username);

                // Send email
                try {
                    await mailHandler.sendPasswordMail(email, generatedPassword);
                    // Delay 1 giây để lách luật giới hạn chống spam của Mailtrap miễn phí
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (mailErr) {
                    errors.push(`Gửi mail cho ${email} thất bại: ${mailErr.message}`);
                }
            }

            // Clean up the uploaded file
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cleanupErr) {
                console.log("Could not delete temp file:", cleanupErr.message);
            }

            return {
                success: true,
                message: "Import finished.",
                importedCount: importedUsers.length,
                importedUsers: importedUsers,
                errors: errors,
                debugTotalRowsFound: rowsToProcess.length,
                debugRowsRawData: rowsToProcess.map(d => ({ r: d.rowNumber, values: d.row.values }))
            };

        } catch (err) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw err;
        }
    }
}