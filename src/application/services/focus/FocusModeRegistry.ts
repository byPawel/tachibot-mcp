/**
 * FocusModeRegistry - Registry pattern for Focus modes
 * Follows Open/Closed Principle - add new modes without modifying this class
 */

import { IFocusMode } from '../../../domain/interfaces/IFocusMode.js';

export class FocusModeRegistry {
  private readonly modes = new Map<string, IFocusMode>();

  /**
   * Register a focus mode
   * @param mode Mode implementation to register
   */
  register(mode: IFocusMode): void {
    this.modes.set(mode.modeName, mode);
  }

  /**
   * Get a focus mode by name
   * @param name Mode name
   * @returns Mode implementation or undefined
   */
  get(name: string): IFocusMode | undefined {
    return this.modes.get(name);
  }

  /**
   * Get all registered mode names
   * @returns Array of mode names
   */
  getAllNames(): string[] {
    return Array.from(this.modes.keys());
  }

  /**
   * Check if a mode is registered
   * @param name Mode name
   * @returns true if mode exists
   */
  has(name: string): boolean {
    return this.modes.has(name);
  }

  /**
   * Get count of registered modes
   * @returns Number of modes
   */
  get size(): number {
    return this.modes.size;
  }
}
