const Message = require('../schemas/messages');
const mongoose = require('mongoose');

module.exports = {
  // Lấy toàn bộ message giữa 2 user
  getMessagesBetweenUsers: async (userId1, userId2) => {
    return await Message.find({
      $or: [
        { from: userId1, to: userId2 },
        { from: userId2, to: userId1 }
      ]
    }).sort({ createdAt: 1 }).populate('from', 'username avatarUrl').populate('to', 'username avatarUrl');
  },

  // Tạo message mới
  createMessage: async (from, to, type, text) => {
    const newMessage = new Message({
      from,
      to,
      messageContent: { type, text }
    });
    return await newMessage.save();
  },

  // Lấy tin nhắn cuối cùng với mỗi đối tác chat (recent chats)
  getRecentChats: async (userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const recentMessages = await Message.aggregate([
      // 1. Tìm tất cả tin nhắn mình gửi hoặc nhận
      {
        $match: {
          $or: [{ from: userObjectId }, { to: userObjectId }]
        }
      },
      // 2. Sắp xếp giảm dần theo thời gian tạo tin nhắn.
      {
        $sort: { createdAt: -1 }
      },
      // 3. Gom nhóm theo đối tác chat (người còn lại)
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$from", userObjectId] },
              "$to", // Nếu mình là người gửi, gom nhóm bằng ID người nhận
              "$from" // Nếu mình là người nhận, gom nhóm bằng ID người gửi
            ]
          },
          lastMessage: { $first: "$$ROOT" } // Lấy message cuối cùng sau khi sort
        }
      },
      // 4. Từ đối tác chat, lookup lấy thông tin user để hiển thị avatar, tên
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "partner"
        }
      },
      {
        $unwind: {
          path: "$partner",
          preserveNullAndEmptyArrays: true
        }
      },
      // 5. Ẩn thông tin nhạy cảm của partner
      {
        $project: {
          "partner.password": 0,
          "partner.role": 0,
          "partner.lockTime": 0,
          "partner.isDeleted": 0,
          "partner.forgotPasswordToken": 0,
          "partner.forgotPasswordTokenExp": 0
        }
      },
      // 6. Sau khi gom nhóm xong, sort tiếp để đưa đoạn hội thoại mới lên đầu
      {
        $sort: { "lastMessage.createdAt": -1 }
      }
    ]);

    return recentMessages;
  }
};
