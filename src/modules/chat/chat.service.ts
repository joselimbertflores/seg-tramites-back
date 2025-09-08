import {
  Injectable,
  HttpException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, UpdateQuery } from 'mongoose';

import { FilesService } from '../files/files.service';
import { FileGroup } from '../files/file-group.enum';
import { Account } from '../administration/schemas';
import { PaginationDto } from '../common';
import { CreateMessageDto } from './dtos';
import { Chat, Message } from './schemas';
import { User } from '../users/schemas';
@Injectable()
export class ChatService {
  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    private fileService: FilesService,
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

  async getAccountChat(currentUser: User, accounId: string) {
    const account = await this.accountModel.findById(accounId);
    if (!account) throw new BadRequestException(`La cuenta no existe`);
    return await this.findOrCreateChat(currentUser, String(account.user._id));
  }

  async getChats(user: User) {
    const chats = await this.chatModel
      .find({ 'participants.user': user.id, hasMessages: true })
      .populate({ path: 'participants.user', select: 'fullname' })
      .sort({ lastActivity: 'desc' });

    return chats.map((chat) => this.plainChat(user, chat));
  }

  async getChatMessages(chatId: string, currentUser: User, paginationDto: PaginationDto) {
    const { limit, offset } = paginationDto;

    const chat = await this.chatModel.findById(chatId, { participants: 1 });

    if (!chat) throw new NotFoundException(`Chat id ${chatId} not found`);

    const messages = await this.messageModel
      .find({ chat: chatId })
      .populate({ path: 'sender', select: { fullname: 1 } })
      .limit(limit)
      .skip(offset)
      .sort({ sentAt: 'desc' });

    return messages.map((message) => this.plainMessage(message, chat, currentUser)).reverse();
  }

  async sendMessage(chatId: string, messageDto: CreateMessageDto, sender: User) {
    const chat = await this.chatModel.findById(chatId);

    if (!chat) throw new NotFoundException(`Chat id ${chatId} not found`);

    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const newMessage = new this.messageModel({
        chat: chat.id,
        sender: sender.id,
        readBy: [sender.id],
        ...messageDto,
      });

      newMessage.save({ session });

      await this.messageModel.populate(newMessage, { path: 'sender', select: 'fullname', options: { session } });

      const updateQuery: UpdateQuery<Chat> = {
        $inc: { 'participants.$[item].unreadCount': 1 },
        hasMessages: true,
        lastActivity: newMessage.sentAt,
        lastMessage: {
          ref: newMessage._id,
          sender: newMessage.sender,
          sentAt: newMessage.sentAt,
          senderName: sender.fullname,
          isRead: false,
          type: newMessage.type,
          content: newMessage.type === 'text' ? newMessage.content : newMessage.media.originalName ?? '',
        },
      };

      const createdChat = await this.chatModel
        .findByIdAndUpdate(chatId, updateQuery, {
          arrayFilters: [{ 'item.user': { $ne: sender.id } }],
          new: true,
          session,
        })
        .populate({ path: 'participants.user', select: 'fullname' });

      await session.commitTransaction();

      const plainMessage = this.plainMessage(newMessage, chat, sender);

      return {
        chatForMe: {
          chat: this.plainChat(sender, createdChat),
          message: plainMessage,
        },
        chatForOthers: createdChat.participants
          .filter(({ user }) => String(user._id) !== sender.id)
          .map(({ user }) => ({
            toUser: String(user._id),
            payload: {
              chat: this.plainChat(user, createdChat),
              message: plainMessage,
            },
          })),
      };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error send message');
    } finally {
      await session.endSession();
    }
  }

  async markChatAsRead(chatId: string, user: User) {
    const chat = await this.chatModel.findById(chatId);

    if (!chat) throw new NotFoundException(`Chat ${chatId} not found`);

    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      // * Mark messages as read and insert readers in array
      await this.messageModel.updateMany(
        {
          chat: chatId,
          sender: { $ne: user.id },
          readBy: { $ne: user.id },
        },
        { $addToSet: { readBy: user.id } },
        { session },
      );

      // * After update chats, populate ref for get updated readBy
      await this.chatModel.populate<{ 'lastMessage.ref': Message }>(chat, {
        path: 'lastMessage.ref',
        select: 'readBy',
        options: { session },
      });

      let isLastMessageRead = false;

      if (chat.lastMessage) {
        const lastMessageRef = chat.lastMessage.ref;
        const readerIds = lastMessageRef['readBy'] as Types.ObjectId[];
        isLastMessageRead = readerIds.length === chat.participants.length;
      }

      const updateChatQuery: UpdateQuery<Chat> = {
        $set: {
          'participants.$[item].unreadCount': 0,
          ...(chat.lastMessage && { 'lastMessage.isRead': isLastMessageRead }),
        },
      };

      await this.chatModel.updateOne({ _id: chatId }, updateChatQuery, { arrayFilters: [{ 'item.user': user.id }] });

      await session.commitTransaction();

      return {
        message: 'Chat marked as read successfully',
        participantId: chat.participants.map(({ user }) => String(user._id)).filter((id) => id !== user.id),
      };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error send message');
    } finally {
      await session.endSession();
    }
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

  private plainMessage(message: Message, chat: Chat, user: User) {
    const { participants } = chat;
    const isMine = String(message.sender._id) === user.id;
    const isRead = isMine ? participants.length === message.readBy.length : true;
    const { media, ...messageProps } = message.toObject();
    return {
      ...messageProps,
      ...(media && {
        media: {
          originalName: media.originalName,
          fileName: this.fileService.buildFileUrl(media.fileName, FileGroup.CHATS),
          type: media.type,
        },
      }),
      isRead,
    };
  }
}
