import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Type definition for MessageDocument combining MessageModel with Mongoose Document
 */
export type MessageDocument = MessageModel & Document;

/**
 * Mongoose schema for message data
 *
 * Represents a message within a conversation in a multi-tenant system
 *
 * @remarks
 * This schema includes indexes for efficient querying and searching,
 * including compound indexes for conversation-based queries and full-text search.
 */
@Schema({
  timestamps: true,
  collection: 'messages',
})
export class MessageModel {
  /**
   * Unique identifier for the message
   * @example "msg_123456789"
   */
  @Prop({ required: true, index: true })
  id: string;

  /**
   * Identifier of the conversation this message belongs to
   * @example "conv_987654321"
   */
  @Prop({ required: true, index: true })
  conversationId: string;

  /**
   * Identifier of the user who sent the message
   * @example "user_12345"
   */
  @Prop({ required: true })
  senderId: string;

  /**
   * Text content of the message
   */
  @Prop({ required: true })
  content: string;

  /**
   * Timestamp when the message was sent
   */
  @Prop({ required: true, index: true })
  timestamp: Date;

  /**
   * Identifier of the tenant this message belongs to
   * @example "tenant_54321"
   */
  @Prop({ required: true, index: true })
  tenantId: string;

  /**
   * Optional metadata associated with the message
   * Can contain additional properties like attachments, read status, etc.
   */
  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

// Create the schema from the class
export const MessageSchema = SchemaFactory.createForClass(MessageModel);

// Create compound indexes for efficient queries
MessageSchema.index({ conversationId: 1, timestamp: -1 });
MessageSchema.index({ content: 'text' });
MessageSchema.index({ tenantId: 1, conversationId: 1 });
