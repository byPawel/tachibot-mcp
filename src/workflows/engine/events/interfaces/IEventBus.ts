/**
 * Event Bus Interface
 * Defines contract for pub/sub event system
 */

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface IEventBus {
  /**
   * Subscribe to an event topic
   * @param topic Event topic name
   * @param handler Event handler function
   * @returns Unsubscribe function
   */
  subscribe<T = any>(topic: string, handler: EventHandler<T>): () => void;

  /**
   * Publish event to topic
   * @param topic Event topic name
   * @param data Event data
   */
  publish<T = any>(topic: string, data: T): Promise<void>;

  /**
   * Remove all listeners for a topic
   * @param topic Event topic name
   */
  clear(topic: string): void;

  /**
   * Remove all listeners for all topics
   */
  clearAll(): void;

  /**
   * Get count of listeners for a topic
   * @param topic Event topic name
   */
  listenerCount(topic: string): number;
}
