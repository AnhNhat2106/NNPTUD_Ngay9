var express = require("express");
var router = express.Router();
let messageController = require('../controllers/messages');
let { CheckLogin } = require('../utils/authHandler');
let { uploadImage } = require('../utils/uploadHandler');

// 1. GET "/" - Lấy message cuối cùng của mỗi đoạn hội thoại liên quan đến user hiện tại
// Lưu ý: Đặt route này ở trên GET '/:userID' để Express không hiểu "/" là một userID
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let recentChats = await messageController.getRecentChats(currentUserId);
        res.send({
            success: true,
            data: recentChats
        });
    } catch (err) {
        res.status(400).send({ success: false, message: err.message });
    }
});

// 2. GET "/:userID" - Lấy toàn bộ thông tin trao đổi 2 chiều giữa 2 người
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let targetUserId = req.params.userID;

        let messages = await messageController.getMessagesBetweenUsers(currentUserId, targetUserId);
        res.send({
            success: true,
            data: messages
        });
    } catch (err) {
        res.status(400).send({ success: false, message: err.message });
    }
});

// 3. POST "/" - Lưu lại nội dung
router.post('/', CheckLogin, uploadImage.single('file'), async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let { to, text } = req.body;
        
        if (!to) {
            return res.status(400).send({ success: false, message: "Trường 'to' (người nhận) không được để trống" });
        }

        let type = "text";
        let messageText = text || "";

        // Nếu có upload gửi kèm file ảnh thì đường dẫn file nằm trong req.file
        if (req.file) {
            type = "file";
            messageText = req.file.path || req.file.filename;
        } else {
            // Trường hợp không có file
            if (!messageText) {
                return res.status(400).send({ success: false, message: "Phải nhập nội dung tin nhắn hoặc đính kèm một file" });
            }
        }

        let newMessage = await messageController.createMessage(currentUserId, to, type, messageText);
        res.send({
            success: true,
            data: newMessage
        });
    } catch (err) {
        res.status(400).send({ success: false, message: err.message });
    }
});

module.exports = router;
