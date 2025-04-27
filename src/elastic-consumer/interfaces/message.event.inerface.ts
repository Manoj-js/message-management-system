import { Message } from '../../message/entities/message.entity';

/**
 * Event types for message-related events
 */
export enum MessageEventType {
  CREATED = 'message.created',
  UPDATED = 'message.updated',
  DELETED = 'message.deleted',
}

/**
 * Structure of message events received from Kafka
 */
export interface MessageEvent {
  /** Type of the message event */
  type: MessageEventType;
  /** Payload containing message data */
  payload: Message;
  /** Timestamp when the event was created */
  timestamp?: string;
  /** Version of the event schema */
  version?: string;
}
