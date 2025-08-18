import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';

import { Chat, Message } from './schemas';
import { User } from '../users/schemas';
import { CreateMessageDto } from './dtos';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async findOrCreateChat(currentUser: User, receiverId: string) {
    let chat = await this.chatModel
      .findOne({ type: 'private', 'participants.user': { $all: [currentUser.id, receiverId] } })
      .populate({ path: 'participants.user', select: 'fullname' });

    if (!chat) {
      const chatModel = new this.chatModel({
        participants: [
          { user: currentUser.id, unreadCount: 0 },
          { user: receiverId, unreadCount: 0 },
        ],
        type: 'private',
      });
      chat = await chatModel.save();
      await chat.populate({ path: 'participants.user', select: 'fullname' });
    }
    return this.plainChat(currentUser, chat);
  }

  async getChatMessages(chatId: string) {
    return await this.messageModel.find({ chat: chatId }).populate({ path: 'sender', select: { fullname: 1 } });
  }

  async sendMessage(chatId: string, messageDto: CreateMessageDto, sender: User) {
    const chat = await this.chatModel.findById(chatId);

    if (!chat) throw new NotFoundException(`Chat id ${chatId} not found`);

    const { content } = messageDto;

    const newMessage = new this.messageModel({
      sender: sender.id,
      chat: chat.id,
      content,
    });

    await newMessage.save();

    await this.messageModel.populate(newMessage, { path: 'sender', select: 'fullname' });

    const updateQuery: UpdateQuery<Chat> = {
      $inc: { 'participants.$[item].unreadCount': 1 },
      hasMessages: true,
      lastMessage: {
        content: newMessage.content,
        sender: newMessage.sender,
        sentAt: newMessage.sentAt,
        senderName: sender.fullname,
      },
    };

    const createdChat = await this.chatModel
      .findByIdAndUpdate(chatId, updateQuery, { arrayFilters: [{ 'item.user': { $ne: sender.id } }], new: true })
      .populate({ path: 'participants.user', select: 'fullname' });

    return {
      message: newMessage,
      chatForOthers: createdChat.participants
        .filter(({ user }) => String(user._id) !== sender.id)
        .map(({ user }) => ({
          toUser: String(user._id),
          payload: {
            chat: this.plainChat(user, createdChat),
            message: newMessage,
          },
        })),
    };
  }

  async getChatsByUser(user: User) {
    const chats = await this.chatModel
      .find({ 'participants.user': user.id, hasMessages: true })
      .populate({ path: 'participants.user', select: 'fullname' })
      .sort({ 'lastMessage.sentAt': 'desc' });

    return chats.map((chat) => this.plainChat(user, chat));
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
