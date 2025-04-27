import { Message } from './message.entity';

describe('Message Entity', () => {
  it('should create a new message with the given properties', () => {
    // Arrange
    const id = '123';
    const conversationId = '456';
    const senderId = '789';
    const content = 'Hello, world!';
    const tenantId = 'tenant-1';
    const metadata = { important: true };

    // Act
    const message = Message.create({
      id,
      conversationId,
      senderId,
      content,
      tenantId,
      metadata,
    });

    // Assert
    expect(message.id).toBe(id);
    expect(message.conversationId).toBe(conversationId);
    expect(message.senderId).toBe(senderId);
    expect(message.content).toBe(content);
    expect(message.tenantId).toBe(tenantId);
    expect(message.metadata).toEqual(metadata);
    expect(message.timestamp).toBeInstanceOf(Date);
  });

  it('should update message content', () => {
    // Arrange
    const message = Message.create({
      id: '123',
      conversationId: '456',
      senderId: '789',
      content: 'Original content',
      tenantId: 'tenant-1',
    });
    const newContent = 'Updated content';

    // Act
    message.updateContent(newContent);

    // Assert
    expect(message.content).toBe(newContent);
  });

  it('should update message metadata', () => {
    // Arrange
    const message = Message.create({
      id: '123',
      conversationId: '456',
      senderId: '789',
      content: 'Hello',
      tenantId: 'tenant-1',
      metadata: { important: true },
    });
    const additionalMetadata = { pinned: true, category: 'general' };

    // Act
    message.updateMetadata(additionalMetadata);

    // Assert
    expect(message.metadata).toEqual({
      important: true,
      pinned: true,
      category: 'general',
    });
  });

  it('should create message from database record', () => {
    // Arrange
    const dbRecord = {
      id: '123',
      conversationId: '456',
      senderId: '789',
      content: 'Hello from DB',
      tenantId: 'tenant-1',
      timestamp: new Date('2023-01-01T12:00:00Z'),
      metadata: { source: 'database' },
    };

    // Act
    const message = Message.fromDatabase(dbRecord);

    // Assert
    expect(message).toBeInstanceOf(Message);
    expect(message.id).toBe(dbRecord.id);
    expect(message.conversationId).toBe(dbRecord.conversationId);
    expect(message.senderId).toBe(dbRecord.senderId);
    expect(message.content).toBe(dbRecord.content);
    expect(message.tenantId).toBe(dbRecord.tenantId);
    expect(message.timestamp).toEqual(dbRecord.timestamp);
    expect(message.metadata).toEqual(dbRecord.metadata);
  });

  it('should convert message to database record', () => {
    // Arrange
    const id = '123';
    const conversationId = '456';
    const senderId = '789';
    const content = 'Hello, world!';
    const tenantId = 'tenant-1';
    const timestamp = new Date('2023-01-01T12:00:00Z');
    const metadata = { important: true };

    const message = Message.create({
      id,
      conversationId,
      senderId,
      content,
      tenantId,
      metadata,
    });
    // Override timestamp for predictable test
    message.timestamp = timestamp;

    // Act
    const dbRecord = message.toDatabase();

    // Assert
    expect(dbRecord).toEqual({
      id,
      conversationId,
      senderId,
      content,
      tenantId,
      timestamp,
      metadata,
    });
  });
});
