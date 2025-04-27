/**
 * Message entity
 *
 * Represents a message in the system
 */
export class Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  tenantId: string;
  timestamp: Date;
  metadata?: Record<string, any>;

  private constructor(props: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    tenantId: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }) {
    this.id = props.id;
    this.conversationId = props.conversationId;
    this.senderId = props.senderId;
    this.content = props.content;
    this.tenantId = props.tenantId;
    this.timestamp = props.timestamp;
    this.metadata = props.metadata;
  }

  /**
   * Creates a new Message instance
   */
  static create(props: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    tenantId: string;
    metadata?: Record<string, any>;
  }): Message {
    return new Message({
      ...props,
      timestamp: new Date(),
    });
  }

  /**
   * Updates the content of the message
   */
  updateContent(content: string): void {
    this.content = content;
  }

  /**
   * Updates the metadata of the message
   */
  updateMetadata(metadata: Record<string, any>): void {
    this.metadata = {
      ...this.metadata,
      ...metadata,
    };
  }

  /**
   * Creates a Message instance from database record
   */
  static fromDatabase(data: any): Message {
    return new Message({
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      tenantId: data.tenantId,
      timestamp: data.timestamp,
      metadata: data.metadata,
    });
  }

  /**
   * Converts the Message to a database record
   */
  toDatabase(): any {
    return {
      id: this.id,
      conversationId: this.conversationId,
      senderId: this.senderId,
      content: this.content,
      tenantId: this.tenantId,
      timestamp: this.timestamp,
      metadata: this.metadata,
    };
  }
}
