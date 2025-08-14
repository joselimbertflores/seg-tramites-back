import { Injectable, NotFoundException } from '@nestjs/common';
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
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getChatsByUser(user: User) {
    const chats = await this.chatModel
      .find({ 'participants.user': user.id })
      .populate({ path: 'participants.user', select: 'fullname' });

    return chats.map((chat) => this.plainChat(user, chat));
  }

  async getmessages(chatId: string) {
    return await this.messageModel.find({ chat: chatId }).populate({ path: 'sender', select: { fullname: 1 } });
  }

  async getChatByUser(user: User, receiverId: string) {
    const receiver = await this.userModel.findById(receiverId).select({ fullname: 1 });
    if (!receiver) {
      throw new NotFoundException(`Receiver with id ${receiverId} not found`);
    }
    const chat = await this.chatModel.findOne({
      'participants.user': { $all: [user.id, receiverId] },
      type: 'private',
    });
    return { name: receiver.fullname, id: chat ? chat.id : null };
  }

  async startChat(user: User, chatDto: StartChatDto) {
    const { receiverId, chatId, content } = chatDto;

    let chatDb: Chat = chatId
      ? await this.chatModel.findById(chatId)
      : await this.chatModel.findOne({ 'participants.user': { $all: [user.id, receiverId] } });

    console.log(chatDb);

    if (!chatDb) {
      const chatModel = new this.chatModel({
        participants: [
          { user: user._id, unreadCount: 0 },
          { user: receiverId, unreadCount: 1 },
        ],
        type: 'private',
        lastMessage: {
          text: content,
          sender: user._id,
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

  private plainChat(currentUser: User, chat: Chat) {
    const { participants, ...props } = chat.toObject();

    const me = participants.find(({ user }) => String(user._id) === currentUser.id);
    let name = '';
    if (props.type === 'private') {
      name = participants.find(({ user }) => String(user._id) !== currentUser.id)?.user.fullname ?? 'Unknow';
    } else {
      name = props?.name ?? 'Unknow group';
    }
    return { ...props, name, unreadCount: me?.unreadCount ?? 0 };
  }
}
