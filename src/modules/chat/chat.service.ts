import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Chat, Message } from './schemas';
import { User } from '../users/schemas';
import { StartChatDto } from './dtos';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async startChat(user: User, chatDto: StartChatDto) {
    const participantIds = [user.id, chatDto.receiverId];

    const { receiverId, chatId, content } = chatDto;

    let chatDb: Chat = chatId
      ? await this.chatModel.findById(chatId)
      : await this.chatModel.findOne({ 'participants.user': { $all: participantIds } });

    if (!chatDb) {
      const chatModel = new this.chatModel({
        participants: [
          { user: user.id, unreadCount: 0 },
          { user: receiverId, unreadCount: 1 },
        ],
        lastMessage: {
          text: content,
          sender: user.id,
          createdAt: new Date(),
        },
      });
      chatDb = await chatModel.save();
    } else {
      await this.chatModel.updateOne(
        { _id: chatDb._id },
        {
          lastMessage: { text: content, sender: user.id, createdAt: new Date() },
          $inc: { 'participants.$[elem].unreadCount': 1 },
        },
        { arrayFilters: [{ 'elem.user': receiverId }] },
      );
    }

    const messageModel = new this.messageModel({
      chat: chatDb.id,
      sender: user.id,
      content: chatDto.content,
    });

    return messageModel.save();
  }

  async getChats(user: User) {
    return await this.chatModel.find({ 'participants.user': user.id }).sort({ 'lastMessage.createdAt': -1 });
  }
}
