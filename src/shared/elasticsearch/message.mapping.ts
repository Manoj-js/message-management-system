/**
 * Elasticsearch mapping for chat message documents.
 * Defines the field types and analysis settings for message data storage and retrieval.
 *
 * @type {Object} Elasticsearch mapping configuration
 * @property {Object} properties Field definitions for the message document
 * @property {Object} properties.id Unique message identifier
 * @property {Object} properties.conversationId Conversation grouping identifier
 * @property {Object} properties.senderId User or system identifier who sent the message
 * @property {Object} properties.content Main message text content with multiple analysis options
 * @property {Object} properties.timestamp Message creation time
 * @property {Object} properties.tenantId Multi-tenancy identifier
 * @property {Object} properties.metadata Additional contextual information for the message
 */
export const messageMapping = {
  properties: {
    id: { type: 'keyword' },
    conversationId: { type: 'keyword' },
    senderId: { type: 'keyword' },
    content: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: { type: 'keyword' },
        ngram: {
          type: 'text',
          analyzer: 'ngram_analyzer',
        },
      },
    },
    timestamp: { type: 'date' },
    tenantId: { type: 'keyword' },
    metadata: { type: 'object', enabled: true },
  },
};

/**
 * Elasticsearch index settings for message documents.
 * Configures analysis settings including custom analyzers and filters.
 *
 * @type {Object} Elasticsearch index settings
 * @property {Object} analysis Text analysis configuration for search capabilities
 * @property {Object} analysis.analyzer Custom analyzers for text processing
 * @property {Object} analysis.analyzer.ngram_analyzer Custom analyzer for partial matching
 * @property {Object} analysis.filter Custom token filters for text processing
 * @property {Object} analysis.filter.ngram_filter N-gram filter for substring matching
 * @property {Object} index Index-level settings
 * @property {number} index.max_ngram_diff Maximum allowed difference between min_gram and max_gram
 */
export const messageSettings = {
  analysis: {
    analyzer: {
      ngram_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'ngram_filter'],
      },
    },
    filter: {
      ngram_filter: {
        type: 'ngram',
        min_gram: 2,
        max_gram: 15,
      },
    },
  },
  index: {
    max_ngram_diff: 15,
  },
};
